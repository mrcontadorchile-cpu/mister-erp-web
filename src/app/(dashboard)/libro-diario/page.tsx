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

export default async function LibroDiarioPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>
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

  const { data: period } = await supabase
    .from('conta.periods')
    .select('id, status')
    .eq('company_id', companyId)
    .eq('year', year).eq('month', month)
    .maybeSingle()

  let entries: any[] = []
  if (period) {
    const { data } = await supabase
      .from('conta.journal_entries')
      .select(`id, number, date, glosa, type, status, conta_journal_lines(debit, credit)`)
      .eq('period_id', period.id)
      .order('number')

    entries = (data ?? []).map(e => {
      const lines = (e.conta_journal_lines ?? []) as { debit: number; credit: number }[]
      return {
        ...e,
        total_debit:  lines.reduce((s: number, l) => s + l.debit, 0),
        total_credit: lines.reduce((s: number, l) => s + l.credit, 0),
      }
    })
  }

  const isClosed = period?.status === 'closed'

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Libro Diario</h1>
          <p className="text-text-secondary text-sm mt-1">
            {monthName(month)} {year} — {entries.length} asientos
          </p>
        </div>
        <div className="flex items-center gap-3">
          <form className="flex items-center gap-2">
            <select name="month" defaultValue={month} className="input w-36 text-sm">
              {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                <option key={m} value={m}>{monthName(m)}</option>
              ))}
            </select>
            <select name="year" defaultValue={year} className="input w-24 text-sm">
              {[year - 1, year, year + 1].map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <button type="submit" className="btn-primary px-4 py-2 text-sm">Ver</button>
          </form>
          {!isClosed && (
            <Link href="/libro-diario/nuevo" className="btn-primary flex items-center gap-2 text-sm">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Nuevo Asiento
            </Link>
          )}
        </div>
      </div>

      {period && (
        <div className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm mb-6 ${
          isClosed ? 'bg-error/5 border-error/20 text-error' : 'bg-success/5 border-success/20 text-success'
        }`}>
          <div className={`w-1.5 h-1.5 rounded-full ${isClosed ? 'bg-error' : 'bg-success'}`} />
          Período {isClosed ? 'cerrado' : 'abierto'} — {monthName(month)} {year}
          {!isClosed && (
            <Link href="/periodos" className="ml-auto text-xs text-text-disabled hover:text-primary underline">
              Gestionar períodos →
            </Link>
          )}
        </div>
      )}

      {!period && (
        <div className="card p-8 text-center text-text-disabled mb-6">
          <p>Sin movimientos para {monthName(month)} {year}</p>
          <Link href="/libro-diario/nuevo" className="btn-primary inline-flex items-center gap-2 mt-4 text-sm">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Crear primer asiento
          </Link>
        </div>
      )}

      {entries.length > 0 && (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="table-header">
                <th className="px-4 py-3 text-left w-16">N°</th>
                <th className="px-4 py-3 text-left w-28">Fecha</th>
                <th className="px-4 py-3 text-left">Glosa</th>
                <th className="px-4 py-3 text-left w-36">Tipo</th>
                <th className="px-4 py-3 text-right w-36">DEBE</th>
                <th className="px-4 py-3 text-right w-36">HABER</th>
                <th className="px-4 py-3 text-center w-28">Estado</th>
                <th className="px-4 py-3 text-center w-20">Ver</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="table-row">
                  <td className="px-4 py-3 font-mono text-text-disabled text-xs">#{e.number}</td>
                  <td className="px-4 py-3 text-text-secondary text-xs">
                    {new Date(e.date).toLocaleDateString('es-CL')}
                  </td>
                  <td className="px-4 py-3 text-text-primary max-w-xs truncate">{e.glosa}</td>
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
                      href={`/libro-diario/${e.id}`}
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
                <td colSpan={4} className="px-4 py-3 text-xs font-bold text-text-secondary">TOTALES</td>
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

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    posted:   { label: 'Contabilizado', cls: 'bg-success/10 text-success' },
    draft:    { label: 'Borrador',      cls: 'bg-warning/10 text-warning' },
    reversed: { label: 'Revertido',     cls: 'bg-error/10 text-error' },
  }
  const s = map[status] ?? { label: status, cls: 'bg-surface-high text-text-disabled' }
  return <span className={`badge ${s.cls}`}>{s.label}</span>
}
