import { createClient } from '@/lib/supabase/server'
import { formatCLP, monthName } from '@/lib/utils'
import { CentroCostoExport } from './CentroCostoExport'

interface LineRaw {
  debit:          number
  credit:         number
  cost_center_id: string | null
  account_id:     string
  cost_centers: { id: string; code: string; name: string } | null
  accounts:     { code: string; name: string; type: string } | null
  journal_entries: {
    number:   number
    date:     string
    glosa:    string
    period_id: string
  } | null
}

export default async function ReporteCentrosCostoPage({
  searchParams,
}: {
  searchParams: Promise<{
    year?: string; month_from?: string; month_to?: string; cc_id?: string; view?: string
  }>
}) {
  const params = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('user_profiles').select('company_id').eq('id', user!.id).single()
  const companyId = profile?.company_id as string

  const now       = new Date()
  const year      = parseInt(params.year       ?? String(now.getFullYear()))
  const monthFrom = parseInt(params.month_from ?? '1')
  const monthTo   = parseInt(params.month_to   ?? String(now.getMonth() + 1))
  const ccFilter  = params.cc_id ?? ''
  const view      = params.view ?? 'resumen'

  // Períodos del rango seleccionado
  const { data: periods } = await supabase
    .schema('conta').from('periods')
    .select('id')
    .eq('company_id', companyId)
    .eq('year', year)
    .gte('month', monthFrom)
    .lte('month', monthTo)

  const periodIds = (periods ?? []).map(p => p.id)

  // Centros de costo
  const { data: ccs } = await supabase
    .schema('conta').from('cost_centers')
    .select('id, code, name')
    .eq('company_id', companyId)
    .eq('active', true)
    .order('code')

  const costCenters = (ccs ?? []) as { id: string; code: string; name: string }[]

  // Movimientos con CC en el rango
  let lines: LineRaw[] = []
  if (periodIds.length > 0) {
    const q = supabase
      .schema('conta').from('journal_lines')
      .select(`
        debit, credit, cost_center_id, account_id,
        cost_centers(id, code, name),
        accounts(code, name, type),
        journal_entries!inner(number, date, glosa, period_id)
      `)
      .in('journal_entries.period_id', periodIds)
      .not('cost_center_id', 'is', null)

    const finalQ = ccFilter ? q.eq('cost_center_id', ccFilter) : q
    const { data } = await finalQ
    lines = (data ?? []) as unknown as LineRaw[]
  }

  // ── Resumen por CC ────────────────────────────────────────
  type CcSummary = {
    id:     string
    code:   string
    name:   string
    debit:  number
    credit: number
    net:    number  // debit - credit (gasto neto)
    lines:  number
  }

  const summaryMap: Record<string, CcSummary> = {}
  for (const l of lines) {
    const cc = l.cost_centers
    if (!cc) continue
    if (!summaryMap[cc.id]) {
      summaryMap[cc.id] = { id: cc.id, code: cc.code, name: cc.name, debit: 0, credit: 0, net: 0, lines: 0 }
    }
    summaryMap[cc.id].debit  += l.debit
    summaryMap[cc.id].credit += l.credit
    summaryMap[cc.id].net    += l.debit - l.credit
    summaryMap[cc.id].lines  += 1
  }
  const summary = Object.values(summaryMap).sort((a, b) => b.net - a.net)
  const totalNet = summary.reduce((s, c) => s + c.net, 0)

  // ── Detalle por CC → agrupado por cuenta ─────────────────
  type CcDetail = {
    cc_id:    string
    cc_code:  string
    cc_name:  string
    accounts: {
      acc_code: string
      acc_name: string
      acc_type: string
      debit:    number
      credit:   number
      net:      number
      movements: {
        number: number
        date:   string
        glosa:  string
        debit:  number
        credit: number
      }[]
    }[]
  }

  const detailMap: Record<string, CcDetail> = {}
  for (const l of lines) {
    const cc  = l.cost_centers
    const acc = l.accounts
    const ent = l.journal_entries
    if (!cc || !acc || !ent) continue

    if (!detailMap[cc.id]) {
      detailMap[cc.id] = { cc_id: cc.id, cc_code: cc.code, cc_name: cc.name, accounts: [] }
    }
    const d = detailMap[cc.id]
    let a = d.accounts.find(x => x.acc_code === acc.code)
    if (!a) {
      a = { acc_code: acc.code, acc_name: acc.name, acc_type: acc.type, debit: 0, credit: 0, net: 0, movements: [] }
      d.accounts.push(a)
    }
    a.debit  += l.debit
    a.credit += l.credit
    a.net    += l.debit - l.credit
    a.movements.push({ number: ent.number, date: ent.date, glosa: ent.glosa, debit: l.debit, credit: l.credit })
  }
  const detail = Object.values(detailMap).sort((a, b) => a.cc_code.localeCompare(b.cc_code))

  // Datos planos para export
  const exportRows = lines.map(l => ({
    cc_codigo:   l.cost_centers?.code ?? '',
    cc_nombre:   l.cost_centers?.name ?? '',
    cta_codigo:  l.accounts?.code ?? '',
    cta_nombre:  l.accounts?.name ?? '',
    numero:      l.journal_entries?.number ?? 0,
    fecha:       l.journal_entries?.date ?? '',
    glosa:       l.journal_entries?.glosa ?? '',
    debe:        l.debit,
    haber:       l.credit,
  }))

  const periodoLabel = monthFrom === monthTo
    ? `${monthName(monthFrom)} ${year}`
    : `${monthName(monthFrom)} – ${monthName(monthTo)} ${year}`

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Gastos por Centro de Costo</h1>
          <p className="text-text-secondary text-sm mt-1">{periodoLabel}</p>
        </div>
        {exportRows.length > 0 && (
          <CentroCostoExport rows={exportRows} periodo={periodoLabel} />
        )}
      </div>

      {/* Filtros */}
      <form className="card p-4 mb-6 flex flex-wrap gap-3 items-end">
        <div>
          <label className="text-xs text-text-disabled block mb-1">Año</label>
          <select name="year" defaultValue={year} className="input w-24 text-sm">
            {[year - 1, year, year + 1].map(y => <option key={y} value={y}>{y}</option>)}
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
            <option value="">Todos</option>
            {costCenters.map(c => (
              <option key={c.id} value={c.id}>{c.code} — {c.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-text-disabled block mb-1">Vista</label>
          <select name="view" defaultValue={view} className="input w-32 text-sm">
            <option value="resumen">Resumen</option>
            <option value="detalle">Detalle</option>
          </select>
        </div>
        <button type="submit" className="btn-primary px-4 py-2 text-sm">Filtrar</button>
      </form>

      {lines.length === 0 ? (
        <div className="card p-12 text-center text-text-disabled">
          Sin movimientos con centro de costo en el período seleccionado
        </div>
      ) : view === 'resumen' ? (
        /* ── VISTA RESUMEN ── */
        <div className="space-y-4">
          {/* Tarjetas summary */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="card p-4">
              <p className="text-xs text-text-disabled mb-1">Total Débito (Gastos)</p>
              <p className="text-xl font-bold font-mono text-info">
                {formatCLP(lines.reduce((s, l) => s + l.debit, 0))}
              </p>
            </div>
            <div className="card p-4">
              <p className="text-xs text-text-disabled mb-1">Total Crédito (Abonos)</p>
              <p className="text-xl font-bold font-mono text-warning">
                {formatCLP(lines.reduce((s, l) => s + l.credit, 0))}
              </p>
            </div>
            <div className="card p-4">
              <p className="text-xs text-text-disabled mb-1">Neto (Débito - Crédito)</p>
              <p className={`text-xl font-bold font-mono ${totalNet >= 0 ? 'text-error' : 'text-success'}`}>
                {formatCLP(totalNet)}
              </p>
            </div>
          </div>

          {/* Tabla resumen */}
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="table-header">
                  <th className="px-4 py-3 text-left w-24">Código</th>
                  <th className="px-4 py-3 text-left">Centro de Costo</th>
                  <th className="px-4 py-3 text-right w-36">DEBE</th>
                  <th className="px-4 py-3 text-right w-36">HABER</th>
                  <th className="px-4 py-3 text-right w-36">NETO</th>
                  <th className="px-4 py-3 text-right w-24">Mov.</th>
                  <th className="px-4 py-3 text-center w-20">%</th>
                </tr>
              </thead>
              <tbody>
                {summary.map(cc => (
                  <tr key={cc.id} className="table-row">
                    <td className="px-4 py-3 font-mono text-xs text-text-disabled">{cc.code}</td>
                    <td className="px-4 py-3 font-medium text-text-primary">{cc.name}</td>
                    <td className="px-4 py-3 text-right font-mono text-info text-xs">{formatCLP(cc.debit)}</td>
                    <td className="px-4 py-3 text-right font-mono text-warning text-xs">{formatCLP(cc.credit)}</td>
                    <td className={`px-4 py-3 text-right font-mono text-sm font-semibold ${cc.net >= 0 ? 'text-error' : 'text-success'}`}>
                      {formatCLP(cc.net)}
                    </td>
                    <td className="px-4 py-3 text-right text-text-disabled text-xs">{cc.lines}</td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-surface-high rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full"
                            style={{ width: `${totalNet > 0 ? Math.min(100, (cc.net / totalNet) * 100) : 0}%` }}
                          />
                        </div>
                        <span className="text-xs text-text-disabled w-10 text-right">
                          {totalNet > 0 ? `${((cc.net / totalNet) * 100).toFixed(1)}%` : '—'}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-surface-high border-t-2 border-border font-bold">
                  <td colSpan={2} className="px-4 py-3 text-xs text-text-secondary">TOTAL</td>
                  <td className="px-4 py-3 text-right font-mono text-info">
                    {formatCLP(lines.reduce((s, l) => s + l.debit, 0))}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-warning">
                    {formatCLP(lines.reduce((s, l) => s + l.credit, 0))}
                  </td>
                  <td className={`px-4 py-3 text-right font-mono ${totalNet >= 0 ? 'text-error' : 'text-success'}`}>
                    {formatCLP(totalNet)}
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      ) : (
        /* ── VISTA DETALLE ── */
        <div className="space-y-6">
          {detail.map(cc => (
            <div key={cc.cc_id} className="card overflow-hidden">
              {/* Header CC */}
              <div className="px-4 py-3 bg-primary/5 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="badge bg-primary/20 text-primary font-mono text-xs">{cc.cc_code}</span>
                  <span className="font-bold text-text-primary">{cc.cc_name}</span>
                </div>
                <span className="text-sm font-mono font-bold text-text-primary">
                  Neto: {formatCLP(cc.accounts.reduce((s, a) => s + a.net, 0))}
                </span>
              </div>

              {/* Cuentas del CC */}
              {cc.accounts.sort((a, b) => a.acc_code.localeCompare(b.acc_code)).map(acc => (
                <div key={acc.acc_code} className="border-b border-border last:border-0">
                  {/* Sub-header cuenta */}
                  <div className="px-4 py-2 bg-surface-high/40 flex items-center justify-between">
                    <span className="text-xs font-medium text-text-secondary font-mono">
                      {acc.acc_code} — {acc.acc_name}
                    </span>
                    <div className="flex gap-4 text-xs font-mono">
                      <span className="text-info">D: {formatCLP(acc.debit)}</span>
                      <span className="text-warning">H: {formatCLP(acc.credit)}</span>
                      <span className={`font-bold ${acc.net >= 0 ? 'text-error' : 'text-success'}`}>
                        N: {formatCLP(acc.net)}
                      </span>
                    </div>
                  </div>

                  {/* Movimientos */}
                  <table className="w-full text-xs">
                    <tbody>
                      {acc.movements.map((m, i) => (
                        <tr key={i} className="table-row">
                          <td className="px-4 py-2 text-text-disabled font-mono w-12">#{m.number}</td>
                          <td className="px-4 py-2 text-text-secondary w-24 whitespace-nowrap">
                            {new Date(m.date).toLocaleDateString('es-CL')}
                          </td>
                          <td className="px-4 py-2 text-text-primary">{m.glosa}</td>
                          <td className="px-4 py-2 text-right font-mono text-info w-28">
                            {m.debit > 0 ? formatCLP(m.debit) : ''}
                          </td>
                          <td className="px-4 py-2 text-right font-mono text-warning w-28">
                            {m.credit > 0 ? formatCLP(m.credit) : ''}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
