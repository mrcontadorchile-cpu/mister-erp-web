'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { hasPermission, PERMISSIONS } from '@/lib/permissions'

async function getAdminContext() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No autenticado')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('company_id')
    .eq('id', user.id)
    .single()
  if (!profile?.company_id) throw new Error('Sin empresa activa')

  // Use SECURITY DEFINER function to avoid RLS circular dependency
  const { data: permData } = await supabase
    .rpc('get_user_permissions', { p_user_id: user.id, p_company_id: profile.company_id })

  const perms: string[] = (permData as string[] | null) ?? []
  if (!hasPermission(perms, PERMISSIONS.SISTEMA_USUARIOS)) throw new Error('Sin permiso')

  return { supabase, userId: user.id, companyId: profile.company_id }
}

/** Change a user's role within the active company */
export async function changeUserRole(membershipId: string, roleId: string) {
  const { supabase } = await getAdminContext()
  const { error } = await supabase
    .from('user_company_memberships')
    .update({ role_id: roleId })
    .eq('id', membershipId)
  if (error) throw new Error(error.message)
  revalidatePath('/sistema/usuarios')
}

/** Suspend or reactivate a user */
export async function changeUserStatus(membershipId: string, status: 'active' | 'suspended') {
  const { supabase, userId } = await getAdminContext()
  // Cannot suspend yourself
  const { data: m } = await supabase
    .from('user_company_memberships')
    .select('user_id')
    .eq('id', membershipId)
    .single()
  if (m?.user_id === userId) throw new Error('No puedes suspender tu propia cuenta')

  const { error } = await supabase
    .from('user_company_memberships')
    .update({ status })
    .eq('id', membershipId)
  if (error) throw new Error(error.message)
  revalidatePath('/sistema/usuarios')
}

/** Invite a user by email to join the active company with a given role */
export async function inviteUserByEmail(email: string, roleId: string) {
  const { supabase, userId, companyId } = await getAdminContext()

  // Find if auth user exists with this email (admin only via service role)
  // Instead, look up user_profiles by querying auth.users via RPC or check if they exist
  // We'll use the public user_profiles table to find by full_name...
  // Actually we need to find by email. Let's use the admin API or a simpler approach:
  // Check if the user already has a profile we can match
  const { data: existing } = await supabase
    .from('user_company_memberships')
    .select('id, user_id')
    .eq('company_id', companyId)

  // We'll create a pending invitation record by searching user_profiles
  // Note: user_profiles.id = auth.users.id, but we can't query by email without service role
  // For now, store as an "invited" stub and match on first login
  // As a pragmatic approach: store invitation in a separate invitations table or
  // require the user to already exist. Let's search user_profiles by email via RPC.

  // Simplest working approach: use supabase admin to list users
  // We'll use a stored procedure approach — just insert with user lookup
  const { data: rpcResult, error: rpcError } = await supabase
    .rpc('find_user_by_email', { p_email: email })

  if (rpcError || !rpcResult) {
    throw new Error('Usuario no encontrado. Debe registrarse primero en el sistema.')
  }

  const targetUserId = rpcResult as string

  // Check not already a member
  const alreadyMember = existing?.some(m => m.user_id === targetUserId)
  if (alreadyMember) throw new Error('Este usuario ya es miembro de la empresa')

  const { error } = await supabase
    .from('user_company_memberships')
    .insert({
      user_id: targetUserId,
      company_id: companyId,
      role_id: roleId,
      status: 'active',
      invited_by: userId,
    })
  if (error) throw new Error(error.message)
  revalidatePath('/sistema/usuarios')
}
