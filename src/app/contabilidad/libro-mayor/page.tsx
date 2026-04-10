import { createClient } from '@/lib/supabase/server'
import { formatCLP, accountTypeColor, accountTypeLabel, monthName } from '@/lib/utils'
import { docTypeShort } from '@/lib/doc-types'
import type { Account, AccountType } from '@/types/database'
import Link from 'next/link'
import { LibroMayorExport } from './LibroMayorExport'
import type { MayorRow } from './LibroMayorExport'
import { PrintButton } from '@/components/ui/PrintButton'

const TIPO_MAP: Record<string, { label: string; short: string; cls: string }> = {
  MANUAL:            { label: 'Manual',          short: 'M',  cls: 'bg-surface-high text-text-secondary' },
  SII_FACTURA:       { label: 'Factura SII',      short: 'F',  cls: 'bg-info/10 text-info' },
  SII_HONORARIO:     { label: 'Honorario',        short: 'H',  cls: 'bg-primary/10 text-primary' },
  INVENTARIO_VENTA:  { label: 'Venta Inv.',       short: 'V',  cls: 'bg-success/10 text-success' },
  INVENTARIO_COMPRA: { label: 'Compra Inv.',      short: 'C',  cls: 'bg-warning/10 text-warning' },
}
const tipoInfo = (t: string) => TIPO_MAP[t] ?? { label: t, short: t.slice(0, 2), cls: 'bg-surface-high text-text-disabled' }

