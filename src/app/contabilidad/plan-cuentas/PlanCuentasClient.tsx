'use client'

import { useState, useTransition } from 'react'
import { Modal } from '@/components/ui/modal'
import { accountTypeColor, accountTypeLabel } from '@/lib/utils'
import { createAccount, updateAccount, toggleAccount } from './actions'
import type { Account, AccountType } from '@/types/database'

interface Props {
  accounts: Account[]
}

interface FormState {
  code: string
  name: string
  type: AccountType
  nature: 'DEUDOR' | 'ACREEDOR'
  parent_id: string
  allows_entry:         boolean
  cost_center_required: boolean
  has_auxiliary:        boolean
}

const DEFAULTS_BY_TYPE: Record<AccountType, { cc: boolean; aux: boolean }> = {
  ACTIVO:     { cc: false, aux: true  },
  PASIVO:     { cc: false, aux: true  },
  INGRESO:    { cc: true,  aux: false },
  EGRESO:     { cc: true,  aux: false },
  PATRIMONIO: { cc: false, aux: false },
}

const EMPTY_FORM: FormState = {
  code: '', name: '', type: 'ACTIVO', nature: 'DEUDOR',
  parent_id: '', allows_entry: true, cost_center_required: false, has_auxiliary: true,
}

const NATURE_BY_TYPE: Record<AccountType, 'DEUDOR' | 'ACREEDOR'> = {
  ACTIVO: 'DEUDOR', EGRESO: 'DEUDOR',
  PASIVO: 'ACREEDOR', PATRIMONIO: 'ACREEDOR', INGRESO: 'ACREEDOR',
}

