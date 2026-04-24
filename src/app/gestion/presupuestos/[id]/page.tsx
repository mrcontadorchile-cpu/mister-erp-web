import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import type { Account, CostCenter } from '@/types/database'
import { getBudget, getBudgetLines } from '../actions'
import { PresupuestoEditor } from './PresupuestoEditor'

export default async function PresupuestoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('user_profiles').select('company_id').eq('id', user!.id).single()

  const [budget, budgetLines, accsRes, ccRes] = await Promise.all([
    getBudget(id),
    getBudgetLines(id),
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

  if (!budget) notFound()

  return (
    <PresupuestoEditor
      budget={budget}
      budgetLines={budgetLines}
      accounts={(accsRes.data ?? []) as Pick<Account, 'id' | 'code' | 'name' | 'type' | 'nature'>[]}
      costCenters={(ccRes.data ?? []) as Pick<CostCenter, 'id' | 'code' | 'name'>[]}
    />
  )
}