export default async function LibroMayorPage({
  searchParams,
}: {
  searchParams: Promise<{
    year?: string; month?: string
    account_id?: string; cc?: string; aux?: string
    acum?: string; tipo?: string
  }>
}) {
  const params = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('user_profiles').select('company_id').eq('id', user!.id).single()

  const companyId = profile?.company_id as string
  const now   = new Date()
  const year  = parseInt(params.year  ?? String(now.getFullYear()))
  const month = parseInt(params.month ?? String(now.getMonth() + 1))
  const acum  = params.acum === '1'

  // ── Lookups ───────────────────────────────────────────────────
  const [accsRes, ccRes, auxRes] = await Promise.all([
    supabase.schema('conta').from('accounts')
      .select('id, code, name, type, nature')
      .eq('company_id', companyId).eq('allows_entry', true).eq('active', true).order('code'),
    supabase.schema('conta').from('cost_centers')
      .select('id, code, name')
      .eq('company_id', companyId).eq('active', true).order('code'),
    supabase.schema('conta').from('auxiliaries')
      .select('id, code, name, type')
      .eq('company_id', companyId).eq('active', true).order('name'),
  ])

  const accs = (accsRes.data ?? []) as Pick<Account, 'id' | 'code' | 'name' | 'type' | 'nature'>[]
  const ccs  = (ccRes.data  ?? []) as { id: string; code: string; name: string }[]
  const auxs = (auxRes.data ?? []) as { id: string; code: string; name: string; type: string }[]

  const selectedId    = params.account_id ?? ''
  const selectedCc    = params.cc ?? ''
  const selectedAux   = params.aux ?? ''
  const selectedTipo  = params.tipo ?? ''
  const allAccounts   = selectedId === ''
  const selectedAcc   = accs.find(a => a.id === selectedId)
  const selectedCcObj = ccs.find(c => c.id === selectedCc)
  const selectedAuxObj= auxs.find(a => a.id === selectedAux)

  // ── Tipos en query ─────────────────────────────────────────────
  interface LineRow {
    id:             string
    account_id:     string
    debit:          number
    credit:         number
    description:    string | null
    doc_type:       string | null
    doc_number:     string | null
    ref_doc_type:   string | null
    ref_doc_number: string | null
    auxiliary_id:   string | null
    cost_center_id: string | null
    cost_centers:   { code: string; name: string } | null
    auxiliaries:    { code: string; name: string } | null
    journal_entries: {
      id:       string
      number:   number
      date:     string
      glosa:    string
      status:   string
      type:     string
    } | null
  }

  // ── Períodos del rango ─────────────────────────────────────────
  const monthFrom = acum ? 1 : month
  const { data: periodsData } = await supabase
    .schema('conta').from('periods')
    .select('id, month')
    .eq('company_id', companyId).eq('year', year)
    .gte('month', monthFrom).lte('month', month)

  const periodIds = (periodsData ?? []).map(p => p.id as string)

  // ── Saldos anteriores ──────────────────────────────────────────
  let prevBalMap = new Map<string, number>()
  if (periodIds.length > 0 && monthFrom > 1) {
    const { data: prevBal } = await supabase.rpc('get_account_balances', {
      p_company_id: companyId,
      p_year: year,
      p_month_from: 1,
      p_month_to: monthFrom - 1,
    })
    for (const b of prevBal ?? []) {
      prevBalMap.set(b.account_id as string, b.balance as number)
    }
  }

  // ── Líneas ─────────────────────────────────────────────────────
  let allLines: LineRow[] = []

  if (periodIds.length > 0) {
    let q = supabase
      .schema('conta').from('journal_lines')
      .select(`
        id, account_id, debit, credit, description, doc_type, doc_number, ref_doc_type, ref_doc_number,
        auxiliary_id, cost_center_id,
        cost_centers(code, name),
        auxiliaries(code, name),
        journal_entries!inner(id, number, date, glosa, status, type, period_id)
      `)
      .in('journal_entries.period_id', periodIds)
      .order('date',   { referencedTable: 'journal_entries', ascending: true })
      .order('number', { referencedTable: 'journal_entries', ascending: true })

    if (!allAccounts) q = q.eq('account_id', selectedId)
    if (selectedCc)   q = q.eq('cost_center_id', selectedCc)
    if (selectedAux)  q = q.eq('auxiliary_id', selectedAux)
    if (selectedTipo) q = (q as any).eq('journal_entries.type', selectedTipo)

    const { data } = await q
    allLines = (data ?? []) as unknown as LineRow[]
  }

  // ── Agrupar por cuenta ─────────────────────────────────────────
  const accMap = new Map(accs.map(a => [a.id, a]))

  interface AuxBreakdown { name: string; debe: number; haber: number }

  interface AccountSection {
    acc:           Pick<Account, 'id' | 'code' | 'name' | 'type' | 'nature'>
    saldoAnterior: number
    lines:         (LineRow & { balance: number })[]
    totalDebe:     number
    totalHaber:    number
    saldoFinal:    number
    saldoMin:      number
    saldoMax:      number
    auxBreakdown:  Map<string, AuxBreakdown>
  }

  const buildSection = (
    acc: Pick<Account, 'id' | 'code' | 'name' | 'type' | 'nature'>,
    lines: LineRow[],
    saldoAnterior: number
  ): AccountSection => {
    let running = saldoAnterior
    let saldoMin = saldoAnterior
    let saldoMax = saldoAnterior
    const auxBreakdown = new Map<string, AuxBreakdown>()

    const linesWithBal = lines.map(l => {
      running += acc.nature === 'DEUDOR' ? l.debit - l.credit : l.credit - l.debit
      saldoMin = Math.min(saldoMin, running)
      saldoMax = Math.max(saldoMax, running)

      // Acumular desglose por auxiliar
      if (l.auxiliaries) {
        const key = l.auxiliary_id!
        const existing = auxBreakdown.get(key) ?? { name: `${l.auxiliaries.code} ${l.auxiliaries.name}`, debe: 0, haber: 0 }
        auxBreakdown.set(key, {
          ...existing,
          debe:  existing.debe  + l.debit,
          haber: existing.haber + l.credit,
        })
      }

      return { ...l, balance: running }
    })

    return {
      acc,
      saldoAnterior,
      lines: linesWithBal,
      totalDebe:  lines.reduce((s, l) => s + l.debit,  0),
      totalHaber: lines.reduce((s, l) => s + l.credit, 0),
      saldoFinal: running,
      saldoMin,
      saldoMax,
      auxBreakdown,
    }
  }

  const sections: AccountSection[] = []

  if (allAccounts) {
    const grouped = new Map<string, LineRow[]>()
    for (const l of allLines) {
      if (!grouped.has(l.account_id)) grouped.set(l.account_id, [])
      grouped.get(l.account_id)!.push(l)
    }
    const sortedIds = [...grouped.keys()].sort((a, b) =>
      (accMap.get(a)?.code ?? '').localeCompare(accMap.get(b)?.code ?? '')
    )
    for (const accId of sortedIds) {
      const acc = accMap.get(accId)
      if (!acc) continue
      sections.push(buildSection(acc, grouped.get(accId)!, prevBalMap.get(accId) ?? 0))
    }
  } else if (selectedAcc) {
    sections.push(buildSection(selectedAcc, allLines, prevBalMap.get(selectedId) ?? 0))
  }

  // ── Export data ────────────────────────────────────────────────
  const exportData: MayorRow[] = sections.flatMap(sec =>
    sec.lines.map(l => ({
      cuenta_codigo: sec.acc.code,
      cuenta_nombre: sec.acc.name,
      tipo:          tipoInfo(l.journal_entries?.type ?? '').label,
      numero:        l.journal_entries?.number ?? 0,
      fecha:         l.journal_entries?.date ?? '',
      glosa:         l.journal_entries?.glosa ?? '',
      descripcion:   l.description ?? '',
      cc_codigo:     l.cost_centers?.code ?? '',
      cc_nombre:     l.cost_centers?.name ?? '',
      auxiliar:   l.auxiliaries?.name ?? '',
      doc_tipo:   l.doc_type    ?? '',
      doc_numero: l.doc_number  ?? '',
      ref_tipo:   l.ref_doc_type   ?? '',
      ref_numero: l.ref_doc_number ?? '',
      debe:          l.debit,
      haber:         l.credit,
      saldo:         l.balance,
    }))
  )

  const grandTotalDebe  = sections.reduce((s, sec) => s + sec.totalDebe,  0)
  const grandTotalHaber = sections.reduce((s, sec) => s + sec.totalHaber, 0)
  const totalMovs       = sections.reduce((s, sec) => s + sec.lines.length, 0)
  const periodLabel     = acum ? `Enero — ${monthName(month)} ${year}` : `${monthName(month)} ${year}`

  return (
    <div className="p-8 max-w-7xl mx-auto print:p-4">
      <div className="flex items-center justify-between mb-6 print:mb-3">
        <div>
          <h1 className="text-2xl font-bold">Libro Mayor</h1>
          <p className="text-text-secondary text-sm mt-1">
            {allAccounts ? 'Todas las cuentas' : selectedAcc?.name ?? ''}
            {' — '}{periodLabel}
            {selectedCcObj  ? ` — CC: ${selectedCcObj.name}` : ''}
            {selectedAuxObj ? ` — ${selectedAuxObj.name}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2 print:hidden">
          {exportData.length > 0 && (
            <LibroMayorExport
              rows={exportData}
              accountCode={allAccounts ? 'TODAS' : (selectedAcc?.code ?? '')}
              accountName={allAccounts ? 'Todas las cuentas' : (selectedAcc?.name ?? '')}
              month={month} year={year} acum={acum}
            />
          )}
          {exportData.length > 0 && <PrintButton />}
        </div>
      </div>

      {/* ── KPIs rápidos ── */}
      {sections.length > 0 && (
        <div className="grid grid-cols-4 gap-3 mb-5 print:hidden">
          <KpiCard label="Cuentas con movimientos" value={String(sections.length)} />
          <KpiCard label="Total movimientos" value={String(totalMovs)} />
          <KpiCard label="Total DEBE" value={formatCLP(grandTotalDebe)} color="text-info" />
          <KpiCard label="Total HABER" value={formatCLP(grandTotalHaber)} color="text-warning" />
        </div>
      )}

      {/* ── Filtros ── */}
      <form className="card p-4 mb-5 flex flex-wrap gap-3 items-end print:hidden">
        <div>
          <label className="text-xs text-text-disabled block mb-1">Cuenta</label>
          <select name="account_id" defaultValue={selectedId} className="input w-64 text-sm">
            <option value="">— Todas las cuentas —</option>
            {accs.map(a => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-text-disabled block mb-1">Auxiliar</label>
          <select name="aux" defaultValue={selectedAux} className="input w-52 text-sm">
            <option value="">— Todos —</option>
            {auxs.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-text-disabled block mb-1">Centro de Costo</label>
          <select name="cc" defaultValue={selectedCc} className="input w-44 text-sm">
            <option value="">— Todos los CC —</option>
            {ccs.map(c => <option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-text-disabled block mb-1">Tipo asiento</label>
          <select name="tipo" defaultValue={selectedTipo} className="input w-40 text-sm">
            <option value="">— Todos —</option>
            {Object.entries(TIPO_MAP).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-text-disabled block mb-1">Mes hasta</label>
          <select name="month" defaultValue={month} className="input w-36 text-sm">
            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
              <option key={m} value={m}>{monthName(m)}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-text-disabled block mb-1">Año</label>
          <select name="year" defaultValue={year} className="input w-24 text-sm">
            {[year - 1, year, year + 1].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div className="flex gap-1">
          <input type="hidden" name="account_id" value={selectedId} />
          <button type="submit" name="acum" value="0"
            className={`px-3 py-2 rounded-lg text-sm border transition-colors ${
              !acum ? 'bg-primary text-primary-foreground border-primary' : 'bg-surface border-border text-text-secondary hover:text-text-primary'
            }`}>
            Mensual
          </button>
          <button type="submit" name="acum" value="1"
            className={`px-3 py-2 rounded-lg text-sm border transition-colors ${
              acum ? 'bg-primary text-primary-foreground border-primary' : 'bg-surface border-border text-text-secondary hover:text-text-primary'
            }`}>
            Acumulado
          </button>
        </div>
      </form>

      {/* ── Sin datos ── */}
      {periodIds.length === 0 && (
        <div className="card p-8 text-center text-text-disabled">
          Sin movimientos para {periodLabel}
        </div>
      )}
      {periodIds.length > 0 && sections.length === 0 && (
        <div className="card p-8 text-center text-text-disabled">
          Sin movimientos con los filtros seleccionados
        </div>
      )}

      {/* ── Secciones ── */}
      <div className="space-y-6">
        {sections.map(sec => {
          const color = accountTypeColor(sec.acc.type as AccountType)
          const hasAuxBreakdown = sec.auxBreakdown.size > 0
          const displaySaldo = sec.acc.nature === 'DEUDOR' ? sec.saldoFinal : -sec.saldoFinal

          return (
            <div key={sec.acc.id} className="card overflow-hidden">

              {/* Cabecera de cuenta */}
              <div className="px-4 py-3 border-b border-border"
                style={{ borderLeftWidth: 4, borderLeftColor: color }}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-bold text-sm" style={{ color }}>{sec.acc.code}</span>
                      <span className="text-text-primary font-semibold text-sm">{sec.acc.name}</span>
                      <span className="badge text-xs" style={{ color, backgroundColor: `${color}15` }}>
                        {accountTypeLabel(sec.acc.type as AccountType)}
                      </span>
                      <span className="text-xs text-text-disabled">
                        {sec.lines.length} mov.
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-5 text-right text-xs shrink-0">
                    {sec.saldoAnterior !== 0 && (
                      <div>
                        <p className="text-text-disabled">Saldo anterior</p>
                        <p className="font-mono font-semibold text-text-primary">{formatCLP(sec.saldoAnterior)}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-text-disabled">DEBE período</p>
                      <p className="font-mono text-info">{formatCLP(sec.totalDebe)}</p>
                    </div>
                    <div>
                      <p className="text-text-disabled">HABER período</p>
                      <p className="font-mono text-warning">{formatCLP(sec.totalHaber)}</p>
                    </div>
                    <div>
                      <p className="text-text-disabled">Saldo</p>
                      <p className={`font-mono font-bold ${displaySaldo >= 0 ? 'text-success' : 'text-error'}`}>
                        {displaySaldo < 0 ? `(${formatCLP(Math.abs(displaySaldo))})` : formatCLP(displaySaldo)}
                      </p>
                    </div>
                    {sec.lines.length > 1 && (
                      <>
                        <div>
                          <p className="text-text-disabled">Mín. período</p>
                          <p className="font-mono text-text-secondary">{formatCLP(sec.saldoMin)}</p>
                        </div>
                        <div>
                          <p className="text-text-disabled">Máx. período</p>
                          <p className="font-mono text-text-secondary">{formatCLP(sec.saldoMax)}</p>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Tabla de líneas */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="table-header text-xs">
                      <th className="px-3 py-2 text-left w-8">T</th>
                      <th className="px-3 py-2 text-left w-12">N°</th>
                      <th className="px-3 py-2 text-left w-22">Fecha</th>
                      <th className="px-3 py-2 text-left">Glosa / Descripción</th>
                      <th className="px-3 py-2 text-left w-24">C.Costo</th>
                      <th className="px-3 py-2 text-left w-32">Auxiliar</th>
                      <th className="px-3 py-2 text-right w-28">DEBE</th>
                      <th className="px-3 py-2 text-right w-28">HABER</th>
                      <th className="px-3 py-2 text-right w-28">SALDO</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sec.saldoAnterior !== 0 && (
                      <tr className="bg-surface-high/40 text-xs">
                        <td colSpan={6} className="px-3 py-1.5 text-text-disabled italic">← Saldo acumulado anterior</td>
                        <td className="px-3 py-1.5 text-right font-mono text-info">
                          {sec.saldoAnterior > 0 ? formatCLP(sec.saldoAnterior) : ''}
                        </td>
                        <td className="px-3 py-1.5 text-right font-mono text-warning">
                          {sec.saldoAnterior < 0 ? formatCLP(Math.abs(sec.saldoAnterior)) : ''}
                        </td>
                        <td className="px-3 py-1.5 text-right font-mono font-bold text-text-primary">
                          {formatCLP(sec.saldoAnterior)}
                        </td>
                      </tr>
                    )}

                    {sec.lines.map(l => {
                      const te = l.journal_entries
                      const ti = tipoInfo(te?.type ?? '')
                      const isReversed = te?.status === 'reversed'
                      return (
                        <tr key={l.id} className={`table-row text-xs ${isReversed ? 'opacity-40 line-through' : ''}`}>
                          <td className="px-3 py-2">
                            <span className={`badge text-[9px] px-1 py-0.5 ${ti.cls}`} title={ti.label}>
                              {ti.short}
                            </span>
                          </td>
                          <td className="px-3 py-2 font-mono text-text-disabled">
                            <Link href={`/contabilidad/libro-diario/${te?.id}`}
                              className="hover:text-primary transition-colors" title="Ver comprobante">
                              #{te?.number}
                            </Link>
                          </td>
                          <td className="px-3 py-2 text-text-secondary whitespace-nowrap">
                            {te?.date ? new Date(te.date + 'T12:00:00').toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit' }) : '—'}
                          </td>
                          <td className="px-3 py-2 text-text-primary">
                            <div className="truncate max-w-[240px]" title={te?.glosa}>{te?.glosa}</div>
                            {l.description && l.description !== te?.glosa && (
                              <div className="truncate max-w-[240px] text-text-disabled text-[10px]" title={l.description}>
                                {l.description}
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            {l.cost_centers
                              ? <span className="badge bg-primary/10 text-primary text-[10px]" title={l.cost_centers.name}>{l.cost_centers.code}</span>
                              : <span className="text-text-disabled">—</span>}
                          </td>
                          <td className="px-3 py-2 text-[11px] max-w-[160px]">
                            {l.auxiliaries ? (
                              <div>
                                <div className="text-text-secondary truncate" title={l.auxiliaries.name}>{l.auxiliaries.name}</div>
                                {(l.doc_type || l.doc_number) && (
                                  <div className="flex items-center gap-1 mt-0.5">
                                    {l.doc_type && (
                                      <span className="badge bg-info/10 text-info text-[9px] px-1">{docTypeShort(l.doc_type)}</span>
                                    )}
                                    {l.doc_number && (
                                      <span className="font-mono text-text-disabled text-[9px]">N°{l.doc_number}</span>
                                    )}
                                  </div>
                                )}
                                {(l.ref_doc_type || l.ref_doc_number) && (
                                  <div className="flex items-center gap-1 mt-0.5">
                                    <span className="text-text-disabled text-[8px]">↩</span>
                                    {l.ref_doc_type && (
                                      <span className="badge bg-success/10 text-success text-[8px] px-1">{docTypeShort(l.ref_doc_type)}</span>
                                    )}
                                    {l.ref_doc_number && (
                                      <span className="font-mono text-success text-[8px]">N°{l.ref_doc_number}</span>
                                    )}
                                  </div>
                                )}
                              </div>
                            ) : <span className="text-text-disabled">—</span>}
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-info">
                            {l.debit > 0 ? formatCLP(l.debit) : ''}
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-warning">
                            {l.credit > 0 ? formatCLP(l.credit) : ''}
                          </td>
                          <td className={`px-3 py-2 text-right font-mono font-semibold ${
                            l.balance >= 0 ? 'text-success' : 'text-error'
                          }`}>
                            {formatCLP(l.balance)}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-surface-high border-t border-border text-xs font-bold">
                      <td colSpan={6} className="px-3 py-2 text-text-secondary">
                        Subtotal {sec.acc.code}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-info">{formatCLP(sec.totalDebe)}</td>
                      <td className="px-3 py-2 text-right font-mono text-warning">{formatCLP(sec.totalHaber)}</td>
                      <td className={`px-3 py-2 text-right font-mono ${sec.saldoFinal >= 0 ? 'text-success' : 'text-error'}`}>
                        {formatCLP(sec.saldoFinal)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Desglose por auxiliar */}
              {hasAuxBreakdown && (
                <div className="px-4 py-3 border-t border-border bg-surface-high/30">
                  <p className="text-[10px] font-bold text-text-disabled uppercase tracking-wide mb-2">
                    Desglose por auxiliar
                  </p>
                  <div className="overflow-x-auto">
                    <table className="text-xs w-full">
                      <thead>
                        <tr className="text-text-disabled">
                          <th className="text-left pb-1 font-medium">Auxiliar</th>
                          <th className="text-right pb-1 font-medium w-28">DEBE</th>
                          <th className="text-right pb-1 font-medium w-28">HABER</th>
                          <th className="text-right pb-1 font-medium w-28">Saldo neto</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/30">
                        {[...sec.auxBreakdown.values()]
                          .sort((a, b) => Math.abs(b.debe - b.haber) - Math.abs(a.debe - a.haber))
                          .map((ab, i) => {
                            const neto = ab.debe - ab.haber
                            return (
                              <tr key={i}>
                                <td className="py-1 text-text-secondary">{ab.name}</td>
                                <td className="py-1 text-right font-mono text-info">{ab.debe > 0 ? formatCLP(ab.debe) : ''}</td>
                                <td className="py-1 text-right font-mono text-warning">{ab.haber > 0 ? formatCLP(ab.haber) : ''}</td>
                                <td className={`py-1 text-right font-mono font-semibold ${neto >= 0 ? 'text-info' : 'text-warning'}`}>
                                  {neto !== 0 ? (neto < 0 ? `(${formatCLP(Math.abs(neto))})` : formatCLP(neto)) : '—'}
                                </td>
                              </tr>
                            )
                          })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* ── Grand total ── */}
      {allAccounts && sections.length > 1 && (
        <div className="card p-4 mt-4 flex items-center justify-between">
          <span className="text-sm font-bold text-text-secondary">
            TOTAL GENERAL — {sections.length} cuentas · {totalMovs} movimientos
          </span>
          <div className="flex gap-8">
            <div className="text-right">
              <p className="text-xs text-text-disabled">Total DEBE</p>
              <p className="font-mono font-bold text-info">{formatCLP(grandTotalDebe)}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-text-disabled">Total HABER</p>
              <p className="font-mono font-bold text-warning">{formatCLP(grandTotalHaber)}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Componente KPI ─────────────────────────────────────────────

function KpiCard({ label, value, color = 'text-text-primary' }: { label: string; value: string; color?: string }) {
  return (
    <div className="card p-4">
      <p className="text-xs text-text-disabled mb-1">{label}</p>
      <p className={`font-bold text-lg font-mono ${color}`}>{value}</p>
    </div>
  )
}
