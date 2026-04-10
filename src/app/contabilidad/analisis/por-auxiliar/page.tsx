import { createClient } from '@/lib/supabase/server'
import { formatCLP } from '@/lib/utils'
import { docTypeShort, docTypeLabel } from '@/lib/doc-types'
import Link from 'next/link'

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface DocRow {
  auxiliary_id: string
  aux_code:     string
  aux_name:     string
  aux_type:     string
  aux_rut:      string | null
  doc_type:     string
  doc_number:   string
  doc_date:     string
  glosa:        string
  entry_id:     string
  entry_number: number
  amount:       number
  settled:      number
  pending:      number
}

interface AuxGroup {
  auxiliary_id:  string
  aux_code:      string
  aux_name:      string
  aux_type:      string
  aux_rut:       string | null
  docs:          DocRow[]
  totalAmount:   number
  totalSettled:  number
  totalPending:  number
  openCount:     number
  saldadoCount:  number
}

const AUX_TYPE_LABEL: Record<string, string> = {
  PROVEEDOR:   'Proveedor',
  CLIENTE:     'Cliente',
  EMPLEADO:    'Empleado',
  ACTIVO_FIJO: 'Activo Fijo',
  OTRO:        'Otro',
}

const AUX_TYPE_CLS: Record<string, string> = {
  PROVEEDOR:   'bg-info/10 text-info',
  CLIENTE:     'bg-success/10 text-success',
  EMPLEADO:    'bg-warning/10 text-warning',
  ACTIVO_FIJO: 'bg-primary/10 text-primary',
  OTRO:        'bg-surface-high text-text-disabled',
}

