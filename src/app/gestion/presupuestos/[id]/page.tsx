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
  const companyId = profile?.company_id as string

  const [budget, budgetLines, accsRes, ccRes, permsData] = await Promise.all([
    getBudget(id),
    getBudgetLines(id),
    supabase.schema('conta').from('accounts')
      .select('id, code, name, type, nature')
      .eq('company_id', companyId)
      .eq('allows_entry', true)
      .eq('active', true)
      .in('type', ['INGRESO', 'EGRESO', 'COSTO'])
      .order('code'),
    supabase.schema('conta').from('cost_centers')
      .select('id, code, name')
      .eq('company_id', companyId)
      .eq('active', true)
      .order('code'),
    supabase.rpc('get_user_permissions', { p_user_id: user!.id, p_company_id: companyId }),
  ])

  if (!budget) notFound()

  const perms: string[] = (permsData.data as string[] | null) ?? []
  const canApprove = perms.includes('*') || perms.includes('gestion.approve')

  return (
    <PresupuestoEditor
      budget={budget}
      budgetLines={budgetLines}
      accounts={(accsRes.data ?? []) as Pick<Account, 'id' | 'code' | 'name' | 'type' | 'nature'>[]}
      costCenters={(ccRes.data ?? []) as Pick<CostCenter, 'id' | 'code' | 'name'>[]}
      userId={user!.id}
      canApprove={canApprove}
    />
  )
}
