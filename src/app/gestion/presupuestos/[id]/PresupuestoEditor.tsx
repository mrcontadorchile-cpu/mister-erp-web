'use client'

import { useState, useTransition, useMemo } from 'react'
import Link from 'next/link'
import type { Account, CostCenter } from '@/types/database'
import {
  upsertBudgetLines, updateBudgetMeta, updateBudgetStatus, deleteBudget,
  submitForApproval,
  type Budget, type BudgetLine,
} from '../actions'
import { useRouter } from 'next/navigation'

const MONTHS_ES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

function buildMonthLabels(budgetType: string, startMonth: number, fiscalYear: number): string[] {
  if (budgetType !== 'rolling') return MONTHS_ES
  return Array.from({ length: 12 }, (_, i) => {
    const absMonth = (startMonth - 1 + i) % 12 + 1
    const yearOffset = Math.floor((startMonth - 1 + i) / 12)
    const yr = (fiscalYear + yearOffset).toString().slice(-2)
    return `${MONTHS_ES[absMonth - 1]}'${yr}`
  })
}

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  draft:            { label: 'Borrador',    color: 'text-text-disabled bg-surface-high' },
  pending_approval: { label: 'En revisión', color: 'text-warning bg-warning/10' },
  approved:         { label: 'Aprobado',    color: 'text-info bg-info/10' },
  active:           { label: 'Activo',      color: 'text-success bg-success/10' },
  closed:           { label: 'Cerrado',     color: 'text-text-disabled bg-surface-high' },
}

const ACC_TYPES: Record<string, { label: string; color: string }> = {
  INGRESO: { label: 'Ingresos', color: 'text-success' },
  EGRESO:  { label: 'Gastos',   color: 'text-error'   },
  COSTO:   { label: 'Costos',   color: 'text-warning' },
}

interface LineRow {
  key:            string
  account_id:     string
  cost_center_id: string
  amounts:        number[]
}

interface Props {
  budget:      Budget
  budgetLines: BudgetLine[]
  accounts:    Pick<Account, 'id' | 'code' | 'name' | 'type' | 'nature'>[]
  costCenters: Pick<CostCenter, 'id' | 'code' | 'name'>[]
  userId:      string
  canApprove:  boolean
}

function parseNum(v: string) {
  return parseInt(v.replace(/\./g, '').replace(/\s/g, ''), 10) || 0
}
function total(amounts: number[]) {
  return amounts.reduce((s, v) => s + v, 0)
}
function fmtCLP(n: number) {
  return n.toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 })
}

// Convertir BudgetLine[] → LineRow[]
function toRows(lines: BudgetLine[]): LineRow[] {
  const map = new Map<string, LineRow>()
  for (const l of lines) {
    const key = `${l.account_id}::${l.cost_center_id ?? ''}`
    if (!map.has(key)) {
      map.set(key, { key, account_id: l.account_id, cost_center_id: l.cost_center_id ?? '', amounts: Array(12).fill(0) })
    }
    const row = map.get(key)!
    row.amounts[l.month - 1] = l.amount
  }
  return Array.from(map.values())
}

