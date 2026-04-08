'use client'

import { useState, useTransition } from 'react'
import { Modal } from '@/components/ui/modal'
import { createCostCenter, updateCostCenter, toggleCostCenter } from './actions'
import type { CostCenter } from '@/types/database'

interface Props { items: CostCenter[] }

const EMPTY = { code: '', name: '' }

export function CentrosCostoClient({ items }: Props) {
  const [form, setForm] = useState(EMPTY)
  const [editId, setEditId] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  const openCreate = () => {
    setEditId(null); setForm(EMPTY); setError(''); setModalOpen(true)
  }

  const openEdit = (cc: CostCenter) => {
    setEditId(cc.id); setForm({ code: cc.code, name: cc.name }); setError(''); setModalOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError('')
    startTransition(async () => {
      const r = editId
        ? await updateCostCenter(editId, form)
        : await createCostCenter(form)
      if (r.error) { setError(r.error); return }
      setModalOpen(false)
    })
  }

  const handleToggle = (id: string, current: boolean) => {
    startTransition(async () => { await toggleCostCenter(id, !current) })
  }

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Centros de Costo</h1>
          <p className="text-text-secondary text-sm mt-1">{items.length} centros registrados</p>
        </div>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nuevo Centro
        </button>
      </div>

      {!items.length ? (
        <div className="card p-12 text-center">
          <p className="text-text-disabled text-sm">Sin centros de costo configurados</p>
          <p className="text-text-disabled text-xs mt-2">Segmenta ingresos y gastos por área o proyecto</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="table-header">
                <th className="px-5 py-3 text-left w-28">Código</th>
                <th className="px-5 py-3 text-left">Nombre</th>
                <th className="px-5 py-3 text-center w-24">Estado</th>
                <th className="px-5 py-3 text-center w-24">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {items.map(cc => (
                <tr key={cc.id} className="table-row">
                  <td className="px-5 py-3 font-mono text-info text-xs">{cc.code}</td>
                  <td className="px-5 py-3 text-text-primary">{cc.name}</td>
                  <td className="px-5 py-3 text-center">
                    <button
                      onClick={() => handleToggle(cc.id, cc.active)}
                      className={`badge cursor-pointer transition-colors ${
                        cc.active
                          ? 'bg-success/10 text-success hover:bg-success/20'
                          : 'bg-surface-high text-text-disabled hover:bg-error/10 hover:text-error'
                      }`}
                    >
                      {cc.active ? 'Activo' : 'Inactivo'}
                    </button>
                  </td>
                  <td className="px-5 py-3 text-center">
                    <button
                      onClick={() => openEdit(cc)}
                      className="text-text-disabled hover:text-primary transition-colors p-1"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editId ? 'Editar Centro de Costo' : 'Nuevo Centro de Costo'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs text-text-disabled block mb-1">Código *</label>
            <input
              value={form.code}
              onChange={e => setForm(f => ({ ...f, code: e.target.value }))}
              className="input text-sm font-mono"
              placeholder="Ej: CC001"
              required
            />
          </div>
          <div>
            <label className="text-xs text-text-disabled block mb-1">Nombre *</label>
            <input
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="input text-sm"
              placeholder="Ej: Administración"
              required
            />
          </div>
          {error && <p className="text-xs text-error bg-error/10 px-3 py-2 rounded">{error}</p>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-ghost flex-1">Cancelar</button>
            <button type="submit" disabled={isPending} className="btn-primary flex-1">
              {isPending ? 'Guardando...' : editId ? 'Guardar Cambios' : 'Crear Centro'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
