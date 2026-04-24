'use client'

import { useState, useTransition, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import type { Account, CostCenter } from '@/types/database'
import { createBudget, type BudgetLine } from '../actions'

const MONTHS_ES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

interface AccountOption extends Pick<Account, 'id' | 'code' | 'name' | 'type' | 'nature'> {}
interface CostCenterOption extends Pick<CostCenter, 'id' | 'code' | 'name'> {}

interface LineRow {
  key:            string
  account_id:     string
  cost_center_id: string
  amounts:        number[]  // [12 posiciones, index 0 = mes presupuesto 1]
}

interface Props {
  accounts:    AccountOption[]
  costCenters: CostCenterOption[]
}

function fmtNum(v: string) {
  const n = parseInt(v.replace(/\D/g, ''), 10)
  return isNaN(n) ? '' : n.toLocaleString('es-CL')
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

// Genera etiquetas de meses para el presupuesto (rolling puede cruzar años)
function buildMonthLabels(budgetType: 'annual' | 'rolling', startMonth: number, fiscalYear: number): string[] {
  if (budgetType === 'annual') return MONTHS_ES
  return Array.from({ length: 12 }, (_, i) => {
    const absMonth = (startMonth - 1 + i) % 12 + 1
    const yearOffset = Math.floor((startMonth - 1 + i) / 12)
    const yr = (fiscalYear + yearOffset).toString().slice(-2)
    return `${MONTHS_ES[absMonth - 1]}'${yr}`
  })
}

const ACC_TYPES: Record<string, { label: string; color: string }> = {
  INGRESO: { label: 'Ingresos',  color: 'text-success' },
  EGRESO:  { label: 'Gastos',    color: 'text-error'   },
  COSTO:   { label: 'Costos',    color: 'text-warning' },
}

export function NuevoPresupuestoForm({ accounts, costCenters }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // Paso 1: cabecera
  const now = new Date()
  const [name,        setName]        = useState('')
  const [description, setDescription] = useState('')
  const [fiscalYear,  setFiscalYear]  = useState(now.getFullYear())
  const [budgetType,  setBudgetType]  = useState<'annual' | 'rolling'>('annual')
  const [startMonth,  setStartMonth]  = useState(1)
  const [step,        setStep]        = useState<1 | 2>(1)
  const [error,       setError]       = useState('')

  // Paso 2: líneas
  const [lines,       setLines]       = useState<LineRow[]>([])
  const [searchAcc,   setSearchAcc]   = useState('')
  const [filterType,  setFilterType]  = useState<'ALL' | 'INGRESO' | 'EGRESO' | 'COSTO'>('ALL')

  // Panel de distribución automática (rápida)
  const [annualInput,     setAnnualInput]     = useState('')
  const [annualAccountId, setAnnualAccountId] = useState('')
  const [annualCcId,      setAnnualCcId]      = useState('')

  const monthLabels = useMemo(
    () => buildMonthLabels(budgetType, startMonth, fiscalYear),
    [budgetType, startMonth, fiscalYear]
  )

  // ── Añadir línea ─────────────────────────────────────────
  function addLine(accountId: string, costCenterId: string) {
    const key = `${accountId}::${costCenterId}`
    if (lines.find(l => l.key === key)) return
    setLines(prev => [...prev, { key, account_id: accountId, cost_center_id: costCenterId, amounts: Array(12).fill(0) }])
  }

  function removeLine(key: string) {
    setLines(prev => prev.filter(l => l.key !== key))
  }

  function setAmount(key: string, monthIdx: number, value: string) {
    const n = parseNum(value)
    setLines(prev => prev.map(l =>
      l.key === key ? { ...l, amounts: l.amounts.map((v, i) => i === monthIdx ? n : v) } : l
    ))
  }

  // Distribuir total de una fila en 12 cuotas iguales
  function distributeRow(key: string) {
    setLines(prev => prev.map(l => {
      if (l.key !== key) return l
      const t = total(l.amounts)
      if (t === 0) return l
      const monthly = Math.round(t / 12)
      return { ...l, amounts: Array(12).fill(monthly) }
    }))
  }

  // Panel rápido: ingresa total anual → distribuye en 12 y agrega la línea
  function distributeAnnual() {
    if (!annualAccountId) return
    const n = parseNum(annualInput)
    if (!n) return
    const monthly = Math.round(n / 12)
    const key = `${annualAccountId}::${annualCcId}`
    setLines(prev => {
      const existing = prev.find(l => l.key === key)
      if (existing) {
        return prev.map(l => l.key === key ? { ...l, amounts: Array(12).fill(monthly) } : l)
      }
      return [...prev, { key, account_id: annualAccountId, cost_center_id: annualCcId, amounts: Array(12).fill(monthly) }]
    })
    setAnnualInput('')
  }

  const grandTotal = lines.reduce((s, l) => s + total(l.amounts), 0)

  const filteredAccounts = useMemo(() => {
    return accounts.filter(a => {
      if (filterType !== 'ALL' && a.type !== filterType) return false
      if (!searchAcc) return true
      const q = searchAcc.toLowerCase()
      return a.code.toLowerCase().includes(q) || a.name.toLowerCase().includes(q)
    })
  }, [accounts, searchAcc, filterType])

  // ── Guardar ───────────────────────────────────────────────
  function handleSave() {
    if (lines.length === 0) { setError('Debes agregar al menos una línea presupuestaria'); return }
    const budgetLines: BudgetLine[] = lines.flatMap(l =>
      l.amounts.map((amount, idx) => ({
        account_id:     l.account_id,
        cost_center_id: l.cost_center_id || null,
        month:          idx + 1,
        amount,
      })).filter(bl => bl.amount > 0)
    )
    if (budgetLines.length === 0) { setError('Todos los montos son cero'); return }
    setError('')
    startTransition(async () => {
      const res = await createBudget(name, fiscalYear, description, budgetLines, budgetType, startMonth)
      if (!res.ok) { setError(res.error ?? 'Error al guardar'); return }
      router.push(`/gestion/presupuestos/${res.id}`)
    })
  }

  // ──────────────────────────────────────────────────────────
  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <button
          type="button"
          onClick={() => step === 2 ? setStep(1) : router.back()}
          className="btn-ghost p-2 rounded-lg border border-border"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div>
          <h1 className="text-xl font-bold text-text-primary">Nuevo Presupuesto</h1>
          <p className="text-xs text-text-disabled mt-0.5">
            Paso {step} de 2 · {step === 1 ? 'Información general' : 'Líneas presupuestarias'}
          </p>
        </div>
      </div>

      {/* ── PASO 1: Cabecera ── */}
      {step === 1 && (
        <div className="max-w-xl space-y-4">
          <div className="card p-6 space-y-5">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">
                Nombre <span className="text-error">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Ej: Presupuesto Operacional 2025"
                className="input w-full"
              />
            </div>

            {/* Tipo de presupuesto */}
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-2">
                Tipo de presupuesto <span className="text-error">*</span>
              </label>
              <div className="grid grid-cols-2 gap-3">
                {([
                  { value: 'annual',  icon: '📅', title: 'Año Calendario',    desc: 'Enero a Diciembre de un año fijo' },
                  { value: 'rolling', icon: '🔄', title: 'Rolling Forecast',  desc: '12 meses móviles desde un mes inicial' },
                ] as const).map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setBudgetType(opt.value)}
                    className={`p-4 rounded-xl border text-left transition-all ${
                      budgetType === opt.value
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/40'
                    }`}
                  >
                    <div className="text-xl mb-1">{opt.icon}</div>
                    <p className="text-sm font-semibold text-text-primary">{opt.title}</p>
                    <p className="text-xs text-text-disabled mt-0.5">{opt.desc}</p>
                    {budgetType === opt.value && (
                      <div className="w-2 h-2 rounded-full bg-primary mt-2" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Año y mes inicio */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5">
                  {budgetType === 'rolling' ? 'Año de inicio' : 'Año Fiscal'} <span className="text-error">*</span>
                </label>
                <select
                  value={fiscalYear}
                  onChange={e => setFiscalYear(Number(e.target.value))}
                  className="input w-full"
                >
                  {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>

              {budgetType === 'rolling' && (
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1.5">
                    Mes de inicio <span className="text-error">*</span>
                  </label>
                  <select
                    value={startMonth}
                    onChange={e => setStartMonth(Number(e.target.value))}
                    className="input w-full"
                  >
                    {MONTHS_ES.map((m, i) => (
                      <option key={i + 1} value={i + 1}>{m}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Preview del rango para rolling */}
            {budgetType === 'rolling' && (
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 text-xs text-text-secondary">
                <span className="font-semibold text-primary">Período: </span>
                {buildMonthLabels('rolling', startMonth, fiscalYear)[0].replace("'", ' 20')}
                {' '} → {' '}
                {buildMonthLabels('rolling', startMonth, fiscalYear)[11].replace("'", ' 20')}
                <span className="ml-2 text-text-disabled">(12 meses)</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">
                Descripción (opcional)
              </label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Descripción o notas del presupuesto..."
                rows={2}
                className="input w-full resize-none"
              />
            </div>

            <button
              type="button"
              onClick={() => {
                if (!name.trim()) { setError('El nombre es obligatorio'); return }
                setError('')
                setStep(2)
              }}
              className="btn-primary w-full"
            >
              Continuar → Ingresar montos
            </button>
            {error && <p className="text-xs text-error">{error}</p>}
          </div>
        </div>
      )}

      {/* ── PASO 2: Líneas ── */}
      {step === 2 && (
        <div className="space-y-6">
          {/* Summary bar */}
          <div className="flex flex-wrap items-center gap-4 p-4 bg-primary/5 border border-primary/20 rounded-xl">
            <div>
              <p className="text-xs text-text-disabled">Presupuesto</p>
              <p className="text-sm font-bold text-text-primary">{name}</p>
            </div>
            <div>
              <p className="text-xs text-text-disabled">Período</p>
              <p className="text-sm font-bold text-text-primary">
                {budgetType === 'annual'
                  ? `Ene–Dic ${fiscalYear}`
                  : `${monthLabels[0]} → ${monthLabels[11]}`
                }
              </p>
            </div>
            <div>
              <p className="text-xs text-text-disabled">Tipo</p>
              <p className="text-sm font-bold text-primary">
                {budgetType === 'annual' ? '📅 Año Calendario' : '🔄 Rolling Forecast'}
              </p>
            </div>
            <div className="ml-auto">
              <p className="text-xs text-text-disabled">Total Presupuestado</p>
              <p className="text-lg font-black text-primary">{fmtCLP(grandTotal)}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Panel izquierdo */}
            <div className="lg:col-span-1">
              <div className="card p-4 sticky top-4">
                <p className="text-xs font-semibold text-text-disabled uppercase tracking-wider mb-3">Agregar cuenta</p>

                {/* Distribución rápida */}
                <div className="bg-surface-high rounded-lg p-3 mb-4 space-y-2">
                  <p className="text-xs font-medium text-text-secondary">⚡ Distribución automática</p>
                  <p className="text-[10px] text-text-disabled">Ingresa el total anual y se divide en 12 cuotas iguales</p>
                  <select
                    value={annualAccountId}
                    onChange={e => setAnnualAccountId(e.target.value)}
                    className="input w-full text-xs"
                  >
                    <option value="">Seleccionar cuenta...</option>
                    {accounts.map(a => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
                  </select>
                  {costCenters.length > 0 && (
                    <select
                      value={annualCcId}
                      onChange={e => setAnnualCcId(e.target.value)}
                      className="input w-full text-xs"
                    >
                      <option value="">Sin centro de costo</option>
                      {costCenters.map(c => <option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}
                    </select>
                  )}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={annualInput}
                      onChange={e => setAnnualInput(fmtNum(e.target.value))}
                      onKeyDown={e => e.key === 'Enter' && distributeAnnual()}
                      placeholder="Monto anual total"
                      className="input flex-1 text-xs"
                    />
                    <button type="button" onClick={distributeAnnual} className="btn-primary px-3 py-1.5 text-xs shrink-0">
                      ÷12
                    </button>
                  </div>
                </div>

                {/* Búsqueda manual */}
                <input
                  type="text"
                  value={searchAcc}
                  onChange={e => setSearchAcc(e.target.value)}
                  placeholder="Buscar cuenta..."
                  className="input w-full text-xs mb-2"
                />
                <div className="flex gap-1 mb-3 flex-wrap">
                  {(['ALL', 'INGRESO', 'EGRESO', 'COSTO'] as const).map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setFilterType(t)}
                      className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${
                        filterType === t
                          ? 'bg-primary text-black border-primary'
                          : 'border-border text-text-disabled hover:border-primary/40'
                      }`}
                    >
                      {t === 'ALL' ? 'Todos' : ACC_TYPES[t]?.label}
                    </button>
                  ))}
                </div>

                <div className="space-y-0.5 max-h-72 overflow-y-auto pr-1">
                  {filteredAccounts.map(a => (
                    <div key={a.id} className="group">
                      <button
                        type="button"
                        onClick={() => addLine(a.id, '')}
                        className="w-full text-left p-2 rounded-lg hover:bg-surface-high transition-colors text-xs flex items-center gap-2"
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
                            <button
                              key={cc.id}
                              type="button"
                              onClick={() => addLine(a.id, cc.id)}
                              className="w-full text-left px-2 py-1 rounded text-[10px] text-text-disabled hover:text-text-secondary hover:bg-surface-high"
                            >
                              <span className="text-primary mr-1">+</span>{cc.code} — {cc.name}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                  {filteredAccounts.length === 0 && (
                    <p className="text-xs text-text-disabled py-3 text-center">Sin resultados</p>
                  )}
                </div>
              </div>
            </div>

            {/* Panel derecho: tabla de líneas */}
            <div className="lg:col-span-2">
              {lines.length === 0 ? (
                <div className="card p-12 text-center text-text-disabled text-sm">
                  <p className="mb-1">Sin líneas presupuestarias</p>
                  <p className="text-xs">Usa la distribución automática o selecciona cuentas del panel izquierdo</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {lines.map(l => {
                    const acc = accounts.find(a => a.id === l.account_id)
                    const cc  = costCenters.find(c => c.id === l.cost_center_id)
                    const lineTotal = total(l.amounts)
                    return (
                      <div key={l.key} className="card overflow-hidden">
                        {/* Cabecera línea */}
                        <div className="flex items-center justify-between px-4 py-2.5 bg-surface-high/40 border-b border-border">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className={`text-xs font-mono shrink-0 ${ACC_TYPES[acc?.type ?? '']?.color ?? 'text-text-secondary'}`}>
                              {acc?.code}
                            </span>
                            <span className="text-xs font-medium text-text-primary truncate">{acc?.name}</span>
                            {cc && <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded shrink-0">{cc.code}</span>}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-xs font-mono font-bold text-text-primary">{fmtCLP(lineTotal)}</span>
                            {/* Botón ÷12 por fila */}
                            {lineTotal > 0 && (
                              <button
                                type="button"
                                onClick={() => distributeRow(l.key)}
                                className="text-[10px] text-text-disabled hover:text-primary border border-border hover:border-primary/40 px-1.5 py-0.5 rounded transition-colors"
                                title="Distribuir uniformemente en 12 meses"
                              >
                                ÷12
                              </button>
                            )}
                            <button type="button" onClick={() => removeLine(l.key)} className="text-text-disabled hover:text-error transition-colors">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        </div>

                        {/* Celdas por mes */}
                        <div className="grid grid-cols-6 md:grid-cols-12 gap-0 divide-x divide-border">
                          {monthLabels.map((mes, idx) => (
                            <div key={mes} className="flex flex-col p-1.5">
                              <span className="text-[9px] text-text-disabled text-center mb-1">{mes}</span>
                              <input
                                type="text"
                                value={l.amounts[idx] > 0 ? l.amounts[idx].toLocaleString('es-CL') : ''}
                                onChange={e => setAmount(l.key, idx, e.target.value)}
                                placeholder="0"
                                className="w-full text-center text-xs bg-transparent border-0 outline-none text-text-primary focus:bg-primary/5 rounded px-0 py-0.5"
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {error && (
                <p className="text-xs text-error mt-3 p-3 bg-error/5 rounded-lg border border-error/20">{error}</p>
              )}
              {lines.length > 0 && (
                <div className="mt-4 flex items-center justify-between">
                  <p className="text-xs text-text-disabled">
                    {lines.length} línea{lines.length !== 1 ? 's' : ''} · Total:{' '}
                    <span className="text-primary font-bold">{fmtCLP(grandTotal)}</span>
                  </p>
                  <button type="button" onClick={handleSave} disabled={isPending} className="btn-primary px-6">
                    {isPending ? 'Guardando...' : 'Guardar Presupuesto'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
