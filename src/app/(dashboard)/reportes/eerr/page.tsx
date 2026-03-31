import { createClient } from '@/lib/supabase/server'
import { formatCLP, monthName } from '@/lib/utils'

export default async function EerrPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string; acum?: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile }  = await supabase
    .from('user_profiles').select('company_id').eq('id', user!.id).single()

  const companyId = profile?.company_id as string
  const now    = new Date()
  const year   = parseInt(params.year  ?? String(now.getFullYear()))
  const month  = parseInt(params.month ?? String(now.getMonth() + 1))
  const acum   = params.acum === '1'

  const monthFrom = acum ? 1 : month

  // Traer saldos via RPC
  const { data: balances } = await supabase.rpc('conta.get_account_balances', {
    p_company_id: companyId,
    p_year: year,
    p_month_from: monthFrom,
    p_month_to: month,
  })

  const balMap = new Map<string, number>()
  for (const b of balances ?? []) {
    balMap.set(b.code as string, Math.abs(b.balance as number))
  }

  const get = (code: string) => balMap.get(code) ?? 0
  const sumPrefix = (prefix: string) => {
    let total = 0
    for (const [k, v] of balMap) {
      if (k.startsWith(prefix)) total += v
    }
    return total
  }

  // ── Cálculos ──
  const ventas        = sumPrefix('4.1.1.') + sumPrefix('4.1.2.') + sumPrefix('4.1.3.')
  const ingrNoOp      = sumPrefix('4.2.')
  const costoVentas   = sumPrefix('5.')
  const margenBruto   = ventas - costoVentas

  const remuneraciones = sumPrefix('6.1.1.')
  const honorarios     = sumPrefix('6.1.2.')
  const arriendos      = sumPrefix('6.1.3.')
  const servicios      = sumPrefix('6.1.4.')
  const gastosGrales   = sumPrefix('6.1.5.')
  const depreciacion   = sumPrefix('6.1.6.')
  const marketing      = sumPrefix('6.1.7.')
  const totalGastosOp  = remuneraciones + honorarios + arriendos + servicios + gastosGrales + depreciacion + marketing

  const resultadoOp   = margenBruto - totalGastosOp
  const gastosFinanc  = sumPrefix('7.1.1.')
  const difCambio     = sumPrefix('7.1.2.')
  const netNoOp       = ingrNoOp - gastosFinanc - difCambio
  const resultAntImp  = resultadoOp + netNoOp
  const impuesto      = resultAntImp > 0 ? resultAntImp * 0.27 : 0
  const resultFinal   = resultAntImp - impuesto

  const periodLabel = acum
    ? `Enero — ${monthName(month)} ${year}`
    : `${monthName(month)} ${year}`

  return (
    <div className="p-8 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Estado de Resultados</h1>
          <p className="text-text-secondary text-sm mt-1">{periodLabel}</p>
        </div>
        <form className="flex gap-2">
          <select name="month" defaultValue={month} className="input w-32 text-sm">
            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
              <option key={m} value={m}>{monthName(m)}</option>
            ))}
          </select>
          <select name="year" defaultValue={year} className="input w-24 text-sm">
            {[year - 1, year, year + 1].map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <button
            type="submit"
            name="acum" value="0"
            className={`px-3 py-2 rounded-lg text-sm border transition-colors ${
              !acum ? 'bg-primary text-primary-foreground border-primary' : 'bg-surface border-border text-text-secondary hover:text-text-primary'
            }`}
          >
            Mensual
          </button>
          <button
            type="submit"
            name="acum" value="1"
            className={`px-3 py-2 rounded-lg text-sm border transition-colors ${
              acum ? 'bg-primary text-primary-foreground border-primary' : 'bg-surface border-border text-text-secondary hover:text-text-primary'
            }`}
          >
            Acumulado
          </button>
        </form>
      </div>

      {/* Tabla EERR */}
      <div className="card overflow-hidden">
        <EerrSection title="INGRESOS OPERACIONALES" />
        <EerrLine label="Ventas" amount={ventas} />
        {ingrNoOp > 0 && <EerrLine label="Otros ingresos" amount={ingrNoOp} />}
        <EerrSubtotal label="Total ingresos" amount={ventas + ingrNoOp} />

        <EerrDivider />
        <EerrSection title="COSTO DE VENTAS" />
        <EerrLine label="Costo de ventas" amount={costoVentas} />
        <EerrTotal label="MARGEN BRUTO" amount={margenBruto} />

        <EerrDivider />
        <EerrSection title="GASTOS OPERACIONALES" />
        {remuneraciones > 0 && <EerrLine label="Remuneraciones" amount={remuneraciones} />}
        {honorarios > 0     && <EerrLine label="Honorarios" amount={honorarios} />}
        {arriendos > 0      && <EerrLine label="Arriendos" amount={arriendos} />}
        {servicios > 0      && <EerrLine label="Servicios básicos" amount={servicios} />}
        {gastosGrales > 0   && <EerrLine label="Gastos generales" amount={gastosGrales} />}
        {depreciacion > 0   && <EerrLine label="Depreciación" amount={depreciacion} />}
        {marketing > 0      && <EerrLine label="Marketing" amount={marketing} />}
        <EerrSubtotal label="Total gastos operacionales" amount={totalGastosOp} />
        <EerrTotal label="RESULTADO OPERACIONAL" amount={resultadoOp} />

        {(ingrNoOp > 0 || gastosFinanc > 0 || difCambio > 0) && (
          <>
            <EerrDivider />
            <EerrSection title="NO OPERACIONALES" />
            {gastosFinanc > 0 && <EerrLine label="Gastos financieros" amount={-gastosFinanc} />}
            {difCambio > 0    && <EerrLine label="Diferencia de cambio" amount={-difCambio} />}
            <EerrSubtotal label="Neto no operacional" amount={netNoOp} />
          </>
        )}

        <EerrDivider />
        <EerrTotal label="RESULTADO ANTES IMPUESTO" amount={resultAntImp} />
        {impuesto > 0 && <EerrLine label="Impuesto 1ª Categoría (27%)" amount={-impuesto} />}

        <div className="border-t-2 border-primary/40">
          <EerrTotal label="RESULTADO DEL EJERCICIO" amount={resultFinal} highlight />
        </div>
      </div>
    </div>
  )
}

