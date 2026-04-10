'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { Modal } from '@/components/ui/modal'
import { createAuxiliary, updateAuxiliary, toggleAuxiliary } from './actions'

const AUX_TYPES = [
  { value: 'CLIENTE',     label: 'Cliente' },
  { value: 'PROVEEDOR',   label: 'Proveedor' },
  { value: 'EMPLEADO',    label: 'Empleado' },
  { value: 'ACTIVO_FIJO', label: 'Activo Fijo' },
  { value: 'OTRO',        label: 'Otro' },
]

const TYPE_COLOR: Record<string, string> = {
  CLIENTE:     'bg-success/10 text-success',
  PROVEEDOR:   'bg-info/10 text-info',
  EMPLEADO:    'bg-warning/10 text-warning',
  ACTIVO_FIJO: 'bg-primary/10 text-primary',
  OTRO:        'bg-surface-high text-text-disabled',
}

interface Auxiliary {
  id:     string
  code:   string
  name:   string
  rut:    string | null
  type:   string
  active: boolean
}

interface Props {
  items: Auxiliary[]
}

const EMPTY = { code: '', name: '', rut: '', type: 'PROVEEDOR' }

export function AuxiliaresClient({ items }: Props) {
  const [form, setForm]             = useState(EMPTY)
  const [editId, setEditId]         = useState<string | null>(null)
  const [modalOpen, setModalOpen]   = useState(false)
  const [filterType, setFilterType] = useState('')
  const [search, setSearch]         = useState('')
  const [error, setError]           = useState('')
  const [isPending, startTransition] = useTransition()

  const openCreate = () => {
    setEditId(null); setForm(EMPTY); setError(''); setModalOpen(true)
  }

  const openEdit = (a: Auxiliary) => {
    setEditId(a.id)
    setForm({ code: a.code, name: a.name, rut: a.rut ?? '', type: a.type })
    setError(''); setModalOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError('')
    startTransition(async () => {
      const r = editId
        ? await updateAuxiliary(editId, form)
        : await createAuxiliary(form)
      if (r.error) { setError(r.error); return }
      setModalOpen(false)
    })
  }

  const handleToggle = (id: string, current: boolean) => {
    startTransition(async () => { await toggleAuxiliary(id, !current) })
  }

  const filtered = items.filter(a => {
    if (filterType && a.type !== filterType) return false
    if (search) {
      const q = search.toLowerCase()
      return a.name.toLowerCase().includes(q) ||
             a.code.toLowerCase().includes(q) ||
             (a.rut ?? '').toLowerCase().includes(q)
    }
    return true
  })

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Auxiliares (Terceros)</h1>
          <p className="text-text-secondary text-sm mt-1">
            Proveedores, clientes, empleados — independientes de la cuenta contable
          </p>
        </div>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nuevo Auxiliar
        </button>
      </div>

      {/* Filtros */}
      <div className="card p-4 mb-5 flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-48">
          <label className="text-xs text-text-disabled block mb-1">Buscar</label>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input text-sm w-full"
            placeholder="Nombre, código o RUT..."
          />
        </div>
        <div>
          <label className="text-xs text-text-disabled block mb-1">Tipo</label>
          <select value={filterType} onChange={e => setFilterType(e.target.value)} className="input text-sm w-36">
            <option value="">Todos</option>
            {AUX_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        {(filterType || search) && (
          <button
            onClick={() => { setFilterType(''); setSearch('') }}
            className="text-xs text-text-disabled hover:text-error transition-colors"
          >
            Limpiar
          </button>
        )}
      </div>

      {/* Badges conteo */}
      <div className="flex items-center gap-3 mb-4">
        {AUX_TYPES.map(t => {
          const count = items.filter(a => a.type === t.value && a.active).length
          if (!count) return null
          return (
            <button
              key={t.value}
              onClick={() => setFilterType(filterType === t.value ? '' : t.value)}
              className={`badge text-xs cursor-pointer transition-all ${
                filterType === t.value ? TYPE_COLOR[t.value] + ' ring-1 ring-current' : TYPE_COLOR[t.value]
              }`}
            >
              {t.label}: {count}
            </button>
          )
        })}
        <span className="text-xs text-text-disabled ml-auto">{filtered.length} registros</span>
      </div>

      {/* Tabla */}
      {filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-text-disabled text-sm">
            {items.length === 0
              ? 'Sin auxiliares registrados. Crea el primero.'
              : 'Sin resultados para el filtro actual.'}
          </p>
          {items.length === 0 && (
            <button onClick={openCreate} className="btn-primary mt-4 text-sm">
              Crear primer auxiliar
            </button>
          )}
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="table-header">
                <th className="px-4 py-3 text-left w-24">Código</th>
                <th className="px-4 py-3 text-left">Nombre</th>
                <th className="px-4 py-3 text-left w-36">RUT</th>
                <th className="px-4 py-3 text-left w-28">Tipo</th>
                <th className="px-4 py-3 text-center w-24">Estado</th>
                <th className="px-4 py-3 text-center w-20"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(a => (
                <tr key={a.id} className={`table-row ${!a.active ? 'opacity-40' : ''}`}>
                  <td className="px-4 py-3 font-mono text-xs text-text-disabled">{a.code}</td>
                  <td className="px-4 py-3 font-medium text-text-primary">{a.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-text-secondary">{a.rut ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`badge text-[10px] ${TYPE_COLOR[a.type] ?? TYPE_COLOR.OTRO}`}>
                      {AUX_TYPES.find(t => t.value === a.type)?.label ?? a.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`badge text-[10px] ${a.active ? 'bg-success/10 text-success' : 'bg-surface-high text-text-disabled'}`}>
                      {a.active ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <Link
                        href={`/contabilidad/auxiliares/${a.id}`}
                        className="text-text-disabled hover:text-info transition-colors"
                        title="Ver cartola / documentos"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </Link>
                      <button onClick={() => openEdit(a)} className="text-text-disabled hover:text-primary transition-colors" title="Editar">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleToggle(a.id, a.active)}
                        disabled={isPending}
                        className={`transition-colors ${a.active ? 'text-text-disabled hover:text-error' : 'text-text-disabled hover:text-success'}`}
                        title={a.active ? 'Desactivar' : 'Activar'}
                      >
                        {a.active ? (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                              d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal crear/editar */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)}
        title={editId ? 'Editar Auxiliar' : 'Nuevo Auxiliar'}>
        <form onSubmit={handleSubmit} className="space-y-4">

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-text-disabled block mb-1">Tipo *</label>
              <select
                value={form.type}
                onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                className="input text-sm"
              >
                {AUX_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-text-disabled block mb-1">Código *</label>
              <input
                value={form.code}
                onChange={e => setForm(f => ({ ...f, code: e.target.value }))}
                className="input text-sm font-mono"
                placeholder="Ej: PROV-001"
                required
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-text-disabled block mb-1">Nombre / Razón social *</label>
            <input
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="input text-sm"
              placeholder="Nombre completo o razón social"
              required
            />
          </div>

          <div>
            <label className="text-xs text-text-disabled block mb-1">RUT</label>
            <input
              value={form.rut}
              onChange={e => setForm(f => ({ ...f, rut: e.target.value }))}
              className="input text-sm font-mono"
              placeholder="12345678-9"
            />
          </div>

          {error && (
            <p className="text-xs text-error bg-error/10 px-3 py-2 rounded">{error}</p>
          )}

          <div className="flex gap-2 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-ghost flex-1">
              Cancelar
            </button>
            <button type="submit" disabled={isPending} className="btn-primary flex-1">
              {isPending ? 'Guardando...' : editId ? 'Guardar cambios' : 'Crear auxiliar'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
