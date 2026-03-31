import { createClient } from '@/lib/supabase/server'
import { ImportarSiiClient } from './ImportarSiiClient'

export default async function ImportarSiiPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('user_profiles').select('company_id').eq('id', user!.id).single()

  const { data: siiConfig } = await supabase
    .from('company_sii_configs')
    .select('sii_rut, sii_password')
    .eq('company_id', profile?.company_id)
    .maybeSingle()

  return (
    <ImportarSiiClient
      companyId={profile?.company_id ?? ''}
      savedRut={siiConfig?.sii_rut ?? ''}
      hasPassword={!!siiConfig?.sii_password}
    />
  )
}
