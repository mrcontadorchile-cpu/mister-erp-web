'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { monthName } from '@/lib/utils'

// ──────────────────────────────────────────────
// Tabla Impuesto Único 2ª Categoría
// Tramos en múltiplos de UTM mensual
// ──────────────────────────────────────────────
const TABLA_IU = [
  { desde: 0,    hasta: 13.5,  tasa: 0,     factor: 0     },
  { desde: 13.5, hasta: 30,    tasa: 0.04,  factor: 0.54  },
  { desde: 30,   hasta: 50,    tasa: 0.08,  factor: 1.74  },
  { desde: 50,   hasta: 70,    tasa: 0.135, factor: 4.49  },
  { desde: 70,   hasta: 90,    tasa: 0.23,  factor: 11.14 },
  { desde: 90,   hasta: 120,   tasa: 0.304, factor: 17.80 },
  { desde: 120,  hasta: 150,   tasa: 0.35,  factor: 23.80 },
  { desde: 150,  hasta: 99999, tasa: 0.40,  factor: 31.30 },
]

function calcularImpuestoUnico(baseImponible: number, utm: number): number {
  if (utm <= 0) return 0
  const baseEnUTM = baseImponible / utm
  const tramo = TABLA_IU.find(t => baseEnUTM >= t.desde && baseEnUTM < t.hasta)
  if (!tramo || tramo.tasa === 0) return 0
  return Math.max(0, Math.round(baseImponible * tramo.tasa - tramo.factor * utm))
}

// ──────────────────────────────────────────────
// Cargar parámetros legales desde BD
// Si no existen o están desactualizados, sincroniza con mindicador.cl
// ──────────────────────────────────────────────
interface ParametrosCalculo {
  uf:              number
  utm:             number
  topeAfpSaludCLP: number
  topeAfcCLP:      number
  afcIndefinidoTrabajador: number
  afcIndefinidoEmpleador:  number
  afcPlazoFijoTrabajador:  number
  afcPlazoFijoEmpleador:   number
}

async function cargarParametros(
  supabase: Awaited<ReturnType<typeof import('@/lib/supabase/server').createClient>>
): Promise<ParametrosCalculo> {
  const now   = new Date()
  const year  = now.getFullYear()
  const month = now.getMonth() + 1

  // Cargar en paralelo desde BD
  const { data: params } = await supabase
    .schema('remu').from('parametros_legales')
    .select('tipo, year, month, valor, datos_json')
    .or(
      `tipo.eq.UF,tipo.eq.UTM,tipo.eq.TOPE_AFP_SALUD_CLP,tipo.eq.TOPE_AFC_CLP,tipo.eq.AFC`
    )
    .order('year', { ascending: false })
    .order('month', { ascending: false })
    .limit(20)

  const p = params ?? []

  const rowUF             = p.find(r => r.tipo === 'UF')
  const rowUTM            = p.find(r => r.tipo === 'UTM'  && r.year === year && r.month === month)
                         ?? p.find(r => r.tipo === 'UTM')
  const rowTopeAfpSalud   = p.find(r => r.tipo === 'TOPE_AFP_SALUD_CLP')
  const rowTopeAfc        = p.find(r => r.tipo === 'TOPE_AFC_CLP')
  const rowAfc            = p.find(r => r.tipo === 'AFC'  && r.year === year)
                         ?? p.find(r => r.tipo === 'AFC')

  // ── Fallback: si UF o UTM no están en BD, llamar mindicador y guardar ──
  let uf  = Number(rowUF?.valor  ?? 0)
  let utm = Number(rowUTM?.valor ?? 0)

  if (uf <= 0 || utm <= 0) {
    try {
      const [resUF, resUTM] = await Promise.all([
        fetch('https://mindicador.cl/api/uf',  { cache: 'no-store' }),
        fetch('https://mindicador.cl/api/utm', { cache: 'no-store' }),
      ])
      const [jUF, jUTM] = await Promise.all([resUF.json(), resUTM.json()])

      if (uf  <= 0) uf  = jUF?.serie?.[0]?.valor  ?? 39000
      if (utm <= 0) utm = jUTM?.serie?.[0]?.valor ?? 68306

      // Guardar para próximo cálculo
      await Promise.all([
        uf  > 0 && supabase.schema('remu').from('parametros_legales').upsert(
          { tipo: 'UF', year, month, valor: uf, fuente: 'mindicador.cl (auto-sync en cálculo)' },
          { onConflict: 'tipo,year,month' }
        ),
        utm > 0 && supabase.schema('remu').from('parametros_legales').upsert(
          { tipo: 'UTM', year, month, valor: utm, fuente: 'mindicador.cl (auto-sync en cálculo)' },
          { onConflict: 'tipo,year,month' }
        ),
      ])
    } catch {
      uf  = uf  > 0 ? uf  : 39000
      utm = utm > 0 ? utm : 68306
    }
  }

  // Topes: usar valor de BD si existe, calcular con UF si no
  const topeAfpSaludCLP = rowTopeAfpSalud?.valor
    ? Number(rowTopeAfpSalud.valor)
    : Math.round(90.0 * uf)

  const topeAfcCLP = rowTopeAfc?.valor
    ? Number(rowTopeAfc.valor)
    : Math.round(135.2 * uf)

  // Tasas AFC desde BD
  const afcData = rowAfc?.datos_json as Record<string, number> | null
  const afcIndefinidoTrabajador = afcData?.contrato_indefinido_trabajador ?? 0.006
  const afcIndefinidoEmpleador  = afcData?.contrato_indefinido_empleador  ?? 0.024
  const afcPlazoFijoTrabajador  = afcData?.contrato_plazo_fijo_trabajador ?? 0.011
  const afcPlazoFijoEmpleador   = afcData?.contrato_plazo_fijo_empleador  ?? 0.030

  return {
    uf, utm,
    topeAfpSaludCLP, topeAfcCLP,
    afcIndefinidoTrabajador, afcIndefinidoEmpleador,
    afcPlazoFijoTrabajador, afcPlazoFijoEmpleador,
  }
}

