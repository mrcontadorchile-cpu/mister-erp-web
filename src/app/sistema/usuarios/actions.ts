'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

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

export async function inviteUserByEmail(email: string, roleId: string): Promise<ActionResult> {
  const ctx = await getContext()
  if (!ctx) return { ok: false, error: 'No autenticado' }

  const { data: targetUid, error: findError } = await ctx.supabase
    .rpc('find_user_by_email', { p_email: email })

  if (findError) return { ok: false, error: findError.message }
  if (!targetUid) return { ok: false, error: 'Usuario no encontrado. Debe registrarse primero en la plataforma.' }

  const { error } = await ctx.supabase.rpc('add_company_member', {
    p_caller_id:  ctx.userId,
    p_company_id: ctx.companyId,
    p_target_uid: targetUid,
    p_role_id:    roleId,
  })
  if (error) return { ok: false, error: error.message }
  revalidatePath('/sistema/usuarios')
  return { ok: true }
}
