'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function crearPeriodo(formData: FormData) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No autenticado')

  const { data: profile } = await supabase
    .from('user_profiles').select('company_id').eq('id', user.id).single()
  const companyId = profile?.company_id as string

  const year  = parseInt(formData.get('year')  as string, 10)
  const month = parseInt(formData.get('month') as string, 10)

  const { error } = await supabase.schema('remu').from('periodos_remuneracion').insert({
    company_id: companyId,
    year,
    month,
    estado: 'abierto',
  })

  if (error) throw new Error(error.message)

  revalidatePath('/remuneraciones/periodos')
  redirect('/remuneraciones/periodos')
}

export async function cerrarPeriodo(periodoId: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No autenticado')

  const { error } = await supabase.schema('remu').from('periodos_remuneracion').update({
    estado:      'cerrado',
    cerrado_at:  new Date().toISOString(),
    cerrado_por: user.id,
  }).eq('id', periodoId)

  if (error) throw new Error(error.message)

  revalidatePath('/remuneraciones/periodos')
}

export async function reabrirPeriodo(periodoId: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No autenticado')

  const { error } = await supabase.schema('remu').from('periodos_remuneracion').update({
    estado:      'abierto',
    cerrado_at:  null,
    cerrado_por: null,
  }).eq('id', periodoId)

  if (error) throw new Error(error.message)

  revalidatePath('/remuneraciones/periodos')
}
