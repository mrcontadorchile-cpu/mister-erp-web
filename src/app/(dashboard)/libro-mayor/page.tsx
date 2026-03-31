import { createClient } from '@/lib/supabase/server'
import { formatCLP, accountTypeColor, accountTypeLabel, monthName } from '@/lib/utils'
import type { Account, AccountType } from '@/types/database'
import Link from 'next/link'

export default async function LibroMayorPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string; account_id?: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('user_profiles').select('company_id').eq('id', user!.id).single()

  const companyId = profile?.company_id as string
  const now = new Date()
  const year  = parseInt(params.year  ?? String(now.getFullYear()))
  const month = parseInt(params.month ?? String(now.getMonth() + 1))

  // Cuentas que permiten movimiento
  const { data: accounts } = await supabase
    .from('conta.accounts')
    .select('id, code, name, type, nature')
    .eq('company_id', companyId)
    .eq('allows_entry', true)
    .eq('active', true)
    .order('code')

  const accs = (accounts ?? []) as Pick<Account, 'id' | 'code' | 'name' | 'type' | 'nature'>[]
  const selectedId = params.account_id ?? accs[0]?.id ?? ''
  const selectedAcc = accs.find(a => a.id === selectedId)

  // Movimientos de la cuenta seleccionada
  interface LineRow {
    id: string
    debit: number
    credit: number
    description: string | null
    conta_journal_entries: {
      number: number
      date: string
      glosa: string
      status: string
    } | null
  }

  let lines: LineRow[] = []
  let saldoAnterior = 0

  if (selectedId) {
    // Saldo anterior (meses anteriores del mismo año)
    if (month > 1) {
      const { data: prevBal } = await supabase
        .rpc('conta.get_account_balances', {
          p_company_id: companyId,
          p_year: year,
          p_month_from: 1,
          p_month_to: month - 1,
        })
      const prev = (prevBal ?? []).find((b: { account_id: string; balance: number }) => b.account_id === selectedId)
      saldoAnterior = prev?.balance ?? 0
    }

    // Período actual
    const { data: period } = await supabase
      .from('conta.periods')
      .select('id')
      .eq('company_id', companyId)
      .eq('year', year)
      .eq('month', month)
      .maybeSingle()

    if (period) {
      const { data } = await supabase
        .from('conta.journal_lines')
        .select(`
          id, debit, credit, description,
          conta_journal_entries!inner(number, date, glosa, status, period_id)
        `)
        .eq('account_id', selectedId)
        .eq('conta_journal_entries.period_id', period.id)
        .order('conta_journal_entries(date)')
        .order('conta_journal_entries(number)')

      lines = (data ?? []) as unknown as LineRow[]
    }
  }

  // Calcular saldo corriente
  let saldoCorriente = saldoAnterior
  const linesWithBalance = lines.map(l => {
    const nature = selectedAcc?.nature
    if (nature === 'DEUDOR') {
      saldoCorriente += l.debit - l.credit
    } else {
      saldoCorriente += l.credit - l.debit
    }
    return { ...l, balance: saldoCorriente }
  })

  const totalDebe  = lines.reduce((s, l) => s + l.debit, 0)
  const totalHaber = lines.reduce((s, l) => s + l.credit, 0)

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Libro Mayor</h1>
          <p className="text-text-secondary text-sm mt-1">Movimientos por cuenta contable</p>
        </div>
        <form className="flex gap-2">
          <select name="account_id" defaultValue={selectedId} className="input w-72 text-sm">
            {accs.map(a => (
              <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
            ))}
          </select>
          <select name="month" defaultValue={month} className="input w-36 text-sm">
            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
              <option key={m} value={m}>{monthName(m)}</option>
            ))}
          </select>
          <select name="year" defaultValue={year} className="input w-24 text-sm">
            {[year - 1, year, year + 1].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button type="submit" className="btn-primary px-4 py-2 text-sm">Ver</button>
        </form>
      </div>

      {selectedAcc && (
        <div className="card p-4 mb-5 flex items-center gap-4">
          <div
            className="w-2 h-10 rounded-full"
            style={{ backgroundColor: accountTypeColor(selectedAcc.type as AccountType) }}
          />
          <div>
            <p className="text-lg font-bold font-mono text-text-primary">{selectedAcc.code}</p>
            <p className="text-sm text-text-secondary">{selectedAcc.name}</p>
          </div>
          <div className="ml-auto flex gap-4 text-right">
            <div>
              <p className="text-xs text-text-disabled">Tipo</p>
              <span className="badge text-xs" style={{
                color: accountTypeColor(selectedAcc.type as AccountType),
                backgroundColor: `${accountTypeColor(selectedAcc.type as AccountType)}15`,
              }}>
                {accountTypeLabel(selectedAcc.type as AccountType)}
              </span>
            </div>
            <div>
              <p className="text-xs text-text-disabled">Naturaleza</p>
              <span className={`badge ${selectedAcc.nature === 'DEUDOR' ? 'bg-info/10 text-info' : 'bg-warning/10 text-warning'}`}>
                {selectedAcc.nature}
              </span>
            </div>
            <div>
              <p className="text-xs text-text-disabled">Saldo anterior</p>
              <p className="text-sm font-mono font-bold text-text-primary">{formatCLP(saldoAnterior)}</p>
            </div>
          </div>
        </div>
      )}

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="table-header">
              <th className="px-4 py-3 text-left w-16">N°</th>
              <th className="px-4 py-3 text-left w-28">Fecha</th>
              <th className="px-4 py-3 text-left">Glosa</th>
              <th className="px-4 py-3 text-left">Descripción línea</th>
              <th className="px-4 py-3 text-right w-32">DEBE</th>
              <th className="px-4 py-3 text-right w-32">HABER</th>
              <th className="px-4 py-3 text-right w-36">SALDO</th>
            </tr>
          </thead>
          <tbody>
            {/* Fila saldo anterior */}
            {saldoAnterior !== 0 && (
              <tr className="bg-surface-high/50">
                <td colSpan={4} className="px-4 py-2.5 text-xs text-text-disabled italic">
                  Saldo acumulado anterior ({monthName(month - 1) || 'dic. año anterior'})
                </td>
                <td className="px-4 py-2.5 text-right font-mono text-xs text-info">
                  {saldoAnterior > 0 ? formatCLP(saldoAnterior) : ''}
                </td>
                <td className="px-4 py-2.5 text-right font-mono text-xs text-warning">
                  {saldoAnterior < 0 ? formatCLP(Math.abs(saldoAnterior)) : ''}
                </td>
                <td className="px-4 py-2.5 text-right font-mono text-xs text-text-primary font-bold">
                  {formatCLP(saldoAnterior)}
                </td>
              </tr>
            )}

            {linesWithBalance.map(l => {
              const entry = l.conta_journal_entries
              return (
                <tr key={l.id} className="table-row">
                  <td className="px-4 py-2.5 font-mono text-text-disabled text-xs">
                    #{entry?.number}
                  </td>
                  <td className="px-4 py-2.5 text-text-secondary text-xs">
                    {entry?.date ? new Date(entry.date).toLocaleDateString('es-CL') : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-text-primary max-w-xs truncate">
                    {entry?.glosa}
                  </td>
                  <td className="px-4 py-2.5 text-text-secondary text-xs truncate max-w-[200px]">
                    {l.description ?? '—'}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-info text-xs">
                    {l.debit > 0 ? formatCLP(l.debit) : ''}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-warning text-xs">
                    {l.credit > 0 ? formatCLP(l.credit) : ''}
                  </td>
                  <td className={`px-4 py-2.5 text-right font-mono text-xs font-semibold ${
                    l.balance >= 0 ? 'text-success' : 'text-error'
                  }`}>
                    {formatCLP(l.balance)}
                  </td>
                </tr>
              )
            })}

            {linesWithBalance.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-text-disabled text-sm">
                  Sin movimientos para {selectedAcc?.name} en {monthName(month)} {year}
                </td>
              </tr>
            )}
          </tbody>
          {lines.length > 0 && (
            <tfoot>
              <tr className="bg-surface-high border-t-2 border-border font-bold">
                <td colSpan={4} className="px-4 py-3 text-xs text-text-secondary">TOTALES DEL PERÍODO</td>
                <td className="px-4 py-3 text-right font-mono text-info text-sm">{formatCLP(totalDebe)}</td>
                <td className="px-4 py-3 text-right font-mono text-warning text-sm">{formatCLP(totalHaber)}</td>
                <td className="px-4 py-3 text-right font-mono text-sm text-text-primary">
                  {formatCLP(linesWithBalance[linesWithBalance.length - 1]?.balance ?? 0)}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  )
}
