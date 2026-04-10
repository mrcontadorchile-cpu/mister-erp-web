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
  if (!hasPermission(perms, PERMISSIONS.SISTEMA_ROLES)) throw new Error('Sin permiso')

  return { supabase, companyId: profile.company_id }
}

export async function createRole(name: string, description: string, permissions: string[]) {
  const { supabase, companyId } = await getAdminContext()
  const { error } = await supabase
    .from('erp_roles')
    .insert({ company_id: companyId, name: name.trim(), description: description.trim(), permissions, is_system: false })
  if (error) throw new Error(error.message)
  revalidatePath('/sistema/roles')
}

export async function updateRolePermissions(roleId: string, permissions: string[]) {
  const { supabase, companyId } = await getAdminContext()
  const { error } = await supabase
    .from('erp_roles')
    .update({ permissions })
    .eq('id', roleId)
    .eq('company_id', companyId)
    .eq('is_system', false) // cannot edit system roles
  if (error) throw new Error(error.message)
  revalidatePath('/sistema/roles')
}

export async function deleteRole(roleId: string) {
  const { supabase, companyId } = await getAdminContext()
  // Check no active members use this role
  const { count } = await supabase
    .from('user_company_memberships')
    .select('*', { count: 'exact', head: true })
    .eq('role_id', roleId)
    .eq('status', 'active')
  if (count && count > 0) throw new Error('No puedes eliminar un rol que tiene usuarios asignados')

  const { error } = await supabase
    .from('erp_roles')
    .delete()
    .eq('id', roleId)
    .eq('company_id', companyId)
    .eq('is_system', false)
  if (error) throw new Error(error.message)
  revalidatePath('/sistema/roles')
}
