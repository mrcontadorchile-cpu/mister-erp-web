'use client'

import Link from 'next/link'
import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { hasPermission, isAdmin, PERMISSIONS } from '@/lib/permissions'
import type { UserProfile } from '@/types/database'

const nav = [
  {
    group: 'GESTIÓN',
    items: [
      { href: '/gestion/dashboard',      label: 'Dashboard',             icon: HomeIcon,       permission: PERMISSIONS.GESTION_VIEW },
    ],
  },
  {
    group: 'PRESUPUESTOS',
    items: [
      { href: '/gestion/presupuestos',       label: 'Mis Presupuestos',  icon: WalletIcon,     permission: PERMISSIONS.GESTION_VIEW },
      { href: '/gestion/presupuestos/nuevo', label: 'Nuevo Presupuesto', icon: PlusIcon,       permission: PERMISSIONS.GESTION_CREATE },
    ],
  },
  {
    group: 'CONTROL',
    items: [
      { href: '/gestion/control',        label: 'Presup. vs Real',       icon: TrendingIcon,   permission: PERMISSIONS.GESTION_VIEW },
    ],
  },
]

interface SidebarGestionProps {
  profile: UserProfile
  onLogout: () => void
  onSwitchCompany?: (companyId: string) => void
}

export function SidebarGestion({ profile, onLogout, onSwitchCompany }: SidebarGestionProps) {
  const pathname = usePathname()
  const [companyMenuOpen, setCompanyMenuOpen] = useState(false)
  const perms = profile.permissions ?? []
  const multiCompany = profile.companies.length > 1

  return (
    <aside className="w-60 shrink-0 bg-surface border-r border-border flex flex-col h-screen sticky top-0">
      {/* Logo + company */}
      <div className="px-5 py-4 border-b border-border">
        <div className="flex items-center gap-3 mb-3">
          <img src="/logo-icon.svg" alt="ERP Mister Group" className="w-8 h-8 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-text-primary truncate">Gestión</p>
            {multiCompany ? (
              <div className="relative">
                <button
                  onClick={() => setCompanyMenuOpen(v => !v)}
                  className="flex items-center gap-1 text-xs text-text-disabled hover:text-text-secondary transition-colors max-w-full"
                >
                  <span className="truncate">{profile.company_name}</span>
                  <ChevronDownIcon className="w-3 h-3 shrink-0" />
                </button>
                {companyMenuOpen && (
                  <div className="absolute left-0 top-full mt-1 z-50 bg-surface border border-border rounded-lg shadow-lg min-w-[180px] py-1">
                    {profile.companies.map(c => (
                      <button
                        key={c.id}
                        onClick={() => {
                          setCompanyMenuOpen(false)
                          if (c.id !== profile.company_id) onSwitchCompany?.(c.id)
                        }}
                        className={cn(
                          'w-full text-left px-3 py-2 text-xs hover:bg-surface-high transition-colors',
                          c.id === profile.company_id ? 'text-primary font-semibold' : 'text-text-secondary'
                        )}
                      >
                        <span className="block truncate">{c.name}</span>
                        <span className="text-[10px] text-text-disabled">{c.rut}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-text-disabled truncate">{profile.company_name}</p>
            )}
          </div>
        </div>
        <Link
          href="/"
          className="flex items-center gap-1.5 text-xs text-text-disabled hover:text-text-secondary transition-colors"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Cambiar módulo
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-5">
        {nav.map(group => {
          const visibleItems = group.items.filter(item =>
            item.permission === null || hasPermission(perms, item.permission)
          )
          if (visibleItems.length === 0) return null
          return (
            <div key={group.group}>
              <p className="text-[10px] font-semibold text-text-disabled tracking-wider px-2 mb-1.5">
                {group.group}
              </p>
              <ul className="space-y-0.5">
                {visibleItems.map(item => {
                  const active =
                    pathname === item.href ||
                    (item.href !== '/gestion/dashboard' &&
                     item.href !== '/gestion/presupuestos/nuevo' &&
                     pathname.startsWith(item.href))
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={cn(
                          'flex items-center gap-2.5 px-2 py-2 rounded-lg text-sm transition-colors',
                          active
                            ? 'bg-primary/10 text-primary font-medium'
                            : 'text-text-secondary hover:text-text-primary hover:bg-surface-high'
                        )}
                      >
                        <item.icon className={cn('w-4 h-4 shrink-0', active ? 'text-primary' : '')} />
                        {item.label}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </div>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-border p-3 space-y-1">
        {profile.is_superadmin && (
          <Link
            href="/superadmin"
            className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs text-warning hover:bg-warning/10 transition-colors"
          >
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3l14 9-14 9V3z" />
            </svg>
            Panel Superadmin
          </Link>
        )}
        <div className="flex items-center gap-2 px-2 py-2 rounded-lg">
          <div className="w-7 h-7 rounded-full bg-surface-high flex items-center justify-center shrink-0">
            <span className="text-xs font-semibold text-text-secondary">
              {profile.full_name?.charAt(0)?.toUpperCase() ?? '?'}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-text-primary truncate">{profile.full_name}</p>
            <p className="text-[10px] text-text-disabled truncate capitalize">{profile.role}</p>
          </div>
          <button
            onClick={onLogout}
            className="text-text-disabled hover:text-error transition-colors"
            title="Cerrar sesión"
          >
            <LogoutIcon className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  )
}

// ── Iconos ──────────────────────────────────────────────────────

function HomeIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
      d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
  </svg>
}
function WalletIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
      d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
  </svg>
}
function PlusIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
      d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
}
function TrendingIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
      d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
  </svg>
}
function ChevronDownIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
}
function LogoutIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
      d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
  </svg>
}
