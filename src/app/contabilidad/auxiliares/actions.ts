'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function createAuxiliary(data: {
  code: string
  name: string
  rut?: string
  type: string
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('user_profiles').select('company_id').eq('id', user!.id).single()

  const { error } = await supabase.schema('conta').from('auxiliaries').insert({
    company_id: profile!.company_id,
    code:       data.code.trim(),
    name:       data.name.trim(),
    rut:        data.rut?.trim() || null,
    type:       data.type,
  })

  if (error) return { error: error.message }
  revalidatePath('/contabilidad/auxiliares')
  return { success: true }
}

export async function updateAuxiliary(id: string, data: {
  code: string
  name: string
  rut?: string
  type: string
}) {
  const supabase = await createClient()
  const { error } = await supabase.schema('conta').from('auxiliaries').update({
    code: data.code.trim(),
    name: data.name.trim(),
    rut:  data.rut?.trim() || null,
    type: data.type,
  }).eq('id', id)

  if (error) return { error: error.message }
  revalidatePath('/contabilidad/auxiliares')
  return { success: true }
}

export async function toggleAuxiliary(id: string, active: boolean) {
  const supabase = await createClient()
  await supabase.schema('conta').from('auxiliaries').update({ active }).eq('id', id)
  revalidatePath('/contabilidad/auxiliares')
  return { success: true }
}
