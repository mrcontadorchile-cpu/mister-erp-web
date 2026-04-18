'use client'

import { useState, useTransition } from 'react'
import { changeUserRole, changeUserStatus, inviteUserByEmail } from './actions'

interface Member {
  id: string
  user_id: string
  status: string
  created_at: string
  full_name: string
  system_role: string
  role_id: string
  role_name: string
  is_admin: boolean
}

interface Role {
  id: string
  name: string
  is_system: boolean
}

interface Props {
  members: Member[]
  roles: Role[]
  currentUserId: string
}

export function UsuariosClient({ members, roles, currentUserId }: Props) {
  const [isPending, startTransition] = useTransition()
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState(roles[0]?.id ?? '')
  const [inviteError, setInviteError] = useState('')
  const [inviteSuccess, setInviteSuccess] = useState(false)
  const [showInvite, setShowInvite] = useState(false)

  function handleRoleChange(membershipId: string, roleId: string) {
    startTransition(async () => {
      const res = await changeUserRole(membershipId, roleId)
      if (!res.ok) alert(res.error)
    })
  }

  function handleStatusToggle(membershipId: string, currentStatus: string) {
    const newStatus = currentStatus === 'active' ? 'suspended' : 'active'
    startTransition(async () => {
      const res = await changeUserStatus(membershipId, newStatus as 'active' | 'suspended')
      if (!res.ok) alert(res.error)
    })
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    setInviteError('')
    setInviteSuccess(false)
    startTransition(async () => {
      try {
        const res = await inviteUserByEmail(inviteEmail, inviteRole)
        if (!res.ok) {
          setInviteError(res.error)
        } else {
          setInviteEmail('')
          setInviteSuccess(true)
          setShowInvite(false)
        }
      } catch (err) {
        setInviteError(err instanceof Error ? err.message : 'Error inesperado al enviar la invitación')
      }
    })
  }

  return (
    <div className="space-y-5">
      {/* Invite button */}
      <div className="flex justify-end">
        <button
          onClick={() => { setShowInvite(v => !v); setInviteError(''); setInviteSuccess(false) }}
          className="btn-primary flex items-center gap-2 text-sm px-4 py-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Agregar usuario
        </button>
      </div>

      {/* Invite form */}
      {showInvite && (
        <div className="card p-5">
          <h3 className="font-semibold text-sm mb-4">Agregar usuario a la empresa</h3>
          <form onSubmit={handleInvite} className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-48">
              <label className="text-xs text-text-disabled block mb-1">Email del usuario</label>
              <input
                type="email"
                required
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
                placeholder="usuario@email.com"
                className="input w-full text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-text-disabled block mb-1">Rol</label>
              <select
                value={inviteRole}
                onChange={e => setInviteRole(e.target.value)}
                className="input w-44 text-sm"
              >
                {roles.map(r => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              disabled={isPending}
              className="btn-primary text-sm px-4 py-2"
            >
              {isPending ? 'Agregando...' : 'Agregar'}
            </button>
            <button
              type="button"
              onClick={() => setShowInvite(false)}
              className="text-sm px-4 py-2 rounded-lg border border-border text-text-secondary hover:text-text-primary"
            >
              Cancelar
            </button>
          </form>
          {inviteError && (
            <p className="text-error text-xs mt-2">{inviteError}</p>
          )}
          <p className="text-text-disabled text-xs mt-2">
            El usuario debe estar registrado en el sistema para poder ser agregado.
          </p>
        </div>
      )}

      {inviteSuccess && (
        <div className="card p-3 border-success/30 bg-success/5 text-success text-sm">
          Usuario agregado correctamente.
        </div>
      )}

      {/* Members table */}
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="table-header text-xs">
              <th className="px-4 py-3 text-left">Usuario</th>
              <th className="px-4 py-3 text-left w-44">Rol</th>
              <th className="px-4 py-3 text-left w-28">Estado</th>
              <th className="px-4 py-3 text-left w-32">Miembro desde</th>
              <th className="px-4 py-3 w-20"></th>
            </tr>
          </thead>
          <tbody>
            {members.map(m => {
              const isCurrentUser = m.user_id === currentUserId
              return (
                <tr key={m.id} className="table-row text-xs">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-surface-high flex items-center justify-center shrink-0">
                        <span className="text-xs font-semibold text-text-secondary">
                          {m.full_name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium text-text-primary">
                          {m.full_name}
                          {isCurrentUser && (
                            <span className="ml-1.5 badge bg-primary/10 text-primary text-[10px]">tú</span>
                          )}
                        </p>
                        {m.is_admin && (
                          <p className="text-[10px] text-warning">Administrador</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={m.role_id}
                      disabled={isPending || isCurrentUser}
                      onChange={e => handleRoleChange(m.id, e.target.value)}
                      className="input text-xs w-full py-1"
                    >
                      {roles.map(r => (
                        <option key={r.id} value={r.id}>{r.name}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`badge text-[10px] ${
                      m.status === 'active'
                        ? 'bg-success/10 text-success'
                        : m.status === 'suspended'
                        ? 'bg-error/10 text-error'
                        : 'bg-warning/10 text-warning'
                    }`}>
                      {m.status === 'active' ? 'Activo' : m.status === 'suspended' ? 'Suspendido' : 'Invitado'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-text-disabled">
                    {new Date(m.created_at).toLocaleDateString('es-CL')}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {!isCurrentUser && (
                      <button
                        onClick={() => handleStatusToggle(m.id, m.status)}
                        disabled={isPending}
                        className={`text-xs px-2 py-1 rounded transition-colors ${
                          m.status === 'active'
                            ? 'text-error hover:bg-error/10'
                            : 'text-success hover:bg-success/10'
                        }`}
                      >
                        {m.status === 'active' ? 'Suspender' : 'Activar'}
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {members.length === 0 && (
          <p className="text-center text-text-disabled py-8 text-sm">
            Sin usuarios en esta empresa
          </p>
        )}
      </div>
    </div>
  )
}
