import { createClient } from '@/lib/supabase/server'
import type { Account, CostCenter } from '@/types/database'
import { NuevoAsientoForm } from './NuevoAsientoForm'

export default async function NuevoAsientoPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('user_profiles').select('company_id').eq('id', user!.id).single()

  const [accsRes, ccRes, auxRes] = await Promise.all([
    supabase.schema('conta').from('accounts')
      .select('id, code, name, type, nature, cost_center_required, has_auxiliary')
      .eq('company_id', profile?.company_id)
      .eq('allows_entry', true)
      .eq('active', true)
      .order('code'),
    supabase.schema('conta').from('cost_centers')
      .select('id, code, name')
      .eq('company_id', profile?.company_id)
      .eq('active', true)
      .order('code'),
    supabase.schema('conta').from('auxiliaries')
      .select('id, code, name, type')
      .eq('company_id', profile?.company_id)
      .eq('active', true)
      .order('name'),
  ])

  return (
    <NuevoAsientoForm
      accounts={(accsRes.data ?? []) as (Pick<Account, 'id' | 'code' | 'name' | 'type' | 'nature' | 'cost_center_required'> & { has_auxiliary: boolean })[]}
      costCenters={(ccRes.data ?? []) as Pick<CostCenter, 'id' | 'code' | 'name'>[]}
      auxiliaries={(auxRes.data ?? []) as { id: string; code: string; name: string; type: string }[]}
    />
  )
}
