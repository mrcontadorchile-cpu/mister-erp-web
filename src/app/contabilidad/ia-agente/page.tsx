import { createClient } from '@/lib/supabase/server'
import { IAgenteClient } from './IAgenteClient'
import type { ConfiguracionAsistente } from '@/types/database'

export const metadata = { title: 'Agente IA — Contabilidad' }

export default async function IAAgentePage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('company_id')
    .eq('id', user!.id)
    .single()

  const companyId = profile?.company_id as string

  const { data: config } = await supabase
    .schema('conta')
    .from('configuracion_asistente')
    .select('*')
    .eq('company_id', companyId)
    .maybeSingle()

  return <IAgenteClient config={config as ConfiguracionAsistente | null} />
}
