import { createClient } from '@/lib/supabase/server'
import { formatCLP } from '@/lib/utils'
import { docTypeLabel, docTypeShort } from '@/lib/doc-types'
import Link from 'next/link'
import { notFound } from 'next/navigation'

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface OpenDocRow {
  doc_type:     string
  doc_number:   string
  doc_date:     string
  glosa:        string
  entry_number: number
  entry_id:     string
  amount:       number
  settled:      number
  pending:      number
}

const AUX_TYPE_LABEL: Record<string, string> = {
  PROVEEDOR: 'Proveedor',
  CLIENTE:   'Cliente',
  EMPLEADO:  'Empleado',
  OTRO:      'Otro',
}

const STATUS_CLS = (pending: number, amount: number) => {
  if (pending <= 0.01)          return { label: 'SALDADO',  cls: 'bg-success/10 text-success' }
  if (pending < amount - 0.01)  return { label: 'PARCIAL',  cls: 'bg-warning/10 text-warning' }
  return                                { label: 'PENDIENTE', cls: 'bg-error/10   text-error'   }
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function CartolAuxiliarPage({
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

  // Datos del auxiliar
  const { data: aux } = await supabase
    .schema('conta').from('auxiliaries')
    .select('id, code, name, rut, type, active')
    .eq('id', id)
    .eq('company_id', companyId)
    .single()

  if (!aux) notFound()

  // Documentos abiertos (vista)
  const { data: openDocs } = await supabase
    .schema('conta').from('open_documents')
    .select('doc_type, doc_number, doc_date, glosa, entry_number, entry_id, amount, settled, pending')
    .eq('company_id', companyId)
    .eq('auxiliary_id', id)
    .order('doc_date', { ascending: false })

  const docs = (openDocs ?? []).map((r: any) => ({
    ...r,
    amount:  Number(r.amount  ?? 0),
    settled: Number(r.settled ?? 0),
    pending: Number(r.pending ?? 0),
    entry_id: r.entry_id ?? '',
  })) as OpenDocRow[]

  // Todos los movimientos del auxiliar (para historial completo)
  const { data: allPeriods } = await supabase
    .schema('conta').from('periods')
    .select('id').eq('company_id', companyId)
  const periodIds = (allPeriods ?? []).map(p => p.id as string)

  const { data: movements } = periodIds.length > 0 ? await supabase
    .schema('conta').from('journal_lines')
    .select(`
      id, debit, credit, description, doc_type, doc_number, ref_doc_type, ref_doc_number,
      journal_entries!inner(id, number, date, glosa, period_id)
    `)
    .eq('auxiliary_id', id)
    .in('journal_entries.period_id', periodIds)
    .order('date', { referencedTable: 'journal_entries', ascending: false })
    .limit(200)
  : { data: [] }

  // KPIs
  const totalPendiente = docs.reduce((s, d) => s + (d.pending > 0 ? d.pending : 0), 0)
  const totalSaldado   = docs.filter(d => d.pending <= 0.01).length
  const totalAbiertos  = docs.filter(d => d.pending >  0.01).length
  const totalDocs      = docs.length

  const fmtDate = (iso: string) =>
    iso ? new Date(iso + 'T12:00:00').toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'

  return (
    <div className="p-8 max-w-6xl mx-auto">

      {/* Encabezado */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link href="/contabilidad/auxiliares"
            className="text-text-disabled hover:text-primary transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">{aux.name}</h1>
              <span className="badge bg-surface-high text-text-secondary text-xs">
                {AUX_TYPE_LABEL[aux.type] ?? aux.type}
              </span>
              {!aux.active && (
                <span className="badge bg-error/10 text-error text-xs">Inactivo</span>
              )}
            </div>
            <p className="text-text-secondary text-sm mt-1">
              {aux.code && <span className="font-mono mr-3">{aux.code}</span>}
              {aux.rut && <span>RUT: {aux.rut}</span>}
            </p>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        <div className="card p-4">
          <p className="text-xs text-text-disabled mb-1">Documentos totales</p>
          <p className="font-bold text-xl font-mono">{totalDocs}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-text-disabled mb-1">Documentos pendientes</p>
          <p className="font-bold text-xl font-mono text-error">{totalAbiertos}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-text-disabled mb-1">Documentos saldados</p>
          <p className="font-bold text-xl font-mono text-success">{totalSaldado}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-text-disabled mb-1">Total pendiente</p>
          <p className="font-bold text-xl font-mono text-warning">{formatCLP(totalPendiente)}</p>
        </div>
      </div>

      {/* ── Documentos con saldo ── */}
      <div className="card overflow-hidden mb-6">
        <div className="px-5 py-3 border-b border-border">
          <h2 className="text-sm font-bold">Documentos</h2>
          <p className="text-xs text-text-disabled mt-0.5">
            Estado de cada documento — saldo original, imputado y pendiente
          </p>
        </div>
        {docs.length === 0 ? (
          <div className="p-8 text-center text-text-disabled text-sm">
            Sin documentos registrados para este auxiliar
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="table-header text-xs">
                  <th className="px-4 py-2.5 text-left">Documento</th>
                  <th className="px-4 py-2.5 text-left">Fecha</th>
                  <th className="px-4 py-2.5 text-left">Glosa</th>
                  <th className="px-4 py-2.5 text-left">Asiento</th>
                  <th className="px-4 py-2.5 text-right">Monto original</th>
                  <th className="px-4 py-2.5 text-right">Imputado</th>
                  <th className="px-4 py-2.5 text-right">Pendiente</th>
                  <th className="px-4 py-2.5 text-center">Estado</th>
                </tr>
              </thead>
              <tbody>
                {docs.map((doc, i) => {
                  const st = STATUS_CLS(doc.pending, doc.amount)
                  const pct = doc.amount > 0 ? Math.min(100, (doc.settled / doc.amount) * 100) : 0
                  return (
                    <tr key={i} className="table-row">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="badge bg-info/10 text-info text-xs px-2">{docTypeShort(doc.doc_type)}</span>
                          <span className="font-mono font-semibold">N°{doc.doc_number}</span>
                        </div>
                        <div className="text-[10px] text-text-disabled mt-0.5">{docTypeLabel(doc.doc_type)}</div>
                      </td>
                      <td className="px-4 py-3 text-text-secondary whitespace-nowrap">
                        {fmtDate(doc.doc_date)}
                      </td>
                      <td className="px-4 py-3 text-text-secondary max-w-[200px] truncate" title={doc.glosa}>
                        {doc.glosa}
                      </td>
                      <td className="px-4 py-3">
                        {doc.entry_id ? (
                          <Link href={`/contabilidad/libro-diario/${doc.entry_id}`}
                            className="font-mono text-xs text-text-disabled hover:text-primary transition-colors">
                            #{doc.entry_number}
                          </Link>
                        ) : (
                          <span className="font-mono text-xs text-text-disabled">#{doc.entry_number}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-text-primary">
                        {formatCLP(doc.amount)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-success">
                        {doc.settled > 0 ? formatCLP(doc.settled) : '—'}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-semibold">
                        {doc.pending > 0.01
                          ? <span className="text-error">{formatCLP(doc.pending)}</span>
                          : <span className="text-success">—</span>
                        }
                        {/* Barra de progreso */}
                        {doc.amount > 0 && (
                          <div className="mt-1 h-1 bg-border rounded-full overflow-hidden">
                            <div
                              className="h-full bg-success rounded-full transition-all"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`badge text-xs px-2 ${st.cls}`}>{st.label}</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="bg-surface-high border-t-2 border-border font-bold text-xs">
                  <td colSpan={4} className="px-4 py-3 text-text-secondary">
                    TOTALES — {totalDocs} documentos
                  </td>
                  <td className="px-4 py-3 text-right font-mono">
                    {formatCLP(docs.reduce((s, d) => s + d.amount, 0))}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-success">
                    {formatCLP(docs.reduce((s, d) => s + d.settled, 0))}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-error">
                    {formatCLP(totalPendiente)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* ── Historial de movimientos ── */}
      <div className="card overflow-hidden">
        <div className="px-5 py-3 border-b border-border">
          <h2 className="text-sm font-bold">Historial de movimientos</h2>
          <p className="text-xs text-text-disabled mt-0.5">Todos los asientos que afectan a este auxiliar (últimos 200)</p>
        </div>
        {(movements ?? []).length === 0 ? (
          <div className="p-8 text-center text-text-disabled text-sm">Sin movimientos</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="table-header text-xs">
                  <th className="px-4 py-2.5 text-left w-12">N°</th>
                  <th className="px-4 py-2.5 text-left w-24">Fecha</th>
                  <th className="px-4 py-2.5 text-left">Glosa</th>
                  <th className="px-4 py-2.5 text-left">Documento</th>
                  <th className="px-4 py-2.5 text-left">Referencia</th>
                  <th className="px-4 py-2.5 text-right w-28">DEBE</th>
                  <th className="px-4 py-2.5 text-right w-28">HABER</th>
                </tr>
              </thead>
              <tbody>
                {(movements ?? []).map((mv: any) => {
                  const te = mv.journal_entries
                  return (
                    <tr key={mv.id} className="table-row text-xs">
                      <td className="px-4 py-2 font-mono text-text-disabled">
                        <Link href={`/contabilidad/libro-diario/${te?.id}`}
                          className="hover:text-primary transition-colors">
                          #{te?.number}
                        </Link>
                      </td>
                      <td className="px-4 py-2 text-text-secondary whitespace-nowrap">
                        {te?.date ? fmtDate(te.date) : '—'}
                      </td>
                      <td className="px-4 py-2 text-text-primary max-w-[200px] truncate" title={te?.glosa}>
                        {te?.glosa}
                        {mv.description && mv.description !== te?.glosa && (
                          <div className="text-text-disabled text-[10px] truncate">{mv.description}</div>
                        )}
                      </td>
                      <td className="px-4 py-2">
                        {mv.doc_type ? (
                          <div className="flex items-center gap-1">
                            <span className="badge bg-info/10 text-info text-[9px] px-1">{docTypeShort(mv.doc_type)}</span>
                            <span className="font-mono text-[10px]">N°{mv.doc_number}</span>
                          </div>
                        ) : <span className="text-text-disabled">—</span>}
                      </td>
                      <td className="px-4 py-2">
                        {mv.ref_doc_type ? (
                          <div className="flex items-center gap-1">
                            <span className="text-text-disabled text-[9px]">↩</span>
                            <span className="badge bg-success/10 text-success text-[9px] px-1">{docTypeShort(mv.ref_doc_type)}</span>
                            <span className="font-mono text-[10px] text-success">N°{mv.ref_doc_number}</span>
                          </div>
                        ) : <span className="text-text-disabled">—</span>}
                      </td>
                      <td className="px-4 py-2 text-right font-mono text-info">
                        {mv.debit > 0 ? formatCLP(mv.debit) : ''}
                      </td>
                      <td className="px-4 py-2 text-right font-mono text-warning">
                        {mv.credit > 0 ? formatCLP(mv.credit) : ''}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