const DOC_STATUS = (pending: number, amount: number) => {
  if (pending <= 0.01)         return { label: 'SALDADO',   cls: 'bg-success/10 text-success' }
  if (pending < amount - 0.01) return { label: 'PARCIAL',   cls: 'bg-warning/10 text-warning' }
  return                              { label: 'PENDIENTE', cls: 'bg-error/10 text-error' }
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function AnalisisPorAuxiliarPage({
  searchParams,
}: {
  searchParams: Promise<{
    tipo?: string; solo_pendientes?: string; search?: string; expand?: string
  }>
}) {
  const params   = await searchParams
  const tipoFlt  = params.tipo ?? ''
  const soloPend = params.solo_pendientes !== '0'   // default: solo con saldo > 0
  const search   = (params.search ?? '').toLowerCase()
  const expanded = params.expand ?? ''              // auxiliaryId a mostrar expandido

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('user_profiles').select('company_id').eq('id', user!.id).single()
  const companyId = profile?.company_id as string

  // Todos los documentos del auxiliar
  const { data: raw } = await supabase
    .schema('conta').from('open_documents')
    .select('auxiliary_id, aux_code, aux_name, aux_type, aux_rut, doc_type, doc_number, doc_date, glosa, entry_id, entry_number, amount, settled, pending')
    .eq('company_id', companyId)
    .order('doc_date', { ascending: false })

  const allDocs = (raw ?? []).map((r: any) => ({
    ...r,
    amount:   Number(r.amount   ?? 0),
    settled:  Number(r.settled  ?? 0),
    pending:  Number(r.pending  ?? 0),
    entry_id: r.entry_id ?? '',
  })) as DocRow[]

  // Agrupar por auxiliar
  const groupMap = new Map<string, AuxGroup>()
  for (const doc of allDocs) {
    if (!groupMap.has(doc.auxiliary_id)) {
      groupMap.set(doc.auxiliary_id, {
        auxiliary_id:  doc.auxiliary_id,
        aux_code:      doc.aux_code,
        aux_name:      doc.aux_name,
        aux_type:      doc.aux_type,
        aux_rut:       doc.aux_rut,
        docs:          [],
        totalAmount:   0,
        totalSettled:  0,
        totalPending:  0,
        openCount:     0,
        saldadoCount:  0,
      })
    }
    const g = groupMap.get(doc.auxiliary_id)!
    g.docs.push(doc)
    g.totalAmount  += doc.amount
    g.totalSettled += doc.settled
    g.totalPending += doc.pending
    if (doc.pending > 0.01) g.openCount++
    else g.saldadoCount++
  }

  // Filtrar grupos
  const groups = [...groupMap.values()].filter(g => {
    if (tipoFlt && g.aux_type !== tipoFlt) return false
    if (soloPend && g.totalPending <= 0.01) return false
    if (search) {
      const hay = `${g.aux_code} ${g.aux_name} ${g.aux_rut ?? ''}`.toLowerCase()
      if (!hay.includes(search)) return false
    }
    return true
  }).sort((a, b) => b.totalPending - a.totalPending)  // mayor deuda primero

  // KPIs globales (sobre todos, sin filtro)
  const allGroups   = [...groupMap.values()]
  const grandPend   = allGroups.reduce((s, g) => s + g.totalPending, 0)
  const withDebt    = allGroups.filter(g => g.totalPending > 0.01).length
  const allSaldados = allGroups.filter(g => g.totalPending <= 0.01 && g.docs.length > 0).length

  const fmtDate = (iso: string) =>
    iso ? new Date(iso + 'T12:00:00').toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—'

  return (
    <div className="p-8 max-w-7xl mx-auto">

      {/* Encabezado */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Análisis por Auxiliar</h1>
        <p className="text-text-secondary text-sm mt-1">
          Estado de cartera por proveedor, cliente o tercero — documentos pendientes de saldar
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        <div className="card p-4">
          <p className="text-xs text-text-disabled mb-1">Auxiliares con documentos</p>
          <p className="font-bold text-xl font-mono">{allGroups.length}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-text-disabled mb-1">Con saldo pendiente</p>
          <p className="font-bold text-xl font-mono text-error">{withDebt}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-text-disabled mb-1">Totalmente saldados</p>
          <p className="font-bold text-xl font-mono text-success">{allSaldados}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-text-disabled mb-1">Monto total pendiente</p>
          <p className="font-bold text-xl font-mono text-warning">{formatCLP(grandPend)}</p>
        </div>
      </div>

      {/* Filtros */}
      <form className="card p-4 mb-5 flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-48">
          <label className="text-xs text-text-disabled block mb-1">Buscar</label>
          <input
            name="search"
            defaultValue={params.search ?? ''}
            className="input text-sm w-full"
            placeholder="Nombre, código o RUT..."
          />
        </div>
        <div>
          <label className="text-xs text-text-disabled block mb-1">Tipo</label>
          <select name="tipo" defaultValue={tipoFlt} className="input text-sm w-36">
            <option value="">Todos</option>
            {Object.entries(AUX_TYPE_LABEL).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
        <div className="flex gap-1 items-end">
          <button type="submit" name="solo_pendientes" value="1"
            className={`px-3 py-2 rounded-lg text-sm border transition-colors ${
              soloPend
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-surface border-border text-text-secondary hover:text-text-primary'
            }`}>
            Con saldo
          </button>
          <button type="submit" name="solo_pendientes" value="0"
            className={`px-3 py-2 rounded-lg text-sm border transition-colors ${
              !soloPend
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-surface border-border text-text-secondary hover:text-text-primary'
            }`}>
            Todos
          </button>
        </div>
      </form>

      {/* Sin datos */}
      {groups.length === 0 && (
        <div className="card p-12 text-center text-text-disabled">
          {allDocs.length === 0
            ? 'Sin documentos registrados. Aparecen aquí al ingresar asientos con tipo y número de documento.'
            : 'Sin auxiliares con saldo pendiente con los filtros actuales.'}
        </div>
      )}

      {/* Tabla resumen */}
      {groups.length > 0 && (
        <div className="space-y-4">

          {/* Vista compacta (tabla resumen con expand) */}
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="table-header text-xs">
                  <th className="px-4 py-3 text-left">Auxiliar</th>
                  <th className="px-4 py-3 text-left w-24">Tipo</th>
                  <th className="px-4 py-3 text-center w-16">Docs</th>
                  <th className="px-4 py-3 text-center w-20">Pendientes</th>
                  <th className="px-4 py-3 text-right w-32">Original</th>
                  <th className="px-4 py-3 text-right w-32">Imputado</th>
                  <th className="px-4 py-3 text-right w-32">Pendiente</th>
                  <th className="px-4 py-3 text-center w-28">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {groups.map(g => {
                  const pct  = g.totalAmount > 0 ? Math.min(100, (g.totalSettled / g.totalAmount) * 100) : 0
                  const isExpanded = expanded === g.auxiliary_id
                  const typeCls = AUX_TYPE_CLS[g.aux_type] ?? AUX_TYPE_CLS.OTRO

                  return (
                    <>
                      {/* Fila resumen del auxiliar */}
                      <tr key={g.auxiliary_id}
                        className={`table-row border-b border-border/60 ${isExpanded ? 'bg-surface-high/50' : ''}`}>
                        <td className="px-4 py-3">
                          <div className="font-medium text-text-primary">{g.aux_name}</div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] font-mono text-text-disabled">{g.aux_code}</span>
                            {g.aux_rut && <span className="text-[10px] text-text-disabled">{g.aux_rut}</span>}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`badge text-[10px] ${typeCls}`}>
                            {AUX_TYPE_LABEL[g.aux_type] ?? g.aux_type}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center font-mono text-xs">{g.docs.length}</td>
                        <td className="px-4 py-3 text-center">
                          {g.openCount > 0
                            ? <span className="badge bg-error/10 text-error text-[10px]">{g.openCount}</span>
                            : <span className="badge bg-success/10 text-success text-[10px]">0</span>
                          }
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-xs">{formatCLP(g.totalAmount)}</td>
                        <td className="px-4 py-3 text-right font-mono text-xs text-success">
                          {g.totalSettled > 0.01 ? formatCLP(g.totalSettled) : '—'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className={`font-mono font-bold text-xs ${g.totalPending > 0 ? 'text-error' : 'text-success'}`}>
                            {g.totalPending > 0.01 ? formatCLP(g.totalPending) : '—'}
                          </div>
                          <div className="mt-1 h-1 bg-border rounded-full overflow-hidden w-24 ml-auto">
                            <div className="h-full bg-success rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            {/* Expand/Collapse */}
                            <Link
                              href={`?tipo=${tipoFlt}&solo_pendientes=${soloPend ? '1' : '0'}&search=${params.search ?? ''}&expand=${isExpanded ? '' : g.auxiliary_id}`}
                              className={`badge text-[10px] px-2 py-0.5 cursor-pointer transition-colors ${
                                isExpanded
                                  ? 'bg-primary/10 text-primary'
                                  : 'bg-surface-high text-text-secondary hover:text-primary'
                              }`}
                            >
                              {isExpanded ? '▲ Colapsar' : '▼ Ver docs'}
                            </Link>
                            {/* Link a cartola */}
                            <Link
                              href={`/contabilidad/auxiliares/${g.auxiliary_id}`}
                              className="badge bg-surface-high text-text-secondary hover:text-info text-[10px] px-2 py-0.5 transition-colors"
                              title="Ver cartola completa"
                            >
                              Cartola
                            </Link>
                          </div>
                        </td>
                      </tr>

                      {/* Detalle documentos (expandible) */}
                      {isExpanded && (
                        <tr key={`${g.auxiliary_id}-detail`}>
                          <td colSpan={8} className="px-0 py-0 bg-surface-high/30">
                            <table className="w-full text-xs border-t border-border/40">
                              <thead>
                                <tr className="text-text-disabled">
                                  <th className="px-6 py-2 text-left font-medium">Documento</th>
                                  <th className="px-4 py-2 text-left font-medium">Fecha</th>
                                  <th className="px-4 py-2 text-left font-medium">Glosa</th>
                                  <th className="px-4 py-2 text-left font-medium w-12">Asiento</th>
                                  <th className="px-4 py-2 text-right font-medium w-28">Original</th>
                                  <th className="px-4 py-2 text-right font-medium w-28">Imputado</th>
                                  <th className="px-4 py-2 text-right font-medium w-28">Pendiente</th>
                                  <th className="px-4 py-2 text-center font-medium w-24">Estado</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-border/20">
                                {g.docs.map((doc, i) => {
                                  const st = DOC_STATUS(doc.pending, doc.amount)
                                  return (
                                    <tr key={i} className="hover:bg-surface/50 transition-colors">
                                      <td className="px-6 py-2">
                                        <div className="flex items-center gap-1.5">
                                          <span className="badge bg-info/10 text-info text-[8px] px-1">{docTypeShort(doc.doc_type)}</span>
                                          <span className="font-mono font-semibold">N°{doc.doc_number}</span>
                                        </div>
                                        <div className="text-[8px] text-text-disabled mt-0.5">{docTypeLabel(doc.doc_type)}</div>
                                      </td>
                                      <td className="px-4 py-2 text-text-secondary whitespace-nowrap">{fmtDate(doc.doc_date)}</td>
                                      <td className="px-4 py-2 text-text-secondary max-w-[200px] truncate" title={doc.glosa}>
                                        {doc.glosa}
                                      </td>
                                      <td className="px-4 py-2">
                                        {doc.entry_id ? (
                                          <Link href={`/contabilidad/libro-diario/${doc.entry_id}`}
                                            className="font-mono text-text-disabled hover:text-primary transition-colors">
                                            #{doc.entry_number}
                                          </Link>
                                        ) : <span className="text-text-disabled">#{doc.entry_number}</span>}
                                      </td>
                                      <td className="px-4 py-2 text-right font-mono">{formatCLP(doc.amount)}</td>
                                      <td className="px-4 py-2 text-right font-mono text-success">
                                        {doc.settled > 0.01 ? formatCLP(doc.settled) : '—'}
                                      </td>
                                      <td className={`px-4 py-2 text-right font-mono font-semibold ${doc.pending > 0.01 ? 'text-error' : 'text-success'}`}>
                                        {doc.pending > 0.01 ? formatCLP(doc.pending) : '—'}
                                      </td>
                                      <td className="px-4 py-2 text-center">
                                        <span className={`badge text-[8px] px-1.5 ${st.cls}`}>{st.label}</span>
                                      </td>
                                    </tr>
                                  )
                                })}
                              </tbody>
                            </table>
                          </td>
                        </tr>
                      )}
                    </>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="bg-surface-high border-t-2 border-border font-bold text-xs">
                  <td colSpan={4} className="px-4 py-3 text-text-secondary">
                    TOTAL — {groups.length} auxiliares mostrados
                  </td>
                  <td className="px-4 py-3 text-right font-mono">
                    {formatCLP(groups.reduce((s, g) => s + g.totalAmount, 0))}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-success">
                    {formatCLP(groups.reduce((s, g) => s + g.totalSettled, 0))}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-error">
                    {formatCLP(groups.reduce((s, g) => s + g.totalPending, 0))}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
