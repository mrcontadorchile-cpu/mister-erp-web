'use client'

import { useState, useTransition } from 'react'
import { PERMISSION_GROUPS } from '@/lib/permissions'
import { createRole, updateRolePermissions, deleteRole } from './actions'

interface Role {
  id: string
  name: string
  description: string | null
  permissions: string[]
  is_system: boolean
  member_count: number
}

interface Props {
  roles: Role[]
}

export function RolesClient({ roles: initialRoles }: Props) {
  const [roles, setRoles] = useState(initialRoles)
  const [isPending, startTransition] = useTransition()
  const [editing, setEditing] = useState<string | null>(null)
  const [editPerms, setEditPerms] = useState<string[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newPerms, setNewPerms] = useState<string[]>([])
  const [error, setError] = useState('')

  function startEdit(role: Role) {
    setEditing(role.id)
    setEditPerms([...role.permissions])
    setError('')
  }

  function togglePerm(perms: string[], perm: string, setter: (p: string[]) => void) {
    if (perms.includes(perm)) {
      setter(perms.filter(p => p !== perm))
    } else {
      setter([...perms, perm])
    }
  }

  function handleSaveEdit(roleId: string) {
    setError('')
    startTransition(async () => {
      try {
        await updateRolePermissions(roleId, editPerms)
        setRoles(prev => prev.map(r => r.id === roleId ? { ...r, permissions: editPerms } : r))
        setEditing(null)
      } catch (e: any) {
        setError(e.message)
      }
    })
  }

  function handleDelete(roleId: string) {
    if (!confirm('¿Eliminar este rol?')) return
    startTransition(async () => {
      try {
        await deleteRole(roleId)
        setRoles(prev => prev.filter(r => r.id !== roleId))
      } catch (e: any) {
        alert(e.message)
      }
    })
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    startTransition(async () => {
      try {
        await createRole(newName, newDesc, newPerms)
        setShowCreate(false)
        setNewName('')
        setNewDesc('')
        setNewPerms([])
        // Refresh is handled by revalidatePath, but we show optimistic update
      } catch (e: any) {
        setError(e.message)
      }
    })
  }

  return (
    <div className="space-y-5">
      {/* Create button */}
      <div className="flex justify-end">
        <button
          onClick={() => { setShowCreate(v => !v); setError('') }}
          className="btn-primary flex items-center gap-2 text-sm px-4 py-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nuevo rol
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="card p-5">
          <h3 className="font-semibold text-sm mb-4">Crear rol personalizado</h3>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-text-disabled block mb-1">Nombre del rol *</label>
                <input
                  required
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  className="input w-full text-sm"
                  placeholder="Ej: Tesorero"
                />
              </div>
              <div>
                <label className="text-xs text-text-disabled block mb-1">Descripción</label>
                <input
                  value={newDesc}
                  onChange={e => setNewDesc(e.target.value)}
                  className="input w-full text-sm"
                  placeholder="Descripción breve"
                />
              </div>
            </div>
            <div>
              <p className="text-xs text-text-disabled mb-2">Permisos</p>
              <PermissionCheckboxes
                selected={newPerms}
                onToggle={perm => togglePerm(newPerms, perm, setNewPerms)}
              />
            </div>
            {error && <p className="text-error text-xs">{error}</p>}
            <div className="flex gap-2">
              <button type="submit" disabled={isPending} className="btn-primary text-sm px-4 py-2">
                {isPending ? 'Creando...' : 'Crear rol'}
              </button>
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="text-sm px-4 py-2 rounded-lg border border-border text-text-secondary hover:text-text-primary"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Roles list */}
      <div className="space-y-3">
        {roles.map(role => (
          <div key={role.id} className="card overflow-hidden">
            <div className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${role.is_system ? 'bg-primary' : 'bg-success'}`} />
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-sm">{role.name}</p>
                    {role.is_system && (
                      <span className="badge bg-primary/10 text-primary text-[10px]">sistema</span>
                    )}
                    {role.permissions.includes('*') && (
                      <span className="badge bg-warning/10 text-warning text-[10px]">acceso total</span>
                    )}
                  </div>
                  {role.description && (
                    <p className="text-xs text-text-disabled">{role.description}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-text-disabled">
                  {role.member_count} {role.member_count === 1 ? 'usuario' : 'usuarios'}
                </span>
                {!role.is_system && (
                  <div className="flex gap-1">
                    <button
                      onClick={() => editing === role.id ? setEditing(null) : startEdit(role)}
                      className="text-xs px-2 py-1 rounded text-text-secondary hover:bg-surface-high transition-colors"
                    >
                      {editing === role.id ? 'Cerrar' : 'Editar permisos'}
                    </button>
                    <button
                      onClick={() => handleDelete(role.id)}
                      disabled={role.member_count > 0 || isPending}
                      className="text-xs px-2 py-1 rounded text-error hover:bg-error/10 transition-colors disabled:opacity-40"
                    >
                      Eliminar
                    </button>
                  </div>
                )}
                {role.is_system && !role.permissions.includes('*') && (
                  <button
                    onClick={() => editing === role.id ? setEditing(null) : startEdit(role)}
                    className="text-xs px-2 py-1 rounded text-text-secondary hover:bg-surface-high transition-colors"
                    title="Los roles de sistema son de solo lectura"
                  >
                    Ver permisos
                  </button>
                )}
              </div>
            </div>

            {/* Permissions summary (when not editing) */}
            {editing !== role.id && !role.permissions.includes('*') && (
              <div className="px-4 pb-3 flex flex-wrap gap-1">
                {role.permissions.slice(0, 8).map(p => (
                  <span key={p} className="badge bg-surface-high text-text-secondary text-[10px]">{p}</span>
                ))}
                {role.permissions.length > 8 && (
                  <span className="badge bg-surface-high text-text-disabled text-[10px]">
                    +{role.permissions.length - 8} más
                  </span>
                )}
              </div>
            )}

            {/* Edit panel */}
            {editing === role.id && (
              <div className="border-t border-border p-4 bg-surface-high/50">
                <PermissionCheckboxes
                  selected={editPerms}
                  onToggle={perm => togglePerm(editPerms, perm, setEditPerms)}
                  readOnly={role.is_system}
                />
                {error && <p className="text-error text-xs mt-2">{error}</p>}
                {!role.is_system && (
                  <div className="flex gap-2 mt-4">
                    <button
                      onClick={() => handleSaveEdit(role.id)}
                      disabled={isPending}
                      className="btn-primary text-xs px-3 py-1.5"
                    >
                      {isPending ? 'Guardando...' : 'Guardar cambios'}
                    </button>
                    <button
                      onClick={() => setEditing(null)}
                      className="text-xs px-3 py-1.5 rounded-lg border border-border text-text-secondary"
                    >
                      Cancelar
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function PermissionCheckboxes({
  selected,
  onToggle,
  readOnly = false,
}: {
  selected: string[]
  onToggle: (perm: string) => void
  readOnly?: boolean
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {PERMISSION_GROUPS.map(group => (
        <div key={group.group}>
          <p className="text-[10px] font-semibold text-text-disabled uppercase tracking-wider mb-1.5">
            {group.group}
          </p>
          <ul className="space-y-1">
            {group.permissions.map(({ key, label }) => (
              <li key={key}>
                <label className={`flex items-center gap-2 text-xs ${readOnly ? 'cursor-default' : 'cursor-pointer'}`}>
                  <input
                    type="checkbox"
                    checked={selected.includes(key)}
                    onChange={() => !readOnly && onToggle(key)}
                    disabled={readOnly}
                    className="w-3.5 h-3.5 rounded accent-primary"
                  />
                  <span className={selected.includes(key) ? 'text-text-primary' : 'text-text-secondary'}>
                    {label}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}
