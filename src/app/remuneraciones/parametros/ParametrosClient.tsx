'use client'

import { useState } from 'react'
import { sincronizarIndicadores, actualizarTasaAfp } from './actions'
import { formatCLP } from '@/lib/utils'

interface AFP {
  id: number
  codigo: string
  nombre: string
  tasa_trabajador: number
  tasa_sis: number
  activa: boolean
}

// ── Botón sincronizar UF + UTM ───────────────────────────────

interface SincronizarProps {
  ufEnBD:    number
  utmEnBD:   number
  ultimaSync: string | null
}

export function SincronizarIndicadoresButton({ ufEnBD, utmEnBD, ultimaSync }: SincronizarProps) {
  const [loading, setLoading]   = useState(false)
  const [resultado, setResultado] = useState<{
    uf: number; utm: number; topeAfp: number; topeAfc: number; fecha: string
  } | null>(null)
  const [error, setError]       = useState<string | null>(null)

  async function handleSync() {
    setLoading(true)
    setError(null)
    setResultado(null)
    try {
      const r = await sincronizarIndicadores()
      setResultado({
        uf:      r.uf,
        utm:     r.utm,
        topeAfp: r.topeAfpSaludCLP,
        topeAfc: r.topeAfcCLP,
        fecha:   new Date().toLocaleString('es-CL', { dateStyle: 'medium', timeStyle: 'short' }),
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al sincronizar')
    } finally {
      setLoading(false)
    }
  }

  const uf  = resultado?.uf  ?? ufEnBD
  const utm = resultado?.utm ?? utmEnBD

  return (
    <div className="space-y-4">
      {/* Indicadores actuales */}
      <div className="grid grid-cols-2 gap-4">
        <div className="p-4 bg-surface-high rounded-lg">
          <p className="text-[10px] text-text-disabled uppercase tracking-wide mb-1">UF</p>
          <p className="text-xl font-black text-text-primary">
            {uf > 0 ? formatCLP(uf) : '—'}
          </p>
          <p className="text-[10px] text-text-disabled">Valor del día · usado para topes</p>
        </div>
        <div className="p-4 bg-surface-high rounded-lg">
          <p className="text-[10px] text-text-disabled uppercase tracking-wide mb-1">UTM</p>
          <p className="text-xl font-black text-text-primary">
            {utm > 0 ? formatCLP(utm) : '—'}
          </p>
          <p className="text-[10px] text-text-disabled">Mes actual · Impuesto Único</p>
        </div>
      </div>

      {/* Topes calculados */}
      {resultado && (
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-success/5 border border-success/20 rounded-lg">
            <p className="text-[10px] text-text-disabled uppercase tracking-wide mb-1">
              Tope AFP + Salud (90 UF)
            </p>
            <p className="text-lg font-black text-success">{formatCLP(resultado.topeAfp)}</p>
          </div>
          <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg">
            <p className="text-[10px] text-text-disabled uppercase tracking-wide mb-1">
              Tope AFC (135,2 UF)
            </p>
            <p className="text-lg font-black text-primary">{formatCLP(resultado.topeAfc)}</p>
          </div>
        </div>
      )}

      {/* Botón + estado */}
      <div className="flex items-center gap-4">
        <button
          onClick={handleSync}
          disabled={loading}
          className="btn-primary flex items-center gap-2"
        >
          <svg
            className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {loading ? 'Sincronizando...' : 'Sincronizar Indicadores'}
        </button>

        <div className="text-right">
          <p className="text-[10px] text-text-disabled">Última sincronización</p>
          <p className="text-xs text-text-secondary font-medium">
            {resultado?.fecha ?? ultimaSync ?? 'Nunca sincronizado'}
          </p>
        </div>
      </div>

      {error && (
        <div className="px-4 py-3 rounded-lg bg-error/10 border border-error/20">
          <p className="text-xs text-error">{error}</p>
          <p className="text-[10px] text-error/70 mt-1">
            Verifica conexión a internet o intenta de nuevo.
          </p>
        </div>
      )}

      {resultado && !error && (
        <div className="px-4 py-3 rounded-lg bg-success/10 border border-success/20">
          <p className="text-xs text-success font-medium">
            Indicadores actualizados correctamente — {resultado.fecha}
          </p>
          <p className="text-[10px] text-success/70 mt-0.5">
            UF {formatCLP(resultado.uf)} · UTM {formatCLP(resultado.utm)} · guardados en BD
          </p>
        </div>
      )}

      <p className="text-[10px] text-text-disabled">
        Fuente: <a href="https://mindicador.cl" target="_blank" rel="noopener noreferrer" className="underline">mindicador.cl</a>
        {' '}· API gratuita del Banco Central · Sincronizar al inicio de cada mes y al calcular liquidaciones
      </p>
    </div>
  )
}

// ── Tabla AFP editable ────────────────────────────────────────

export function TablaAFPEditable({ afps }: { afps: AFP[] }) {
  const [editId, setEditId] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg]        = useState<{ texto: string; ok: boolean } | null>(null)

  async function handleGuardar(e: React.FormEvent<HTMLFormElement>, afpId: number) {
    e.preventDefault()
    setLoading(true)
    setMsg(null)
    const fd = new FormData(e.currentTarget)
    const tasaTrabajador = parseFloat(fd.get('tasa_trabajador') as string) / 100
    const tasaSis        = parseFloat(fd.get('tasa_sis')        as string) / 100
    const fuente         = fd.get('fuente') as string
    try {
      await actualizarTasaAfp(afpId, tasaTrabajador, tasaSis, fuente)
      setEditId(null)
      setMsg({ texto: 'Tasa actualizada correctamente', ok: true })
    } catch {
      setMsg({ texto: 'Error al guardar', ok: false })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      {msg && (
        <div className={`mx-4 mt-3 mb-1 px-4 py-2 rounded-lg border ${
          msg.ok
            ? 'bg-success/10 border-success/20'
            : 'bg-error/10 border-error/20'
        }`}>
          <p className={`text-xs ${msg.ok ? 'text-success' : 'text-error'}`}>{msg.texto}</p>
        </div>
      )}
      <table className="w-full">
        <thead>
          <tr className="table-header">
            <th className="px-4 py-3 text-left">AFP</th>
            <th className="px-4 py-3 text-right">Tasa trabajador</th>
            <th className="px-4 py-3 text-right">SIS (empleador)</th>
            <th className="px-4 py-3 text-center">Estado</th>
            <th className="px-4 py-3 text-right">Acción</th>
          </tr>
        </thead>
        <tbody>
          {afps.map(afp => (
            <tr key={afp.id} className="table-row">
              {editId === afp.id ? (
                <td colSpan={5} className="px-4 py-3">
                  <form onSubmit={e => handleGuardar(e, afp.id)} className="flex items-end gap-3 flex-wrap">
                    <p className="text-xs font-semibold text-text-primary w-full">{afp.nombre}</p>
                    <div>
                      <label className="block text-[10px] text-text-disabled mb-1">
                        Tasa trabajador (%)
                      </label>
                      <input
                        name="tasa_trabajador"
                        type="number" step="0.01" min="0" max="30"
                        defaultValue={(afp.tasa_trabajador * 100).toFixed(2)}
                        required className="input w-32 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-text-disabled mb-1">
                        SIS empleador (%)
                      </label>
                      <input
                        name="tasa_sis"
                        type="number" step="0.01" min="0" max="10"
                        defaultValue={(afp.tasa_sis * 100).toFixed(2)}
                        required className="input w-28 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-text-disabled mb-1">
                        Fuente / referencia
                      </label>
                      <input
                        name="fuente"
                        defaultValue="Superintendencia de Pensiones"
                        className="input w-56 text-sm"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button type="submit" disabled={loading} className="btn-primary text-xs py-1.5 px-3">
                        {loading ? '...' : 'Guardar'}
                      </button>
                      <button type="button" onClick={() => setEditId(null)} className="btn-ghost text-xs py-1.5 px-3">
                        Cancelar
                      </button>
                    </div>
                  </form>
                </td>
              ) : (
                <>
                  <td className="px-4 py-2.5 text-sm font-medium text-text-primary">{afp.nombre}</td>
                  <td className="px-4 py-2.5 text-sm text-right text-text-secondary">
                    {(afp.tasa_trabajador * 100).toFixed(2)}%
                  </td>
                  <td className="px-4 py-2.5 text-sm text-right text-text-secondary">
                    {(afp.tasa_sis * 100).toFixed(2)}%
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <span className={`badge ${afp.activa ? 'bg-success/10 text-success' : 'bg-surface-high text-text-disabled'}`}>
                      {afp.activa ? 'Activa' : 'Inactiva'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <button onClick={() => { setEditId(afp.id); setMsg(null) }}
                      className="text-xs text-primary hover:underline">
                      Editar
                    </button>
                  </td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
