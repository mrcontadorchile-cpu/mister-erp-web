import { createClient } from '@/lib/supabase/server'
import { formatCLP, monthName, lastDayOfMonth } from '@/lib/utils'
import { PrintButton } from '@/components/ui/PrintButton'
import { BalanceExport } from './BalanceExport'
import type { BalSection } from './BalanceExport'

/* ─────────────────────────────────────────────────────────────────────────────
   Balance General Clasificado

   La RPC devuelve:  balance = debit - credit
   • DEUDOR  (ACTIVO, EGRESO):    saldo normal > 0  → usamos tal cual
   • ACREEDOR (PASIVO, PAT, ING): saldo normal < 0  → negamos → positivo = normal
──────────────────────────────────────────────────────────────────────────────── */

interface BalRow {
  account_id: string
  code: string
  name: string
  type: string
  nature: string
  total_debit: number
  total_credit: number
  balance: number
  display: number
}

export default async function BalanceClasificadoPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>
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
  const company   = (profile as any)?.companies as { name: string; rut: string } | null

  const now   = new Date()
  const year  = parseInt(params.year  ?? String(now.getFullYear()))
  const month = parseInt(params.month ?? String(now.getMonth() + 1))

  const { data: raw } = await supabase.rpc('get_account_balances', {
    p_company_id: companyId,
    p_year: year,
    p_month_from: 1,
    p_month_to: month,
  })

  const rows: BalRow[] = (raw ?? []).map((b: any) => {
    const rawBal = Number(b.balance)
    return {
      account_id:   b.account_id,
      code:         b.code as string,
      name:         b.name as string,
      type:         b.type as string,
      nature:       b.nature as string,
      total_debit:  Number(b.total_debit),
      total_credit: Number(b.total_credit),
      balance:      rawBal,
      display:      b.nature === 'DEUDOR' ? rawBal : -rawBal,
    }
  })

  const active = rows.filter(r => r.total_debit !== 0 || r.total_credit !== 0)

  const byType = (type: string) => active.filter(r => r.type === type)
  const activos        = byType('ACTIVO')
  const pasivos        = byType('PASIVO')
  const patrimonioRows = byType('PATRIMONIO')
  const ingresos       = byType('INGRESO')
  const egresos        = byType('EGRESO')

  const actCorriente   = activos.filter(r => r.code.startsWith('1.1.'))
  const actNoCorriente = activos.filter(r => r.code.startsWith('1.2.'))
  const actOtros       = activos.filter(r => !r.code.startsWith('1.'))

  const pasCorriente   = pasivos.filter(r => r.code.startsWith('2.1.'))
  const pasNoCorriente = pasivos.filter(r => r.code.startsWith('2.2.'))
  const pasOtros       = pasivos.filter(r => !r.code.startsWith('2.'))

  const sum = (arr: BalRow[]) => arr.reduce((s, r) => s + r.display, 0)

  const totalActivo    = sum(activos)
  const totalPasivo    = sum(pasivos)
  const totalPatBase   = sum(patrimonioRows)
  const totalIngresos  = sum(ingresos)
  const totalEgresos   = sum(egresos)
  const resultEj       = totalIngresos - totalEgresos
  const totalPatrimonio= totalPatBase + resultEj
  const totalPasPat    = totalPasivo + totalPatrimonio
  const diff           = Math.abs(totalActivo - totalPasPat)
  const balanced       = diff < 1

  type Item = { name: string; code: string; amount: number }
  const toItems = (arr: BalRow[]): Item[] => arr.map(r => ({ name: r.name, code: r.code, amount: r.display }))

  const dateLabel = `Al ${lastDayOfMonth(year, month)} de ${monthName(month)} de ${year}`

  // ── Datos para exportación ────────────────────────────────────────
  const mkSection = (title: string, arr: BalRow[]): BalSection => ({
    title,
    items: toItems(arr),
    total: sum(arr),
  })

  const activoSections: BalSection[] = [
    ...(actCorriente.length   > 0 ? [mkSection('Activo Corriente',    actCorriente)]   : []),
    ...(actNoCorriente.length > 0 ? [mkSection('Activo No Corriente', actNoCorriente)] : []),
    ...(actOtros.length       > 0 ? [mkSection('Otros Activos',       actOtros)]       : []),
  ]

  const pasivoSections: BalSection[] = [
    ...(pasCorriente.length   > 0 ? [mkSection('Pasivo Corriente',    pasCorriente)]   : []),
    ...(pasNoCorriente.length > 0 ? [mkSection('Pasivo No Corriente', pasNoCorriente)] : []),
    ...(pasOtros.length       > 0 ? [mkSection('Otros Pasivos',       pasOtros)]       : []),
  ]

  const patrimonioSection: BalSection[] = [{
    title: 'Patrimonio',
    items: [
      ...toItems(patrimonioRows),
      ...(resultEj !== 0 ? [{ name: 'Resultado del Ejercicio', code: '', amount: resultEj }] : []),
    ],
    total: totalPatrimonio,
  }]

  return (
    <>
      {/* ── PANTALLA ── */}
      <div className="print:hidden p-8 max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Balance General Clasificado</h1>
            <p className="text-text-secondary text-sm mt-1">{dateLabel}</p>
          </div>
          <div className="flex items-center gap-2">
            <BalanceExport
              dateLabel={dateLabel}
              companyName={company?.name ?? ''}
              companyRut={company?.rut}
              activo={activoSections}
              totalActivo={totalActivo}
              pasivo={pasivoSections}
              totalPasivo={totalPasivo}
              patrimonio={patrimonioSection}
              totalPatrimonio={totalPatrimonio}
              totalPasPat={totalPasPat}
              balanced={balanced}
            />
            <PrintButton />
            <form className="flex gap-2">
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
        </div>

        {/* Indicador de balance */}
        <div className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm mb-6 ${
          balanced
            ? 'bg-success/5 border-success/20 text-success'
            : 'bg-error/5 border-error/20 text-error'
        }`}>
          <span className="font-bold">{balanced ? '✓' : '⚠'}</span>
          {balanced
            ? 'Balance cuadrado — Activo = Pasivo + Patrimonio'
            : `Balance descuadrado — Diferencia: ${formatCLP(diff)}`}
        </div>

        <div className="grid grid-cols-2 gap-6">
          {/* ── ACTIVO ── */}
          <div className="space-y-4">
            <ColHeader title="ACTIVO" color="#4CAF50" total={totalActivo} />
            {actCorriente.length   > 0 && <Section title="Activo Corriente"    total={sum(actCorriente)}   color="#4CAF50" items={toItems(actCorriente)} />}
            {actNoCorriente.length > 0 && <Section title="Activo No Corriente" total={sum(actNoCorriente)} color="#4CAF50" items={toItems(actNoCorriente)} />}
            {actOtros.length       > 0 && <Section title="Otros Activos"       total={sum(actOtros)}       color="#4CAF50" items={toItems(actOtros)} />}
            {activos.length === 0 && <div className="card p-6 text-center text-text-disabled text-sm">Sin movimientos en activos</div>}
          </div>

          {/* ── PASIVO + PATRIMONIO ── */}
          <div className="space-y-4">
            <ColHeader title="PASIVO Y PATRIMONIO" color="#E53935" total={totalPasPat} />
            {pasCorriente.length   > 0 && <Section title="Pasivo Corriente"    total={sum(pasCorriente)}   color="#E53935" items={toItems(pasCorriente)} />}
            {pasNoCorriente.length > 0 && <Section title="Pasivo No Corriente" total={sum(pasNoCorriente)} color="#E53935" items={toItems(pasNoCorriente)} />}
            {pasOtros.length       > 0 && <Section title="Otros Pasivos"       total={sum(pasOtros)}       color="#E53935" items={toItems(pasOtros)} />}
            <Section
              title="Patrimonio"
              total={totalPatrimonio}
              color="#9C27B0"
              items={[
                ...toItems(patrimonioRows),
                ...(resultEj !== 0 ? [{ name: 'Resultado del Ejercicio', code: '', amount: resultEj }] : []),
              ]}
            />
          </div>
        </div>

        {(ingresos.length > 0 || egresos.length > 0) && (
          <div className="card p-5 mt-6">
            <p className="text-xs font-bold text-text-disabled uppercase tracking-wide mb-3">
              Composición del Resultado del Ejercicio
            </p>
            <div className="flex items-center gap-8 text-sm">
              <div>
                <p className="text-xs text-text-disabled mb-1">Ingresos</p>
                <p className="font-mono text-success font-semibold">{formatCLP(totalIngresos)}</p>
              </div>
              <span className="text-text-disabled text-lg">−</span>
              <div>
                <p className="text-xs text-text-disabled mb-1">Costos y Gastos</p>
                <p className="font-mono text-error font-semibold">{formatCLP(totalEgresos)}</p>
              </div>
              <span className="text-text-disabled text-lg">=</span>
              <div>
                <p className="text-xs text-text-disabled mb-1">Resultado</p>
                <p className={`font-mono font-bold text-lg ${resultEj >= 0 ? 'text-success' : 'text-error'}`}>
                  {resultEj < 0 ? `(${formatCLP(Math.abs(resultEj))})` : formatCLP(resultEj)}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── IMPRESIÓN ── */}
      <div className="hidden print:block" style={{ padding: '28px', fontFamily: 'Arial, sans-serif', fontSize: '10pt', color: 'black' }}>

        {/* Encabezado */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px', paddingBottom: '12px', borderBottom: '2px solid black' }}>
          <div>
            <div style={{ fontSize: '16pt', fontWeight: 900, textTransform: 'uppercase' }}>{company?.name ?? 'Empresa'}</div>
            {company?.rut && <div style={{ fontSize: '9pt', color: '#555', marginTop: '2px' }}>RUT: {company.rut}</div>}
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '12pt', fontWeight: 700, textTransform: 'uppercase' }}>Balance General Clasificado</div>
            <div style={{ fontSize: '10pt', color: '#444', marginTop: '4px' }}>{dateLabel}</div>
          </div>
        </div>

        {/* Indicador */}
        <div style={{ marginBottom: '14px', padding: '5px 10px', border: `1px solid ${balanced ? '#4CAF50' : '#E53935'}`, borderRadius: '4px', fontSize: '9pt', color: balanced ? '#2e7d32' : '#c62828', fontWeight: 600 }}>
          {balanced ? '✓ Balance cuadrado — Activo = Pasivo + Patrimonio' : `⚠ Balance descuadrado — Diferencia: ${formatCLP(diff)}`}
        </div>

        {/* Dos columnas */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>

          {/* ACTIVO */}
          <div>
            <PrintColHeader title="ACTIVO" total={totalActivo} color="#2e7d32" />
            {actCorriente.length   > 0 && <PrintSection title="Activo Corriente"    items={toItems(actCorriente)}   total={sum(actCorriente)}   color="#2e7d32" />}
            {actNoCorriente.length > 0 && <PrintSection title="Activo No Corriente" items={toItems(actNoCorriente)} total={sum(actNoCorriente)} color="#2e7d32" />}
            {actOtros.length       > 0 && <PrintSection title="Otros Activos"       items={toItems(actOtros)}       total={sum(actOtros)}       color="#2e7d32" />}
          </div>

          {/* PASIVO + PATRIMONIO */}
          <div>
            <PrintColHeader title="PASIVO Y PATRIMONIO" total={totalPasPat} color="#c62828" />
            {pasCorriente.length   > 0 && <PrintSection title="Pasivo Corriente"    items={toItems(pasCorriente)}   total={sum(pasCorriente)}   color="#c62828" />}
            {pasNoCorriente.length > 0 && <PrintSection title="Pasivo No Corriente" items={toItems(pasNoCorriente)} total={sum(pasNoCorriente)} color="#c62828" />}
            {pasOtros.length       > 0 && <PrintSection title="Otros Pasivos"       items={toItems(pasOtros)}       total={sum(pasOtros)}       color="#c62828" />}
            <PrintSection
              title="Patrimonio"
              color="#6a1b9a"
              items={[
                ...toItems(patrimonioRows),
                ...(resultEj !== 0 ? [{ name: 'Resultado del Ejercicio', code: '', amount: resultEj }] : []),
              ]}
              total={totalPatrimonio}
            />
          </div>
        </div>

        {/* Pie */}
        <div style={{ marginTop: '32px', fontSize: '8pt', color: '#888', textAlign: 'right' }}>
          Generado el {new Date().toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' })}
        </div>
      </div>
    </>
  )
}

// ── Componentes pantalla ────────────────────────────────────────────────────

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
  items: { name: string; code: string; amount: number }[]
}) {
  if (items.length === 0) return null
  return (
    <div className="card overflow-hidden">
      <div className="px-4 py-2.5 border-b border-border" style={{ borderLeftColor: color, borderLeftWidth: 3 }}>
        <span className="text-xs font-semibold text-text-disabled uppercase tracking-wide">{title}</span>
      </div>
      <div className="divide-y divide-border/50">
        {items.map((item, i) => (
          <div key={i} className="flex items-center justify-between px-4 py-2">
            <div className="flex items-center gap-2 min-w-0">
              {item.code && <span className="font-mono text-[10px] text-text-disabled shrink-0">{item.code}</span>}
              <span className="text-sm text-text-secondary truncate">{item.name}</span>
            </div>
            <span className={`text-sm font-mono shrink-0 ml-3 ${item.amount < 0 ? 'text-error' : 'text-text-primary'}`}>
              {item.amount < 0 ? `(${formatCLP(Math.abs(item.amount))})` : formatCLP(item.amount)}
            </span>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between px-4 py-2.5 border-t border-border" style={{ backgroundColor: `${color}0D` }}>
        <span className="text-xs font-semibold" style={{ color }}>Total {title}</span>
        <span className={`text-sm font-bold font-mono ${total < 0 ? 'text-error' : ''}`} style={total >= 0 ? { color } : {}}>
          {total < 0 ? `(${formatCLP(Math.abs(total))})` : formatCLP(total)}
        </span>
      </div>
    </div>
  )
}

// ── Componentes impresión ───────────────────────────────────────────────────

function PrintColHeader({ title, total, color }: { title: string; total: number; color: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', borderBottom: `2px solid ${color}`, paddingBottom: '6px', marginBottom: '8px' }}>
      <span style={{ fontWeight: 700, fontSize: '10pt', color }}>{title}</span>
      <span style={{ fontWeight: 900, fontSize: '11pt', fontFamily: 'monospace', color }}>{formatCLP(total)}</span>
    </div>
  )
}

function PrintSection({ title, items, total, color }: {
  title: string; color: string; total: number
  items: { name: string; code: string; amount: number }[]
}) {
  if (items.length === 0) return null
  return (
    <div style={{ marginBottom: '10px', border: '1px solid #ddd', borderLeft: `3px solid ${color}` }}>
      <div style={{ padding: '4px 8px', backgroundColor: '#f5f5f5', fontSize: '8pt', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.3px', color: '#555' }}>
        {title}
      </div>
      {items.map((item, i) => (
        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 8px', borderTop: i > 0 ? '1px solid #f0f0f0' : undefined, fontSize: '9pt' }}>
          <span style={{ color: '#333' }}>
            {item.code && <span style={{ fontFamily: 'monospace', fontSize: '8pt', color: '#999', marginRight: '6px' }}>{item.code}</span>}
            {item.name}
          </span>
          <span style={{ fontFamily: 'monospace', color: item.amount < 0 ? '#c00' : '#111', marginLeft: '8px', whiteSpace: 'nowrap' }}>
            {item.amount < 0 ? `(${formatCLP(Math.abs(item.amount))})` : formatCLP(item.amount)}
          </span>
        </div>
      ))}
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 8px', borderTop: '1px solid #ccc', backgroundColor: `${color}15`, fontSize: '9pt', fontWeight: 700 }}>
        <span style={{ color }}>Total {title}</span>
        <span style={{ fontFamily: 'monospace', color: total < 0 ? '#c00' : color }}>
          {total < 0 ? `(${formatCLP(Math.abs(total))})` : formatCLP(total)}
        </span>
      </div>
    </div>
  )
}