// ──────────────────────────────────────────────
// Calcular una liquidación
// ──────────────────────────────────────────────
export async function calcularLiquidacion(empleadoId: string, periodoId: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No autenticado')

  const { data: profile } = await supabase
    .from('user_profiles').select('company_id').eq('id', user.id).single()
  const companyId = profile?.company_id as string

  // Cargar parámetros legales desde BD (sin hardcode)
  const params = await cargarParametros(supabase)
  const { uf, utm, topeAfpSaludCLP, topeAfcCLP,
          afcIndefinidoTrabajador, afcIndefinidoEmpleador,
          afcPlazoFijoTrabajador,  afcPlazoFijoEmpleador } = params

  // Cargar empleado con AFP (tasa_trabajador y tasa_sis vienen de la tabla afp)
  const { data: emp, error: empError } = await supabase
    .schema('remu').from('empleados')
    .select('*, afp:afp_id(tasa_trabajador, tasa_sis, nombre)')
    .eq('id', empleadoId)
    .single()

  if (empError || !emp) throw new Error('Empleado no encontrado')

  // Cargar movimientos del período
  const { data: movimientos } = await supabase
    .schema('remu').from('movimientos_personal')
    .select('*')
    .eq('empleado_id', empleadoId)
    .eq('periodo_id', periodoId)

  const movs = movimientos ?? []

  // ── Días trabajados ──────────────────────────
  const diasInasistencia = movs
    .filter(m => m.tipo === 'inasistencia')
    .reduce((s, m) => s + (Number(m.cantidad) || 0), 0)
  const diasTrabajados = Math.max(0, 30 - diasInasistencia)

  // ── Sueldo base proporcional ─────────────────
  const sueldoBaseProporcional = Math.round(emp.sueldo_base * diasTrabajados / 30)

  // ── Horas extra ──────────────────────────────
  const horasExtra50  = movs.filter(m => m.tipo === 'horas_extra_50').reduce((s, m)  => s + (Number(m.cantidad) || 0), 0)
  const horasExtra100 = movs.filter(m => m.tipo === 'horas_extra_100').reduce((s, m) => s + (Number(m.cantidad) || 0), 0)
  const valorHoraNormal    = Math.round(emp.sueldo_base / (30 * 8))
  const montoHorasExtra50  = Math.round(valorHoraNormal * 1.5 * horasExtra50)
  const montoHorasExtra100 = Math.round(valorHoraNormal * 2.0 * horasExtra100)
  const montoHorasExtra    = montoHorasExtra50 + montoHorasExtra100

  // ── Colación, movilización, bonos ────────────
  const montoColacion = movs
    .filter(m => m.tipo === 'colacion').reduce((s, m) => s + (Number(m.monto) || 0), 0)
  const montoMovilizacion = movs
    .filter(m => m.tipo === 'movilizacion').reduce((s, m) => s + (Number(m.monto) || 0), 0)
  const montoBonosImponibles = movs
    .filter(m => m.tipo === 'bono').reduce((s, m) => s + (Number(m.monto) || 0), 0)

  // ── Haberes ───────────────────────────────────
  const totalHaberesImponibles    = sueldoBaseProporcional + montoHorasExtra + montoBonosImponibles
  const totalHaberesNoImponibles  = montoColacion + montoMovilizacion
  const totalHaberes              = totalHaberesImponibles + totalHaberesNoImponibles

  // ── Base cotizable AFP/Salud (con tope desde BD) ──
  const baseAfpSalud = Math.min(totalHaberesImponibles, topeAfpSaludCLP)

  // ── Descuento AFP (tasa desde tabla afp en BD) ──
  const afp = emp.afp as unknown as { tasa_trabajador: number; tasa_sis: number; nombre: string } | null
  const tasaAfp      = afp?.tasa_trabajador ?? 0.1144
  const descuentoAfp = Math.round(baseAfpSalud * tasaAfp)

  // ── Descuento salud ───────────────────────────
  const tasaSalud      = emp.tipo_salud === 'isapre' ? (Number(emp.tasa_isapre) || 0.07) : 0.07
  const descuentoSalud = Math.round(baseAfpSalud * tasaSalud)

  // ── Descuento AFC (tasas + tope desde BD) ─────
  const esPlazoFijo       = emp.tipo_contrato === 'plazo_fijo'
  const tasaAfcTrabajador = esPlazoFijo ? afcPlazoFijoTrabajador : afcIndefinidoTrabajador
  const tasaAfcEmpleador  = esPlazoFijo ? afcPlazoFijoEmpleador  : afcIndefinidoEmpleador
  const baseAfc           = Math.min(totalHaberesImponibles, topeAfcCLP)
  const descuentoAfc      = emp.cotiza_afc ? Math.round(baseAfc * tasaAfcTrabajador) : 0

  // ── Base impuesto único ───────────────────────
  const baseImpuesto = Math.max(0,
    totalHaberesImponibles + totalHaberesNoImponibles
    - descuentoAfp - descuentoSalud - descuentoAfc
  )
  const impuestoUnico = calcularImpuestoUnico(baseImpuesto, utm)

  // ── Descuentos voluntarios ────────────────────
  const descuentoAnticipos = movs.filter(m => m.tipo === 'anticipo').reduce((s, m) => s + (Number(m.monto) || 0), 0)
  const descuentoPrestamos = movs.filter(m => m.tipo === 'prestamo').reduce((s, m) => s + (Number(m.monto) || 0), 0)
  const otrosDescuentos    = movs.filter(m => m.tipo === 'otro').reduce((s, m) => s + (Number(m.monto) || 0), 0)

  // ── Totales ───────────────────────────────────
  const totalDescuentos = descuentoAfp + descuentoSalud + descuentoAfc + impuestoUnico
                        + descuentoAnticipos + descuentoPrestamos + otrosDescuentos
  const liquidoAPagar = Math.max(0, totalHaberes - totalDescuentos)

  // ── Costo empresa (SIS desde tabla afp en BD) ──
  const tasaSis        = afp?.tasa_sis ?? 0.0154
  const aporteAfpSis   = Math.round(baseAfpSalud * tasaSis)
  const aporteAfcEmpl  = emp.cotiza_afc ? Math.round(baseAfc * tasaAfcEmpleador) : 0

  // ── Persistir ─────────────────────────────────
  const payload = {
    company_id:                  companyId,
    periodo_id:                  periodoId,
    empleado_id:                 empleadoId,
    sueldo_base:                 emp.sueldo_base,
    dias_trabajados:             diasTrabajados,
    horas_extra_50:              Math.round(horasExtra50),
    horas_extra_100:             Math.round(horasExtra100),
    monto_horas_extra:           montoHorasExtra,
    monto_gratificacion:         0,
    total_haberes_imponibles:    totalHaberesImponibles,
    total_haberes_no_imponibles: totalHaberesNoImponibles,
    total_haberes:               totalHaberes,
    descuento_afp:               descuentoAfp,
    descuento_salud:             descuentoSalud,
    descuento_afc_trabajador:    descuentoAfc,
    impuesto_unico:              impuestoUnico,
    descuento_anticipos:         descuentoAnticipos,
    descuento_prestamos:         descuentoPrestamos,
    otros_descuentos:            otrosDescuentos,
    total_descuentos:            totalDescuentos,
    liquido_a_pagar:             liquidoAPagar,
    aporte_afp_sis:              aporteAfpSis,
    aporte_afc_empleador:        aporteAfcEmpl,
    uf_valor:                    uf,
    utm_valor:                   utm,
    estado:                      'borrador',
  }

  const { data: existing } = await supabase
    .schema('remu').from('liquidaciones')
    .select('id')
    .eq('periodo_id', periodoId)
    .eq('empleado_id', empleadoId)
    .maybeSingle()

  if (existing) {
    await supabase.schema('remu').from('liquidaciones').update(payload).eq('id', existing.id)
    await supabase.schema('remu').from('lineas_liquidacion').delete().eq('liquidacion_id', existing.id)
    await insertarLineas(supabase, existing.id, {
      sueldoBaseProporcional, montoHorasExtra50, montoHorasExtra100,
      montoColacion, montoMovilizacion, montoBonosImponibles,
      descuentoAfp, descuentoSalud, descuentoAfc, impuestoUnico,
      descuentoAnticipos, descuentoPrestamos, otrosDescuentos,
    })
  } else {
    const { data: nueva } = await supabase
      .schema('remu').from('liquidaciones').insert(payload).select('id').single()
    if (nueva) {
      await insertarLineas(supabase, nueva.id, {
        sueldoBaseProporcional, montoHorasExtra50, montoHorasExtra100,
        montoColacion, montoMovilizacion, montoBonosImponibles,
        descuentoAfp, descuentoSalud, descuentoAfc, impuestoUnico,
        descuentoAnticipos, descuentoPrestamos, otrosDescuentos,
      })
    }
  }

  revalidatePath(`/remuneraciones/liquidaciones/${periodoId}`)
}

