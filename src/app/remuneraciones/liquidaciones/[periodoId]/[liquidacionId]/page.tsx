import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { formatCLP, monthName } from '@/lib/utils'
import Link from 'next/link'

export default async function DetalleLiquidacionPage({
  params,
}: {
  params: Promise<{ periodoId: string; liquidacionId: string }>
}) {
  const { periodoId, liquidacionId } = await params
  const supabase = await createClient()

  const [liqRes, lineasRes] = await Promise.all([
    supabase.schema('remu').from('liquidaciones')
      .select('*, empleado:empleado_id(nombres, apellido_paterno, apellido_materno, rut, cargo, tipo_contrato, afp:afp_id(nombre), tipo_salud, isapre:isapre_id(nombre)), periodo:periodo_id(year, month, estado)')
      .eq('id', liquidacionId)
      .single(),
    supabase.schema('remu').from('lineas_liquidacion')
      .select('*')
      .eq('liquidacion_id', liquidacionId)
      .order('orden'),
  ])

  if (liqRes.error || !liqRes.data) notFound()

  const liq    = liqRes.data
  const lineas = lineasRes.data ?? []
  const emp    = liq.empleado as unknown as {
    nombres: string; apellido_paterno: string; apellido_materno: string | null
    rut: string; cargo: string; tipo_contrato: string
    afp: { nombre: string } | null; tipo_salud: string; isapre: { nombre: string } | null
  } | null
  const periodo = liq.periodo as unknown as { year: number; month: number; estado: string } | null

  const haberes   = lineas.filter(l => l.tipo === 'haber')
  const descuentos = lineas.filter(l => l.tipo === 'descuento')

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center gap-3 mb-8 text-sm">
        <Link href="/remuneraciones/liquidaciones" className="text-text-disabled hover:text-text-primary">
          Liquidaciones
        </Link>
        <span className="text-border">/</span>
        <Link href={`/remuneraciones/liquidaciones/${periodoId}`} className="text-text-disabled hover:text-text-primary">
          {periodo ? `${monthName(periodo.month)} ${periodo.year}` : ''}
        </Link>
        <span className="text-border">/</span>
        <span className="text-text-primary font-medium">
          {emp ? `${emp.apellido_paterno}, ${emp.nombres}` : 'Liquidación'}
        </span>
      </div>

      {/* Encabezado de la liquidación */}
      <div className="card p-6 mb-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-text-primary">
              {emp ? `${emp.apellido_paterno} ${emp.apellido_materno ?? ''}, ${emp.nombres}` : ''}
            </h1>
            <p className="text-sm text-text-secondary mt-0.5">{emp?.cargo}</p>
            <p className="text-xs text-text-disabled mt-0.5">RUT: {emp?.rut}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-text-disabled">Período</p>
            <p className="text-sm font-semibold text-text-primary">
              {periodo ? `${monthName(periodo.month)} ${periodo.year}` : ''}
            </p>
            <span className={`badge mt-1 ${
              liq.estado === 'pagada'   ? 'bg-success/10 text-success' :
              liq.estado === 'aprobada' ? 'bg-primary/10 text-primary' :
              'bg-surface-high text-text-disabled'
            }`}>
              {liq.estado}
            </span>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-5 pt-5 border-t border-border">
          <div>
            <p className="text-xs text-text-disabled">Días trabajados</p>
            <p className="text-sm font-semibold text-text-primary">{liq.dias_trabajados} días</p>
          </div>
          <div>
            <p className="text-xs text-text-disabled">AFP</p>
            <p className="text-sm font-semibold text-text-primary">{(emp?.afp as { nombre: string } | null)?.nombre ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs text-text-disabled">Salud</p>
            <p className="text-sm font-semibold text-text-primary">
              {emp?.tipo_salud === 'isapre' && (emp?.isapre as { nombre: string } | null)?.nombre
                ? (emp?.isapre as { nombre: string }).nombre
                : 'Fonasa'}
            </p>
          </div>
          {liq.uf_valor && (
            <div>
              <p className="text-xs text-text-disabled">UF usada</p>
              <p className="text-sm font-semibold text-text-primary">{formatCLP(Number(liq.uf_valor))}</p>
            </div>
          )}
          {liq.utm_valor && (
            <div>
              <p className="text-xs text-text-disabled">UTM usada</p>
              <p className="text-sm font-semibold text-text-primary">{formatCLP(liq.utm_valor)}</p>
            </div>
          )}
        </div>
      </div>

      {/* Detalle haberes y descuentos */}
      <div className="grid grid-cols-2 gap-6 mb-6">
        {/* Haberes */}
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-surface-high">
            <p className="text-xs font-semibold text-success uppercase tracking-wide">Haberes</p>
          </div>
          <table className="w-full">
            <tbody>
              {haberes.map(h => (
                <tr key={h.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-2.5">
                    <p className="text-xs text-text-primary">{h.nombre_concepto}</p>
                    {!h.imponible && (
                      <p className="text-[10px] text-text-disabled">No imponible</p>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right text-xs font-medium text-text-primary">
                    {formatCLP(h.monto)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-success/5 border-t border-success/20">
                <td className="px-4 py-3 text-xs font-bold text-success">Total Haberes</td>
                <td className="px-4 py-3 text-right text-sm font-bold text-success">
                  {formatCLP(liq.total_haberes)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Descuentos */}
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-surface-high">
            <p className="text-xs font-semibold text-error uppercase tracking-wide">Descuentos</p>
          </div>
          <table className="w-full">
            <tbody>
              {descuentos.map(d => (
                <tr key={d.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-2.5">
                    <p className="text-xs text-text-primary">{d.nombre_concepto}</p>
                  </td>
                  <td className="px-4 py-2.5 text-right text-xs font-medium text-error">
                    ({formatCLP(d.monto)})
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-error/5 border-t border-error/20">
                <td className="px-4 py-3 text-xs font-bold text-error">Total Descuentos</td>
                <td className="px-4 py-3 text-right text-sm font-bold text-error">
                  ({formatCLP(liq.total_descuentos)})
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Líquido a pagar */}
      <div className="card p-6 bg-primary/5 border-primary/20">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-text-secondary">Líquido a Pagar</p>
            <p className="text-xs text-text-disabled mt-0.5">
              Haberes {formatCLP(liq.total_haberes)} − Descuentos {formatCLP(liq.total_descuentos)}
            </p>
          </div>
          <p className="text-3xl font-black text-primary">{formatCLP(liq.liquido_a_pagar)}</p>
        </div>
      </div>

      {/* Costo empresa */}
      {(liq.aporte_afp_sis > 0 || liq.aporte_afc_empleador > 0) && (
        <div className="card p-5 mt-4">
          <p className="text-xs font-semibold text-text-disabled uppercase tracking-wide mb-3">
            Costo Empresa (Aportes Adicionales)
          </p>
          <div className="grid grid-cols-2 gap-3">
            {liq.aporte_afp_sis > 0 && (
              <div>
                <p className="text-xs text-text-disabled">SIS (Seg. Invalidez AFP)</p>
                <p className="text-sm font-semibold text-text-primary">{formatCLP(liq.aporte_afp_sis)}</p>
              </div>
            )}
            {liq.aporte_afc_empleador > 0 && (
              <div>
                <p className="text-xs text-text-disabled">AFC Empleador</p>
                <p className="text-sm font-semibold text-text-primary">{formatCLP(liq.aporte_afc_empleador)}</p>
              </div>
            )}
            <div>
              <p className="text-xs text-text-disabled">Costo Total Empresa</p>
              <p className="text-sm font-bold text-warning">
                {formatCLP(liq.liquido_a_pagar + liq.aporte_afp_sis + liq.aporte_afc_empleador)}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="mt-6 flex justify-end">
        <Link
          href={`/remuneraciones/liquidaciones/${periodoId}`}
          className="btn-ghost"
        >
          ← Volver al período
        </Link>
      </div>
    </div>
  )
}
