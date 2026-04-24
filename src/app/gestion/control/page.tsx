import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { formatCLP, monthName } from '@/lib/utils'
import { listBudgets } from '../presupuestos/actions'

interface VsRow {
  account_id:       string
  account_code:     string
  account_name:     string
  account_type:     string
  account_nature:   string
  cost_center_id:   string | null
  cost_center_code: string | null
  cost_center_name: string | null
  budget_amount:    number
  actual_debit:     number
  actual_credit:    number
}

const ACC_TYPE_ORDER = ['INGRESO', 'COSTO', 'EGRESO']
const ACC_TYPE_LABEL: Record<string, { label: string; color: string }> = {
  INGRESO: { label: 'Ingresos',      color: 'text-success'  },
  EGRESO:  { label: 'Gastos',        color: 'text-error'    },
  COSTO:   { label: 'Costo de Ventas', color: 'text-warning' },
}

export default async function ControlPresupuestarioPage({
  searchParams,
}: {
  searchParams: Promise<{
    budget_id?: string
    month_from?: string
    month_to?:   string
    cc_id?:      string
  }>
}) {
  const params   = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile }  = await supabase
    .from('user_profiles').select('company_id').eq('id', user!.id).single()
  const companyId = profile?.company_id as string

  const now       = new Date()
  const monthFrom = parseInt(params.month_from ?? '1')
  const monthTo   = parseInt(params.month_to   ?? String(now.getMonth() + 1))
  const ccFilter  = params.cc_id ?? ''

  // Cargar lista de presupuestos para el selector
  const budgets = await listBudgets()

  // Si no hay budget_id, usar el primero activo o el primero disponible
  const defaultBudget = budgets.find(b => b.status === 'active') ?? budgets[0]
  const budgetId = params.budget_id ?? defaultBudget?.id ?? ''

  const selectedBudget = budgets.find(b => b.id === budgetId)

  // Centros de costo
  const { data: ccs } = await supabase
    .schema('conta').from('cost_centers')
    .select('id, code, name')
    .eq('company_id', companyId)
    .eq('active', true)
    .order('code')
  const costCenters = (ccs ?? []) as { id: string; code: string; name: string }[]

  // Datos presupuesto vs real
  let rows: VsRow[] = []
  if (budgetId) {
    const { data, error } = await (supabase as any).schema('conta').rpc('get_budget_vs_actual', {
      p_company_id:     companyId,
      p_budget_id:      budgetId,
      p_month_from:     monthFrom,
      p_month_to:       monthTo,
      p_cost_center_id: ccFilter || null,
    })
    if (!error) rows = (data ?? []) as VsRow[]
  }

  // ── Calcular real por tipo de cuenta ─────────────────────────
  // Para cuentas INGRESO/PASIVO/PATRIMONIO (ACREEDOR): real = credit - debit
  // Para cuentas EGRESO/COSTO/ACTIVO (DEUDOR): real = debit - credit
  function actualAmount(row: VsRow) {
    return row.account_nature === 'DEUDOR'
      ? row.actual_debit - row.actual_credit
      : row.actual_credit - row.actual_debit
  }

  // ── Agrupar por tipo ─────────────────────────────────────────
  type GroupRow = VsRow & { real: number; variance: number; variance_pct: number; pct_exec: number }

  const grouped: Record<string, GroupRow[]> = {}
  for (const r of rows) {
    const real     = actualAmount(r)
    const variance = r.budget_amount - real
    const variance_pct = r.budget_amount > 0
      ? ((real - r.budget_amount) / r.budget_amount) * 100
      : (real > 0 ? 100 : 0)
    const pct_exec = r.budget_amount > 0
      ? Math.min(999, (real / r.budget_amount) * 100)
      : (real > 0 ? 100 : 0)

    const row: GroupRow = { ...r, real, variance, variance_pct, pct_exec }
    grouped[r.account_type] = [...(grouped[r.account_type] ?? []), row]
  }

  // ── Totales globales ─────────────────────────────────────────
  const totalBudget = rows.reduce((s, r) => s + r.budget_amount, 0)
  const totalReal   = rows.reduce((s, r) => s + actualAmount(r), 0)
  const totalVar    = totalBudget - totalReal
  const totalPct    = totalBudget > 0 ? (totalReal / totalBudget) * 100 : 0

  const periodoLabel = monthFrom === monthTo
    ? monthName(monthFrom)
    : `${monthName(monthFrom)} – ${monthName(monthTo)}`

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text-primary">Control Presupuestario</h1>
        <p className="text-text-secondary text-sm mt-1">
          Presupuesto vs Real · {periodoLabel} {selectedBudget ? `· ${selectedBudget.fiscal_year}` : ''}
        </p>
      </div>

      {/* Filtros */}
      <form className="card p-4 mb-6 flex flex-wrap gap-3 items-end">
        <div>
          <label className="text-xs text-text-disabled block mb-1">Presupuesto</label>
          <select name="budget_id" defaultValue={budgetId} className="input w-64 text-sm">
            <option value="">— Seleccionar —</option>
            {budgets.map(b => (
              <option key={b.id} value={b.id}>
                {b.name} ({b.fiscal_year}) [{b.status}]
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-text-disabled block mb-1">Desde</label>
          <select name="month_from" defaultValue={monthFrom} className="input w-36 text-sm">
            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
              <option key={m} value={m}>{monthName(m)}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-text-disabled block mb-1">Hasta</label>
          <select name="month_to" defaultValue={monthTo} className="input w-36 text-sm">
            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
              <option key={m} value={m}>{monthName(m)}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-text-disabled block mb-1">Centro de Costo</label>
          <select name="cc_id" defaultValue={ccFilter} className="input w-52 text-sm">
            <option value="">Todos los centros</option>
            {costCenters.map(c => (
              <option key={c.id} value={c.id}>{c.code} — {c.name}</option>
            ))}
          </select>
        </div>
        <button type="submit" className="btn-primary px-4 py-2 text-sm">Filtrar</button>
      </form>

      {/* Sin presupuesto seleccionado */}
      {!budgetId && (
        <div className="card p-12 text-center text-text-disabled">
          <p className="mb-2 font-medium">Selecciona un presupuesto para ver el control</p>
          <Link href="/gestion/presupuestos/nuevo" className="text-primary text-sm hover:underline">
            → Crear primer presupuesto
          </Link>
        </div>
      )}

      {/* Sin datos */}
      {budgetId && rows.length === 0 && (
        <div className="card p-12 text-center text-text-disabled">
          <p className="mb-1">Sin datos para este período</p>
          <p className="text-xs">El presupuesto no tiene líneas o no hay asientos contabilizados en este rango</p>
        </div>
      )}

      {/* KPIs globales */}
      {rows.length > 0 && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="card p-4">
              <p className="text-xs text-text-disabled mb-1">Total Presupuestado</p>
              <p className="text-xl font-black text-text-primary">{formatCLP(totalBudget)}</p>
            </div>
            <div className="card p-4">
              <p className="text-xs text-text-disabled mb-1">Real Ejecutado</p>
              <p className="text-xl font-black text-info">{formatCLP(totalReal)}</p>
            </div>
            <div className="card p-4">
              <p className="text-xs text-text-disabled mb-1">Varianza</p>
              <p className={`text-xl font-black ${totalVar >= 0 ? 'text-success' : 'text-error'}`}>
                {totalVar >= 0 ? '+' : ''}{formatCLP(totalVar)}
              </p>
            </div>
            <div className="card p-4">
              <p className="text-xs text-text-disabled mb-1">% Ejecución</p>
              <p className={`text-xl font-black ${totalPct > 100 ? 'text-error' : totalPct > 80 ? 'text-warning' : 'text-success'}`}>
                {totalPct.toFixed(1)}%
              </p>
              {/* Barra global */}
              <div className="mt-2 h-2 bg-surface-high rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${totalPct > 100 ? 'bg-error' : totalPct > 80 ? 'bg-warning' : 'bg-success'}`}
                  style={{ width: `${Math.min(100, totalPct)}%` }}
                />
              </div>
            </div>
          </div>

          {/* Tabla detallada por tipo */}
          {ACC_TYPE_ORDER.filter(t => grouped[t]?.length).map(type => {
            const typeRows = grouped[type] ?? []
            const typeBudget = typeRows.reduce((s, r) => s + r.budget_amount, 0)
            const typeReal   = typeRows.reduce((s, r) => s + r.real, 0)
            const typeVar    = typeBudget - typeReal
            const typePct    = typeBudget > 0 ? (typeReal / typeBudget) * 100 : 0
            const { label, color } = ACC_TYPE_LABEL[type] ?? { label: type, color: 'text-text-secondary' }

            return (
              <div key={type} className="mb-8">
                {/* Cabecera del grupo */}
                <div className="flex items-center justify-between mb-2">
                  <p className={`text-xs font-semibold uppercase tracking-wider ${color}`}>{label}</p>
                  <div className="flex items-center gap-6 text-xs text-text-disabled">
                    <span>Presup: <span className="font-mono font-semibold text-text-secondary">{formatCLP(typeBudget)}</span></span>
                    <span>Real: <span className="font-mono font-semibold text-info">{formatCLP(typeReal)}</span></span>
                    <span className={typePct > 100 ? 'text-error' : 'text-success'}>
                      {typePct.toFixed(1)}% ejecutado
                    </span>
                  </div>
                </div>

                <div className="card overflow-hidden overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="table-header">
                        <th className="px-4 py-3 text-left w-24">Código</th>
                        <th className="px-4 py-3 text-left">Cuenta</th>
                        <th className="px-4 py-3 text-left w-36">Centro Costo</th>
                        <th className="px-4 py-3 text-right w-32">Presupuesto</th>
                        <th className="px-4 py-3 text-right w-32">Real</th>
                        <th className="px-4 py-3 text-right w-32">Varianza</th>
                        <th className="px-4 py-3 text-right w-20">Var %</th>
                        <th className="px-4 py-3 w-36">Ejecución</th>
                      </tr>
                    </thead>
                    <tbody>
                      {typeRows.map((r, i) => {
                        const isOver = r.pct_exec > 100
                        const varColor = type === 'INGRESO'
                          ? (r.variance_pct >= 0 ? 'text-success' : 'text-error')
                          : (r.variance_pct <= 0 ? 'text-success' : 'text-error')

                        return (
                          <tr key={i} className="table-row">
                            <td className="px-4 py-3 font-mono text-xs text-text-disabled">{r.account_code}</td>
                            <td className="px-4 py-3 text-text-primary font-medium text-xs">{r.account_name}</td>
                            <td className="px-4 py-3 text-xs text-text-disabled">
                              {r.cost_center_code
                                ? <span className="bg-primary/10 text-primary px-1.5 py-0.5 rounded text-[10px] font-medium">{r.cost_center_code} — {r.cost_center_name}</span>
                                : <span className="text-text-disabled italic">General</span>
                              }
                            </td>
                            <td className="px-4 py-3 text-right font-mono text-xs">{formatCLP(r.budget_amount)}</td>
                            <td className="px-4 py-3 text-right font-mono text-xs text-info">{formatCLP(r.real)}</td>
                            <td className={`px-4 py-3 text-right font-mono text-xs font-semibold ${r.variance >= 0 ? 'text-success' : 'text-error'}`}>
                              {r.variance >= 0 ? '+' : ''}{formatCLP(r.variance)}
                            </td>
                            <td className={`px-4 py-3 text-right text-xs font-semibold ${varColor}`}>
                              {r.variance_pct >= 0 ? '+' : ''}{r.variance_pct.toFixed(1)}%
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <div className="flex-1 h-1.5 bg-surface-high rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full ${isOver ? 'bg-error' : r.pct_exec > 80 ? 'bg-warning' : 'bg-success'}`}
                                    style={{ width: `${Math.min(100, r.pct_exec)}%` }}
                                  />
                                </div>
                                <span className={`text-[10px] w-10 text-right font-mono ${isOver ? 'text-error' : 'text-text-disabled'}`}>
                                  {r.pct_exec.toFixed(0)}%
                                </span>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                    {/* Subtotal */}
                    <tfoot>
                      <tr className="bg-surface-high border-t-2 border-border font-bold">
                        <td colSpan={3} className="px-4 py-3 text-xs text-text-secondary uppercase">
                          Subtotal {label}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-xs">{formatCLP(typeBudget)}</td>
                        <td className="px-4 py-3 text-right font-mono text-xs text-info">{formatCLP(typeReal)}</td>
                        <td className={`px-4 py-3 text-right font-mono text-xs ${typeVar >= 0 ? 'text-success' : 'text-error'}`}>
                          {typeVar >= 0 ? '+' : ''}{formatCLP(typeVar)}
                        </td>
                        <td colSpan={2} className={`px-4 py-3 text-right text-xs ${typePct > 100 ? 'text-error' : 'text-success'}`}>
                          {typePct.toFixed(1)}%
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )
          })}

          {/* Gran Total */}
          <div className="card p-4 bg-surface-high/50 border-2 border-border">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <p className="text-sm font-bold text-text-primary uppercase tracking-wider">Total General</p>
              <div className="flex flex-wrap gap-6 text-sm font-mono">
                <div className="text-right">
                  <p className="text-xs text-text-disabled mb-0.5">Presupuestado</p>
                  <p className="font-bold text-text-primary">{formatCLP(totalBudget)}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-text-disabled mb-0.5">Real</p>
                  <p className="font-bold text-info">{formatCLP(totalReal)}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-text-disabled mb-0.5">Varianza</p>
                  <p className={`font-bold ${totalVar >= 0 ? 'text-success' : 'text-error'}`}>
                    {totalVar >= 0 ? '+' : ''}{formatCLP(totalVar)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-text-disabled mb-0.5">Ejecución</p>
                  <p className={`font-bold ${totalPct > 100 ? 'text-error' : totalPct > 80 ? 'text-warning' : 'text-success'}`}>
                    {totalPct.toFixed(1)}%
                  </p>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