async function insertarLineas(
  supabase: Awaited<ReturnType<typeof import('@/lib/supabase/server').createClient>>,
  liquidacionId: string,
  montos: Record<string, number>
) {
  const lineas = [
    { nombre: 'Sueldo Base Proporcional', tipo: 'haber',     imponible: true,  tributable: true,  monto: montos.sueldoBaseProporcional, orden: 1 },
    ...(montos.montoHorasExtra50    > 0 ? [{ nombre: 'Horas Extra 50%',       tipo: 'haber',     imponible: true,  tributable: true,  monto: montos.montoHorasExtra50,    orden: 2 }] : []),
    ...(montos.montoHorasExtra100   > 0 ? [{ nombre: 'Horas Extra 100%',      tipo: 'haber',     imponible: true,  tributable: true,  monto: montos.montoHorasExtra100,   orden: 3 }] : []),
    ...(montos.montoBonosImponibles > 0 ? [{ nombre: 'Bonos',                 tipo: 'haber',     imponible: true,  tributable: true,  monto: montos.montoBonosImponibles, orden: 4 }] : []),
    ...(montos.montoColacion        > 0 ? [{ nombre: 'Asig. Colación',        tipo: 'haber',     imponible: false, tributable: false, monto: montos.montoColacion,        orden: 5 }] : []),
    ...(montos.montoMovilizacion    > 0 ? [{ nombre: 'Asig. Movilización',    tipo: 'haber',     imponible: false, tributable: false, monto: montos.montoMovilizacion,    orden: 6 }] : []),
    ...(montos.descuentoAfp         > 0 ? [{ nombre: 'Descuento AFP',         tipo: 'descuento', imponible: false, tributable: false, monto: montos.descuentoAfp,         orden: 10 }] : []),
    ...(montos.descuentoSalud       > 0 ? [{ nombre: 'Descuento Salud (7%)',  tipo: 'descuento', imponible: false, tributable: false, monto: montos.descuentoSalud,       orden: 11 }] : []),
    ...(montos.descuentoAfc         > 0 ? [{ nombre: 'Seg. Cesantía (AFC)',   tipo: 'descuento', imponible: false, tributable: false, monto: montos.descuentoAfc,         orden: 12 }] : []),
    ...(montos.impuestoUnico        > 0 ? [{ nombre: 'Imp. Único 2ª Cat.',    tipo: 'descuento', imponible: false, tributable: false, monto: montos.impuestoUnico,        orden: 13 }] : []),
    ...(montos.descuentoAnticipos   > 0 ? [{ nombre: 'Anticipos',             tipo: 'descuento', imponible: false, tributable: false, monto: montos.descuentoAnticipos,   orden: 20 }] : []),
    ...(montos.descuentoPrestamos   > 0 ? [{ nombre: 'Préstamos',             tipo: 'descuento', imponible: false, tributable: false, monto: montos.descuentoPrestamos,   orden: 21 }] : []),
    ...(montos.otrosDescuentos      > 0 ? [{ nombre: 'Otros descuentos',      tipo: 'descuento', imponible: false, tributable: false, monto: montos.otrosDescuentos,      orden: 22 }] : []),
  ]

  const rows = lineas.map(l => ({ ...l, liquidacion_id: liquidacionId }))
  if (rows.length > 0) {
    await supabase.schema('remu').from('lineas_liquidacion').insert(rows)
  }
}

