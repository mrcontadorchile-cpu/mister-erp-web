'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function openPeriod(year: number, month: number) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('user_profiles').select('company_id').eq('id', user!.id).single()

  const { error } = await supabase.schema('conta').from('periods').insert({
    company_id: profile!.company_id,
    year,
    month,
    status: 'open',
  })

  if (error) return { error: error.message }
  revalidatePath('/contabilidad/periodos')
  return { success: true }
}

export async function closePeriod(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { error } = await supabase.schema('conta').from('periods').update({
    status: 'closed',
    closed_at: new Date().toISOString(),
    closed_by: user!.id,
  }).eq('id', id)

  if (error) return { error: error.message }
  revalidatePath('/contabilidad/periodos')
  return { success: true }
}

export async function reopenPeriod(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.schema('conta').from('periods').update({
    status: 'open',
    closed_at: null,
    closed_by: null,
  }).eq('id', id)

  if (error) return { error: error.message }
  revalidatePath('/contabilidad/periodos')
  return { success: true }
}