export function PresupuestoEditor({ budget: initial, budgetLines, accounts, costCenters, userId, canApprove }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [budget, setBudget] = useState<Budget>(initial)
  const [lines, setLines]   = useState<LineRow[]>(toRows(budgetLines))
  const [error, setError]   = useState('')
  const [saved, setSaved]   = useState(false)
  const [dirty, setDirty]   = useState(false)
  const [editMeta, setEditMeta] = useState(false)
  const [metaName, setMetaName] = useState(initial.name)
  const [metaDesc, setMetaDesc] = useState(initial.description ?? '')
  const [searchAcc, setSearchAcc] = useState('')
  const isReadonly   = budget.status === 'closed'
  const isCreator    = budget.created_by === userId
  const isApprovable = canApprove && (!budget.created_by || budget.created_by !== userId)
  const monthLabels  = buildMonthLabels(budget.budget_type, budget.start_month ?? 1, budget.fiscal_year)

  function flash(ok: boolean, msg?: string) {
    if (ok) { setSaved(true); setTimeout(() => setSaved(false), 2500) }
    else setError(msg ?? 'Error')
  }

  function addLine(accountId: string, costCenterId: string) {
    const key = `${accountId}::${costCenterId}`
    if (lines.find(l => l.key === key)) return
    setLines(prev => [...prev, { key, account_id: accountId, cost_center_id: costCenterId, amounts: Array(12).fill(0) }])
    setDirty(true)
  }

  function removeLine(key: string) {
    setLines(prev => prev.filter(l => l.key !== key))
    setDirty(true)
  }

  function setAmount(key: string, monthIdx: number, value: string) {
    const n = parseNum(value)
    setLines(prev => prev.map(l =>
      l.key === key ? { ...l, amounts: l.amounts.map((v, i) => i === monthIdx ? n : v) } : l
    ))
    setDirty(true)
  }

  function handleSaveLines() {
    setError('')
    const budgetLinesPayload: BudgetLine[] = lines.flatMap(l =>
      l.amounts.map((amount, idx) => ({
        account_id:     l.account_id,
        cost_center_id: l.cost_center_id || null,
        month:          idx + 1,
        amount,
      })).filter(bl => bl.amount > 0)
    )
    startTransition(async () => {
      const res = await upsertBudgetLines(budget.id, budgetLinesPayload)
      flash(res.ok, res.error)
      if (res.ok) setDirty(false)
    })
  }

  function handleSaveMeta() {
    if (!metaName.trim()) return
    startTransition(async () => {
      const res = await updateBudgetMeta(budget.id, metaName, metaDesc)
      if (res.ok) {
        setBudget(prev => ({ ...prev, name: metaName.trim(), description: metaDesc.trim() || null }))
        setEditMeta(false)
        flash(true)
      } else flash(false, res.error)
    })
  }

  function handleSubmitApproval() {
    if (!confirm('¿Enviar este presupuesto para aprobación?')) return
    startTransition(async () => {
      const res = await submitForApproval(budget.id)
      if (res.ok) setBudget(prev => ({ ...prev, status: 'pending_approval' }))
      else flash(false, res.error)
    })
  }

  function handleStatus(status: Budget['status']) {
    startTransition(async () => {
      const res = await updateBudgetStatus(budget.id, status as any)
      if (res.ok) setBudget(prev => ({ ...prev, status }))
      else flash(false, res.error)
    })
  }

  function distributeRow(key: string) {
    const row = lines.find(l => l.key === key)
    if (!row) return
    const t = total(row.amounts)
    if (t === 0) return
    const monthly = Math.round(t / 12)
    setLines(prev => prev.map(l => l.key === key ? { ...l, amounts: Array(12).fill(monthly) } : l))
    setDirty(true)
  }

  function handleDelete() {
    if (!confirm(`¿Eliminar el presupuesto "${budget.name}"?`)) return
    startTransition(async () => {
      const res = await deleteBudget(budget.id)
      if (res.ok) router.push('/gestion/presupuestos')
      else flash(false, res.error)
    })
  }

  const grandTotal = lines.reduce((s, l) => s + total(l.amounts), 0)
  const st = STATUS_LABEL[budget.status] ?? STATUS_LABEL.draft

  const filteredAccounts = useMemo(() =>
    accounts.filter(a => {
      if (!searchAcc) return true
      const q = searchAcc.toLowerCase()
      return a.code.toLowerCase().includes(q) || a.name.toLowerCase().includes(q)
    }),
    [accounts, searchAcc]
  )

  // Agrupar líneas por tipo de cuenta
  const grouped = useMemo(() => {
    const g: Record<string, LineRow[]> = {}
    for (const l of lines) {
      const acc = accounts.find(a => a.id === l.account_id)
      const type = acc?.type ?? 'OTRO'
      g[type] = [...(g[type] ?? []), l]
    }
    return g
  }, [lines, accounts])

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-start gap-4 mb-6">
        <Link href="/gestion/presupuestos" className="btn-ghost p-2 rounded-lg border border-border mt-1 shrink-0">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div className="flex-1 min-w-0">
          {editMeta ? (
            <div className="flex items-center gap-2">
              <input
                value={metaName}
                onChange={e => setMetaName(e.target.value)}
                className="input text-lg font-bold flex-1"
                autoFocus
              />
              <button onClick={handleSaveMeta} disabled={isPending} className="btn-primary text-sm px-3 py-1.5">Guardar</button>
              <button onClick={() => setEditMeta(false)} className="btn-ghost text-sm px-2 py-1.5">Cancelar</button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-text-primary truncate">{budget.name}</h1>
              {!isReadonly && (
                <button onClick={() => setEditMeta(true)} className="text-text-disabled hover:text-text-secondary shrink-0">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </button>
              )}
            </div>
          )}
          <div className="flex items-center gap-3 mt-1.5">
            <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${st.color}`}>{st.label}</span>
            <span className="text-xs text-text-disabled">Año Fiscal {budget.fiscal_year}</span>
            <span className="text-xs text-text-disabled">{lines.length} línea{lines.length !== 1 ? 's' : ''}</span>
            <span className="text-xs font-bold text-primary">{fmtCLP(grandTotal)}</span>
          </div>
        </div>

        {/* Acciones estado */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Borrador: creador envía a revisión */}
          {budget.status === 'draft' && isCreator && (
            <button onClick={handleSubmitApproval} disabled={isPending} className="btn-ghost text-xs border border-warning/40 text-warning px-3 py-1.5">
              Enviar a aprobación
            </button>
          )}
          {/* Borrador: aprobador puede aprobar directo (si no es creador) */}
          {budget.status === 'draft' && isApprovable && !isCreator && (
            <button onClick={() => handleStatus('approved')} disabled={isPending} className="btn-ghost text-xs border border-info/40 text-info px-3 py-1.5">
              Aprobar
            </button>
          )}
          {/* En revisión: aprobador aprueba */}
          {budget.status === 'pending_approval' && isApprovable && (
            <button onClick={() => handleStatus('approved')} disabled={isPending} className="btn-ghost text-xs border border-info/40 text-info px-3 py-1.5">
              ✓ Aprobar
            </button>
          )}
          {/* En revisión: creador retira */}
          {budget.status === 'pending_approval' && isCreator && (
            <button onClick={() => handleStatus('draft')} disabled={isPending} className="btn-ghost text-xs border border-border text-text-disabled px-3 py-1.5">
              Retirar
            </button>
          )}
          {budget.status === 'approved' && canApprove && (
            <button onClick={() => handleStatus('active')} disabled={isPending} className="btn-ghost text-xs border border-success/40 text-success px-3 py-1.5">Activar</button>
          )}
          {budget.status === 'active' && canApprove && (
            <button onClick={() => handleStatus('closed')} disabled={isPending} className="btn-ghost text-xs border border-border text-text-disabled px-3 py-1.5">Cerrar</button>
          )}
          <Link href={`/gestion/control?budget_id=${budget.id}`}
            className="btn-ghost text-xs border border-border px-3 py-1.5 flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            Control
          </Link>
          {budget.status === 'draft' && (
            <button onClick={handleDelete} disabled={isPending} className="text-text-disabled hover:text-error transition-colors p-2" title="Eliminar">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      {saved && <div className="mb-4 p-3 rounded-lg bg-success/10 text-success text-sm border border-success/20">✓ Guardado correctamente</div>}
      {error && <div className="mb-4 p-3 rounded-lg bg-error/10 text-error text-sm border border-error/20">{error}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Panel izquierdo: añadir cuentas (solo si no está cerrado) */}
        {!isReadonly && (
          <div className="lg:col-span-1">
            <div className="card p-4 sticky top-4">
              <p className="text-xs font-semibold text-text-disabled uppercase tracking-wider mb-3">Añadir cuenta</p>
              <input
                type="text"
                value={searchAcc}
                onChange={e => setSearchAcc(e.target.value)}
                placeholder="Buscar cuenta..."
                className="input w-full text-xs mb-3"
              />
              <div className="space-y-0.5 max-h-96 overflow-y-auto pr-1">
                {filteredAccounts.map(a => (
                  <div key={a.id} className="group">
                    <button
                      type="button"
                      onClick={() => addLine(a.id, '')}
                      className="w-full text-left p-2 rounded-lg hover:bg-surface-high text-xs flex items-center gap-2"
                    >
                      <span className={`font-mono text-[10px] shrink-0 ${ACC_TYPES[a.type]?.color ?? ''}`}>{a.code}</span>
                      <span className="truncate text-text-secondary group-hover:text-text-primary">{a.name}</span>
                      <svg className="w-3 h-3 text-primary shrink-0 ml-auto opacity-0 group-hover:opacity-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    </button>
                    {costCenters.length > 0 && (
                      <div className="hidden group-hover:block pl-4 space-y-0.5 pb-1">
                        {costCenters.map(cc => (
                          <button key={cc.id} type="button" onClick={() => addLine(a.id, cc.id)}
                            className="w-full text-left px-2 py-1 rounded text-[10px] text-text-disabled hover:text-text-secondary hover:bg-surface-high flex items-center gap-1">
                            <span className="text-primary">+</span> {cc.code} — {cc.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Tabla de líneas */}
        <div className={isReadonly ? 'lg:col-span-4' : 'lg:col-span-3'}>
          {lines.length === 0 ? (
            <div className="card p-12 text-center text-text-disabled text-sm">Sin líneas presupuestarias</div>
          ) : (
            <div className="space-y-6">
              {Object.entries(grouped).map(([type, typeLines]) => (
                <div key={type}>
                  <p className={`text-xs font-semibold uppercase tracking-wider mb-2 ${ACC_TYPES[type]?.color ?? 'text-text-secondary'}`}>
                    {ACC_TYPES[type]?.label ?? type}
                  </p>
                  <div className="space-y-2">
                    {typeLines.map(l => {
                      const acc = accounts.find(a => a.id === l.account_id)
                      const cc  = costCenters.find(c => c.id === l.cost_center_id)
                      const lineTotal = total(l.amounts)
                      return (
                        <div key={l.key} className="card overflow-hidden">
                          <div className="flex items-center justify-between px-3 py-2 bg-surface-high/40 border-b border-border">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className={`text-xs font-mono shrink-0 ${ACC_TYPES[acc?.type ?? '']?.color ?? ''}`}>{acc?.code}</span>
                              <span className="text-xs font-medium text-text-primary truncate">{acc?.name}</span>
                              {cc && <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded shrink-0">{cc.code}</span>}
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-xs font-mono font-bold">{fmtCLP(lineTotal)}</span>
                              {!isReadonly && lineTotal > 0 && (
                                <button
                                  type="button"
                                  onClick={() => distributeRow(l.key)}
                                  className="text-[10px] text-text-disabled hover:text-primary border border-border hover:border-primary/40 px-1.5 py-0.5 rounded transition-colors"
                                  title="Distribuir uniformemente en 12 meses"
                                >÷12</button>
                              )}
                              {!isReadonly && (
                                <button type="button" onClick={() => removeLine(l.key)} className="text-text-disabled hover:text-error transition-colors">
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              )}
                            </div>
                          </div>
                          <div className="grid grid-cols-6 md:grid-cols-12 gap-0 divide-x divide-border">
                            {monthLabels.map((mes, idx) => (
                              <div key={mes} className="flex flex-col p-1.5">
                                <span className="text-[9px] text-text-disabled text-center mb-1">{mes}</span>
                                {isReadonly ? (
                                  <span className="w-full text-center text-xs text-text-primary">
                                    {l.amounts[idx] > 0 ? l.amounts[idx].toLocaleString('es-CL') : '—'}
                                  </span>
                                ) : (
                                  <input
                                    type="text"
                                    value={l.amounts[idx] > 0 ? l.amounts[idx].toLocaleString('es-CL') : ''}
                                    onChange={e => setAmount(l.key, idx, e.target.value)}
                                    placeholder="0"
                                    className="w-full text-center text-xs bg-transparent border-0 outline-none text-text-primary focus:bg-primary/5 rounded px-0 py-0.5"
                                  />
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )
                    })}
                    {/* Subtotal por tipo */}
                    <div className="flex justify-end pr-2">
                      <span className="text-xs text-text-disabled">
                        Subtotal {ACC_TYPES[type]?.label ?? type}:{' '}
                        <span className={`font-bold ${ACC_TYPES[type]?.color ?? ''}`}>
                          {fmtCLP(typeLines.reduce((s, l) => s + total(l.amounts), 0))}
                        </span>
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Guardar */}
          {!isReadonly && dirty && (
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={handleSaveLines}
                disabled={isPending}
                className="btn-primary px-6"
              >
                {isPending ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
