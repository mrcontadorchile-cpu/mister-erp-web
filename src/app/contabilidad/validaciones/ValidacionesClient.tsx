'use client'

import { useState, useTransition } from 'react'
import { formatNumber } from '@/lib/utils'
import { aprobarBorrador, corregirBorrador, rechazarBorrador } from './actions'
import type { AsientoBorrador } from '@/types/database'

interface Cuenta { id: string; code: string; name: string }

interface Props {
  pendientes: AsientoBorrador[]
  historial: AsientoBorrador[]
  cuentas: Cuenta[]
}

const DOC_LABELS: Record<string, string> = {
  FACTURA_COMPRA:  'F/Compra',
  FACTURA_VENTA:   'F/Venta',
  NOTA_DEBITO:     'N/Débito',
  NOTA_CREDITO:    'N/Crédito',
  BOLETA_HONORARIO:'B/Honorario',
}

const STATUS_LABELS: Record<string, string> = {
  aprobado:  'Aprobado',
  corregido: 'Corregido',
  rechazado: 'Rechazado',
}

const STATUS_COLORS: Record<string, string> = {
  aprobado:  'bg-success/10 text-success border-success/20',
  corregido: 'bg-warning/10 text-warning border-warning/20',
  rechazado: 'bg-error/10 text-error border-error/20',
}

