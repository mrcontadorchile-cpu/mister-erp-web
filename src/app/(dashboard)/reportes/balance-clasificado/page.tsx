import { createClient } from '@/lib/supabase/server'
import { formatCLP, monthName, lastDayOfMonth } from '@/lib/utils'

export default async function BalanceClasificadoPage({
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

  const { data: balances } = await supabase.rpc('conta.get_account_balances', {
    p_company_id: companyId,
    p_year: year,
    p_month_from: 1,
    p_month_to: month,
  })

  const balMap = new Map<string, number>()
  for (const b of balances ?? []) {
    balMap.set(b.code as string, Math.abs(b.balance as number))
  }

  const sumPrefix = (p: string) => {
    let t = 0
    for (const [k, v] of balMap) { if (k.startsWith(p)) t += v }
    return t
  }

  // Activo
  const caja     = sumPrefix('1.1.1.')
  const depositos= sumPrefix('1.1.2.')
  const clientes = sumPrefix('1.1.3.')
  const docCob   = sumPrefix('1.1.4.')
  const deudores = sumPrefix('1.1.5.')
  const ivaCred  = sumPrefix('1.1.6.')
  const otrosAct = sumPrefix('1.1.7.')
  const existencias = sumPrefix('1.1.8.')
  const totalActCor = caja + depositos + clientes + docCob + deudores + ivaCred + otrosAct + existencias

  const activoFijo = sumPrefix('1.2.1.')
  const depAcum    = sumPrefix('1.2.2.')
  const intangibles= sumPrefix('1.2.3.')
  const totalActNoCor = (activoFijo - depAcum) + intangibles
  const totalActivo = totalActCor + totalActNoCor

  // Pasivo
  const proveedores  = sumPrefix('2.1.1.')
  const docPagar     = sumPrefix('2.1.2.')
  const ivaDebito    = sumPrefix('2.1.3.')
  const ppmPagar     = sumPrefix('2.1.4.')
  const honPagar     = sumPrefix('2.1.5.')
  const retPagar     = sumPrefix('2.1.6.')
  const sueldos      = sumPrefix('2.1.7.')
  const leyes        = sumPrefix('2.1.8.')
  const totalPasCor  = proveedores + docPagar + ivaDebito + ppmPagar + honPagar + retPagar + sueldos + leyes

  const prestamosLP  = sumPrefix('2.2.1.')
  const totalPasNoCor= prestamosLP
  const totalPasivo  = totalPasCor + totalPasNoCor

  // Patrimonio
  const capital      = sumPrefix('3.1.1.')
  const reservas     = sumPrefix('3.1.2.')
  const resultAnt    = sumPrefix('3.1.3.')
  const ingresos     = sumPrefix('4.')
  const costos       = sumPrefix('5.')
  const gastosOp     = sumPrefix('6.')
  const gastosNoOp   = sumPrefix('7.')
  const resultEj     = ingresos - costos - gastosOp - gastosNoOp
  const totalPatrimonio = capital + reservas + resultAnt + resultEj
  const totalPasPat  = totalPasivo + totalPatrimonio
  const diff         = Math.abs(totalActivo - totalPasPat)
  const balanced     = diff < 1

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Balance General Clasificado</h1>
          <p className="text-text-secondary text-sm mt-1">
            Al {lastDayOfMonth(year, month)} de {monthName(month)} de {year}
          </p>
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

      {/* Balance cuadrado / no cuadrado */}
      <div className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm mb-6 ${
        balanced
          ? 'bg-success/5 border-success/20 text-success'
          : 'bg-error/5 border-error/20 text-error'
      }`}>
        <span>{balanced ? '✓' : '⚠'}</span>
        {balanced
          ? 'Balance cuadrado — Activo = Pasivo + Patrimonio'
          : `Balance desbalanceado — Diferencia: ${formatCLP(diff)}`
        }
      </div>

      {/* Dos columnas */}
      <div className="grid grid-cols-2 gap-6">
        {/* ACTIVO */}
        <div className="space-y-4">
          <ColHeader title="ACTIVO" color="#4CAF50" total={totalActivo} />
          <Section title="Activo Corriente" total={totalActCor} color="#4CAF50" items={[
            { name: 'Disponible (Caja/Banco)', amount: caja,      show: caja > 0 },
            { name: 'Depósitos a Plazo',       amount: depositos,  show: depositos > 0 },
            { name: 'Cuentas por Cobrar',       amount: clientes,   show: clientes > 0 },
            { name: 'Documentos por Cobrar',    amount: docCob,     show: docCob > 0 },
            { name: 'Deudores Varios',          amount: deudores,   show: deudores > 0 },
            { name: 'IVA Crédito Fiscal',       amount: ivaCred,    show: ivaCred > 0 },
            { name: 'Otros Activos',            amount: otrosAct,   show: otrosAct > 0 },
            { name: 'Existencias',              amount: existencias,show: existencias > 0 },
          ]} />
          <Section title="Activo No Corriente" total={totalActNoCor} color="#4CAF50" items={[
            { name: 'Activo Fijo Bruto',        amount: activoFijo,           show: activoFijo > 0 },
            { name: 'Deprec. Acumulada',        amount: -depAcum,             show: depAcum > 0 },
            { name: 'Intangibles',              amount: intangibles,          show: intangibles > 0 },
          ]} />
        </div>

        {/* PASIVO + PATRIMONIO */}
        <div className="space-y-4">
          <ColHeader title="PASIVO Y PATRIMONIO" color="#E53935" total={totalPasPat} />
          <Section title="Pasivo Corriente" total={totalPasCor} color="#E53935" items={[
            { name: 'Proveedores',              amount: proveedores, show: proveedores > 0 },
            { name: 'Documentos por Pagar',     amount: docPagar,    show: docPagar > 0 },
            { name: 'IVA Débito Fiscal',        amount: ivaDebito,   show: ivaDebito > 0 },
            { name: 'PPM por Pagar',            amount: ppmPagar,    show: ppmPagar > 0 },
            { name: 'Honorarios por Pagar',     amount: honPagar,    show: honPagar > 0 },
            { name: 'Retención Honorarios',     amount: retPagar,    show: retPagar > 0 },
            { name: 'Sueldos por Pagar',        amount: sueldos,     show: sueldos > 0 },
            { name: 'Leyes Sociales',           amount: leyes,       show: leyes > 0 },
          ]} />
          <Section title="Pasivo No Corriente" total={totalPasNoCor} color="#E53935" items={[
            { name: 'Préstamos LP', amount: prestamosLP, show: prestamosLP > 0 },
          ]} />
          <Section title="Patrimonio" total={totalPatrimonio} color="#9C27B0" items={[
            { name: 'Capital',                  amount: capital,   show: capital > 0 },
            { name: 'Reservas',                 amount: reservas,  show: reservas > 0 },
            { name: 'Result. Ej. Anterior',     amount: resultAnt, show: resultAnt !== 0 },
            { name: 'Resultado del Ejercicio',  amount: resultEj,  show: true },
          ]} />
        </div>
      </div>
    </div>
  )
}

function ColHeader({ title, color, total }: { title: string; color: string; total: number }) {
  return (
    <div className="flex items-center justify-between pb-2 border-b-2" style={{ borderColor: color }}>
      <span className="font-bold text-sm" style={{ color }}>{title}</span>
      <span className="font-black text-base" style={{ color }}>{formatCLP(total)}</span>
    </div>
  )
}

function Section({ title, total, color, items }: {
  title: string; total: number; color: string
  items: { name: string; amount: number; show: boolean }[]
}) {
  const visible = items.filter(i => i.show)
  return (
    <div className="card overflow-hidden">
      <div className="px-4 py-2.5 border-b border-border" style={{ borderLeftColor: color, borderLeftWidth: 3 }}>
        <span className="text-xs font-semibold text-text-disabled uppercase tracking-wide">{title}</span>
      </div>
      <div className="divide-y divide-border/50">
        {visible.map(item => (
          <div key={item.name} className="flex items-center justify-between px-4 py-2">
            <span className="text-sm text-text-secondary pl-2">{item.name}</span>
            <span className={`text-sm font-mono ${item.amount < 0 ? 'text-error' : 'text-text-primary'}`}>
              {item.amount < 0 ? `(${formatCLP(Math.abs(item.amount))})` : formatCLP(item.amount)}
            </span>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between px-4 py-2.5 border-t border-border" style={{ backgroundColor: `${color}0D` }}>
        <span className="text-xs font-semibold" style={{ color }}>Total {title}</span>
        <span className="text-sm font-bold font-mono" style={{ color }}>{formatCLP(total)}</span>
      </div>
    </div>
  )
}
