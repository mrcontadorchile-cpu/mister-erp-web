import { createClient } from '@/lib/supabase/server'
import { AuxiliaresClient } from './AuxiliaresClient'

export default async function AuxiliaresPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('user_profiles').select('company_id').eq('id', user!.id).single()

  const { data: items } = await supabase
    .schema('conta')
    .from('auxiliaries')
    .select('id, code, name, rut, type, active')
    .eq('company_id', profile?.company_id)
    .order('type')
    .order('name')

  return <AuxiliaresClient items={(items ?? []) as any} />
}
