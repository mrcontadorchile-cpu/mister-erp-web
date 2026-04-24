import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { listBudgets } from './actions'
import { PresupuestosClient } from './PresupuestosClient'

export default async function PresupuestosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('user_profiles').select('company_id').eq('id', user!.id).single()
  const companyId = profile?.company_id as string

  const [budgets, permsData] = await Promise.all([
    listBudgets(),
    supabase.rpc('get_user_permissions', { p_user_id: user!.id, p_company_id: companyId }),
  ])
  const perms: string[] = (permsData.data as string[] | null) ?? []
  const canApprove = perms.includes('*') || perms.includes('gestion.approve')

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Presupuestos</h1>
          <p className="text-text-secondary text-sm mt-1">
            {budgets.length} presupuesto{budgets.length !== 1 ? 's' : ''} registrado{budgets.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Link href="/gestion/presupuestos/nuevo" className="btn-primary flex items-center gap-2 text-sm px-4 py-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nuevo Presupuesto
        </Link>
      </div>

      <PresupuestosClient budgets={budgets} userId={user!.id} canApprove={canApprove} />
    </div>
  )
}
