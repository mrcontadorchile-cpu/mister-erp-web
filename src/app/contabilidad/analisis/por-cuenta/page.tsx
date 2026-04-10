import { createClient } from '@/lib/supabase/server'
import { formatCLP, accountTypeColor, accountTypeLabel } from '@/lib/utils'
import { docTypeShort, docTypeLabel } from '@/lib/doc-types'
import Link from 'next/link'
import type { AccountType } from '@/types/database'

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface DocRow {
  account_id:    string
  account_code:  string
  account_name:  string
  account_type:  string
  account_nature:string
  auxiliary_id:  string
  aux_code:      string
  aux_name:      string
  aux_rut:       string | null
  doc_type:      string
  doc_number:    string
  doc_date:      string
  glosa:         string
  entry_number:  number
  entry_id:      string
  amount:        number
  settled:       number
  pending:       number
}

interface AccountGroup {
  account_id:    string
  account_code:  string
  account_name:  string
  account_type:  string
  account_nature:string
  docs:          DocRow[]
  totalAmount:   number
  totalSettled:  number
  totalPending:  number
  pendingCount:  number
}

const STATUS = (pending: number, amount: number) => {
  if (pending <= 0.01)         return { label: 'SALDADO',   cls: 'bg-success/10 text-success' }
  if (pending < amount - 0.01) return { label: 'PARCIAL',   cls: 'bg-warning/10 text-warning' }
  return                              { label: 'PENDIENTE', cls: 'bg-error/10 text-error' }
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function AnalisisPorCuentaPage({
  searchParams,
}: {
  searchParams: Promise<{ solo_pendientes?: string; search?: string }>
}) {
  const params    = await searchParams
  const soloPend  = params.solo_pendientes !== '0'  // default: solo pendientes
  const search    = (params.search ?? '').toLowerCase()

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('user_profiles').select('company_id').eq('id', user!.id).single()
  const companyId = profile?.company_id as string

  // Todos los documentos (vista account_open_documents)
  const { data: raw } = await supabase
    .schema('conta').from('account_open_documents')
    .select(`
      account_id, account_code, account_name, account_type, account_nature,
      auxiliary_id, aux_code, aux_name, aux_rut,
      doc_type, doc_number, doc_date, glosa, entry_number, entry_id,
      amount, settled, pending
    `)
    .eq('company_id', companyId)
    .order('account_code')
    .order('doc_date')

  const allDocs = (raw ?? []).map((r: any) => ({
    ...r,
    amount:  Number(r.amount  ?? 0),
    settled: Number(r.settled ?? 0),
    pending: Number(r.pending ?? 0),
    entry_id: r.entry_id ?? '',
  })) as DocRow[]

  // Filtrar según toggle
  const filtered = allDocs.filter(d => {
    if (soloPend && d.pending <= 0.01) return false
    if (search) {
      const hay = `${d.account_code} ${d.account_name} ${d.aux_name} ${d.doc_number} ${d.glosa}`.toLowerCase()
      if (!hay.includes(search)) return false
    }
    return true
  })

  // Agrupar por cuenta
  const groupMap = new Map<string, AccountGroup>()
  for (const doc of filtered) {
    if (!groupMap.has(doc.account_id)) {
      groupMap.set(doc.account_id, {
        account_id:     doc.account_id,
        account_code:   doc.account_code,
        account_name:   doc.account_name,
        account_type:   doc.account_type,
        account_nature: doc.account_nature,
        docs:           [],
        totalAmount:    0,
        totalSettled:   0,
        totalPending:   0,
        pendingCount:   0,
      })
    }
    const g = groupMap.get(doc.account_id)!
    g.docs.push(doc)
    g.totalAmount  += doc.amount
    g.totalSettled += doc.settled
    g.totalPending += doc.pending
    if (doc.pending > 0.01) g.pendingCount++
  }

  const groups = [...groupMap.values()].sort((a, b) => a.account_code.localeCompare(b.account_code))

  const grandPending = groups.reduce((s, g) => s + g.totalPending, 0)
  const grandDocs    = allDocs.length
  const grandPendCount = allDocs.filter(d => d.pending > 0.01).length

  const fmtDate = (iso: string) =>
    iso ? new Date(iso + 'T12:00:00').toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—'

  return (
    <div className="p-8 max-w-7xl mx-auto">

      {/* Encabezado */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Análisis por Cuenta</h1>
          <p className="text-text-secondary text-sm mt-1">
            Documentos pendientes por cuenta contable — CxP, CxC y similares
          </p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        <div className="card p-4">
          <p className="text-xs text-text-disabled mb-1">Cuentas con documentos</p>
          <p className="font-bold text-xl font-mono">{groupMap.size}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-text-disabled mb-1">Total documentos</p>
          <p className="font-bold text-xl font-mono">{grandDocs}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-text-disabled mb-1">Documentos pendientes</p>
          <p className="font-bold text-xl font-mono text-error">{grandPendCount}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-text-disabled mb-1">Monto total pendiente</p>
          <p className="font-bold text-xl font-mono text-warning">{formatCLP(grandPending)}</p>
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
            placeholder="Cuenta, auxiliar, número doc..."
          />
        </div>
        <div className="flex gap-1 items-end">
          <button type="submit" name="solo_pendientes" value="1"
            className={`px-3 py-2 rounded-lg text-sm border transition-colors ${
              soloPend
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-surface border-border text-text-secondary hover:text-text-primary'
            }`}>
            Solo pendientes
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
            ? 'Sin documentos registrados. Los documentos aparecen aquí al ingresar asientos con tipo y número de documento.'
            : 'No hay documentos pendientes. Todos los documentos han sido saldados.'}
        </div>
      )}

      {/* Grupos por cuenta */}
      <div className="space-y-6">
        {groups.map(g => {
          const color = accountTypeColor(g.account_type as AccountType)
          return (
            <div key={g.account_id} className="card overflow-hidden">

              {/* Cabecera de cuenta */}
              <div className="px-5 py-3.5 border-b border-border flex items-center justify-between gap-4"
                style={{ borderLeftWidth: 4, borderLeftColor: color }}>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono font-bold text-sm" style={{ color }}>{g.account_code}</span>
                  <span className="font-semibold text-sm text-text-primary">{g.account_name}</span>
                  <span className="badge text-xs" style={{ color, backgroundColor: `${color}15` }}>
                    {accountTypeLabel(g.account_type as AccountType)}
                  </span>
                </div>
                <div className="flex items-center gap-5 shrink-0 text-right text-xs">
                  <div>
                    <p className="text-text-disabled">Docs</p>
                    <p className="font-mono font-semibold">{g.docs.length}</p>
                  </div>
                  <div>
                    <p className="text-text-disabled">Monto original</p>
                    <p className="font-mono text-text-primary">{formatCLP(g.totalAmount)}</p>
                  </div>
                  <div>
                    <p className="text-text-disabled">Imputado</p>
                    <p className="font-mono text-success">{formatCLP(g.totalSettled)}</p>
                  </div>
                  <div>
                    <p className="text-text-disabled">Pendiente</p>
                    <p className={`font-mono font-bold ${g.totalPending > 0 ? 'text-error' : 'text-success'}`}>
                      {g.totalPending > 0.01 ? formatCLP(g.totalPending) : '—'}
                    </p>
                  </div>
                  {g.pendingCount > 0 && (
                    <div>
                      <p className="text-text-disabled">Pend.</p>
                      <p className="font-mono text-error">{g.pendingCount} docs</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Tabla documentos */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="table-header text-xs">
                      <th className="px-4 py-2.5 text-left">Documento</th>
                      <th className="px-4 py-2.5 text-left">Auxiliar</th>
                      <th className="px-4 py-2.5 text-left w-20">Fecha</th>
                      <th className="px-4 py-2.5 text-left">Glosa</th>
                      <th className="px-4 py-2.5 text-left w-12">Asiento</th>
                      <th className="px-4 py-2.5 text-right w-28">Original</th>
                      <th className="px-4 py-2.5 text-right w-28">Imputado</th>
                      <th className="px-4 py-2.5 text-right w-28">Pendiente</th>
                      <th className="px-4 py-2.5 text-center w-24">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.docs.map((doc, i) => {
                      const st  = STATUS(doc.pending, doc.amount)
                      const pct = doc.amount > 0 ? Math.min(100, (doc.settled / doc.amount) * 100) : 0
                      return (
                        <tr key={i} className="table-row text-xs">
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-1.5">
                              <span className="badge bg-info/10 text-info text-[9px] px-1">{docTypeShort(doc.doc_type)}</span>
                              <span className="font-mono font-semibold">N°{doc.doc_number}</span>
                            </div>
                            <div className="text-[9px] text-text-disabled mt-0.5">{docTypeLabel(doc.doc_type)}</div>
                          </td>
                          <td className="px-4 py-2.5">
                            <div className="font-medium text-text-primary">{doc.aux_name}</div>
                            {doc.aux_rut && <div className="text-[9px] text-text-disabled font-mono">{doc.aux_rut}</div>}
                          </td>
                          <td className="px-4 py-2.5 text-text-secondary whitespace-nowrap">{fmtDate(doc.doc_date)}</td>
                          <td className="px-4 py-2.5 text-text-secondary max-w-[180px] truncate" title={doc.glosa}>
                            {doc.glosa}
                          </td>
                          <td className="px-4 py-2.5">
                            {doc.entry_id ? (
                              <Link href={`/contabilidad/libro-diario/${doc.entry_id}`}
                                className="font-mono text-text-disabled hover:text-primary transition-colors">
                                #{doc.entry_number}
                              </Link>
                            ) : <span className="text-text-disabled">#{doc.entry_number}</span>}
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono">{formatCLP(doc.amount)}</td>
                          <td className="px-4 py-2.5 text-right font-mono text-success">
                            {doc.settled > 0.01 ? formatCLP(doc.settled) : '—'}
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <div className={`font-mono font-semibold ${doc.pending > 0.01 ? 'text-error' : 'text-success'}`}>
                              {doc.pending > 0.01 ? formatCLP(doc.pending) : '—'}
                            </div>
                            {doc.amount > 0 && (
                              <div className="mt-1 h-1 bg-border rounded-full overflow-hidden w-20 ml-auto">
                                <div className="h-full bg-success rounded-full" style={{ width: `${pct}%` }} />
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            <span className={`badge text-[9px] px-1.5 ${st.cls}`}>{st.label}</span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-surface-high border-t border-border text-xs font-bold">
                      <td colSpan={5} className="px-4 py-2.5 text-text-secondary">
                        Subtotal {g.account_code} — {g.docs.length} docs
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono">{formatCLP(g.totalAmount)}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-success">{formatCLP(g.totalSettled)}</td>
                      <td className={`px-4 py-2.5 text-right font-mono ${g.totalPending > 0 ? 'text-error' : 'text-success'}`}>
                        {g.totalPending > 0.01 ? formatCLP(g.totalPending) : '—'}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
