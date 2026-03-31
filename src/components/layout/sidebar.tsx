'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import type { UserProfile } from '@/types/database'

const nav = [
  {
    group: 'CONTABILIDAD',
    items: [
      { href: '/dashboard',     label: 'Dashboard',         icon: HomeIcon },
      { href: '/plan-cuentas',  label: 'Plan de Cuentas',   icon: TreeIcon },
      { href: '/libro-diario',  label: 'Libro Diario',      icon: ReceiptIcon },
      { href: '/centros-costo', label: 'Centros de Costo',  icon: BuildingIcon },
    ],
  },
  {
    group: 'DOCUMENTOS SII',
    items: [
      { href: '/documentos-sii', label: 'Documentos',       icon: FileTextIcon },
      { href: '/importar-sii',   label: 'Importar SII',     icon: CloudDownloadIcon },
    ],
  },
  {
    group: 'REPORTES',
    items: [
      { href: '/reportes/balance-8col',         label: 'Balance 8 Columnas',  icon: TableIcon },
      { href: '/reportes/balance-clasificado',  label: 'Balance Clasificado', icon: ScaleIcon },
      { href: '/reportes/eerr',                 label: 'Estado de Resultados',icon: TrendingUpIcon },
    ],
  },
]

interface SidebarProps {
  profile: UserProfile
  onLogout: () => void
}

export function Sidebar({ profile, onLogout }: SidebarProps) {
  const pathname = usePathname()

  return (
    <aside className="w-60 shrink-0 bg-surface border-r border-border flex flex-col h-screen sticky top-0">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-border">
        <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center shrink-0">
          <span className="text-primary-foreground font-black text-xs">MC</span>
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-text-primary truncate">Contabilidad</p>
          <p className="text-xs text-text-disabled truncate">{profile.company_name}</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-6">
        {nav.map(group => (
          <div key={group.group}>
            <p className="text-[10px] font-semibold text-text-disabled tracking-wider px-2 mb-2">
              {group.group}
            </p>
            <ul className="space-y-0.5">
              {group.items.map(item => {
                const active = pathname === item.href ||
                  (item.href !== '/dashboard' && pathname.startsWith(item.href))
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
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-border p-3">
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

// ── Iconos inline (SVG) ─────────────────────────────────────
function HomeIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
      d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
  </svg>
}
function TreeIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
      d="M4 6h16M4 10h16M4 14h16M4 18h16" />
  </svg>
}
function ReceiptIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
  </svg>
}
function BuildingIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
      d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
  </svg>
}
function FileTextIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
}
function CloudDownloadIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
      d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
  </svg>
}
function TableIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
      d="M3 10h18M3 14h18M10 3v18M3 6a3 3 0 013-3h12a3 3 0 013 3v12a3 3 0 01-3 3H6a3 3 0 01-3-3V6z" />
  </svg>
}
function ScaleIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
      d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
  </svg>
}
function TrendingUpIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
      d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
  </svg>
}
function LogoutIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
      d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
  </svg>
}
