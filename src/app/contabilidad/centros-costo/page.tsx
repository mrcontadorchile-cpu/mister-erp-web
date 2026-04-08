import { createClient } from '@/lib/supabase/server'
import type { CostCenter } from '@/types/database'
import { CentrosCostoClient } from './CentrosCostoClient'

export default async function CentrosCostoPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('user_profiles').select('company_id').eq('id', user!.id).single()

  const { data: items } = await supabase
    .schema('conta').from('cost_centers')
    .select('*')
    .eq('company_id', profile?.company_id)
    .order('code')

  return <CentrosCostoClient items={(items ?? []) as CostCenter[]} />
}
