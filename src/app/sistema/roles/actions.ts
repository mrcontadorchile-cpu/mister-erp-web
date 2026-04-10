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

export async function createRole(name: string, description: string, permissions: string[]): Promise<ActionResult> {
  const ctx = await getContext()
  if (!ctx) return { ok: false, error: 'No autenticado' }

  const { error } = await ctx.supabase.rpc('create_company_role', {
    p_caller_id:   ctx.userId,
    p_company_id:  ctx.companyId,
    p_name:        name.trim(),
    p_description: description.trim(),
    p_permissions: permissions,
  })
  if (error) return { ok: false, error: error.message }
  revalidatePath('/sistema/roles')
  return { ok: true }
}

export async function updateRolePermissions(roleId: string, permissions: string[]): Promise<ActionResult> {
  const ctx = await getContext()
  if (!ctx) return { ok: false, error: 'No autenticado' }

  const { error } = await ctx.supabase.rpc('update_role_permissions', {
    p_caller_id:   ctx.userId,
    p_company_id:  ctx.companyId,
    p_role_id:     roleId,
    p_permissions: permissions,
  })
  if (error) return { ok: false, error: error.message }
  revalidatePath('/sistema/roles')
  return { ok: true }
}

export async function deleteRole(roleId: string): Promise<ActionResult> {
  const ctx = await getContext()
  if (!ctx) return { ok: false, error: 'No autenticado' }

  const { error } = await ctx.supabase.rpc('delete_company_role', {
    p_caller_id:  ctx.userId,
    p_company_id: ctx.companyId,
    p_role_id:    roleId,
  })
  if (error) return { ok: false, error: error.message }
  revalidatePath('/sistema/roles')
  return { ok: true }
}
