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

export async function createRole(name: string, description: string, permissions: string[]) {
  const { supabase, userId, companyId } = await getContext()
  const { error } = await supabase.rpc('create_company_role', {
    p_caller_id:   userId,
    p_company_id:  companyId,
    p_name:        name.trim(),
    p_description: description.trim(),
    p_permissions: permissions,
  })
  if (error) throw new Error(error.message)
  revalidatePath('/sistema/roles')
}

export async function updateRolePermissions(roleId: string, permissions: string[]) {
  const { supabase, userId, companyId } = await getContext()
  const { error } = await supabase.rpc('update_role_permissions', {
    p_caller_id:   userId,
    p_company_id:  companyId,
    p_role_id:     roleId,
    p_permissions: permissions,
  })
  if (error) throw new Error(error.message)
  revalidatePath('/sistema/roles')
}

export async function deleteRole(roleId: string) {
  const { supabase, userId, companyId } = await getContext()
  const { error } = await supabase.rpc('delete_company_role', {
    p_caller_id:  userId,
    p_company_id: companyId,
    p_role_id:    roleId,
  })
  if (error) throw new Error(error.message)
  revalidatePath('/sistema/roles')
}