export function PlanCuentasClient({ accounts }: Props) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [editId, setEditId] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState<AccountType | ''>('')
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  const types: AccountType[] = ['ACTIVO', 'PASIVO', 'PATRIMONIO', 'INGRESO', 'EGRESO']

  const filtered = accounts.filter(a => {
    if (filterType && a.type !== filterType) return false
    if (search && !a.code.includes(search) && !a.name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const openCreate = () => {
    setEditId(null)
    setForm(EMPTY_FORM)
    setError('')
    setModalOpen(true)
  }

  const openEdit = (acc: Account) => {
    setEditId(acc.id)
    setForm({
      code:                 acc.code,
      name:                 acc.name,
      type:                 acc.type,
      nature:               acc.nature,
      parent_id:            acc.parent_id ?? '',
      allows_entry:         acc.allows_entry,
      cost_center_required: acc.cost_center_required,
      has_auxiliary:        (acc as any).has_auxiliary ?? false,
    })
    setError('')
    setModalOpen(true)
  }

  const handleTypeChange = (type: AccountType) => {
    const d = DEFAULTS_BY_TYPE[type]
    setForm(f => ({
      ...f,
      type,
      nature:               NATURE_BY_TYPE[type],
      cost_center_required: d.cc,
      has_auxiliary:        d.aux,
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    startTransition(async () => {
      const result = editId
        ? await updateAccount(editId, { ...form, parent_id: form.parent_id || null })
        : await createAccount(form)
      if (result.error) { setError(result.error); return }
      setModalOpen(false)
    })
  }

  const handleToggle = (id: string, current: boolean) => {
    startTransition(async () => { await toggleAccount(id, !current) })
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Plan de Cuentas</h1>
          <p className="text-text-secondary text-sm mt-1">{accounts.length} cuentas totales</p>
        </div>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nueva Cuenta
        </button>
      </div>

      {/* Filtros */}
      <div className="flex gap-3 mb-5 flex-wrap">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar código o nombre..."
          className="input w-64 text-sm"
        />
        <select value={filterType} onChange={e => setFilterType(e.target.value as AccountType | '')} className="input w-44 text-sm">
          <option value="">Todos los tipos</option>
          {types.map(t => <option key={t} value={t}>{accountTypeLabel(t)}</option>)}
        </select>
        <div className="flex gap-2 flex-wrap">
          {types.map(t => {
            const count = accounts.filter(a => a.type === t).length
            const color = accountTypeColor(t)
            return (
              <button
                key={t}
                onClick={() => setFilterType(filterType === t ? '' : t)}
                className="px-3 py-1 rounded-full text-xs font-medium border transition-all"
                style={{
                  color: filterType === t ? '#000' : color,
                  borderColor: `${color}60`,
                  backgroundColor: filterType === t ? color : `${color}15`,
                }}
              >
                {accountTypeLabel(t)} ({count})
              </button>
            )
          })}
        </div>
      </div>

      {/* Tabla */}
      <div className="card overflow-hidden overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="table-header">
              <th className="px-4 py-3 text-left w-28">Código</th>
              <th className="px-4 py-3 text-left">Nombre</th>
              <th className="px-4 py-3 text-center w-28">Tipo</th>
              <th className="px-4 py-3 text-center w-20">Nivel</th>
              <th className="px-4 py-3 text-center w-24">Naturaleza</th>
              <th className="px-4 py-3 text-center w-20">Mov.</th>
              <th className="px-4 py-3 text-center w-20" title="Centro de Costo">CC</th>
              <th className="px-4 py-3 text-center w-20" title="Auxiliar">Aux.</th>
              <th className="px-4 py-3 text-center w-20">Estado</th>
              <th className="px-4 py-3 text-center w-16">Edit.</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(acc => {
              const color = accountTypeColor(acc.type)
              return (
                <tr key={acc.id} className="table-row">
                  <td className="px-4 py-2.5">
                    <span className="font-mono text-xs" style={{ color }}>{acc.code}</span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className={acc.level <= 2 ? 'font-semibold text-text-primary' : 'text-text-secondary'}
                      style={{ paddingLeft: `${(acc.level - 1) * 12}px` }}
                    >
                      {acc.name}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <span className="badge text-xs" style={{ color, backgroundColor: `${color}15`, border: `1px solid ${color}30` }}>
                      {accountTypeLabel(acc.type)}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <span className="badge bg-surface-high text-text-secondary">N{acc.level}</span>
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <span className={`badge ${acc.nature === 'DEUDOR' ? 'bg-info/10 text-info' : 'bg-warning/10 text-warning'}`}>
                      {acc.nature}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    {acc.allows_entry
                      ? <span className="badge bg-success/10 text-success text-[10px]">Sí</span>
                      : <span className="badge bg-surface-high text-text-disabled text-[10px]">No</span>}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    {acc.allows_entry
                      ? acc.cost_center_required
                        ? <span className="badge bg-primary/10 text-primary text-[10px]">Sí</span>
                        : <span className="badge bg-surface-high text-text-disabled text-[10px]">No</span>
                      : <span className="text-text-disabled text-[10px]">—</span>}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    {acc.allows_entry
                      ? (acc as any).has_auxiliary
                        ? <span className="badge bg-warning/10 text-warning text-[10px]">Sí</span>
                        : <span className="badge bg-surface-high text-text-disabled text-[10px]">No</span>
                      : <span className="text-text-disabled text-[10px]">—</span>}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <button
                      onClick={() => handleToggle(acc.id, acc.active)}
                      className={`badge cursor-pointer transition-colors text-[10px] ${acc.active ? 'bg-success/10 text-success hover:bg-success/20' : 'bg-surface-high text-text-disabled hover:bg-error/10 hover:text-error'}`}
                    >
                      {acc.active ? 'Activa' : 'Inactiva'}
                    </button>
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <button
                      onClick={() => openEdit(acc)}
                      className="text-text-disabled hover:text-primary transition-colors p-1"
                      title="Editar"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                  </td>
                </tr>
              )
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-text-disabled">
                  No se encontraron cuentas
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editId ? 'Editar Cuenta' : 'Nueva Cuenta'}
        description="Completa los datos de la cuenta contable"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-text-disabled block mb-1">Código *</label>
              <input
                value={form.code}
                onChange={e => setForm(f => ({ ...f, code: e.target.value }))}
                className="input text-sm font-mono"
                placeholder="Ej: 1101"
                required
              />
            </div>
            <div>
              <label className="text-xs text-text-disabled block mb-1">Tipo *</label>
              <select
                value={form.type}
                onChange={e => handleTypeChange(e.target.value as AccountType)}
                className="input text-sm"
                required
              >
                {types.map(t => <option key={t} value={t}>{accountTypeLabel(t)}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs text-text-disabled block mb-1">Nombre *</label>
            <input
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="input text-sm"
              placeholder="Ej: Caja"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-text-disabled block mb-1">Naturaleza *</label>
              <select
                value={form.nature}
                onChange={e => setForm(f => ({ ...f, nature: e.target.value as 'DEUDOR' | 'ACREEDOR' }))}
                className="input text-sm"
                required
              >
                <option value="DEUDOR">Deudor</option>
                <option value="ACREEDOR">Acreedor</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-text-disabled block mb-1">Cuenta Padre</label>
              <select
                value={form.parent_id}
                onChange={e => setForm(f => ({ ...f, parent_id: e.target.value }))}
                className="input text-sm"
              >
                <option value="">Sin padre (nivel 1)</option>
                {accounts
                  .filter(a => a.type === form.type && a.id !== editId)
                  .sort((a, b) => a.code.localeCompare(b.code))
                  .map(a => (
                    <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
                  ))}
              </select>
            </div>
          </div>

          <div className="border border-border rounded-lg p-3 space-y-2.5">
            <p className="text-xs text-text-disabled font-medium mb-1">Controles de la cuenta</p>
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={form.allows_entry}
                onChange={e => setForm(f => ({ ...f, allows_entry: e.target.checked }))}
                className="w-3.5 h-3.5 accent-primary"
              />
              <div>
                <span className="text-sm text-text-secondary">Permite movimientos</span>
                <p className="text-[10px] text-text-disabled">La cuenta acepta líneas en asientos contables</p>
              </div>
            </label>
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={form.cost_center_required}
                onChange={e => setForm(f => ({ ...f, cost_center_required: e.target.checked }))}
                className="w-3.5 h-3.5 accent-primary"
              />
              <div>
                <span className="text-sm text-text-secondary">Requiere Centro de Costo</span>
                <p className="text-[10px] text-text-disabled">Por defecto: Sí en cuentas de resultado (INGRESO/EGRESO)</p>
              </div>
            </label>
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={form.has_auxiliary}
                onChange={e => setForm(f => ({ ...f, has_auxiliary: e.target.checked }))}
                className="w-3.5 h-3.5 accent-primary"
              />
              <div>
                <span className="text-sm text-text-secondary">Lleva Auxiliar</span>
                <p className="text-[10px] text-text-disabled">Por defecto: Sí en Activo/Pasivo. No en Caja/Bancos ni cuentas de resultado</p>
              </div>
            </label>
          </div>

          {error && <p className="text-xs text-error bg-error/10 px-3 py-2 rounded">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-ghost flex-1">
              Cancelar
            </button>
            <button type="submit" disabled={isPending} className="btn-primary flex-1">
              {isPending ? 'Guardando...' : editId ? 'Guardar Cambios' : 'Crear Cuenta'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
