'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function createAccount(data: {
  code: string
  name: string
  type: string
  nature: string
  parent_id: string | null
  allows_entry:         boolean
  cost_center_required: boolean
  has_auxiliary:        boolean
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('user_profiles').select('company_id').eq('id', user!.id).single()

  let level = 1
  if (data.parent_id) {
    const { data: parent } = await supabase
      .schema('conta').from('accounts').select('level').eq('id', data.parent_id).single()
    level = (parent?.level ?? 0) + 1
  }

  const { error } = await supabase.schema('conta').from('accounts').insert({
    company_id: profile!.company_id,
    code: data.code,
    name: data.name,
    type: data.type,
    nature: data.nature,
    parent_id: data.parent_id || null,
    level,
    allows_entry:         data.allows_entry,
    cost_center_required: data.cost_center_required,
    has_auxiliary:        data.has_auxiliary,
    active: true,
  })

  if (error) return { error: error.message }
  revalidatePath('/contabilidad/plan-cuentas')
  return { success: true }
}

export async function updateAccount(id: string, data: {
  code: string
  name: string
  type: string
  nature: string
  allows_entry:         boolean
  cost_center_required: boolean
  has_auxiliary:        boolean
}) {
  const supabase = await createClient()
  const { error } = await supabase.schema('conta').from('accounts').update({
    code:                 data.code,
    name:                 data.name,
    type:                 data.type,
    nature:               data.nature,
    allows_entry:         data.allows_entry,
    cost_center_required: data.cost_center_required,
    has_auxiliary:        data.has_auxiliary,
  }).eq('id', id)

  if (error) return { error: error.message }
  revalidatePath('/contabilidad/plan-cuentas')
  return { success: true }
}

export async function toggleAccount(id: string, active: boolean) {
  const supabase = await createClient()
  const { error } = await supabase.schema('conta').from('accounts')
    .update({ active }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/contabilidad/plan-cuentas')
  return { success: true }
}
