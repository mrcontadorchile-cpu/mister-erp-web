'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { deleteBudget, updateBudgetStatus, submitForApproval, type Budget } from './actions'

const MONTHS_SHORT = ['', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  draft:            { label: 'Borrador',      color: 'text-text-disabled bg-surface-high' },
  pending_approval: { label: 'En revisión',   color: 'text-warning bg-warning/10' },
  approved:         { label: 'Aprobado',      color: 'text-info bg-info/10' },
  active:           { label: 'Activo',        color: 'text-success bg-success/10' },
  closed:           { label: 'Cerrado',       color: 'text-text-disabled bg-surface-high border border-border' },
}

const TYPE_LABEL: Record<string, string> = {
  annual:  'Año Calendario',
  rolling: 'Rolling 12m',
}

interface Props {
  budgets:    Budget[]
  userId:     string
  canApprove: boolean
}

export function PresupuestosClient({ budgets: initial, userId, canApprove }: Props) {
  const [budgets, setBudgets] = useState<Budget[]>(initial)
  const [isPending, startTransition] = useTransition()
  const [msg, setMsg] = useState('')

  function flash(text: string, isErr = true) {
    setMsg(text)
    setTimeout(() => setMsg(''), isErr ? 4000 : 2500)
  }

  function handleDelete(id: string, name: string) {
    if (!confirm(`¿Eliminar el presupuesto "${name}"? Esta acción es irreversible.`)) return
    startTransition(async () => {
      const res = await deleteBudget(id)
      if (!res.ok) { flash(`Error: ${res.error}`); return }
      setBudgets(prev => prev.filter(b => b.id !== id))
    })
  }

  function handleSubmit(id: string) {
    if (!confirm('¿Enviar este presupuesto para aprobación?')) return
    startTransition(async () => {
      const res = await submitForApproval(id)
      if (!res.ok) { flash(`Error: ${res.error}`); return }
      setBudgets(prev => prev.map(b => b.id === id ? { ...b, status: 'pending_approval' } : b))
      flash('Enviado para aprobación ✓', false)
    })
  }

  function handleStatus(id: string, status: Budget['status']) {
    startTransition(async () => {
      const res = await updateBudgetStatus(id, status as any)
      if (!res.ok) { flash(`Error: ${res.error}`); return }
      setBudgets(prev => prev.map(b => b.id === id ? { ...b, status } : b))
    })
  }

  if (budgets.length === 0) {
    return (
      <div className="card p-16 text-center">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
          </svg>
        </div>
        <p className="text-text-primary font-semibold mb-1">Sin presupuestos aún</p>
        <p className="text-text-disabled text-sm mb-6">Crea tu primer presupuesto para comenzar el control de gestión</p>
        <Link href="/gestion/presupuestos/nuevo" className="btn-primary inline-flex items-center gap-2 px-5 py-2.5 text-sm">
          Crear primer presupuesto
        </Link>
      </div>
    )
  }

  // Agrupar por año fiscal
  const byYear = budgets.reduce<Record<number, Budget[]>>((acc, b) => {
    acc[b.fiscal_year] = [...(acc[b.fiscal_year] ?? []), b]
    return acc
  }, {})
  const years = Object.keys(byYear).map(Number).sort((a, b) => b - a)

  return (
    <div className="space-y-6">
      {msg && (
        <div className={`p-3 rounded-lg text-sm border ${
          msg.includes('✓')
            ? 'bg-success/10 text-success border-success/20'
            : 'bg-error/10 text-error border-error/20'
        }`}>{msg}</div>
      )}

      {years.map(year => (
        <div key={year}>
          <p className="text-xs font-semibold text-text-disabled tracking-wider uppercase mb-3">
            Año Fiscal {year}
          </p>
          <div className="space-y-2">
            {byYear[year].map(b => {
              const st = STATUS_LABEL[b.status] ?? STATUS_LABEL.draft
              const isCreator = b.created_by === userId
              // Para aprobar: necesita permiso + no puede ser el mismo creador (salvo que no tenga created_by)
              const isApprovable = canApprove && (!b.created_by || b.created_by !== userId)
              const typeLabel = TYPE_LABEL[b.budget_type] ?? b.budget_type
              const startLabel = b.budget_type === 'rolling' && b.start_month > 1
                ? ` · desde ${MONTHS_SHORT[b.start_month]}`
                : ''

              return (
                <div key={b.id} className="card p-4">
                  <div className="flex items-start gap-4">
                    {/* Status badge */}
                    <span className={`shrink-0 text-[11px] font-semibold px-2.5 py-0.5 rounded-full mt-0.5 ${st.color}`}>
                      {st.label}
                    </span>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-text-primary truncate">{b.name}</p>
                      <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                        <span className="text-xs text-text-disabled">Año {b.fiscal_year}</span>
                        <span className="text-xs text-primary/70 bg-primary/8 px-1.5 py-0.5 rounded text-[10px] font-medium">
                          {typeLabel}{startLabel}
                        </span>
                        <span className="text-xs text-text-disabled">
                          Actualizado {new Date(b.updated_at).toLocaleDateString('es-CL')}
                        </span>
                      </div>
                      {/* Mensaje estado */}
                      {b.status === 'pending_approval' && (
                        <p className="text-xs text-warning mt-1">
                          ⏳ Esperando aprobación
                          {canApprove && !isApprovable && ' (no puedes aprobar el tuyo propio)'}
                        </p>
                      )}
                    </div>

                    {/* Acciones */}
                    <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">

                      {/* Borrador: creador puede enviar a aprobación */}
                      {b.status === 'draft' && isCreator && (
                        <button
                          onClick={() => handleSubmit(b.id)}
                          disabled={isPending}
                          className="text-xs text-warning hover:underline px-2 py-1 border border-warning/30 rounded"
                        >
                          Enviar a aprobación
                        </button>
                      )}

                      {/* Borrador: aprobador puede aprobar directamente (bypass) */}
                      {b.status === 'draft' && isApprovable && !isCreator && (
                        <button
                          onClick={() => {
                            // Primero enviar a pending, luego aprobar automáticamente
                            startTransition(async () => {
                              await submitForApproval(b.id)
                              const res = await updateBudgetStatus(b.id, 'approved')
                              if (!res.ok) { flash(`Error: ${res.error}`); return }
                              setBudgets(prev => prev.map(bb => bb.id === b.id ? { ...bb, status: 'approved' } : bb))
                            })
                          }}
                          disabled={isPending}
                          className="text-xs text-info hover:underline px-2 py-1"
                        >
                          Aprobar
                        </button>
                      )}

                      {/* En revisión: aprobador (que no sea creador) puede aprobar */}
                      {b.status === 'pending_approval' && isApprovable && (
                        <button
                          onClick={() => handleStatus(b.id, 'approved')}
                          disabled={isPending}
                          className="text-xs text-info hover:text-info/80 font-semibold px-2 py-1 border border-info/30 rounded"
                        >
                          ✓ Aprobar
                        </button>
                      )}

                      {/* En revisión: creador puede retractarse */}
                      {b.status === 'pending_approval' && isCreator && (
                        <button
                          onClick={() => handleStatus(b.id, 'draft')}
                          disabled={isPending}
                          className="text-xs text-text-disabled hover:underline px-2"
                        >
                          Retirar
                        </button>
                      )}

                      {/* Aprobado → Activar */}
                      {b.status === 'approved' && canApprove && (
                        <button
                          onClick={() => handleStatus(b.id, 'active')}
                          disabled={isPending}
                          className="text-xs text-success hover:underline px-2 py-1 border border-success/30 rounded"
                        >
                          Activar
                        </button>
                      )}

                      {/* Activo → Cerrar */}
                      {b.status === 'active' && canApprove && (
                        <button
                          onClick={() => handleStatus(b.id, 'closed')}
                          disabled={isPending}
                          className="text-xs text-text-disabled hover:underline px-2"
                        >
                          Cerrar
                        </button>
                      )}

                      <Link
                        href={`/gestion/presupuestos/${b.id}`}
                        className="text-xs text-primary hover:underline px-2"
                      >
                        Ver / Editar
                      </Link>
                      <Link
                        href={`/gestion/control?budget_id=${b.id}`}
                        className="text-xs text-text-secondary hover:text-text-primary border border-border rounded px-2 py-1"
                      >
                        Control
                      </Link>
                      {(b.status === 'draft') && (
                        <button
                          onClick={() => handleDelete(b.id, b.name)}
                          disabled={isPending}
                          className="text-text-disabled hover:text-error transition-colors p-1"
                          title="Eliminar"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
