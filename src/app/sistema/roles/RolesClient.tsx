'use client'

import { useState, useTransition } from 'react'
import { MODULE_PERMISSIONS, getModuleAllPermissions } from '@/lib/permissions'
import { createRole, updateRolePermissions, deleteRole } from './actions'

interface Role {
  id: string
  name: string
  description: string | null
  permissions: string[]
  is_system: boolean
  member_count: number
}

interface Props { roles: Role[] }

export function RolesClient({ roles: initialRoles }: Props) {
  const [roles, setRoles]           = useState(initialRoles)
  const [isPending, startTransition] = useTransition()
  const [editing, setEditing]       = useState<string | null>(null)
  const [editPerms, setEditPerms]   = useState<string[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName]       = useState('')
  const [newDesc, setNewDesc]       = useState('')
  const [newPerms, setNewPerms]     = useState<string[]>([])
  const [error, setError]           = useState('')

  function startEdit(role: Role) {
    setEditing(role.id)
    setEditPerms([...role.permissions])
    setError('')
  }

  function togglePerm(perms: string[], perm: string, setter: (p: string[]) => void) {
    setter(perms.includes(perm) ? perms.filter(p => p !== perm) : [...perms, perm])
  }

  function toggleAll(perms: string[], setter: (p: string[]) => void) {
    // Toggle between full admin (*) and empty
    setter(perms.includes('*') ? [] : ['*'])
  }

  function toggleModule(modulePrefix: string, perms: string[], setter: (p: string[]) => void) {
    if (perms.includes('*')) return // full admin, no-op
    const modulePerms = getModuleAllPermissions(modulePrefix)
    const hasAll = modulePerms.every(p => perms.includes(p))
    if (hasAll) {
      setter(perms.filter(p => !modulePerms.includes(p)))
    } else {
      const merged = Array.from(new Set([...perms, ...modulePerms]))
      setter(merged)
    }
  }

  function handleSaveEdit(roleId: string) {
    setError('')
    startTransition(async () => {
      const res = await updateRolePermissions(roleId, editPerms)
      if (!res.ok) {
        setError(res.error)
      } else {
        setRoles(prev => prev.map(r => r.id === roleId ? { ...r, permissions: editPerms } : r))
        setEditing(null)
      }
    })
  }

  function handleDelete(roleId: string) {
    if (!confirm('¿Eliminar este rol? Esta acción no se puede deshacer.')) return
    startTransition(async () => {
      const res = await deleteRole(roleId)
      if (!res.ok) alert(res.error)
      else setRoles(prev => prev.filter(r => r.id !== roleId))
    })
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    startTransition(async () => {
      const res = await createRole(newName, newDesc, newPerms)
      if (!res.ok) {
        setError(res.error)
      } else {
        setShowCreate(false)
        setNewName('')
        setNewDesc('')
        setNewPerms([])
      }
    })
  }

  return (
    <div className="space-y-5">
      {/* Header actions */}
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
                <input required value={newName} onChange={e => setNewName(e.target.value)}
                  className="input w-full text-sm" placeholder="Ej: Contador Junior" />
              </div>
              <div>
                <label className="text-xs text-text-disabled block mb-1">Descripción</label>
                <input value={newDesc} onChange={e => setNewDesc(e.target.value)}
                  className="input w-full text-sm" placeholder="Descripción breve" />
              </div>
            </div>
            <PermissionEditor selected={newPerms} setter={setNewPerms}
              onTogglePerm={p => togglePerm(newPerms, p, setNewPerms)}
              onToggleModule={m => toggleModule(m, newPerms, setNewPerms)}
              onToggleAll={() => toggleAll(newPerms, setNewPerms)} />
            {error && <p className="text-error text-xs">{error}</p>}
            <div className="flex gap-2">
              <button type="submit" disabled={isPending} className="btn-primary text-sm px-4 py-2">
                {isPending ? 'Creando...' : 'Crear rol'}
              </button>
              <button type="button" onClick={() => setShowCreate(false)}
                className="text-sm px-4 py-2 rounded-lg border border-border text-text-secondary hover:text-text-primary">
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
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-sm">{role.name}</p>
                    {role.is_system && (
                      <span className="badge bg-primary/10 text-primary text-[10px]">sistema</span>
                    )}
                    {role.permissions.includes('*') && (
                      <span className="badge bg-warning/10 text-warning text-[10px]">acceso total</span>
                    )}
                    {!role.permissions.includes('*') && role.permissions.length > 0 && (
                      <span className="text-[10px] text-text-disabled">
                        {role.permissions.length} permiso{role.permissions.length !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                  {role.description && (
                    <p className="text-xs text-text-disabled mt-0.5">{role.description}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-text-disabled">
                  {role.member_count} {role.member_count === 1 ? 'usuario' : 'usuarios'}
                </span>
                <div className="flex gap-1">
                  <button
                    onClick={() => editing === role.id ? setEditing(null) : startEdit(role)}
                    className="text-xs px-2 py-1 rounded text-text-secondary hover:bg-surface-high transition-colors"
                  >
                    {editing === role.id ? 'Cerrar' : role.is_system && role.permissions.includes('*') ? 'Ver' : 'Editar permisos'}
                  </button>
                  {!role.is_system && (
                    <button
                      onClick={() => handleDelete(role.id)}
                      disabled={role.member_count > 0 || isPending}
                      className="text-xs px-2 py-1 rounded text-error hover:bg-error/10 transition-colors disabled:opacity-40"
                      title={role.member_count > 0 ? 'No se puede eliminar un rol con usuarios asignados' : ''}
                    >
                      Eliminar
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Module summary chips */}
            {editing !== role.id && !role.permissions.includes('*') && role.permissions.length > 0 && (
              <div className="px-4 pb-3 flex flex-wrap gap-1.5">
                {MODULE_PERMISSIONS.map(mod => {
                  const modPerms = getModuleAllPermissions(mod.module)
                  const count = role.permissions.filter(p => modPerms.includes(p)).length
                  if (count === 0) return null
                  return (
                    <span key={mod.module}
                      className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                      {mod.label}
                      <span className="opacity-60">({count})</span>
                    </span>
                  )
                })}
              </div>
            )}

            {/* Edit panel */}
            {editing === role.id && (
              <div className="border-t border-border p-4 bg-surface-high/30">
                <PermissionEditor
                  selected={editPerms}
                  setter={setEditPerms}
                  onTogglePerm={p => togglePerm(editPerms, p, setEditPerms)}
                  onToggleModule={m => toggleModule(m, editPerms, setEditPerms)}
                  onToggleAll={() => toggleAll(editPerms, setEditPerms)}
                  readOnly={role.is_system && role.permissions.includes('*')}
                />
                {error && <p className="text-error text-xs mt-2">{error}</p>}
                {!(role.is_system && role.permissions.includes('*')) && (
                  <div className="flex gap-2 mt-4">
                    <button onClick={() => handleSaveEdit(role.id)} disabled={isPending}
                      className="btn-primary text-xs px-3 py-1.5">
                      {isPending ? 'Guardando...' : 'Guardar cambios'}
                    </button>
                    <button onClick={() => setEditing(null)}
                      className="text-xs px-3 py-1.5 rounded-lg border border-border text-text-secondary">
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

// ── Permission editor component ───────────────────────────────

function PermissionEditor({
  selected, setter, onTogglePerm, onToggleModule, onToggleAll, readOnly = false,
}: {
  selected: string[]
  setter: (p: string[]) => void
  onTogglePerm: (p: string) => void
  onToggleModule: (m: string) => void
  onToggleAll: () => void
  readOnly?: boolean
}) {
  const [openModules, setOpenModules] = useState<Record<string, boolean>>({})

  function toggleOpen(module: string) {
    setOpenModules(prev => ({ ...prev, [module]: !prev[module] }))
  }

  const isFullAdmin = selected.includes('*')

  return (
    <div className="space-y-2">
      {/* Acceso total */}
      <label className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-colors ${
        isFullAdmin ? 'border-warning/50 bg-warning/5' : 'border-border bg-surface'
      } ${readOnly ? 'cursor-default' : 'cursor-pointer hover:border-warning/30'}`}>
        <input type="checkbox" checked={isFullAdmin}
          onChange={() => !readOnly && onToggleAll()}
          disabled={readOnly}
          className="w-4 h-4 rounded accent-primary" />
        <div>
          <p className="text-sm font-semibold text-text-primary">Acceso total (Administrador)</p>
          <p className="text-xs text-text-secondary">Acceso completo a todos los módulos y funciones del ERP</p>
        </div>
        {isFullAdmin && (
          <span className="ml-auto text-[10px] font-bold text-warning bg-warning/10 px-2 py-0.5 rounded-full">ADMIN</span>
        )}
      </label>

      {/* Divider */}
      <div className="flex items-center gap-2 py-1">
        <div className="flex-1 h-px bg-border" />
        <span className="text-xs text-text-disabled">o configura por módulo</span>
        <div className="flex-1 h-px bg-border" />
      </div>

      {/* Per-module */}
      <div className={`space-y-2 ${isFullAdmin ? 'opacity-40 pointer-events-none' : ''}`}>
        {MODULE_PERMISSIONS.map(mod => {
          const modPerms  = getModuleAllPermissions(mod.module)
          const hasAll    = modPerms.every(p => selected.includes(p))
          const hasSome   = modPerms.some(p => selected.includes(p)) && !hasAll
          const isOpen    = openModules[mod.module] ?? false

          return (
            <div key={mod.module} className={`rounded-xl border overflow-hidden transition-colors ${
              hasAll ? 'border-primary/40 bg-primary/5' :
              hasSome ? 'border-primary/20 bg-primary/3' : 'border-border bg-surface'
            }`}>
              {/* Module header */}
              <div className="flex items-center gap-3 p-3">
                <input
                  type="checkbox"
                  checked={hasAll}
                  ref={el => { if (el) el.indeterminate = hasSome }}
                  onChange={() => !readOnly && onToggleModule(mod.module)}
                  disabled={readOnly}
                  className="w-4 h-4 rounded accent-primary shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-text-primary">{mod.label}</p>
                  <p className="text-xs text-text-disabled truncate">{mod.description}</p>
                </div>
                {(hasAll || hasSome) && (
                  <span className="text-[10px] text-primary shrink-0">
                    {modPerms.filter(p => selected.includes(p)).length}/{modPerms.length}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => toggleOpen(mod.module)}
                  className="text-text-disabled hover:text-text-secondary transition-colors shrink-0 ml-1"
                >
                  <svg className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>

              {/* Subgroups */}
              {isOpen && (
                <div className="border-t border-border px-4 py-3 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                  {mod.groups.map(grp => (
                    <div key={grp.group}>
                      <p className="text-[10px] font-semibold text-text-disabled uppercase tracking-wider mb-1.5">
                        {grp.group}
                      </p>
                      <ul className="space-y-1">
                        {grp.permissions.map(({ key, label }) => (
                          <li key={key}>
                            <label className={`flex items-center gap-2 text-xs ${readOnly ? 'cursor-default' : 'cursor-pointer'}`}>
                              <input
                                type="checkbox"
                                checked={selected.includes(key)}
                                onChange={() => !readOnly && onTogglePerm(key)}
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
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
