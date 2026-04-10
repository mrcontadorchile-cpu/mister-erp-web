'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function createCostCenter(data: { code: string; name: string }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('user_profiles').select('company_id').eq('id', user!.id).single()

  const { error } = await supabase.schema('conta').from('cost_centers').insert({
    company_id: profile!.company_id,
    code: data.code,
    name: data.name,
    active: true,
  })

  if (error) return { error: error.message }
  revalidatePath('/contabilidad/centros-costo')
  return { success: true }
}

export async function updateCostCenter(id: string, data: { code: string; name: string }) {
  const supabase = await createClient()
  const { error } = await supabase.schema('conta').from('cost_centers')
    .update({ code: data.code, name: data.name })
    .eq('id', id)

  if (error) return { error: error.message }
  revalidatePath('/contabilidad/centros-costo')
  return { success: true }
}

export async function toggleCostCenter(id: string, active: boolean) {
  const supabase = await createClient()
  const { error } = await supabase.schema('conta').from('cost_centers')
    .update({ active }).eq('id', id)

  if (error) return { error: error.message }
  revalidatePath('/contabilidad/centros-costo')
  return { success: true }
}
