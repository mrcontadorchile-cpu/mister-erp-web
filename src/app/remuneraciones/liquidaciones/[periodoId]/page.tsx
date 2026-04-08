import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { LiquidacionesClient } from './LiquidacionesClient'
import { monthName } from '@/lib/utils'
import Link from 'next/link'

export default async function LiquidacionesPeriodoPage({
  params,
}: {
  params: Promise<{ periodoId: string }>
}) {
  const { periodoId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('user_profiles').select('company_id').eq('id', user!.id).single()

  const companyId = profile?.company_id as string

  // Cargar período
  const { data: periodo, error: periodoError } = await supabase
    .schema('remu').from('periodos_remuneracion')
    .select('*')
    .eq('id', periodoId)
    .eq('company_id', companyId)
    .single()

  if (periodoError || !periodo) notFound()

  // Cargar empleados activos
  const { data: empleados } = await supabase
    .schema('remu').from('empleados')
    .select('id, nombres, apellido_paterno, apellido_materno, cargo, sueldo_base')
    .eq('company_id', companyId)
    .eq('estado', 'activo')
    .order('apellido_paterno')

  // Cargar liquidaciones del período
  const { data: liquidaciones } = await supabase
    .schema('remu').from('liquidaciones')
    .select('id, empleado_id, total_haberes, total_descuentos, liquido_a_pagar, descuento_afp, descuento_salud, impuesto_unico, estado')
    .eq('periodo_id', periodoId)

  // Cargar número del comprobante contable si existe
  let numeroComprobante: number | null = null
  if (periodo.centralizacion_id) {
    const { data: entry } = await supabase
      .schema('conta').from('journal_entries')
      .select('number')
      .eq('id', periodo.centralizacion_id)
      .single()
    numeroComprobante = entry?.number ?? null
  }

  const periodoLabel = `${monthName(periodo.month)} ${periodo.year}`
  const periodoCerrado = periodo.estado === 'cerrado'

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <Link href="/remuneraciones/liquidaciones" className="text-text-disabled hover:text-text-primary">
          ← Liquidaciones
        </Link>
        <span className="text-border">/</span>
        <h1 className="text-xl font-bold text-text-primary">{periodoLabel}</h1>
        <span className={`badge ml-2 ${
          periodoCerrado ? 'bg-error/10 text-error' : 'bg-success/10 text-success'
        }`}>
          {periodo.estado}
        </span>
        {numeroComprobante && (
          <span className="badge ml-1 bg-primary/10 text-primary">
            Comprobante N° {numeroComprobante}
          </span>
        )}
      </div>

      <LiquidacionesClient
        periodoId={periodoId}
        periodoLabel={periodoLabel}
        empleados={empleados ?? []}
        liquidaciones={liquidaciones ?? []}
        periodoCerrado={periodoCerrado}
        centralizado={!!periodo.centralizacion_id}
        numeroComprobante={numeroComprobante}
      />
    </div>
  )
}
