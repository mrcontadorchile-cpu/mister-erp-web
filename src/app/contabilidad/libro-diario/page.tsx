import { createClient } from '@/lib/supabase/server'
import { formatCLP, monthName } from '@/lib/utils'
import Link from 'next/link'

const ENTRY_TYPE_LABEL: Record<string, string> = {
  MANUAL:            'Manual',
  SII_FACTURA:       'Factura SII',
  SII_HONORARIO:     'Honorario SII',
  INVENTARIO_VENTA:  'Venta Inventario',
  INVENTARIO_COMPRA: 'Compra Inventario',
}

type SortField = 'number' | 'date' | 'glosa' | 'type' | 'status'

export default async function LibroDiarioPage({
  searchParams,
}: {
  searchParams: Promise<{
    year?: string; month?: string
    q?: string; type?: string; status?: string
    sort?: string; dir?: string
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

  const q         = params.q?.trim() ?? ''
  const typeFilter = params.type ?? ''
  const statusFilter = params.status ?? ''
  const sort      = (params.sort ?? 'number') as SortField
  const dir       = params.dir === 'desc' ? 'desc' : 'asc'
  const searching = q.length > 0

  // --- Consulta ---
  let entries: any[] = []
  let period: { id: string; status: string } | null = null
  let isClosed = false

  if (searching) {
    // Búsqueda global: ignora período, busca en toda la empresa
    let q2 = supabase
      .schema('conta').from('journal_entries')
      .select(`id, number, date, glosa, type, status, journal_lines(debit, credit)`)
      .eq('company_id', companyId)
      .ilike('glosa', `%${q}%`)

    if (typeFilter)   q2 = q2.eq('type', typeFilter)
    if (statusFilter) q2 = q2.eq('status', statusFilter)

    const sortCol = sort === 'number' ? 'number' : sort === 'date' ? 'date' : sort === 'glosa' ? 'glosa' : sort === 'type' ? 'type' : 'status'
    q2 = q2.order(sortCol, { ascending: dir === 'asc' }).limit(500)

    const { data } = await q2
    entries = (data ?? []).map(e => {
      const lines = (e.journal_lines ?? []) as { debit: number; credit: number }[]
      return { ...e, total_debit: lines.reduce((s: number, l) => s + l.debit, 0), total_credit: lines.reduce((s: number, l) => s + l.credit, 0) }
    })
  } else {
    // Vista por período
    const { data: p } = await supabase
      .schema('conta').from('periods')
      .select('id, status')
      .eq('company_id', companyId)
      .eq('year', year).eq('month', month)
      .maybeSingle()

    period   = p
    isClosed = p?.status === 'closed'

    if (p) {
      let q2 = supabase
        .schema('conta').from('journal_entries')
        .select(`id, number, date, glosa, type, status, journal_lines(debit, credit)`)
        .eq('period_id', p.id)

      if (typeFilter)   q2 = q2.eq('type', typeFilter)
      if (statusFilter) q2 = q2.eq('status', statusFilter)

      const sortCol = sort === 'number' ? 'number' : sort === 'date' ? 'date' : sort === 'glosa' ? 'glosa' : sort === 'type' ? 'type' : 'status'
      q2 = q2.order(sortCol, { ascending: dir === 'asc' })

      const { data } = await q2
      entries = (data ?? []).map(e => {
        const lines = (e.journal_lines ?? []) as { debit: number; credit: number }[]
        return { ...e, total_debit: lines.reduce((s: number, l) => s + l.debit, 0), total_credit: lines.reduce((s: number, l) => s + l.credit, 0) }
      })
    }
  }

  // Helpers para links de ordenamiento
  const sortLink = (field: SortField) => {
    const newDir = sort === field && dir === 'asc' ? 'desc' : 'asc'
    const base = searching
      ? `?q=${encodeURIComponent(q)}`
      : `?year=${year}&month=${month}`
    const extra = [
      typeFilter   ? `&type=${typeFilter}`     : '',
      statusFilter ? `&status=${statusFilter}` : '',
    ].join('')
    return `${base}&sort=${field}&dir=${newDir}${extra}`
  }

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sort !== field) return <span className="ml-1 text-text-disabled opacity-40">↕</span>
    return <span className="ml-1">{dir === 'asc' ? '↑' : '↓'}</span>
  }

  // Params base para mantener filtros al cambiar mes/año
  const filterBase = [
    typeFilter   ? `&type=${typeFilter}`     : '',
    statusFilter ? `&status=${statusFilter}` : '',
    sort !== 'number' ? `&sort=${sort}&dir=${dir}` : '',
  ].join('')

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Libro Diario</h1>
          <p className="text-text-secondary text-sm mt-1">
            {searching
              ? `${entries.length} resultado${entries.length !== 1 ? 's' : ''} para "${q}"`
              : `${monthName(month)} ${year} — ${entries.length} asientos`}
          </p>
        </div>
        {!isClosed && !searching && (
          <Link href="/contabilidad/libro-diario/nuevo" className="btn-primary flex items-center gap-2 text-sm">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Nuevo Asiento
          </Link>
        )}
      </div>

      {/* Barra de filtros */}
      <form method="GET" className="flex flex-wrap items-center gap-2 mb-5">
        {/* Búsqueda por glosa */}
        <div className="relative flex-1 min-w-56">
          <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-disabled" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
          </svg>
          <input
            name="q"
            defaultValue={q}
            placeholder="Buscar por glosa..."
            className="input text-sm pl-9 w-full"
            autoComplete="off"
          />
          {q && (
            <a
              href={`?year=${year}&month=${month}${filterBase}`}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-text-disabled hover:text-error text-xs px-1"
              title="Limpiar búsqueda"
            >✕</a>
          )}
        </div>

        {/* Tipo */}
        <select name="type" defaultValue={typeFilter} className="input w-40 text-sm">
          <option value="">Todos los tipos</option>
          {Object.entries(ENTRY_TYPE_LABEL).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>

        {/* Estado */}
        <select name="status" defaultValue={statusFilter} className="input w-40 text-sm">
          <option value="">Todos los estados</option>
          <option value="posted">Contabilizado</option>
          <option value="draft">Borrador</option>
          <option value="reversed">Revertido</option>
        </select>

        {/* Período (solo cuando no se busca) */}
        {!q && (
          <>
            <select name="month" defaultValue={month} className="input w-36 text-sm">
              {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                <option key={m} value={m}>{monthName(m)}</option>
              ))}
            </select>
            <select name="year" defaultValue={year} className="input w-24 text-sm">
              {[year - 2, year - 1, year, year + 1].map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </>
        )}

        <button type="submit" className="btn-primary px-4 py-2 text-sm">Filtrar</button>

        {(q || typeFilter || statusFilter) && (
          <a href={`?year=${year}&month=${month}`} className="btn-ghost px-4 py-2 text-sm text-text-disabled">
            Limpiar
          </a>
        )}
      </form>

      {/* Banner período */}
      {!searching && period && (
        <div className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm mb-5 ${
          isClosed ? 'bg-error/5 border-error/20 text-error' : 'bg-success/5 border-success/20 text-success'
        }`}>
          <div className={`w-1.5 h-1.5 rounded-full ${isClosed ? 'bg-error' : 'bg-success'}`} />
          Período {isClosed ? 'cerrado' : 'abierto'} — {monthName(month)} {year}
          {!isClosed && (
            <Link href="/contabilidad/periodos" className="ml-auto text-xs text-text-disabled hover:text-primary underline">
              Gestionar períodos →
            </Link>
          )}
        </div>
      )}

      {/* Sin período */}
      {!searching && !period && (
        <div className="card p-8 text-center text-text-disabled mb-6">
          <p>Sin movimientos para {monthName(month)} {year}</p>
          <Link href="/contabilidad/libro-diario/nuevo" className="btn-primary inline-flex items-center gap-2 mt-4 text-sm">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Crear primer asiento
          </Link>
        </div>
      )}

      {/* Sin resultados de búsqueda */}
      {searching && entries.length === 0 && (
        <div className="card p-8 text-center text-text-disabled">
          <p>No se encontraron asientos con "{q}"</p>
        </div>
      )}

      {/* Tabla */}
      {entries.length > 0 && (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="table-header">
                <th className="px-4 py-3 text-left w-16">
                  <Link href={sortLink('number')} className="hover:text-primary flex items-center">
                    N° <SortIcon field="number" />
                  </Link>
                </th>
                <th className="px-4 py-3 text-left w-28">
                  <Link href={sortLink('date')} className="hover:text-primary flex items-center">
                    Fecha <SortIcon field="date" />
                  </Link>
                </th>
                <th className="px-4 py-3 text-left">
                  <Link href={sortLink('glosa')} className="hover:text-primary flex items-center">
                    Glosa <SortIcon field="glosa" />
                  </Link>
                </th>
                <th className="px-4 py-3 text-left w-36">
                  <Link href={sortLink('type')} className="hover:text-primary flex items-center">
                    Tipo <SortIcon field="type" />
                  </Link>
                </th>
                <th className="px-4 py-3 text-right w-36">DEBE</th>
                <th className="px-4 py-3 text-right w-36">HABER</th>
                <th className="px-4 py-3 text-center w-28">
                  <Link href={sortLink('status')} className="hover:text-primary flex items-center justify-center">
                    Estado <SortIcon field="status" />
                  </Link>
                </th>
                <th className="px-4 py-3 text-center w-20">Ver</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="table-row">
                  <td className="px-4 py-3 font-mono text-text-disabled text-xs">#{e.number}</td>
                  <td className="px-4 py-3 text-text-secondary text-xs">
                    {e.date}
                  </td>
                  <td className="px-4 py-3 text-text-primary max-w-xs">
                    {q ? <HighlightText text={e.glosa} query={q} /> : <span className="truncate block">{e.glosa}</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className="badge bg-surface-high text-text-secondary text-xs">
                      {ENTRY_TYPE_LABEL[e.type] ?? e.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-info text-xs">
                    {formatCLP(e.total_debit)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-warning text-xs">
                    {formatCLP(e.total_credit)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <StatusBadge status={e.status} />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Link
                      href={`/contabilidad/libro-diario/${e.id}`}
                      className="text-text-disabled hover:text-primary transition-colors"
                    >
                      <svg className="w-4 h-4 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-surface-high border-t-2 border-border">
                <td colSpan={4} className="px-4 py-3 text-xs font-bold text-text-secondary">
                  TOTALES {searching && <span className="font-normal text-text-disabled">({entries.length} asientos)</span>}
                </td>
                <td className="px-4 py-3 text-right font-bold text-info text-sm font-mono">
                  {formatCLP(entries.reduce((s, e) => s + e.total_debit, 0))}
                </td>
                <td className="px-4 py-3 text-right font-bold text-warning text-sm font-mono">
                  {formatCLP(entries.reduce((s, e) => s + e.total_credit, 0))}
                </td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}

function HighlightText({ text, query }: { text: string; query: string }) {
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return <span className="truncate block">{text}</span>
  return (
    <span className="block">
      {text.slice(0, idx)}
      <mark className="bg-warning/30 text-text-primary rounded-sm">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </span>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    posted:   { label: 'Contabilizado', cls: 'bg-success/10 text-success' },
    draft:    { label: 'Borrador',      cls: 'bg-warning/10 text-warning' },
    reversed: { label: 'Revertido',     cls: 'bg-error/10 text-error' },
  }
  const s = map[status] ?? { label: status, cls: 'bg-surface-high text-text-disabled' }
  return <span className={`badge ${s.cls}`}>{s.label}</span>
}
