'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

async function getContext() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('company_id')
    .eq('id', user.id)
    .single()
  if (!profile?.company_id) return null

  return { supabase, userId: user.id, companyId: profile.company_id as string }
}

type ActionResult = { ok: true } | { ok: false; error: string }

/** Change a user's role within the active company */
export async function changeUserRole(membershipId: string, roleId: string): Promise<ActionResult> {
  const ctx = await getContext()
  if (!ctx) return { ok: false, error: 'No autenticado' }

  const { error } = await ctx.supabase.rpc('update_member_role', {
    p_caller_id:     ctx.userId,
    p_company_id:    ctx.companyId,
    p_membership_id: membershipId,
    p_new_role_id:   roleId,
  })
  if (error) return { ok: false, error: error.message }
  revalidatePath('/sistema/usuarios')
  return { ok: true }
}

/** Suspend or reactivate a user */
export async function changeUserStatus(membershipId: string, status: 'active' | 'suspended'): Promise<ActionResult> {
  const ctx = await getContext()
  if (!ctx) return { ok: false, error: 'No autenticado' }

  const { error } = await ctx.supabase.rpc('update_member_status', {
    p_caller_id:     ctx.userId,
    p_company_id:    ctx.companyId,
    p_membership_id: membershipId,
    p_status:        status,
  })
  if (error) return { ok: false, error: error.message }
  revalidatePath('/sistema/usuarios')
  return { ok: true }
}

/**
 * Invite a user by email.
 * - If they already have an account → add them directly to the company.
 * - If they don't → send them an invite email via Supabase Auth Admin API.
 *   They'll receive a link to set their password and will be added to the company on first login.
 */
export async function inviteUserByEmail(email: string, roleId: string): Promise<ActionResult> {
  const ctx = await getContext()
  if (!ctx) return { ok: false, error: 'No autenticado' }

  // Verify caller has permission (via SECURITY DEFINER fn)
  const { data: perms } = await ctx.supabase
    .rpc('get_user_permissions', { p_user_id: ctx.userId, p_company_id: ctx.companyId })
  const permissions: string[] = (perms as string[] | null) ?? []
  if (!permissions.includes('*') && !permissions.includes('sistema.usuarios')) {
    return { ok: false, error: 'Sin permiso para invitar usuarios' }
  }

  // Verify role belongs to this company
  const { data: roleCheck } = await ctx.supabase
    .rpc('get_company_roles', { p_company_id: ctx.companyId })
  const validRole = (roleCheck as { id: string }[] | null)?.find(r => r.id === roleId)
  if (!validRole) return { ok: false, error: 'Rol inválido' }

  const admin = createAdminClient()
  const trimmedEmail = email.trim().toLowerCase()

  // Check if user already exists
  const { data: existing } = await admin.auth.admin.listUsers()
  const existingUser = existing?.users?.find(u => u.email?.toLowerCase() === trimmedEmail)

  if (existingUser) {
    // User already has an account → add directly to company
    const { error } = await ctx.supabase.rpc('add_company_member', {
      p_caller_id:  ctx.userId,
      p_company_id: ctx.companyId,
      p_target_uid: existingUser.id,
      p_role_id:    roleId,
    })
    if (error) return { ok: false, error: error.message }
    revalidatePath('/sistema/usuarios')
    return { ok: true }
  }

  // User doesn't exist → invite via Supabase Auth (sends email with password setup link)
  const redirectTo = `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://erp.mistercontador.cl'}/auth/callback?next=/`

  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(
    trimmedEmail,
    { redirectTo }
  )

  if (inviteError) return { ok: false, error: inviteError.message }
  if (!invited?.user) return { ok: false, error: 'No se pudo crear la invitación' }

  // Pre-create user_profiles row so the membership FK works
  await admin.from('user_profiles').upsert({
    id:         invited.user.id,
    full_name:  trimmedEmail.split('@')[0],
    role:       'user',
    company_id: null,
  }, { onConflict: 'id', ignoreDuplicates: true })

  // Create membership as 'invited' — activates in /auth/callback
  await admin.from('user_company_memberships').upsert({
    user_id:    invited.user.id,
    company_id: ctx.companyId,
    role_id:    roleId,
    status:     'invited',
    invited_by: ctx.userId,
  }, { onConflict: 'user_id,company_id' })

  revalidatePath('/sistema/usuarios')
  return { ok: true }
}
