/**
 * Generador de archivo Previred (formato texto estándar)
 * Basado en el "Manual Técnico Previred" formato plano por semicolón
 *
 * Cada línea corresponde a un trabajador con los siguientes campos:
 * RUT_EMPLEADOR;PERIODO;RUT_TRABAJADOR;TIPO_MOVIMIENTO;AFP;RENTA_IMPONIBLE_AFP;
 * COTIZACION_AFP;MONTO_SIS;ISAPRE_FONASA;RENTA_IMPONIBLE_SALUD;COTIZACION_SALUD;
 * CAJA_COMP;AFC_RENTA_IMPONIBLE;AFC_TRABAJADOR;AFC_EMPLEADOR
 */

export interface LineaPrevired {
  rutEmpresa:          string  // sin puntos, con guión
  periodo:             string  // AAAAMM
  rutTrabajador:       string  // sin puntos, con guión
  nombres:             string
  apellidos:           string
  tipoMovimiento:      '1' | '2' | '3'  // 1=alta, 2=normal, 3=baja
  codigoAfp:           string
  rentaImponibleAfp:   number
  cotizacionAfp:       number
  montoSis:            number
  codigoSalud:         string  // 'FONASA' o código isapre
  rentaImponibleSalud: number
  cotizacionSalud:     number
  afcRentaImponible:   number
  afcTrabajador:       number
  afcEmpleador:        number
}

export function generarArchivoPrevired(lineas: LineaPrevired[]): string {
  const rows = lineas.map(l => [
    l.rutEmpresa,
    l.periodo,
    l.rutTrabajador,
    l.tipoMovimiento,
    l.codigoAfp,
    l.rentaImponibleAfp,
    l.cotizacionAfp,
    l.montoSis,
    l.codigoSalud,
    l.rentaImponibleSalud,
    l.cotizacionSalud,
    '',                      // caja compensación (vacío si no aplica)
    l.afcRentaImponible,
    l.afcTrabajador,
    l.afcEmpleador,
  ].join(';'))

  return rows.join('\r\n')
}

export function formatRutPrevired(rut: string): string {
  // Asegura formato sin puntos, con guión: 12345678-9
  return rut.replace(/\./g, '').replace(/,/g, '-')
}
