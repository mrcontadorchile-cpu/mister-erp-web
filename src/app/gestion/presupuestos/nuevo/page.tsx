import { createClient } from '@/lib/supabase/server'
import type { Account, CostCenter } from '@/types/database'
import { NuevoPresupuestoForm } from './NuevoPresupuestoForm'

export default async function NuevoPresupuestoPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('user_profiles').select('company_id').eq('id', user!.id).single()

  const [accsRes, ccRes] = await Promise.all([
    supabase.schema('conta').from('accounts')
      .select('id, code, name, type, nature')
      .eq('company_id', profile?.company_id)
      .eq('allows_entry', true)
      .eq('active', true)
      .in('type', ['INGRESO', 'EGRESO', 'COSTO'])
      .order('code'),
    supabase.schema('conta').from('cost_centers')
      .select('id, code, name')
      .eq('company_id', profile?.company_id)
      .eq('active', true)
      .order('code'),
  ])

  return (
    <NuevoPresupuestoForm
      accounts={(accsRes.data ?? []) as Pick<Account, 'id' | 'code' | 'name' | 'type' | 'nature'>[]}
      costCenters={(ccRes.data ?? []) as Pick<CostCenter, 'id' | 'code' | 'name'>[]}
    />
  )
}