function confidenceBadge(conf: number | null) {
  if (conf === null) return null
  const pct = Math.round(conf * 100)
  const color = pct >= 75 ? 'bg-success/10 text-success' : pct >= 50 ? 'bg-warning/10 text-warning' : 'bg-error/10 text-error'
  return <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${color}`}>{pct}% conf.</span>
}

// ── Corrector sheet ─────────────────────────────────────────
function CorrectorModal({
  borrador,
  cuentas,
  onClose,
}: {
  borrador: AsientoBorrador
  cuentas: Cuenta[]
  onClose: () => void
}) {
  const [debeCode, setDebeCode]   = useState(borrador.ia_account_debe_code ?? '')
  const [haberCode, setHaberCode] = useState(borrador.ia_account_haber_code ?? '')
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleSubmit() {
    if (!debeCode || !haberCode) { setError('Debes seleccionar ambas cuentas.'); return }
    setError(null)
    startTransition(async () => {
      try {
        await corregirBorrador(borrador.id, debeCode, haberCode)
        onClose()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error al corregir')
      }
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-surface border border-border rounded-xl w-full max-w-lg shadow-2xl">
        <div className="p-5 border-b border-border">
          <h2 className="text-base font-semibold text-text-primary">Corregir asiento</h2>
          <p className="text-xs text-text-secondary mt-0.5 truncate">
            {borrador.name_counterpart} — {DOC_LABELS[borrador.doc_type] ?? borrador.doc_type}
            {borrador.folio ? ` N°${borrador.folio}` : ''}
          </p>
        </div>

        <div className="p-5 space-y-4">
          {/* Sugerencia IA */}
          {borrador.ia_account_debe_code && (
            <div className="bg-surface-high rounded-lg p-3 text-xs text-text-secondary space-y-1">
              <p className="font-semibold text-text-primary flex items-center gap-2">
                Sugerencia IA {confidenceBadge(borrador.ia_confidence)}
              </p>
              <p>DEBE: <span className="text-text-primary font-mono">{borrador.ia_account_debe_code}</span></p>
              <p>HABER: <span className="text-text-primary font-mono">{borrador.ia_account_haber_code}</span></p>
              {borrador.ia_razon && <p className="text-text-disabled italic">{borrador.ia_razon}</p>}
            </div>
          )}

          {/* Selector DEBE */}
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1.5">Cuenta DEBE</label>
            <select
              value={debeCode}
              onChange={e => setDebeCode(e.target.value)}
              className="w-full bg-surface-high border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-primary"
            >
              <option value="">— Seleccionar cuenta —</option>
              {cuentas.map(c => (
                <option key={c.id} value={c.code}>{c.code} — {c.name}</option>
              ))}
            </select>
          </div>

          {/* Selector HABER */}
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1.5">Cuenta HABER</label>
            <select
              value={haberCode}
              onChange={e => setHaberCode(e.target.value)}
              className="w-full bg-surface-high border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-primary"
            >
              <option value="">— Seleccionar cuenta —</option>
              {cuentas.map(c => (
                <option key={c.id} value={c.code}>{c.code} — {c.name}</option>
              ))}
            </select>
          </div>

          {error && <p className="text-xs text-error">{error}</p>}
        </div>

        <div className="p-5 border-t border-border flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={pending}
            className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary rounded-lg hover:bg-surface-high transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={pending || !debeCode || !haberCode}
            className="px-4 py-2 text-sm font-semibold bg-warning text-black rounded-lg hover:bg-warning/90 disabled:opacity-50 transition-colors"
          >
            {pending ? 'Guardando…' : 'Guardar corrección'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Tarjeta borrador ────────────────────────────────────────
function BorradorCard({
  borrador,
  cuentas,
}: {
  borrador: AsientoBorrador
  cuentas: Cuenta[]
}) {
  const [correctorOpen, setCorrectorOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (done) return null

  function handleAprobar() {
    setError(null)
    startTransition(async () => {
      try {
        await aprobarBorrador(borrador.id)
        setDone(true)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error al aprobar')
      }
    })
  }

  function handleRechazar() {
    if (!confirm('¿Rechazar este documento? Quedará como "rechazado" y no se contabilizará.')) return
    setError(null)
    startTransition(async () => {
      try {
        await rechazarBorrador(borrador.id)
        setDone(true)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error al rechazar')
      }
    })
  }

  const totalFmt = borrador.total_amount != null
    ? `$${formatNumber(borrador.total_amount)}`
    : '—'

  const dateStr = new Date(borrador.date + 'T12:00:00').toLocaleDateString('es-CL', {
    day: '2-digit', month: 'short', year: 'numeric'
  })

  return (
    <>
      {correctorOpen && (
        <CorrectorModal
          borrador={borrador}
          cuentas={cuentas}
          onClose={() => setCorrectorOpen(false)}
        />
      )}

      <div className={`card p-5 space-y-4 ${pending ? 'opacity-60 pointer-events-none' : ''}`}>
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-text-primary truncate">{borrador.name_counterpart}</p>
            <p className="text-xs text-text-disabled mt-0.5">
              {borrador.rut_counterpart} · {DOC_LABELS[borrador.doc_type] ?? borrador.doc_type}
              {borrador.folio ? ` N°${borrador.folio}` : ''} · {dateStr}
            </p>
          </div>
          <p className="text-lg font-black text-text-primary shrink-0">{totalFmt}</p>
        </div>

        {/* Glosa */}
        <p className="text-xs text-text-secondary bg-surface-high rounded-lg px-3 py-2 truncate">
          {borrador.glosa}
        </p>

        {/* Sugerencia IA */}
        <div className="flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-semibold text-text-disabled uppercase tracking-wider mb-1.5 flex items-center gap-2">
              Sugerencia IA {confidenceBadge(borrador.ia_confidence)}
            </p>
            {borrador.ia_account_debe_code ? (
              <div className="flex gap-2 flex-wrap">
                <span className="font-mono text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                  DEBE {borrador.ia_account_debe_code}
                </span>
                <span className="font-mono text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                  HABER {borrador.ia_account_haber_code}
                </span>
              </div>
            ) : (
              <p className="text-xs text-text-disabled italic">Sin sugerencia — el LLM no pudo inferir las cuentas</p>
            )}
          </div>
        </div>

        {borrador.ia_razon && (
          <p className="text-xs text-text-disabled italic border-l-2 border-border pl-3">
            {borrador.ia_razon}
          </p>
        )}

        {error && <p className="text-xs text-error">{error}</p>}

        {/* Acciones */}
        <div className="flex gap-2 pt-1">
          <button
            onClick={handleAprobar}
            disabled={!borrador.ia_account_debe_code || pending}
            className="flex-1 py-2 text-xs font-semibold bg-success text-white rounded-lg hover:bg-success/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            ✓ Aprobar
          </button>
          <button
            onClick={() => setCorrectorOpen(true)}
            disabled={pending}
            className="flex-1 py-2 text-xs font-semibold bg-warning text-black rounded-lg hover:bg-warning/90 disabled:opacity-40 transition-colors"
          >
            ✎ Corregir
          </button>
          <button
            onClick={handleRechazar}
            disabled={pending}
            className="flex-1 py-2 text-xs font-semibold bg-error/10 text-error rounded-lg hover:bg-error/20 disabled:opacity-40 transition-colors border border-error/20"
          >
            ✕ Rechazar
          </button>
        </div>
      </div>
    </>
  )
}

// ── Pantalla principal ──────────────────────────────────────
export function ValidacionesClient({ pendientes, historial, cuentas }: Props) {
  const [tab, setTab] = useState<'pendientes' | 'historial'>('pendientes')

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-text-primary">Validaciones IA</h1>
          {pendientes.length > 0 && (
            <span className="bg-warning text-black text-xs font-bold px-2.5 py-1 rounded-full">
              {pendientes.length}
            </span>
          )}
        </div>
        <p className="text-text-secondary text-sm mt-1">
          Documentos SII que requieren revisión antes de contabilizarse
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-surface-high rounded-xl p-1 mb-6 w-fit">
        <button
          onClick={() => setTab('pendientes')}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-2 ${
            tab === 'pendientes'
              ? 'bg-surface text-text-primary shadow-sm'
              : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          Pendientes
          {pendientes.length > 0 && (
            <span className="bg-warning/20 text-warning text-[10px] font-bold px-1.5 py-0.5 rounded-full">
              {pendientes.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab('historial')}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            tab === 'historial'
              ? 'bg-surface text-text-primary shadow-sm'
              : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          Historial
        </button>
      </div>

      {/* Tab: Pendientes */}
      {tab === 'pendientes' && (
        <div>
          {pendientes.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-4xl mb-4">✅</p>
              <p className="text-text-primary font-semibold text-lg">Todo al día</p>
              <p className="text-text-secondary text-sm mt-1">No hay documentos pendientes de validación</p>
            </div>
          ) : (
            <div className="space-y-4">
              {pendientes.map(b => (
                <BorradorCard key={b.id} borrador={b} cuentas={cuentas} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: Historial */}
      {tab === 'historial' && (
        <div>
          {historial.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-text-secondary text-sm">Sin historial aún</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-surface-high border-b border-border">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-text-disabled uppercase tracking-wider">Proveedor/Cliente</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-text-disabled uppercase tracking-wider hidden md:table-cell">Tipo</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-text-disabled uppercase tracking-wider hidden lg:table-cell">Cuentas</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-text-disabled uppercase tracking-wider">Total</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-text-disabled uppercase tracking-wider">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {historial.map(b => (
                    <tr key={b.id} className="hover:bg-surface-high/50 transition-colors">
                      <td className="px-4 py-3">
                        <p className="text-text-primary font-medium truncate max-w-[200px]">{b.name_counterpart}</p>
                        <p className="text-text-disabled text-xs">{b.rut_counterpart}</p>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell text-text-secondary text-xs">
                        {DOC_LABELS[b.doc_type] ?? b.doc_type}
                        {b.folio ? ` N°${b.folio}` : ''}
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <div className="flex gap-1.5">
                          <span className="font-mono text-[11px] bg-surface-high text-text-secondary px-1.5 py-0.5 rounded">
                            {b.account_debe_code ?? b.ia_account_debe_code ?? '—'}
                          </span>
                          <span className="font-mono text-[11px] bg-surface-high text-text-secondary px-1.5 py-0.5 rounded">
                            {b.account_haber_code ?? b.ia_account_haber_code ?? '—'}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-text-primary font-semibold tabular-nums">
                        {b.total_amount != null ? `$${formatNumber(b.total_amount)}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-[10px] font-semibold px-2 py-1 rounded-full border ${STATUS_COLORS[b.status] ?? ''}`}>
                          {STATUS_LABELS[b.status] ?? b.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
