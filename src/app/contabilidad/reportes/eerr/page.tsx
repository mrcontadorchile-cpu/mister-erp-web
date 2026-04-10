import { createClient } from '@/lib/supabase/server'
import { formatCLP, monthName } from '@/lib/utils'
import { PrintButton } from '@/components/ui/PrintButton'
import { EerrExport } from './EerrExport'
import type { EerrLine } from './EerrExport'

export default async function EerrPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string; acum?: string }>
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
  const monthFrom = acum ? 1 : month

  const { data: raw } = await supabase.rpc('get_account_balances', {
    p_company_id: companyId,
    p_year: year,
    p_month_from: monthFrom,
    p_month_to: month,
  })

  // DEUDOR  (EGRESO):   balance = debit - credit > 0  → usamos tal cual
  // ACREEDOR (INGRESO): balance = debit - credit < 0  → negamos → positivo = ingreso
  interface BalRow { code: string; name: string; type: string; nature: string; display: number }
  const rows: BalRow[] = (raw ?? []).map((b: any) => {
    const rawBal = Number(b.balance)
    return {
      code:    b.code as string,
      name:    b.name as string,
      type:    b.type as string,
      nature:  b.nature as string,
      display: b.nature === 'DEUDOR' ? rawBal : -rawBal,
    }
  })

  const active = rows.filter(r => r.display !== 0)

  const byType   = (type: string) => active.filter(r => r.type === type)
  const ingRows  = byType('INGRESO')
  const egrRows  = byType('EGRESO')

  const sumType   = (type: string)   => active.filter(r => r.type === type).reduce((s, r) => s + r.display, 0)
  const sumPrefix = (prefix: string) => active.filter(r => r.code.startsWith(prefix)).reduce((s, r) => s + r.display, 0)

  // ── Ingresos ──────────────────────────────────────────────────────
  const ventas    = sumPrefix('4.1.')
  const ingrNoOp  = sumPrefix('4.2.')
  const otrosIngr = sumType('INGRESO') - ventas - ingrNoOp

  // ── Costos ────────────────────────────────────────────────────────
  const costoVentas = sumPrefix('5.')

  // ── Gastos operacionales ──────────────────────────────────────────
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

  // ── No operacionales ──────────────────────────────────────────────
  const gastosFinanc    = sumPrefix('7.1.1.')
  const difCambio       = sumPrefix('7.1.2.')
  const gastosNoOp7     = sumPrefix('7.')
  const gastosNoOpOtros = gastosNoOp7 - gastosFinanc - difCambio

  // ── Totales ───────────────────────────────────────────────────────
  const totalIngrOp    = sumType('INGRESO') - ingrNoOp
  const margenBruto    = totalIngrOp - costoVentas
  const totalGastosOp  = gastosOp6Total
  const resultadoOp    = margenBruto - totalGastosOp
  const totalGastosNoOp= gastosNoOp7
  const resultAntImp   = resultadoOp + ingrNoOp - totalGastosNoOp
  const impuesto       = resultAntImp > 0 ? resultAntImp * 0.27 : 0
  const resultFinal    = resultAntImp - impuesto

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
            </form>
          </div>
        </div>

        <div className="card overflow-hidden">
          {/* ── INGRESOS ── */}
          <EerrSection title="INGRESOS OPERACIONALES" />
          {ventas > 0      && <EerrLine label="Ventas" amount={ventas} />}
          {otrosIngr > 0   && <EerrLine label="Otros ingresos operacionales" amount={otrosIngr} />}
          {ingRows.filter(r => !r.code.startsWith('4.')).map(r => (
            <EerrLine key={r.code} label={r.name} amount={r.display} />
          ))}
          <EerrSubtotal label="Total ingresos operacionales" amount={totalIngrOp} />

          {ingrNoOp > 0 && (
            <>
              <EerrSection title="INGRESOS NO OPERACIONALES" />
              <EerrLine label="Otros ingresos" amount={ingrNoOp} />
            </>
          )}

          <EerrDivider />

          {costoVentas > 0 && (
            <>
              <EerrSection title="COSTO DE VENTAS" />
              {egrRows.filter(r => r.code.startsWith('5.')).map(r => (
                <EerrLine key={r.code} label={r.name} amount={-r.display} />
              ))}
              <EerrTotal label="MARGEN BRUTO" amount={margenBruto} />
              <EerrDivider />
            </>
          )}

          {gastosOp6Total > 0 && (
            <>
              <EerrSection title="GASTOS OPERACIONALES" />
              {remuneraciones > 0 && <EerrLine label="Remuneraciones"    amount={-remuneraciones} />}
              {honorarios > 0     && <EerrLine label="Honorarios"        amount={-honorarios} />}
              {arriendos > 0      && <EerrLine label="Arriendos"         amount={-arriendos} />}
              {servicios > 0      && <EerrLine label="Servicios básicos" amount={-servicios} />}
              {gastosGrales > 0   && <EerrLine label="Gastos generales"  amount={-gastosGrales} />}
              {depreciacion > 0   && <EerrLine label="Depreciación"      amount={-depreciacion} />}
              {marketing > 0      && <EerrLine label="Marketing"         amount={-marketing} />}
              {gastosOpOtros > 0  && <EerrLine label="Otros gastos operacionales" amount={-gastosOpOtros} />}
              <EerrSubtotal label="Total gastos operacionales" amount={-gastosOp6Total} />
            </>
          )}

          {egrRows.filter(r => !r.code.startsWith('5.') && !r.code.startsWith('6.') && !r.code.startsWith('7.')).map(r => (
            <EerrLine key={r.code} label={r.name} amount={-r.display} />
          ))}

          <EerrTotal label="RESULTADO OPERACIONAL" amount={resultadoOp} />

          {totalGastosNoOp > 0 && (
            <>
              <EerrDivider />
              <EerrSection title="GASTOS NO OPERACIONALES" />
              {gastosFinanc > 0    && <EerrLine label="Gastos financieros"        amount={-gastosFinanc} />}
              {difCambio > 0       && <EerrLine label="Diferencia de cambio"       amount={-difCambio} />}
              {gastosNoOpOtros > 0 && <EerrLine label="Otros gastos no operacionales" amount={-gastosNoOpOtros} />}
            </>
          )}

          <EerrDivider />
          <EerrTotal label="RESULTADO ANTES DE IMPUESTO" amount={resultAntImp} />
          {impuesto > 0 && <EerrLine label="Impuesto 1ª Categoría (27%)" amount={-impuesto} />}

          <div className="border-t-2 border-primary/40">
            <EerrTotal label="RESULTADO DEL EJERCICIO" amount={resultFinal} highlight />
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
      <span className={`text-sm font-semibold font-mono ${amount < 0 ? 'text-error' : 'text-text-primary'}`}>
        {amount < 0 ? `(${formatCLP(Math.abs(amount))})` : formatCLP(amount)}
      </span>
    </div>
  )
}

function EerrTotal({ label, amount, highlight = false }: { label: string; amount: number; highlight?: boolean }) {
  const isNeg = amount < 0
  return (
    <div className={`flex items-center justify-between px-5 py-3.5 ${highlight ? 'bg-primary/5' : 'bg-surface-high'}`}>
      <span className={`font-bold ${highlight ? 'text-base text-text-primary' : 'text-sm text-text-primary'}`}>{label}</span>
      <span className={`font-bold font-mono ${highlight ? 'text-base ' : 'text-sm '}${isNeg ? 'text-error' : highlight ? 'text-primary' : 'text-success'}`}>
        {isNeg ? `(${formatCLP(Math.abs(amount))})` : formatCLP(amount)}
      </span>
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
