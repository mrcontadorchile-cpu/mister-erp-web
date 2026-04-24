'use client'

import { calcularLiquidacion, calcularTodasLiquidaciones, aprobarLiquidacion, agregarMovimiento, centralizarPeriodo } from './actions'
import { formatCLP } from '@/lib/utils'
import { useState } from 'react'

function toastError(err: unknown) {
  alert(err instanceof Error ? err.message : 'Error inesperado')
}

interface Empleado {
  id: string
  nombres: string
  apellido_paterno: string
  apellido_materno: string | null
  cargo: string
  sueldo_base: number
}

interface Liquidacion {
  id: string
  empleado_id: string
  total_haberes: number
  total_descuentos: number
  liquido_a_pagar: number
  descuento_afp: number
  descuento_salud: number
  impuesto_unico: number
  estado: string
}

interface LiquidacionesClientProps {
  periodoId: string
  periodoLabel: string
  empleados: Empleado[]
  liquidaciones: Liquidacion[]
  periodoCerrado: boolean
  centralizado: boolean
  numeroComprobante: number | null
}

export function LiquidacionesClient({
  periodoId,
  periodoLabel,
  empleados,
  liquidaciones,
  periodoCerrado,
  centralizado,
  numeroComprobante,
}: LiquidacionesClientProps) {
  const [loading, setLoading] = useState<string | null>(null)
  const [movModal, setMovModal] = useState<string | null>(null)  // empleadoId
  const [centralizandoError, setCentralizandoError] = useState<string | null>(null)

  const liqMap = new Map(liquidaciones.map(l => [l.empleado_id, l]))

  async function handleCalcular(empleadoId: string) {
    setLoading(empleadoId)
    try {
      await calcularLiquidacion(empleadoId, periodoId)
    } catch (err) {
      toastError(err)
    } finally {
      setLoading(null)
    }
  }

  async function handleCalcularTodas() {
    setLoading('ALL')
    try {
      await calcularTodasLiquidaciones(periodoId)
    } catch (err) {
      toastError(err)
    } finally {
      setLoading(null)
    }
  }

  async function handleAprobar(liquidacionId: string) {
    setLoading(liquidacionId)
    try {
      await aprobarLiquidacion(liquidacionId, periodoId)
    } catch (err) {
      toastError(err)
    } finally {
      setLoading(null)
    }
  }

  const totalLiquido = liquidaciones.reduce((s, l) => s + l.liquido_a_pagar, 0)

  const todasAprobadas =
    liquidaciones.length > 0 &&
    liquidaciones.length === empleados.length &&
    liquidaciones.every(l => l.estado === 'aprobada')

  async function handleCentralizar() {
    setCentralizandoError(null)
    setLoading('CENTRALIZAR')
    try {
      const res = await centralizarPeriodo(periodoId)
      if ('error' in res) setCentralizandoError(res.error)
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Barra de acciones */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-text-secondary">
            {liquidaciones.length} de {empleados.length} empleados liquidados
            {liquidaciones.length > 0 && (
              <span className="ml-2 font-semibold text-text-primary">
                · Total líquido: {formatCLP(totalLiquido)}
              </span>
            )}
          </p>
          {centralizandoError && (
            <p className="text-xs text-error mt-1">{centralizandoError}</p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {!periodoCerrado && (
            <button
              onClick={handleCalcularTodas}
              disabled={loading === 'ALL'}
              className="btn-secondary"
            >
              {loading === 'ALL' ? 'Calculando...' : 'Calcular Todas'}
            </button>
          )}
          {!centralizado && todasAprobadas && (
            <button
              onClick={handleCentralizar}
              disabled={loading === 'CENTRALIZAR'}
              className="btn-primary"
            >
              {loading === 'CENTRALIZAR' ? 'Centralizando...' : 'Centralizar Período'}
            </button>
          )}
          {centralizado && numeroComprobante && (
            <a
              href="/contabilidad/libro-diario"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary/10 text-primary text-sm font-medium hover:bg-primary/20 transition-colors"
            >
              <span>✓ Comprobante N° {numeroComprobante}</span>
              <span className="text-xs opacity-70">Ver →</span>
            </a>
          )}
        </div>
      </div>

      {/* Tabla de empleados */}
      <div className="card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="table-header">
              <th className="px-4 py-3 text-left">Empleado</th>
              <th className="px-4 py-3 text-right">Sueldo Base</th>
              <th className="px-4 py-3 text-right">Total Haberes</th>
              <th className="px-4 py-3 text-right">Descuentos</th>
              <th className="px-4 py-3 text-right">Líquido</th>
              <th className="px-4 py-3 text-center">Estado</th>
              <th className="px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {empleados.map(emp => {
              const liq = liqMap.get(emp.id)
              const isLoading = loading === emp.id || (liq && loading === liq.id)
              return (
                <tr key={emp.id} className="table-row">
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium text-text-primary">
                      {emp.apellido_paterno} {emp.apellido_materno ?? ''}, {emp.nombres}
                    </p>
                    <p className="text-xs text-text-disabled">{emp.cargo}</p>
                  </td>
                  <td className="px-4 py-3 text-sm text-right text-text-secondary">
                    {formatCLP(emp.sueldo_base)}
                  </td>
                  <td className="px-4 py-3 text-sm text-right text-text-primary">
                    {liq ? formatCLP(liq.total_haberes) : '—'}
                  </td>
                  <td className="px-4 py-3 text-sm text-right text-error">
                    {liq ? formatCLP(liq.total_descuentos) : '—'}
                  </td>
                  <td className="px-4 py-3 text-sm text-right font-bold text-success">
                    {liq ? formatCLP(liq.liquido_a_pagar) : '—'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {liq ? (
                      <span className={`badge ${
                        liq.estado === 'pagada'   ? 'bg-success/10 text-success' :
                        liq.estado === 'aprobada' ? 'bg-primary/10 text-primary' :
                        'bg-surface-high text-text-disabled'
                      }`}>
                        {liq.estado}
                      </span>
                    ) : (
                      <span className="badge bg-surface-high text-text-disabled">sin calcular</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2 justify-end items-center">
                      {!periodoCerrado && (
                        <>
                          <button
                            onClick={() => setMovModal(emp.id)}
                            className="text-xs text-text-disabled hover:text-text-secondary"
                            title="Agregar novedad"
                          >
                            + Novedad
                          </button>
                          <button
                            onClick={() => handleCalcular(emp.id)}
                            disabled={!!isLoading}
                            className="text-xs text-primary hover:underline disabled:opacity-50"
                          >
                            {isLoading ? '...' : liq ? 'Recalcular' : 'Calcular'}
                          </button>
                          {liq && liq.estado === 'borrador' && (
                            <button
                              onClick={() => handleAprobar(liq.id)}
                              disabled={!!isLoading}
                              className="text-xs text-success hover:underline disabled:opacity-50"
                            >
                              Aprobar
                            </button>
                          )}
                        </>
                      )}
                      {liq && (
                        <a
                          href={`/remuneraciones/liquidaciones/${periodoId}/${liq.id}`}
                          className="text-xs text-primary hover:underline"
                        >
                          Ver
                        </a>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Modal de movimiento */}
      {movModal && (
        <MovimientoModal
          empleadoId={movModal}
          periodoId={periodoId}
          onClose={() => setMovModal(null)}
        />
      )}
    </div>
  )
}

// ── Modal para agregar novedades ──────────────────

function MovimientoModal({
  empleadoId,
  periodoId,
  onClose,
}: {
  empleadoId: string
  periodoId: string
  onClose: () => void
}) {
  const [tipo, setTipo] = useState('horas_extra_50')

  const necesitaCantidad = ['inasistencia', 'horas_extra_50', 'horas_extra_100'].includes(tipo)
  const necesitaMonto    = ['bono', 'anticipo', 'prestamo', 'colacion', 'movilizacion', 'otro'].includes(tipo)

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-surface border border-border rounded-xl p-6 w-full max-w-md shadow-2xl">
        <h3 className="text-base font-bold text-text-primary mb-5">Agregar Novedad</h3>
        <form
          action={async (fd) => {
            await agregarMovimiento(fd)
            onClose()
          }}
          className="space-y-4"
        >
          <input type="hidden" name="periodo_id"  value={periodoId} />
          <input type="hidden" name="empleado_id" value={empleadoId} />

          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">Tipo</label>
            <select
              name="tipo"
              value={tipo}
              onChange={e => setTipo(e.target.value)}
              className="input"
            >
              <option value="inasistencia">Inasistencia (días)</option>
              <option value="horas_extra_50">Horas Extra 50%</option>
              <option value="horas_extra_100">Horas Extra 100%</option>
              <option value="bono">Bono (imponible)</option>
              <option value="colacion">Colación (no imponible)</option>
              <option value="movilizacion">Movilización (no imponible)</option>
              <option value="anticipo">Anticipo (descuento)</option>
              <option value="prestamo">Préstamo (descuento)</option>
              <option value="otro">Otro descuento</option>
            </select>
          </div>

          {necesitaCantidad && (
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">
                {tipo === 'inasistencia' ? 'Días' : 'Horas'}
              </label>
              <input name="cantidad" type="number" step="0.5" min="0" required className="input" />
            </div>
          )}

          {necesitaMonto && (
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">Monto (CLP)</label>
              <input name="monto" type="number" step="1000" min="0" required className="input" />
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">Descripción (opcional)</label>
            <input name="descripcion" className="input" />
          </div>

          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={onClose} className="btn-ghost">Cancelar</button>
            <button type="submit" className="btn-primary">Agregar</button>
          </div>
        </form>
      </div>
    </div>
  )
}