function EerrSection({ title }: { title: string }) {
  return (
    <div className="px-5 py-2 bg-surface-high">
      <p className="text-[11px] font-semibold text-text-disabled tracking-wider">{title}</p>
    </div>
  )
}

function EerrLine({ label, amount }: { label: string; amount: number }) {
  const neg = amount < 0
  return (
    <div className="flex items-center justify-between px-5 py-2.5 border-b border-border/50">
      <span className="text-sm text-text-secondary pl-3">{label}</span>
      <span className={`text-sm font-mono ${neg ? 'text-error' : 'text-text-primary'}`}>
        {neg ? `(${formatCLP(Math.abs(amount))})` : formatCLP(amount)}
      </span>
    </div>
  )
}

function EerrSubtotal({ label, amount }: { label: string; amount: number }) {
  return (
    <div className="flex items-center justify-between px-5 py-2.5 border-b border-border bg-surface-high/50">
      <span className="text-sm font-medium text-text-secondary">{label}</span>
      <span className="text-sm font-semibold font-mono text-text-primary">
        {formatCLP(amount)}
      </span>
    </div>
  )
}

function EerrTotal({ label, amount, highlight = false }: {
  label: string; amount: number; highlight?: boolean
}) {
  const isNeg = amount < 0
  return (
    <div className={`flex items-center justify-between px-5 py-3.5 ${
      highlight ? 'bg-primary/5' : 'bg-surface-high'
    }`}>
      <span className={`font-bold ${highlight ? 'text-base text-text-primary' : 'text-sm text-text-primary'}`}>
        {label}
      </span>
      <span className={`font-bold font-mono ${
        highlight
          ? 'text-base ' + (isNeg ? 'text-error' : 'text-primary')
          : 'text-sm ' + (isNeg ? 'text-error' : 'text-success')
      }`}>
        {isNeg ? `(${formatCLP(Math.abs(amount))})` : formatCLP(amount)}
      </span>
    </div>
  )
}

function EerrDivider() {
  return <div className="border-t border-border my-1" />
}
