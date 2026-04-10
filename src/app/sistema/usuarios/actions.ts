'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

async function getContext() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No autenticado')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('company_id')
    .eq('id', user.id)
    .single()
  if (!profile?.company_id) throw new Error('Sin empresa activa')

  return { supabase, userId: user.id, companyId: profile.company_id as string }
}

/** Change a user's role within the active company */
export async function changeUserRole(membershipId: string, roleId: string) {
  const { supabase, userId, companyId } = await getContext()
  const { error } = await supabase.rpc('update_member_role', {
    p_caller_id:     userId,
    p_company_id:    companyId,
    p_membership_id: membershipId,
    p_new_role_id:   roleId,
  })
  if (error) throw new Error(error.message)
  revalidatePath('/sistema/usuarios')
}

/** Suspend or reactivate a user */
export async function changeUserStatus(membershipId: string, status: 'active' | 'suspended') {
  const { supabase, userId, companyId } = await getContext()
  const { error } = await supabase.rpc('update_member_status', {
    p_caller_id:     userId,
    p_company_id:    companyId,
    p_membership_id: membershipId,
    p_status:        status,
  })
  if (error) throw new Error(error.message)
  revalidatePath('/sistema/usuarios')
}

/** Invite a user by email to join the active company with a given role */
export async function inviteUserByEmail(email: string, roleId: string) {
  const { supabase, userId, companyId } = await getContext()

  // Find user ID by email via SECURITY DEFINER function
  const { data: targetUid, error: findError } = await supabase
    .rpc('find_user_by_email', { p_email: email })

  if (findError) throw new Error(findError.message)
  if (!targetUid) throw new Error('Usuario no encontrado. Debe registrarse primero en el sistema.')

  const { error } = await supabase.rpc('add_company_member', {
    p_caller_id:  userId,
    p_company_id: companyId,
    p_target_uid: targetUid,
    p_role_id:    roleId,
  })
  if (error) throw new Error(error.message)
  revalidatePath('/sistema/usuarios')
}
