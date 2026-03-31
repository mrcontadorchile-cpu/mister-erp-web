import { createClient } from '@/lib/supabase/server'
import { formatNumber, monthName, accountTypeColor } from '@/lib/utils'
import type { AccountBalance } from '@/types/database'

export default async function Balance8ColPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile }  = await supabase
    .from('user_profiles').select('company_id').eq('id', user!.id).single()

  const companyId = profile?.company_id as string
  const now   = new Date()
  const year  = parseInt(params.year  ?? String(now.getFullYear()))
  const month = parseInt(params.month ?? String(now.getMonth() + 1))

  const [prevRes, movRes, currRes] = await Promise.all([
    month > 1
      ? supabase.rpc('conta.get_account_balances', { p_company_id: companyId, p_year: year, p_month_from: 1, p_month_to: month - 1 })
      : Promise.resolve({ data: [] }),
    supabase.rpc('conta.get_account_balances', { p_company_id: companyId, p_year: year, p_month_from: month, p_month_to: month }),
    supabase.rpc('conta.get_account_balances', { p_company_id: companyId, p_year: year, p_month_from: 1, p_month_to: month }),
  ])

  const prevMap = new Map(((prevRes.data ?? []) as AccountBalance[]).map(b => [b.code, b]))
  const movMap  = new Map(((movRes.data ?? []) as AccountBalance[]).map(b => [b.code, b]))
  const currMap = new Map(((currRes.data ?? []) as AccountBalance[]).map(b => [b.code, b]))

  // Unión de todos los códigos con movimiento
  const allCodes = new Set([...prevMap.keys(), ...movMap.keys(), ...currMap.keys()])
  const rows = Array.from(allCodes).sort().map(code => {
    const curr = currMap.get(code) ?? movMap.get(code) ?? prevMap.get(code)!
    const prevBal = prevMap.get(code)?.balance ?? 0
    const currBal = currMap.get(code)?.balance ?? 0
    const mov = movMap.get(code)

    const saldoAntDebe  = prevBal > 0 ? prevBal : 0
    const saldoAntHaber = prevBal < 0 ? Math.abs(prevBal) : 0
    const saldoActDebe  = currBal > 0 ? currBal : 0
    const saldoActHaber = currBal < 0 ? Math.abs(currBal) : 0

    let invDeudor = 0, invAcreedor = 0, resPerdidas = 0, resGanancias = 0
    switch (curr.type) {
      case 'ACTIVO':
        invDeudor   = saldoActDebe
        invAcreedor = saldoActHaber
        break
      case 'PASIVO': case 'PATRIMONIO':
        invAcreedor = saldoActHaber
        invDeudor   = saldoActDebe
        break
      case 'INGRESO':
        resGanancias = Math.abs(currBal)
        break
      case 'EGRESO':
        resPerdidas  = Math.abs(currBal)
        break
    }

    return {
      code,
      name: curr.name,
      type: curr.type,
      saldoAntDebe, saldoAntHaber,
      movDebe:  mov?.total_debit  ?? 0,
      movHaber: mov?.total_credit ?? 0,
      saldoActDebe, saldoActHaber,
      invDeudor, invAcreedor,
      resPerdidas, resGanancias,
    }
  })

  const T = (key: keyof typeof rows[0]) =>
    rows.reduce((s, r) => s + (r[key] as number), 0)

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Balance de 8 Columnas</h1>
          <p className="text-text-secondary text-sm mt-1">{monthName(month)} {year}</p>
        </div>
        <form className="flex gap-2">
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
      </div>

      <div className="card overflow-x-auto">
        <table className="text-xs w-full">
          <thead>
            <tr className="table-header">
              <th className="px-3 py-2.5 text-left sticky left-0 bg-surface-high">Código</th>
              <th className="px-3 py-2.5 text-left min-w-48 sticky left-16 bg-surface-high">Cuenta</th>
              <th colSpan={2} className="px-3 py-2 text-center border-l border-border text-info">Saldo Anterior</th>
              <th colSpan={2} className="px-3 py-2 text-center border-l border-border text-warning">Movimientos</th>
              <th colSpan={2} className="px-3 py-2 text-center border-l border-border text-success">Saldo Actual</th>
              <th colSpan={2} className="px-3 py-2 text-center border-l border-border text-patrimonio">Inventario</th>
              <th colSpan={2} className="px-3 py-2 text-center border-l border-border text-error">Resultado</th>
            </tr>
            <tr className="table-header border-t border-border">
              <th className="sticky left-0 bg-surface-high" />
              <th className="sticky left-16 bg-surface-high" />
              <th className="px-3 py-1.5 text-right border-l border-border text-info/70">DEBE</th>
              <th className="px-3 py-1.5 text-right text-warning/70">HABER</th>
              <th className="px-3 py-1.5 text-right border-l border-border text-info/70">DEBE</th>
              <th className="px-3 py-1.5 text-right text-warning/70">HABER</th>
              <th className="px-3 py-1.5 text-right border-l border-border text-info/70">DEBE</th>
              <th className="px-3 py-1.5 text-right text-warning/70">HABER</th>
              <th className="px-3 py-1.5 text-right border-l border-border text-activo/70">Deudor</th>
              <th className="px-3 py-1.5 text-right text-pasivo/70">Acreedor</th>
              <th className="px-3 py-1.5 text-right border-l border-border text-error/70">Pérd.</th>
              <th className="px-3 py-1.5 text-right text-success/70">Gan.</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.code} className="table-row">
                <td className="px-3 py-2 font-mono sticky left-0 bg-background" style={{ color: accountTypeColor(r.type as any) }}>
                  {r.code}
                </td>
                <td className="px-3 py-2 text-text-secondary max-w-xs truncate sticky left-16 bg-background">{r.name}</td>
                <td className="px-3 py-2 text-right font-mono text-info border-l border-border/50">{r.saldoAntDebe > 0 ? formatNumber(r.saldoAntDebe) : ''}</td>
                <td className="px-3 py-2 text-right font-mono text-warning">{r.saldoAntHaber > 0 ? formatNumber(r.saldoAntHaber) : ''}</td>
                <td className="px-3 py-2 text-right font-mono text-info border-l border-border/50">{r.movDebe > 0 ? formatNumber(r.movDebe) : ''}</td>
                <td className="px-3 py-2 text-right font-mono text-warning">{r.movHaber > 0 ? formatNumber(r.movHaber) : ''}</td>
                <td className="px-3 py-2 text-right font-mono text-info border-l border-border/50">{r.saldoActDebe > 0 ? formatNumber(r.saldoActDebe) : ''}</td>
                <td className="px-3 py-2 text-right font-mono text-warning">{r.saldoActHaber > 0 ? formatNumber(r.saldoActHaber) : ''}</td>
                <td className="px-3 py-2 text-right font-mono text-activo border-l border-border/50">{r.invDeudor > 0 ? formatNumber(r.invDeudor) : ''}</td>
                <td className="px-3 py-2 text-right font-mono text-pasivo">{r.invAcreedor > 0 ? formatNumber(r.invAcreedor) : ''}</td>
                <td className="px-3 py-2 text-right font-mono text-error border-l border-border/50">{r.resPerdidas > 0 ? formatNumber(r.resPerdidas) : ''}</td>
                <td className="px-3 py-2 text-right font-mono text-success">{r.resGanancias > 0 ? formatNumber(r.resGanancias) : ''}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-border bg-surface-high font-bold">
              <td colSpan={2} className="px-3 py-3 text-xs font-bold text-text-secondary sticky left-0 bg-surface-high">TOTALES</td>
              <td className="px-3 py-3 text-right font-mono text-info text-xs border-l border-border">{formatNumber(T('saldoAntDebe'))}</td>
              <td className="px-3 py-3 text-right font-mono text-warning text-xs">{formatNumber(T('saldoAntHaber'))}</td>
              <td className="px-3 py-3 text-right font-mono text-info text-xs border-l border-border">{formatNumber(T('movDebe'))}</td>
              <td className="px-3 py-3 text-right font-mono text-warning text-xs">{formatNumber(T('movHaber'))}</td>
              <td className="px-3 py-3 text-right font-mono text-info text-xs border-l border-border">{formatNumber(T('saldoActDebe'))}</td>
              <td className="px-3 py-3 text-right font-mono text-warning text-xs">{formatNumber(T('saldoActHaber'))}</td>
              <td className="px-3 py-3 text-right font-mono text-activo text-xs border-l border-border">{formatNumber(T('invDeudor'))}</td>
              <td className="px-3 py-3 text-right font-mono text-pasivo text-xs">{formatNumber(T('invAcreedor'))}</td>
              <td className="px-3 py-3 text-right font-mono text-error text-xs border-l border-border">{formatNumber(T('resPerdidas'))}</td>
              <td className="px-3 py-3 text-right font-mono text-success text-xs">{formatNumber(T('resGanancias'))}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
