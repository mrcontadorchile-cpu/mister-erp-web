import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generarArchivoPrevired, formatRutPrevired, type LineaPrevired } from '@/app/remuneraciones/previred/route-previred'

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const periodoId = searchParams.get('periodoId')
  if (!periodoId) return NextResponse.json({ error: 'periodoId requerido' }, { status: 400 })

  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('company_id, companies(rut)')
    .eq('id', user.id)
    .single()

  const companyId  = profile?.company_id as string
  const companyRut = (profile?.companies as unknown as { rut: string } | null)?.rut ?? ''

  // Cargar período
  const { data: periodo } = await supabase
    .schema('remu').from('periodos_remuneracion')
    .select('year, month')
    .eq('id', periodoId)
    .eq('company_id', companyId)
    .single()

  if (!periodo) return NextResponse.json({ error: 'Período no encontrado' }, { status: 404 })

  const periodoStr = `${periodo.year}${String(periodo.month).padStart(2, '0')}`

  // Cargar liquidaciones aprobadas o pagadas
  const { data: liquidaciones } = await supabase
    .schema('remu').from('liquidaciones')
    .select(`
      total_haberes_imponibles,
      descuento_afp, aporte_afp_sis,
      descuento_salud,
      descuento_afc_trabajador, aporte_afc_empleador,
      empleado:empleado_id(
        rut, nombres, apellido_paterno, apellido_materno,
        afp:afp_id(codigo),
        tipo_salud,
        isapre:isapre_id(codigo)
      )
    `)
    .eq('periodo_id', periodoId)
    .in('estado', ['aprobada', 'pagada'])

  if (!liquidaciones || liquidaciones.length === 0) {
    return NextResponse.json({ error: 'No hay liquidaciones aprobadas' }, { status: 404 })
  }

  const rutEmpresa = formatRutPrevired(companyRut)

  const lineas: LineaPrevired[] = liquidaciones.map(liq => {
    const emp      = liq.empleado as unknown as {
      rut: string; nombres: string; apellido_paterno: string; apellido_materno: string | null
      afp: { codigo: string } | null; tipo_salud: string; isapre: { codigo: string } | null
    } | null

    const codigoAfp   = (emp?.afp as { codigo: string } | null)?.codigo ?? ''
    const codigoSalud = emp?.tipo_salud === 'isapre' && (emp?.isapre as { codigo: string } | null)?.codigo
      ? (emp?.isapre as { codigo: string }).codigo
      : 'FONASA'

    return {
      rutEmpresa,
      periodo:             periodoStr,
      rutTrabajador:       formatRutPrevired(emp?.rut ?? ''),
      nombres:             emp?.nombres ?? '',
      apellidos:           `${emp?.apellido_paterno ?? ''} ${emp?.apellido_materno ?? ''}`.trim(),
      tipoMovimiento:      '1',
      codigoAfp,
      rentaImponibleAfp:   liq.total_haberes_imponibles,
      cotizacionAfp:       liq.descuento_afp,
      montoSis:            liq.aporte_afp_sis,
      codigoSalud,
      rentaImponibleSalud: liq.total_haberes_imponibles,
      cotizacionSalud:     liq.descuento_salud,
      afcRentaImponible:   liq.total_haberes_imponibles,
      afcTrabajador:       liq.descuento_afc_trabajador,
      afcEmpleador:        liq.aporte_afc_empleador,
    }
  })

  const contenido  = generarArchivoPrevired(lineas)
  const nombreArchivo = `previred_${rutEmpresa.replace('-', '')}_${periodoStr}.txt`

  return new NextResponse(contenido, {
    headers: {
      'Content-Type':        'text/plain; charset=utf-8',
      'Content-Disposition': `attachment; filename="${nombreArchivo}"`,
    },
  })
}
