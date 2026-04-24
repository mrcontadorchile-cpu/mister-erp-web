import { createClient } from '@/lib/supabase/server'
import { formatCLP, monthName, MONTHS } from '@/lib/utils'

const MESES = MONTHS

export default async function LibroRemuneracionesPage({
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

  // Buscar período
  const { data: periodo } = await supabase
    .schema('remu').from('periodos_remuneracion')
    .select('id, estado')
    .eq('company_id', companyId)
    .eq('year', year)
    .eq('month', month)
    .maybeSingle()

  // Liquidaciones del período con detalle de empleado
  const liquidaciones = periodo ? (await supabase
    .schema('remu').from('liquidaciones')
    .select(`
      id, sueldo_base, dias_trabajados,
      total_haberes_imponibles, total_haberes_no_imponibles, total_haberes,
      descuento_afp, descuento_salud, descuento_afc_trabajador, impuesto_unico,
      descuento_anticipos, descuento_prestamos, otros_descuentos,
      total_descuentos, liquido_a_pagar,
      aporte_afp_sis, aporte_afc_empleador,
      estado,
      empleado:empleado_id(
        nombres, apellido_paterno, apellido_materno, rut, cargo,
        afp:afp_id(nombre), tipo_salud, isapre:isapre_id(nombre)
      )
    `)
    .eq('periodo_id', periodo.id)
    .order('empleado_id')
  ).data ?? [] : []

  // Totales
  const totales = liquidaciones.reduce((acc, l) => ({
    haberes_imponibles:    acc.haberes_imponibles    + l.total_haberes_imponibles,
    haberes_no_imponibles: acc.haberes_no_imponibles + l.total_haberes_no_imponibles,
    total_haberes:         acc.total_haberes         + l.total_haberes,
    afp:                   acc.afp                   + l.descuento_afp,
    salud:                 acc.salud                 + l.descuento_salud,
    afc:                   acc.afc                   + l.descuento_afc_trabajador,
    impuesto:              acc.impuesto              + l.impuesto_unico,
    total_descuentos:      acc.total_descuentos      + l.total_descuentos,
    liquido:               acc.liquido               + l.liquido_a_pagar,
    costo_empresa:         acc.costo_empresa         + l.aporte_afp_sis + l.aporte_afc_empleador,
  }), {
    haberes_imponibles: 0, haberes_no_imponibles: 0, total_haberes: 0,
    afp: 0, salud: 0, afc: 0, impuesto: 0, total_descuentos: 0,
    liquido: 0, costo_empresa: 0,
  })

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Libro de Remuneraciones</h1>
          <p className="text-text-secondary text-sm mt-1">{company?.name} · {company?.rut}</p>
        </div>
        {/* Selector período */}
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
              {MESES.slice(1).map((mes, i) => (
                <option key={i + 1} value={i + 1}>{mes}</option>
              ))}
            </select>
          </div>
          <button type="submit" className="btn-primary">Ver</button>
        </form>
      </div>

      {!periodo ? (
        <div className="card p-12 text-center">
          <p className="text-text-secondary">No existe período para {monthName(month)} {year}.</p>
        </div>
      ) : liquidaciones.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-text-secondary">Sin liquidaciones para este período.</p>
        </div>
      ) : (
        <>
          {/* Resumen */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="card p-4">
              <p className="text-xs text-text-disabled">Trabajadores</p>
              <p className="text-xl font-bold text-text-primary">{liquidaciones.length}</p>
            </div>
            <div className="card p-4">
              <p className="text-xs text-text-disabled">Total Haberes</p>
              <p className="text-xl font-bold text-success">{formatCLP(totales.total_haberes)}</p>
            </div>
            <div className="card p-4">
              <p className="text-xs text-text-disabled">Total Descuentos</p>
              <p className="text-xl font-bold text-error">{formatCLP(totales.total_descuentos)}</p>
            </div>
            <div className="card p-4">
              <p className="text-xs text-text-disabled">Total Líquido</p>
              <p className="text-xl font-bold text-primary">{formatCLP(totales.liquido)}</p>
            </div>
          </div>

          {/* Tabla libro */}
          <div className="card overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="table-header">
                  <th className="px-3 py-3 text-left">Trabajador</th>
                  <th className="px-3 py-3 text-left">RUT</th>
                  <th className="px-3 py-3 text-left">AFP / Salud</th>
                  <th className="px-3 py-3 text-right">H. Imponibles</th>
                  <th className="px-3 py-3 text-right">H. No Imp.</th>
                  <th className="px-3 py-3 text-right">Total Hab.</th>
                  <th className="px-3 py-3 text-right">AFP</th>
                  <th className="px-3 py-3 text-right">Salud</th>
                  <th className="px-3 py-3 text-right">AFC</th>
                  <th className="px-3 py-3 text-right">Imp. Único</th>
                  <th className="px-3 py-3 text-right">Total Desc.</th>
                  <th className="px-3 py-3 text-right font-bold">Líquido</th>
                </tr>
              </thead>
              <tbody>
                {liquidaciones.map(liq => {
                  const emp = liq.empleado as unknown as {
                    nombres: string; apellido_paterno: string; apellido_materno: string | null
                    rut: string; afp: { nombre: string } | null; tipo_salud: string
                    isapre: { nombre: string } | null
                  } | null
                  return (
                    <tr key={liq.id} className="table-row">
                      <td className="px-3 py-2.5 font-medium text-text-primary whitespace-nowrap">
                        {emp?.apellido_paterno} {emp?.apellido_materno ?? ''}, {emp?.nombres}
                      </td>
                      <td className="px-3 py-2.5 text-text-secondary">{emp?.rut}</td>
                      <td className="px-3 py-2.5 text-text-secondary">
                        <div>{(emp?.afp as { nombre: string } | null)?.nombre ?? '—'}</div>
                        <div className="text-[10px] text-text-disabled">
                          {emp?.tipo_salud === 'isapre' && (emp?.isapre as { nombre: string } | null)?.nombre
                            ? (emp?.isapre as { nombre: string }).nombre
                            : 'Fonasa'}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-right">{formatCLP(liq.total_haberes_imponibles)}</td>
                      <td className="px-3 py-2.5 text-right">{formatCLP(liq.total_haberes_no_imponibles)}</td>
                      <td className="px-3 py-2.5 text-right font-medium">{formatCLP(liq.total_haberes)}</td>
                      <td className="px-3 py-2.5 text-right text-error">{formatCLP(liq.descuento_afp)}</td>
                      <td className="px-3 py-2.5 text-right text-error">{formatCLP(liq.descuento_salud)}</td>
                      <td className="px-3 py-2.5 text-right text-error">{formatCLP(liq.descuento_afc_trabajador)}</td>
                      <td className="px-3 py-2.5 text-right text-error">{formatCLP(liq.impuesto_unico)}</td>
                      <td className="px-3 py-2.5 text-right font-medium text-error">{formatCLP(liq.total_descuentos)}</td>
                      <td className="px-3 py-2.5 text-right font-bold text-primary">{formatCLP(liq.liquido_a_pagar)}</td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border bg-surface-high">
                  <td colSpan={3} className="px-3 py-3 text-xs font-bold text-text-primary">TOTALES</td>
                  <td className="px-3 py-3 text-right text-xs font-bold">{formatCLP(totales.haberes_imponibles)}</td>
                  <td className="px-3 py-3 text-right text-xs font-bold">{formatCLP(totales.haberes_no_imponibles)}</td>
                  <td className="px-3 py-3 text-right text-xs font-bold">{formatCLP(totales.total_haberes)}</td>
                  <td className="px-3 py-3 text-right text-xs font-bold text-error">{formatCLP(totales.afp)}</td>
                  <td className="px-3 py-3 text-right text-xs font-bold text-error">{formatCLP(totales.salud)}</td>
                  <td className="px-3 py-3 text-right text-xs font-bold text-error">{formatCLP(totales.afc)}</td>
                  <td className="px-3 py-3 text-right text-xs font-bold text-error">{formatCLP(totales.impuesto)}</td>
                  <td className="px-3 py-3 text-right text-xs font-bold text-error">{formatCLP(totales.total_descuentos)}</td>
                  <td className="px-3 py-3 text-right text-sm font-black text-primary">{formatCLP(totales.liquido)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Costo empresa */}
          <div className="card p-4 mt-4">
            <p className="text-xs font-semibold text-text-disabled uppercase tracking-wide mb-2">
              Costo Total Empresa
            </p>
            <div className="flex gap-8">
              <div>
                <p className="text-xs text-text-disabled">Líquido trabajadores</p>
                <p className="text-sm font-bold text-text-primary">{formatCLP(totales.liquido)}</p>
              </div>
              <div>
                <p className="text-xs text-text-disabled">Aportes patronales</p>
                <p className="text-sm font-bold text-text-primary">{formatCLP(totales.costo_empresa)}</p>
              </div>
              <div>
                <p className="text-xs text-text-disabled">Costo Total</p>
                <p className="text-base font-black text-warning">{formatCLP(totales.liquido + totales.costo_empresa)}</p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