// ──────────────────────────────────────────────
// Calcular todas las liquidaciones del período
// ──────────────────────────────────────────────
export async function calcularTodasLiquidaciones(periodoId: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No autenticado')

  const { data: profile } = await supabase
    .from('user_profiles').select('company_id').eq('id', user.id).single()
  const companyId = profile?.company_id as string

  const { data: empleados } = await supabase
    .schema('remu').from('empleados')
    .select('id')
    .eq('company_id', companyId)
    .eq('estado', 'activo')

  for (const emp of empleados ?? []) {
    await calcularLiquidacion(emp.id, periodoId)
  }

  revalidatePath(`/remuneraciones/liquidaciones/${periodoId}`)
}

// ──────────────────────────────────────────────
// Aprobar liquidación
// ──────────────────────────────────────────────
export async function aprobarLiquidacion(liquidacionId: string, periodoId: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No autenticado')

  await supabase.schema('remu').from('liquidaciones')
    .update({ estado: 'aprobada' })
    .eq('id', liquidacionId)

  revalidatePath(`/remuneraciones/liquidaciones/${periodoId}`)
}

// ──────────────────────────────────────────────
// Agregar movimiento (novedad)
// ──────────────────────────────────────────────
export async function agregarMovimiento(formData: FormData) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No autenticado')

  const { data: profile } = await supabase
    .from('user_profiles').select('company_id').eq('id', user.id).single()
  const companyId = profile?.company_id as string

  const periodoId  = formData.get('periodo_id')  as string
  const empleadoId = formData.get('empleado_id') as string
  const tipo       = formData.get('tipo')        as string
  const cantidad   = formData.get('cantidad') ? parseFloat(formData.get('cantidad') as string) : null
  const monto      = formData.get('monto')    ? parseInt(formData.get('monto')    as string, 10) : null

  await supabase.schema('remu').from('movimientos_personal').insert({
    company_id:  companyId,
    empleado_id: empleadoId,
    periodo_id:  periodoId,
    tipo,
    cantidad,
    monto,
    descripcion: (formData.get('descripcion') as string) || null,
  })

  revalidatePath(`/remuneraciones/liquidaciones/${periodoId}`)
}

