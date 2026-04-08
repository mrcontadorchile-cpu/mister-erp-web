import { createClient } from '@/lib/supabase/server'
import { formatCLP, monthName, MONTHS } from '@/lib/utils'

export default async function PreviredPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>
}) {
  const sp = await searchParams
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('user_profiles').select('company_id, companies(name, rut)').eq('id', user!.id).single()

  const companyId = profile?.company_id as string
  const company   = profile?.companies as unknown as { name: string; rut: string } | null

  const now   = new Date()
  const year  = parseInt(sp.year  ?? String(now.getFullYear()), 10)
  const month = parseInt(sp.month ?? String(now.getMonth() + 1), 10)

  const { data: periodo } = await supabase
    .schema('remu').from('periodos_remuneracion')
    .select('id')
    .eq('company_id', companyId)
    .eq('year', year)
    .eq('month', month)
    .maybeSingle()

  const liquidaciones = periodo ? (await supabase
    .schema('remu').from('liquidaciones')
    .select(`
      descuento_afp, descuento_salud, descuento_afc_trabajador,
      aporte_afp_sis, aporte_afc_empleador,
      total_haberes_imponibles,
      empleado:empleado_id(
        rut, nombres, apellido_paterno, apellido_materno,
        afp:afp_id(codigo, nombre), tipo_salud, isapre:isapre_id(codigo, nombre),
        tipo_contrato
      )
    `)
    .eq('periodo_id', periodo.id)
    .in('estado', ['aprobada', 'pagada'])
  ).data ?? [] : []

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Previred</h1>
          <p className="text-text-secondary text-sm mt-1">Resumen de cotizaciones para pago</p>
        </div>
        <form className="flex gap-2 items-end">
          <div>
            <label className="block text-xs text-text-disabled mb-1">Año</label>
            <select name="year" defaultValue={year} className="input w-24">
              {[now.getFullYear() - 1, now.getFullYear()].map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-text-disabled mb-1">Mes</label>
            <select name="month" defaultValue={month} className="input w-36">
              {MONTHS.slice(1).map((mes, i) => (
                <option key={i + 1} value={i + 1}>{mes}</option>
              ))}
            </select>
          </div>
          <button type="submit" className="btn-primary">Ver</button>
        </form>
      </div>

      <div className="card p-4 mb-4 bg-warning/5 border-warning/20">
        <p className="text-xs text-warning font-medium">
          Solo incluye liquidaciones aprobadas o pagadas. Período: {monthName(month)} {year} · Empresa: {company?.rut}
        </p>
      </div>

      {liquidaciones.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-text-secondary text-sm">
            No hay liquidaciones aprobadas para {monthName(month)} {year}.
          </p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="table-header">
                <th className="px-3 py-3 text-left">Trabajador</th>
                <th className="px-3 py-3 text-left">RUT</th>
                <th className="px-3 py-3 text-left">AFP</th>
                <th className="px-3 py-3 text-left">Salud</th>
                <th className="px-3 py-3 text-right">Cotiz. AFP</th>
                <th className="px-3 py-3 text-right">SIS</th>
                <th className="px-3 py-3 text-right">Cotiz. Salud</th>
                <th className="px-3 py-3 text-right">AFC Trab.</th>
                <th className="px-3 py-3 text-right">AFC Empl.</th>
              </tr>
            </thead>
            <tbody>
              {liquidaciones.map((liq, idx) => {
                const emp = liq.empleado as unknown as {
                  rut: string; nombres: string; apellido_paterno: string; apellido_materno: string | null
                  afp: { codigo: string; nombre: string } | null
                  tipo_salud: string; isapre: { codigo: string; nombre: string } | null
                } | null
                return (
                  <tr key={idx} className="table-row">
                    <td className="px-3 py-2.5 font-medium text-text-primary">
                      {emp?.apellido_paterno} {emp?.apellido_materno ?? ''}, {emp?.nombres}
                    </td>
                    <td className="px-3 py-2.5 text-text-secondary">{emp?.rut}</td>
                    <td className="px-3 py-2.5 text-text-secondary">
                      {(emp?.afp as { nombre: string } | null)?.nombre ?? '—'}
                    </td>
                    <td className="px-3 py-2.5 text-text-secondary">
                      {emp?.tipo_salud === 'isapre' && (emp?.isapre as { nombre: string } | null)?.nombre
                        ? (emp?.isapre as { nombre: string }).nombre
                        : 'Fonasa'}
                    </td>
                    <td className="px-3 py-2.5 text-right">{formatCLP(liq.descuento_afp)}</td>
                    <td className="px-3 py-2.5 text-right">{formatCLP(liq.aporte_afp_sis)}</td>
                    <td className="px-3 py-2.5 text-right">{formatCLP(liq.descuento_salud)}</td>
                    <td className="px-3 py-2.5 text-right">{formatCLP(liq.descuento_afc_trabajador)}</td>
                    <td className="px-3 py-2.5 text-right">{formatCLP(liq.aporte_afc_empleador)}</td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-border bg-surface-high font-bold">
                <td colSpan={4} className="px-3 py-3 text-xs">TOTAL ({liquidaciones.length} trabajadores)</td>
                <td className="px-3 py-3 text-right text-xs">{formatCLP(liquidaciones.reduce((s, l) => s + l.descuento_afp, 0))}</td>
                <td className="px-3 py-3 text-right text-xs">{formatCLP(liquidaciones.reduce((s, l) => s + l.aporte_afp_sis, 0))}</td>
                <td className="px-3 py-3 text-right text-xs">{formatCLP(liquidaciones.reduce((s, l) => s + l.descuento_salud, 0))}</td>
                <td className="px-3 py-3 text-right text-xs">{formatCLP(liquidaciones.reduce((s, l) => s + l.descuento_afc_trabajador, 0))}</td>
                <td className="px-3 py-3 text-right text-xs">{formatCLP(liquidaciones.reduce((s, l) => s + l.aporte_afc_empleador, 0))}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}
