import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { formatCLP } from '@/lib/utils'
import { listBudgets } from '../presupuestos/actions'

export default async function GestionDashboardPage() {
  const supabase  = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile }  = await supabase
    .from('user_profiles').select('company_id, companies(name)').eq('id', user!.id).single()
  const companyId   = profile?.company_id as string
  const companyName = (profile?.companies as unknown as { name: string } | null)?.name ?? ''

  const now     = new Date()
  const month   = now.getMonth() + 1

  const budgets = await listBudgets()
  const active  = budgets.filter(b => b.status === 'active')
  const draft   = budgets.filter(b => b.status === 'draft')

  // Para cada presupuesto activo, calcular % ejecución del mes actual
  const execData = await Promise.all(
    active.map(async b => {
      const { data } = await (supabase as any).schema('conta').rpc('get_budget_vs_actual', {
        p_company_id:     companyId,
        p_budget_id:      b.id,
        p_month_from:     1,
        p_month_to:       month,
        p_cost_center_id: null,
      })
      const rows = (data ?? []) as any[]
      const totalBudget = rows.reduce((s: number, r: any) => s + Number(r.budget_amount), 0)
      const totalReal   = rows.reduce((s: number, r: any) => {
        const real = r.account_nature === 'DEUDOR'
          ? Number(r.actual_debit) - Number(r.actual_credit)
          : Number(r.actual_credit) - Number(r.actual_debit)
        return s + real
      }, 0)
      const pct = totalBudget > 0 ? (totalReal / totalBudget) * 100 : 0
      return { ...b, totalBudget, totalReal, pct }
    })
  )

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text-primary">Gestión</h1>
        <p className="text-text-secondary text-sm mt-1">{companyName}</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
        <div className="card p-5">
          <div className="text-2xl mb-2">📊</div>
          <p className="text-2xl font-black text-primary">{budgets.length}</p>
          <p className="text-text-disabled text-xs mt-1">Presupuestos en total</p>
        </div>
        <div className="card p-5">
          <div className="text-2xl mb-2">✅</div>
          <p className="text-2xl font-black text-success">{active.length}</p>
          <p className="text-text-disabled text-xs mt-1">Presupuestos activos</p>
        </div>
        <div className="card p-5">
          <div className="text-2xl mb-2">📝</div>
          <p className="text-2xl font-black text-warning">{draft.length}</p>
          <p className="text-text-disabled text-xs mt-1">En borrador</p>
        </div>
      </div>

      {/* Presupuestos activos con ejecución */}
      {execData.length > 0 && (
        <div className="mb-10">
          <p className="text-[11px] font-semibold text-text-disabled tracking-wider uppercase mb-4">
            Ejecución Presupuestaria (Enero – {new Date(now.getFullYear(), month - 1, 1).toLocaleDateString('es-CL', { month: 'long' })})
          </p>
          <div className="space-y-4">
            {execData.map(b => {
              const pctClamped = Math.min(100, b.pct)
              const color = b.pct > 100 ? 'bg-error' : b.pct > 85 ? 'bg-warning' : 'bg-success'
              const textColor = b.pct > 100 ? 'text-error' : b.pct > 85 ? 'text-warning' : 'text-success'
              return (
                <div key={b.id} className="card p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-sm font-semibold text-text-primary">{b.name}</p>
                      <p className="text-xs text-text-disabled mt-0.5">Año Fiscal {b.fiscal_year}</p>
                    </div>
                    <div className="text-right">
                      <p className={`text-xl font-black ${textColor}`}>{b.pct.toFixed(1)}%</p>
                      <p className="text-xs text-text-disabled">ejecutado</p>
                    </div>
                  </div>
                  <div className="h-2.5 bg-surface-high rounded-full overflow-hidden mb-3">
                    <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pctClamped}%` }} />
                  </div>
                  <div className="flex items-center justify-between text-xs text-text-disabled">
                    <span>Real: <span className="text-info font-mono font-semibold">{formatCLP(b.totalReal)}</span></span>
                    <span>Presupuestado: <span className="font-mono font-semibold text-text-secondary">{formatCLP(b.totalBudget)}</span></span>
                    <Link href={`/gestion/control?budget_id=${b.id}`} className="text-primary hover:underline">
                      Ver detalle →
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Accesos rápidos */}
      <p className="text-[11px] font-semibold text-text-disabled tracking-wider uppercase mb-4">Accesos rápidos</p>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-8">
        <NavCard href="/gestion/presupuestos"       label="Presupuestos"         color="#FFD700" />
        <NavCard href="/gestion/presupuestos/nuevo" label="Nuevo Presupuesto"    color="#4CAF50" />
        <NavCard href="/gestion/control"            label="Control Presupuesto vs Real" color="#2196F3" />
      </div>

      {/* Link a Contabilidad */}
      <div className="card p-4 flex items-center gap-3 hover:border-primary/30 transition-colors">
        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 text-lg">📒</div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-text-primary">Datos reales desde Contabilidad</p>
          <p className="text-xs text-text-disabled mt-0.5">Los montos "real" provienen de asientos contabilizados</p>
        </div>
        <Link href="/contabilidad/dashboard" className="text-xs text-primary hover:underline shrink-0">
          Ir a Contabilidad →
        </Link>
      </div>
    </div>
  )
}

function NavCard({ href, label, color }: { href: string; label: string; color: string }) {
  return (
    <a
      href={href}
      className="card p-4 flex items-center gap-3 hover:border-primary/40 transition-colors group"
    >
      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
        style={{ backgroundColor: `${color}18` }}>
        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
      </div>
      <span className="text-sm text-text-secondary group-hover:text-text-primary transition-colors font-medium">
        {label}
      </span>
    </a>
  )
}
