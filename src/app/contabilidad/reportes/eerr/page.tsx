import { createClient } from '@/lib/supabase/server'
import { formatCLP, monthName } from '@/lib/utils'
import { PrintButton } from '@/components/ui/PrintButton'
import { EerrExport } from './EerrExport'
import type { EerrLine } from './EerrExport'

export default async function EerrPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string; acum?: string; cmp?: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('company_id, companies(name, rut)')
    .eq('id', user!.id)
    .single()

  const companyId = profile?.company_id as string
  const company = (profile as any)?.companies as { name: string; rut: string } | null

  const now    = new Date()
  const year   = parseInt(params.year  ?? String(now.getFullYear()))
  const month  = parseInt(params.month ?? String(now.getMonth() + 1))
  const acum   = params.acum === '1'
  const cmp    = params.cmp === '1'          // modo comparativo
  const monthFrom = acum ? 1 : month

  // Período de comparación: mes anterior (o año anterior si enero)
  const cmpMonth = month === 1 ? 12 : month - 1
  const cmpYear  = month === 1 ? year - 1 : year
  const cmpFrom  = acum ? 1 : cmpMonth

  const [{ data: raw }, { data: rawCmp }] = await Promise.all([
    supabase.rpc('get_account_balances', {
      p_company_id: companyId,
      p_year: year,
      p_month_from: monthFrom,
      p_month_to: month,
    }),
    cmp
      ? supabase.rpc('get_account_balances', {
          p_company_id: companyId,
          p_year: cmpYear,
          p_month_from: cmpFrom,
          p_month_to: cmpMonth,
        })
      : Promise.resolve({ data: null }),
  ])

  // DEUDOR  (EGRESO):   balance = debit - credit > 0  → usamos tal cual
  // ACREEDOR (INGRESO): balance = debit - credit < 0  → negamos → positivo = ingreso
  interface BalRow { code: string; name: string; type: string; nature: string; display: number }

  function buildRows(data: any[]): BalRow[] {
    return data.map((b: any) => ({
      code:    b.code as string,
      name:    b.name as string,
      type:    b.type as string,
      nature:  b.nature as string,
      display: b.nature === 'DEUDOR' ? Number(b.balance) : -Number(b.balance),
    }))
  }

  function calcTotals(rows: BalRow[]) {
    const active = rows.filter(r => r.display !== 0)
    const sumType   = (type: string)   => active.filter(r => r.type === type).reduce((s, r) => s + r.display, 0)
    const sumPrefix = (prefix: string) => active.filter(r => r.code.startsWith(prefix)).reduce((s, r) => s + r.display, 0)
    const ventas    = sumPrefix('4.1.')
    const ingrNoOp  = sumPrefix('4.2.')
    const otrosIngr = sumType('INGRESO') - ventas - ingrNoOp
    const costoVentas    = sumPrefix('5.')
    const remuneraciones = sumPrefix('6.1.1.')
    const honorarios     = sumPrefix('6.1.2.')
    const arriendos      = sumPrefix('6.1.3.')
    const servicios      = sumPrefix('6.1.4.')
    const gastosGrales   = sumPrefix('6.1.5.')
    const depreciacion   = sumPrefix('6.1.6.')
    const marketing      = sumPrefix('6.1.7.')
    const gastosOpKnown  = remuneraciones + honorarios + arriendos + servicios + gastosGrales + depreciacion + marketing
    const gastosOp6Total = sumPrefix('6.')
    const gastosOpOtros  = gastosOp6Total - gastosOpKnown
    const gastosFinanc    = sumPrefix('7.1.1.')
    const difCambio       = sumPrefix('7.1.2.')
    const gastosNoOp7     = sumPrefix('7.')
    const gastosNoOpOtros = gastosNoOp7 - gastosFinanc - difCambio
    const totalIngrOp     = sumType('INGRESO') - ingrNoOp
    const margenBruto     = totalIngrOp - costoVentas
    const resultadoOp     = margenBruto - gastosOp6Total
    const resultAntImp    = resultadoOp + ingrNoOp - gastosNoOp7
    const impuesto        = resultAntImp > 0 ? resultAntImp * 0.27 : 0
    const resultFinal     = resultAntImp - impuesto
    return {
      active, sumType, sumPrefix,
      ventas, ingrNoOp, otrosIngr, costoVentas,
      remuneraciones, honorarios, arriendos, servicios, gastosGrales, depreciacion, marketing,
      gastosOp6Total, gastosOpOtros, gastosFinanc, difCambio, gastosNoOp7, gastosNoOpOtros,
      totalIngrOp, margenBruto, resultadoOp, resultAntImp, impuesto, resultFinal,
      ingRows:  active.filter(r => r.type === 'INGRESO'),
      egrRows:  active.filter(r => r.type === 'EGRESO'),
    }
  }

  const rows = buildRows(raw ?? [])
  const t    = calcTotals(rows)
  const {
    active, sumType, sumPrefix,
    ventas, ingrNoOp, otrosIngr, costoVentas,
    remuneraciones, honorarios, arriendos, servicios, gastosGrales, depreciacion, marketing,
    gastosOp6Total, gastosOpOtros, gastosFinanc, difCambio, gastosNoOp7, gastosNoOpOtros,
    totalIngrOp, margenBruto, resultadoOp, resultAntImp, impuesto, resultFinal,
    ingRows, egrRows,
  } = t
  const totalGastosOp   = gastosOp6Total
  const totalGastosNoOp = gastosNoOp7

  // Comparativo (período anterior)
  const cmpT = cmp && rawCmp ? calcTotals(buildRows(rawCmp)) : null
  const cmpLabel = acum
    ? `Enero — ${monthName(cmpMonth)} ${cmpYear}`
    : `${monthName(cmpMonth)} ${cmpYear}`

  const periodLabel = acum ? `Enero — ${monthName(month)} ${year}` : `${monthName(month)} ${year}`

  // ── Datos para exportación Excel ──────────────────────────────────
  const excelRows: EerrLine[] = []
  const addSection = (title: string) => excelRows.push({ label: title, amount: null, style: 'section' })
  const addLine    = (label: string, amount: number) => excelRows.push({ label, amount, style: 'line' })
  const addSub     = (label: string, amount: number) => excelRows.push({ label, amount, style: 'subtotal' })
  const addTotal   = (label: string, amount: number) => excelRows.push({ label, amount, style: 'total' })
  const addDiv     = () => excelRows.push({ label: '', amount: null, style: 'divider' })

  addSection('INGRESOS OPERACIONALES')
  if (ventas > 0)     addLine('Ventas', ventas)
  if (otrosIngr > 0)  addLine('Otros ingresos operacionales', otrosIngr)
  ingRows.filter(r => !r.code.startsWith('4.')).forEach(r => addLine(r.name, r.display))
  addSub('Total ingresos operacionales', totalIngrOp)

  if (ingrNoOp > 0) {
    addSection('INGRESOS NO OPERACIONALES')
    addLine('Otros ingresos', ingrNoOp)
  }

  addDiv()

  if (costoVentas > 0) {
    addSection('COSTO DE VENTAS')
    egrRows.filter(r => r.code.startsWith('5.')).forEach(r => addLine(r.name, -r.display))
    addTotal('MARGEN BRUTO', margenBruto)
    addDiv()
  }

  if (gastosOp6Total > 0) {
    addSection('GASTOS OPERACIONALES')
    if (remuneraciones > 0) addLine('Remuneraciones', -remuneraciones)
    if (honorarios > 0)     addLine('Honorarios', -honorarios)
    if (arriendos > 0)      addLine('Arriendos', -arriendos)
    if (servicios > 0)      addLine('Servicios básicos', -servicios)
    if (gastosGrales > 0)   addLine('Gastos generales', -gastosGrales)
    if (depreciacion > 0)   addLine('Depreciación', -depreciacion)
    if (marketing > 0)      addLine('Marketing', -marketing)
    if (gastosOpOtros > 0)  addLine('Otros gastos operacionales', -gastosOpOtros)
    addSub('Total gastos operacionales', -gastosOp6Total)
  }

  addTotal('RESULTADO OPERACIONAL', resultadoOp)

  if (totalGastosNoOp > 0) {
    addDiv()
    addSection('GASTOS NO OPERACIONALES')
    if (gastosFinanc > 0)     addLine('Gastos financieros', -gastosFinanc)
    if (difCambio > 0)        addLine('Diferencia de cambio', -difCambio)
    if (gastosNoOpOtros > 0)  addLine('Otros gastos no operacionales', -gastosNoOpOtros)
  }

  addDiv()
  addTotal('RESULTADO ANTES DE IMPUESTO', resultAntImp)
  if (impuesto > 0) addLine('Impuesto 1ª Categoría (27%)', -impuesto)
  addTotal('RESULTADO DEL EJERCICIO', resultFinal)

  return (
    <>
      {/* ── PANTALLA ── */}
      <div className="print:hidden p-8 max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold">Estado de Resultados</h1>
            <p className="text-text-secondary text-sm mt-1">{periodLabel}</p>
          </div>
          <div className="flex items-center gap-2">
            <EerrExport
              rows={excelRows}
              periodLabel={periodLabel}
              companyName={company?.name ?? ''}
              companyRut={company?.rut}
            />
            <PrintButton />
            <form className="flex gap-2 flex-wrap justify-end">
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
              <input type="hidden" name="acum" value={acum ? '1' : '0'} />
              <input type="hidden" name="cmp"  value={cmp  ? '1' : '0'} />
              <button type="submit" className="btn-primary px-3 py-2 text-sm">Ver</button>
              <div className="flex gap-1">
                <a href={`?year=${year}&month=${month}&acum=0&cmp=${cmp ? '1' : '0'}`}
                  className={`px-3 py-2 rounded-lg text-sm border transition-colors ${
                    !acum ? 'bg-primary text-primary-foreground border-primary' : 'bg-surface border-border text-text-secondary hover:text-text-primary'
                  }`}>Mensual</a>
                <a href={`?year=${year}&month=${month}&acum=1&cmp=${cmp ? '1' : '0'}`}
                  className={`px-3 py-2 rounded-lg text-sm border transition-colors ${
                    acum ? 'bg-primary text-primary-foreground border-primary' : 'bg-surface border-border text-text-secondary hover:text-text-primary'
                  }`}>Acumulado</a>
                <a href={`?year=${year}&month=${month}&acum=${acum ? '1' : '0'}&cmp=${cmp ? '0' : '1'}`}
                  className={`px-3 py-2 rounded-lg text-sm border transition-colors ${
                    cmp ? 'bg-surface-high text-text-primary border-primary/40' : 'bg-surface border-border text-text-secondary hover:text-text-primary'
                  }`}
                  title={cmp ? `Ocultar comparativo con ${cmpLabel}` : `Comparar con ${cmpLabel}`}
                >
                  {cmp ? '÷ Ocultar comparativo' : '≈ Comparar'}
                </a>
              </div>
            </form>
          </div>
        </div>

        {/* Encabezado de columnas cuando hay comparativo */}
        {cmp && (
          <div className="flex items-center justify-end gap-4 mb-2 px-1">
            <span className="text-xs font-semibold text-primary w-40 text-right">{periodLabel}</span>
            <span className="text-xs text-text-disabled w-40 text-right">{cmpLabel}</span>
            <span className="text-xs text-text-disabled w-20 text-right">Variación</span>
          </div>
        )}

        <div className="card overflow-hidden">
          {/* ── INGRESOS ── */}
          <EerrSection title="INGRESOS OPERACIONALES" />
          {ventas > 0      && <EerrLine label="Ventas" amount={ventas} cmp={cmpT?.ventas} />}
          {otrosIngr > 0   && <EerrLine label="Otros ingresos operacionales" amount={otrosIngr} cmp={cmpT?.otrosIngr} />}
          {ingRows.filter(r => !r.code.startsWith('4.')).map(r => (
            <EerrLine key={r.code} label={r.name} amount={r.display} />
          ))}
          <EerrSubtotal label="Total ingresos operacionales" amount={totalIngrOp} cmp={cmpT?.totalIngrOp} />

          {ingrNoOp > 0 && (
            <>
              <EerrSection title="INGRESOS NO OPERACIONALES" />
              <EerrLine label="Otros ingresos" amount={ingrNoOp} cmp={cmpT?.ingrNoOp} />
            </>
          )}

          <EerrDivider />

          {costoVentas > 0 && (
            <>
              <EerrSection title="COSTO DE VENTAS" />
              {egrRows.filter(r => r.code.startsWith('5.')).map(r => (
                <EerrLine key={r.code} label={r.name} amount={-r.display} />
              ))}
              <EerrTotal label="MARGEN BRUTO" amount={margenBruto} cmp={cmpT?.margenBruto} />
              <EerrDivider />
            </>
          )}

          {gastosOp6Total > 0 && (
            <>
              <EerrSection title="GASTOS OPERACIONALES" />
              {remuneraciones > 0 && <EerrLine label="Remuneraciones"    amount={-remuneraciones} cmp={cmpT ? -cmpT.remuneraciones : undefined} />}
              {honorarios > 0     && <EerrLine label="Honorarios"        amount={-honorarios}     cmp={cmpT ? -cmpT.honorarios     : undefined} />}
              {arriendos > 0      && <EerrLine label="Arriendos"         amount={-arriendos}      cmp={cmpT ? -cmpT.arriendos      : undefined} />}
              {servicios > 0      && <EerrLine label="Servicios básicos" amount={-servicios}      cmp={cmpT ? -cmpT.servicios      : undefined} />}
              {gastosGrales > 0   && <EerrLine label="Gastos generales"  amount={-gastosGrales}   cmp={cmpT ? -cmpT.gastosGrales   : undefined} />}
              {depreciacion > 0   && <EerrLine label="Depreciación"      amount={-depreciacion}   cmp={cmpT ? -cmpT.depreciacion   : undefined} />}
              {marketing > 0      && <EerrLine label="Marketing"         amount={-marketing}      cmp={cmpT ? -cmpT.marketing      : undefined} />}
              {gastosOpOtros > 0  && <EerrLine label="Otros gastos operacionales" amount={-gastosOpOtros} cmp={cmpT ? -cmpT.gastosOpOtros : undefined} />}
              <EerrSubtotal label="Total gastos operacionales" amount={-gastosOp6Total} cmp={cmpT ? -cmpT.gastosOp6Total : undefined} />
            </>
          )}

          {egrRows.filter(r => !r.code.startsWith('5.') && !r.code.startsWith('6.') && !r.code.startsWith('7.')).map(r => (
            <EerrLine key={r.code} label={r.name} amount={-r.display} />
          ))}

          <EerrTotal label="RESULTADO OPERACIONAL" amount={resultadoOp} cmp={cmpT?.resultadoOp} />

          {totalGastosNoOp > 0 && (
            <>
              <EerrDivider />
              <EerrSection title="GASTOS NO OPERACIONALES" />
              {gastosFinanc > 0    && <EerrLine label="Gastos financieros"           amount={-gastosFinanc}    cmp={cmpT ? -cmpT.gastosFinanc    : undefined} />}
              {difCambio > 0       && <EerrLine label="Diferencia de cambio"          amount={-difCambio}       cmp={cmpT ? -cmpT.difCambio       : undefined} />}
              {gastosNoOpOtros > 0 && <EerrLine label="Otros gastos no operacionales" amount={-gastosNoOpOtros} cmp={cmpT ? -cmpT.gastosNoOpOtros : undefined} />}
            </>
          )}

          <EerrDivider />
          <EerrTotal label="RESULTADO ANTES DE IMPUESTO" amount={resultAntImp} cmp={cmpT?.resultAntImp} />
          {impuesto > 0 && <EerrLine label="Impuesto 1ª Categoría (27%)" amount={-impuesto} cmp={cmpT ? -cmpT.impuesto : undefined} />}

          <div className="border-t-2 border-primary/40">
            <EerrTotal label="RESULTADO DEL EJERCICIO" amount={resultFinal} cmp={cmpT?.resultFinal} highlight />
          </div>
        </div>
      </div>

      {/* ── IMPRESIÓN ── */}
      <div className="hidden print:block" style={{ padding: '32px', fontFamily: 'Arial, sans-serif', fontSize: '11pt', color: 'black', maxWidth: '700px', margin: '0 auto' }}>

        {/* Encabezado */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', paddingBottom: '14px', borderBottom: '2px solid black' }}>
          <div>
            <div style={{ fontSize: '16pt', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '-0.5px' }}>
              {company?.name ?? 'Empresa'}
            </div>
            {company?.rut && (
              <div style={{ fontSize: '9pt', color: '#555', marginTop: '2px' }}>RUT: {company.rut}</div>
            )}
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '13pt', fontWeight: 700, textTransform: 'uppercase' }}>Estado de Resultados</div>
            <div style={{ fontSize: '10pt', color: '#444', marginTop: '4px' }}>{periodLabel}</div>
          </div>
        </div>

        {/* Tabla */}
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10pt' }}>
          <tbody>
            <PrintSectionRow title="INGRESOS OPERACIONALES" />
            {ventas > 0     && <PrintLineRow label="Ventas" amount={ventas} />}
            {otrosIngr > 0  && <PrintLineRow label="Otros ingresos operacionales" amount={otrosIngr} />}
            {ingRows.filter(r => !r.code.startsWith('4.')).map(r => (
              <PrintLineRow key={r.code} label={r.name} amount={r.display} />
            ))}
            <PrintSubtotalRow label="Total ingresos operacionales" amount={totalIngrOp} />

            {ingrNoOp > 0 && (
              <>
                <PrintSectionRow title="INGRESOS NO OPERACIONALES" />
                <PrintLineRow label="Otros ingresos" amount={ingrNoOp} />
              </>
            )}

            <PrintDividerRow />

            {costoVentas > 0 && (
              <>
                <PrintSectionRow title="COSTO DE VENTAS" />
                {egrRows.filter(r => r.code.startsWith('5.')).map(r => (
                  <PrintLineRow key={r.code} label={r.name} amount={-r.display} />
                ))}
                <PrintTotalRow label="MARGEN BRUTO" amount={margenBruto} />
                <PrintDividerRow />
              </>
            )}

            {gastosOp6Total > 0 && (
              <>
                <PrintSectionRow title="GASTOS OPERACIONALES" />
                {remuneraciones > 0 && <PrintLineRow label="Remuneraciones"    amount={-remuneraciones} />}
                {honorarios > 0     && <PrintLineRow label="Honorarios"        amount={-honorarios} />}
                {arriendos > 0      && <PrintLineRow label="Arriendos"         amount={-arriendos} />}
                {servicios > 0      && <PrintLineRow label="Servicios básicos" amount={-servicios} />}
                {gastosGrales > 0   && <PrintLineRow label="Gastos generales"  amount={-gastosGrales} />}
                {depreciacion > 0   && <PrintLineRow label="Depreciación"      amount={-depreciacion} />}
                {marketing > 0      && <PrintLineRow label="Marketing"         amount={-marketing} />}
                {gastosOpOtros > 0  && <PrintLineRow label="Otros gastos operacionales" amount={-gastosOpOtros} />}
                <PrintSubtotalRow label="Total gastos operacionales" amount={-gastosOp6Total} />
              </>
            )}

            {egrRows.filter(r => !r.code.startsWith('5.') && !r.code.startsWith('6.') && !r.code.startsWith('7.')).map(r => (
              <PrintLineRow key={r.code} label={r.name} amount={-r.display} />
            ))}

            <PrintTotalRow label="RESULTADO OPERACIONAL" amount={resultadoOp} />

            {totalGastosNoOp > 0 && (
              <>
                <PrintDividerRow />
                <PrintSectionRow title="GASTOS NO OPERACIONALES" />
                {gastosFinanc > 0    && <PrintLineRow label="Gastos financieros"           amount={-gastosFinanc} />}
                {difCambio > 0       && <PrintLineRow label="Diferencia de cambio"          amount={-difCambio} />}
                {gastosNoOpOtros > 0 && <PrintLineRow label="Otros gastos no operacionales" amount={-gastosNoOpOtros} />}
              </>
            )}

            <PrintDividerRow />
            <PrintTotalRow label="RESULTADO ANTES DE IMPUESTO" amount={resultAntImp} />
            {impuesto > 0 && <PrintLineRow label="Impuesto 1ª Categoría (27%)" amount={-impuesto} />}

            <tr style={{ borderTop: '2.5px solid black' }}>
              <td style={{ padding: '9px 8px', fontWeight: 900, fontSize: '12pt' }}>RESULTADO DEL EJERCICIO</td>
              <td style={{ padding: '9px 8px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 900, fontSize: '12pt', color: resultFinal < 0 ? '#c00' : '#1a7a1a' }}>
                {resultFinal < 0 ? `(${formatCLP(Math.abs(resultFinal))})` : formatCLP(resultFinal)}
              </td>
            </tr>
          </tbody>
        </table>

        {/* Pie */}
        <div style={{ marginTop: '40px', fontSize: '8pt', color: '#888', textAlign: 'right' }}>
          Generado el {new Date().toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' })}
        </div>
      </div>
    </>
  )
}

// ── Componentes pantalla ────────────────────────────────────────────────────

function fmtAmt(amount: number) {
  return amount < 0
    ? `(${formatCLP(Math.abs(amount))})`
    : formatCLP(amount)
}

function VarBadge({ current, prev }: { current: number; prev?: number }) {
  if (prev === undefined || prev === 0) return <span className="w-20" />
  const pct = ((current - prev) / Math.abs(prev)) * 100
  const up  = pct >= 0
  return (
    <span className={`text-xs font-mono w-20 text-right shrink-0 ${up ? 'text-success' : 'text-error'}`}>
      {up ? '▲' : '▼'} {Math.abs(pct).toFixed(1)}%
    </span>
  )
}

function EerrSection({ title }: { title: string }) {
  return (
    <div className="px-5 py-2 bg-surface-high">
      <p className="text-[11px] font-semibold text-text-disabled tracking-wider">{title}</p>
    </div>
  )
}

function EerrLine({ label, amount, cmp }: { label: string; amount: number; cmp?: number }) {
  const neg = amount < 0
  return (
    <div className="flex items-center justify-between px-5 py-2.5 border-b border-border/50 gap-2">
      <span className="text-sm text-text-secondary pl-3 flex-1">{label}</span>
      {cmp !== undefined && (
        <span className="text-sm font-mono text-text-disabled w-40 text-right shrink-0">{fmtAmt(cmp)}</span>
      )}
      <span className={`text-sm font-mono w-40 text-right shrink-0 ${neg ? 'text-error' : 'text-text-primary'}`}>
        {fmtAmt(amount)}
      </span>
      <VarBadge current={amount} prev={cmp} />
    </div>
  )
}

function EerrSubtotal({ label, amount, cmp }: { label: string; amount: number; cmp?: number }) {
  return (
    <div className="flex items-center justify-between px-5 py-2.5 border-b border-border bg-surface-high/50 gap-2">
      <span className="text-sm font-medium text-text-secondary flex-1">{label}</span>
      {cmp !== undefined && (
        <span className="text-sm font-semibold font-mono text-text-disabled w-40 text-right shrink-0">{fmtAmt(cmp)}</span>
      )}
      <span className={`text-sm font-semibold font-mono w-40 text-right shrink-0 ${amount < 0 ? 'text-error' : 'text-text-primary'}`}>
        {fmtAmt(amount)}
      </span>
      <VarBadge current={amount} prev={cmp} />
    </div>
  )
}

function EerrTotal({ label, amount, cmp, highlight = false }: { label: string; amount: number; cmp?: number; highlight?: boolean }) {
  const isNeg = amount < 0
  return (
    <div className={`flex items-center px-5 py-3.5 gap-2 ${highlight ? 'bg-primary/5' : 'bg-surface-high'}`}>
      <span className={`font-bold flex-1 ${highlight ? 'text-base text-text-primary' : 'text-sm text-text-primary'}`}>{label}</span>
      {cmp !== undefined && (
        <span className={`font-bold font-mono text-text-disabled w-40 text-right shrink-0 ${highlight ? 'text-base' : 'text-sm'}`}>{fmtAmt(cmp)}</span>
      )}
      <span className={`font-bold font-mono w-40 text-right shrink-0 ${highlight ? 'text-base ' : 'text-sm '}${isNeg ? 'text-error' : highlight ? 'text-primary' : 'text-success'}`}>
        {fmtAmt(amount)}
      </span>
      <VarBadge current={amount} prev={cmp} />
    </div>
  )
}

function EerrDivider() {
  return <div className="border-t border-border my-1" />
}

// ── Componentes impresión ───────────────────────────────────────────────────

function PrintSectionRow({ title }: { title: string }) {
  return (
    <tr style={{ backgroundColor: '#f0f0f0' }}>
      <td colSpan={2} style={{ padding: '5px 8px', fontSize: '8.5pt', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#444' }}>
        {title}
      </td>
    </tr>
  )
}

function PrintLineRow({ label, amount }: { label: string; amount: number }) {
  const neg = amount < 0
  return (
    <tr style={{ borderBottom: '1px solid #e8e8e8' }}>
      <td style={{ padding: '4px 8px 4px 20px', fontSize: '10pt', color: '#333' }}>{label}</td>
      <td style={{ padding: '4px 8px', textAlign: 'right', fontFamily: 'monospace', fontSize: '10pt', color: neg ? '#c00' : '#111' }}>
        {neg ? `(${formatCLP(Math.abs(amount))})` : formatCLP(amount)}
      </td>
    </tr>
  )
}

function PrintSubtotalRow({ label, amount }: { label: string; amount: number }) {
  const neg = amount < 0
  return (
    <tr style={{ backgroundColor: '#f7f7f7', borderBottom: '1px solid #ccc' }}>
      <td style={{ padding: '5px 8px', fontWeight: 600, fontSize: '10pt' }}>{label}</td>
      <td style={{ padding: '5px 8px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 600, color: neg ? '#c00' : '#111' }}>
        {neg ? `(${formatCLP(Math.abs(amount))})` : formatCLP(amount)}
      </td>
    </tr>
  )
}

function PrintTotalRow({ label, amount }: { label: string; amount: number }) {
  const neg = amount < 0
  return (
    <tr style={{ backgroundColor: '#e8e8e8', borderTop: '1.5px solid #999', borderBottom: '1.5px solid #999' }}>
      <td style={{ padding: '7px 8px', fontWeight: 700, fontSize: '10.5pt', textTransform: 'uppercase' }}>{label}</td>
      <td style={{ padding: '7px 8px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, fontSize: '11pt', color: neg ? '#c00' : '#1a5c1a' }}>
        {neg ? `(${formatCLP(Math.abs(amount))})` : formatCLP(amount)}
      </td>
    </tr>
  )
}

function PrintDividerRow() {
  return (
    <tr>
      <td colSpan={2} style={{ padding: '4px 0', borderTop: '1px solid #ccc' }} />
    </tr>
  )
}
