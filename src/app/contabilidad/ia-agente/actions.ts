'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { EntidadMapeo } from '@/types/database'

export interface ConfigIAInput {
  instrucciones_maestras: string
  umbral_autonomia: number
  auto_matching_nc: boolean
  mapeo_entidades: EntidadMapeo[]
}

export async function saveConfigIA(data: ConfigIAInput) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No autorizado')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('company_id')
    .eq('id', user.id)
    .single()

  if (!profile?.company_id) throw new Error('Sin empresa asociada')

  const { error } = await supabase
    .schema('conta')
    .from('configuracion_asistente')
    .upsert(
      {
        company_id:            profile.company_id,
        instrucciones_maestras: data.instrucciones_maestras,
        umbral_autonomia:      data.umbral_autonomia,
        auto_matching_nc:      data.auto_matching_nc,
        mapeo_entidades:       data.mapeo_entidades,
      },
      { onConflict: 'company_id' }
    )

  if (error) throw new Error(error.message)

  revalidatePath('/contabilidad/ia-agente')
}