// ──────────────────────────────────────────────
// Centralizar período → genera comprobante contable
// ──────────────────────────────────────────────
export async function centralizarPeriodo(
  periodoId: string
): Promise<{ success: true; numero: number } | { error: string }> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { data: profile } = await supabase
    .from('user_profiles').select('company_id').eq('id', user.id).single()
  const companyId = profile?.company_id as string

  // ── Verificar período ───────────────────────
  const { data: periodo } = await supabase
    .schema('remu').from('periodos_remuneracion')
    .select('id, year, month, estado, centralizacion_id')
    .eq('id', periodoId)
    .eq('company_id', companyId)
    .single()

  if (!periodo) return { error: 'Período no encontrado' }
  if (periodo.centralizacion_id) return { error: 'El período ya fue centralizado' }

  // ── Verificar que todas las liquidaciones estén aprobadas ──
  const { data: liquidaciones } = await supabase
    .schema('remu').from('liquidaciones')
    .select('estado, total_haberes, descuento_afp, descuento_salud, descuento_afc_trabajador, impuesto_unico, aporte_afp_sis, aporte_afc_empleador, liquido_a_pagar, descuento_anticipos, descuento_prestamos, otros_descuentos')
    .eq('periodo_id', periodoId)

  if (!liquidaciones || liquidaciones.length === 0) {
    return { error: 'No hay liquidaciones en este período' }
  }

  const sinAprobar = liquidaciones.filter(l => l.estado === 'borrador').length
  if (sinAprobar > 0) {
    return { error: `Hay ${sinAprobar} liquidación(es) sin aprobar. Aprueba todas antes de centralizar.` }
  }

  // ── Sumar totales ────────────────────────────
  const s = liquidaciones.reduce((acc, l) => ({
    totalHaberes:   acc.totalHaberes   + (l.total_haberes            ?? 0),
    descAfp:        acc.descAfp        + (l.descuento_afp            ?? 0),
    descSalud:      acc.descSalud      + (l.descuento_salud          ?? 0),
    descAfcTrab:    acc.descAfcTrab    + (l.descuento_afc_trabajador ?? 0),
    impuesto:       acc.impuesto       + (l.impuesto_unico           ?? 0),
    aporteAfpSis:   acc.aporteAfpSis   + (l.aporte_afp_sis           ?? 0),
    aporteAfcEmp:   acc.aporteAfcEmp   + (l.aporte_afc_empleador     ?? 0),
    liquidoAPagar:  acc.liquidoAPagar  + (l.liquido_a_pagar          ?? 0),
    descVoluntario: acc.descVoluntario + (l.descuento_anticipos      ?? 0)
                                       + (l.descuento_prestamos      ?? 0)
                                       + (l.otros_descuentos         ?? 0),
  }), { totalHaberes: 0, descAfp: 0, descSalud: 0, descAfcTrab: 0, impuesto: 0,
        aporteAfpSis: 0, aporteAfcEmp: 0, liquidoAPagar: 0, descVoluntario: 0 })

  // ── Buscar cuentas contables por código ──────
  const codigos = ['6.1.1.1', '6.1.1.3', '6.1.1.4', '2.1.7.1', '2.1.8.1', '2.1.8.2', '2.1.8.3', '2.1.9.1']
  const { data: cuentas, error: cuentasError } = await supabase
    .schema('conta').from('accounts')
    .select('id, code')
    .eq('company_id', companyId)
    .in('code', codigos)

  if (cuentasError) return { error: cuentasError.message }

  const c = Object.fromEntries((cuentas ?? []).map(a => [a.code, a.id]))
  const faltantes = codigos.filter(cod => !c[cod])
  if (faltantes.length > 0) {
    return { error: `Faltan cuentas contables: ${faltantes.join(', ')}. Verifica el plan de cuentas.` }
  }

  // ── Construir líneas del asiento ─────────────
  interface Linea { account_id: string; debit: number; credit: number; description: string }
  const lines: Linea[] = []

  const push = (code: string, debit: number, credit: number, desc: string) => {
    const monto = debit || credit
    if (monto > 0) lines.push({ account_id: c[code], debit, credit, description: desc })
  }

  // DEBE (gastos)
  push('6.1.1.1', s.totalHaberes, 0, 'Sueldos y salarios del período')
  push('6.1.1.3', s.aporteAfpSis, 0, 'Seguro invalidez y sobrevivencia (SIS)')
  push('6.1.1.4', s.aporteAfcEmp, 0, 'Seguro cesantía empleador')

  // HABER (pasivos por pagar)
  push('2.1.7.1', 0, s.liquidoAPagar + s.descVoluntario, 'Remuneraciones netas por pagar')
  push('2.1.8.1', 0, s.descAfp + s.aporteAfpSis,        'AFP por pagar (cotizaciones + SIS)')
  push('2.1.8.2', 0, s.descSalud,                        'Isapre / Fonasa por pagar')
  push('2.1.8.3', 0, s.descAfcTrab + s.aporteAfcEmp,    'Seguro cesantía por pagar')
  push('2.1.9.1', 0, s.impuesto,                         'Impuesto único 2ª categoría')

  // Verificar cuadratura
  const totalDebe  = lines.reduce((x, l) => x + l.debit,  0)
  const totalHaber = lines.reduce((x, l) => x + l.credit, 0)
  if (Math.abs(totalDebe - totalHaber) > 1) {
    return { error: `El asiento no cuadra: Debe $${totalDebe.toLocaleString('es-CL')} ≠ Haber $${totalHaber.toLocaleString('es-CL')}` }
  }

  // ── Obtener o crear período contable ─────────
  let { data: contaPeriod } = await supabase
    .schema('conta').from('periods')
    .select('id, status')
    .eq('company_id', companyId)
    .eq('year', periodo.year)
    .eq('month', periodo.month)
    .maybeSingle()

  if (!contaPeriod) {
    const { data: np, error: pe } = await supabase
      .schema('conta').from('periods')
      .insert({ company_id: companyId, year: periodo.year, month: periodo.month, status: 'open' })
      .select('id, status').single()
    if (pe) return { error: pe.message }
    contaPeriod = np
  }

  if (contaPeriod!.status === 'closed') {
    return { error: 'El período contable está cerrado. Reabre el período antes de centralizar.' }
  }

  // ── Número de asiento ────────────────────────
  const { count } = await supabase
    .schema('conta').from('journal_entries')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', companyId)
  const numero = (count ?? 0) + 1

  // ── Crear asiento contable ───────────────────
  const periodoLabel = `${monthName(periodo.month)} ${periodo.year}`
  const { data: entry, error: ee } = await supabase
    .schema('conta').from('journal_entries')
    .insert({
      company_id:    companyId,
      period_id:     contaPeriod!.id,
      number:        numero,
      date:          `${periodo.year}-${String(periodo.month).padStart(2, '0')}-01`,
      glosa:         `Centralización remuneraciones ${periodoLabel}`,
      type:          'REMU_CENTRALIZACION',
      source_module: 'rrhh',
      source_id:     periodoId,
      status:        'posted',
      created_by:    user.id,
    })
    .select('id').single()

  if (ee) return { error: ee.message }

  // ── Insertar líneas ──────────────────────────
  const { error: le } = await supabase.schema('conta').from('journal_lines').insert(
    lines.map(l => ({
      entry_id:       entry.id,
      account_id:     l.account_id,
      cost_center_id: null,
      debit:          l.debit,
      credit:         l.credit,
      description:    l.description,
    }))
  )
  if (le) return { error: le.message }

  // ── Marcar período como centralizado/cerrado ─
  await supabase
    .schema('remu').from('periodos_remuneracion')
    .update({
      centralizacion_id: entry.id,
      centralizado_en:   new Date().toISOString(),
      centralizado_por:  user.id,
      estado:            'cerrado',
    })
    .eq('id', periodoId)

  revalidatePath(`/remuneraciones/liquidaciones/${periodoId}`)
  revalidatePath('/contabilidad/libro-diario')
  return { success: true, numero }
}
