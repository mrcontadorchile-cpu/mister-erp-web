'use client'

import Link from 'next/link'
import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { hasPermission, hasAnyPermission, isAdmin, PERMISSIONS } from '@/lib/permissions'
import type { UserProfile } from '@/types/database'

const nav = [
  {
    group: 'CONTABILIDAD',
    items: [
      { href: '/contabilidad/dashboard', label: 'Dashboard',  icon: HomeIcon,     permission: null },
      { href: '/contabilidad/periodos',  label: 'Períodos',   icon: CalendarIcon, permission: PERMISSIONS.CONTA_PERIODOS_VIEW },
    ],
  },
  {
    group: 'MOVIMIENTOS',
    items: [
      { href: '/contabilidad/libro-diario',       label: 'Libro Diario',  icon: BookIcon,       permission: PERMISSIONS.CONTA_DIARIO_VIEW },
      { href: '/contabilidad/libro-diario/nuevo', label: 'Nuevo Asiento', icon: PlusSquareIcon, permission: PERMISSIONS.CONTA_DIARIO_CREATE },
      { href: '/contabilidad/libro-mayor',        label: 'Libro Mayor',   icon: LedgerIcon,     permission: PERMISSIONS.CONTA_MAYOR_VIEW },
    ],
  },
  {
    group: 'DOCUMENTOS SII',
    items: [
      { href: '/contabilidad/documentos-sii', label: 'Documentos',   icon: FileTextIcon,      permission: PERMISSIONS.CONTA_SII_VIEW },
      { href: '/contabilidad/importar-sii',   label: 'Importar SII', icon: CloudDownloadIcon, permission: PERMISSIONS.CONTA_SII_IMPORT },
    ],
  },
  {
    group: 'ANÁLISIS',
    items: [
      { href: '/contabilidad/analisis/por-cuenta',   label: 'Por Cuenta',   icon: AnalysisCuentaIcon, permission: PERMISSIONS.CONTA_ANALISIS_VIEW },
      { href: '/contabilidad/analisis/por-auxiliar', label: 'Por Auxiliar', icon: AnalysisAuxIcon,    permission: PERMISSIONS.CONTA_ANALISIS_VIEW },
    ],
  },
  {
    group: 'REPORTES',
    items: [
      { href: '/contabilidad/reportes/balance-8col',        label: 'Balance 8 Col.',      icon: TableIcon,       permission: PERMISSIONS.CONTA_REPORTES_VIEW },
      { href: '/contabilidad/reportes/balance-clasificado', label: 'Balance Clasificado', icon: ScaleIcon,       permission: PERMISSIONS.CONTA_REPORTES_VIEW },
      { href: '/contabilidad/reportes/eerr',                label: 'Estado Resultados',   icon: TrendingUpIcon,  permission: PERMISSIONS.CONTA_REPORTES_VIEW },
      { href: '/contabilidad/reportes/centros-costo',       label: 'Gastos por CC',       icon: BuildingIcon,    permission: PERMISSIONS.CONTA_REPORTES_VIEW },
      { href: '/contabilidad/reportes/libro-compras',       label: 'Libro de Compras',    icon: LibroComprasIcon, permission: PERMISSIONS.CONTA_REPORTES_VIEW },
      { href: '/contabilidad/reportes/libro-ventas',        label: 'Libro de Ventas',     icon: LibroVentasIcon,  permission: PERMISSIONS.CONTA_REPORTES_VIEW },
      { href: '/contabilidad/reportes/libro-honorarios',    label: 'Libro de Honorarios', icon: LibroHonorIcon,   permission: PERMISSIONS.CONTA_REPORTES_VIEW },
    ],
  },
  {
    group: 'MAESTROS',
    items: [
      { href: '/contabilidad/plan-cuentas',  label: 'Plan de Cuentas',  icon: TreeIcon,     permission: PERMISSIONS.CONTA_PLAN_VIEW },
      { href: '/contabilidad/centros-costo', label: 'Centros de Costo', icon: BuildingIcon, permission: PERMISSIONS.CONTA_PLAN_VIEW },
      { href: '/contabilidad/auxiliares',    label: 'Auxiliares',       icon: UsersIcon,    permission: PERMISSIONS.CONTA_AUXILIARES_VIEW },
    ],
  },
  {
    group: 'CONFIGURACIÓN',
    items: [
      { href: '/contabilidad/configuracion', label: 'Empresa / SII', icon: SettingsIcon, permission: PERMISSIONS.CONTA_CONFIG_VIEW },
    ],
  },
]

interface SidebarProps {
  profile: UserProfile
  onLogout: () => void
  onSwitchCompany?: (companyId: string) => void
}

export function Sidebar({ profile, onLogout, onSwitchCompany }: SidebarProps) {
  const pathname = usePathname()
  const [companyMenuOpen, setCompanyMenuOpen] = useState(false)
  const perms = profile.permissions ?? []
  const multiCompany = profile.companies.length > 1
  const canAccessSistema = hasAnyPermission(perms, [PERMISSIONS.SISTEMA_USUARIOS, PERMISSIONS.SISTEMA_ROLES])

  return (
    <aside className="w-60 shrink-0 bg-surface border-r border-border flex flex-col h-screen sticky top-0">
      {/* Logo + company */}
      <div className="px-5 py-4 border-b border-border">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center shrink-0">
            <span className="text-primary-foreground font-black text-xs">MC</span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-text-primary truncate">Contabilidad</p>
            {/* Company switcher */}
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
                    (item.href !== '/contabilidad/dashboard' &&
                     item.href !== '/contabilidad/libro-diario/nuevo' &&
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

        {/* Sistema link — solo admins */}
        {canAccessSistema && (
          <div>
            <p className="text-[10px] font-semibold text-text-disabled tracking-wider px-2 mb-1.5">
              SISTEMA
            </p>
            <ul className="space-y-0.5">
              <li>
                <Link
                  href="/sistema/usuarios"
                  className={cn(
                    'flex items-center gap-2.5 px-2 py-2 rounded-lg text-sm transition-colors',
                    pathname.startsWith('/sistema')
                      ? 'bg-primary/10 text-primary font-medium'
                      : 'text-text-secondary hover:text-text-primary hover:bg-surface-high'
                  )}
                >
                  <ShieldIcon className={cn('w-4 h-4 shrink-0', pathname.startsWith('/sistema') ? 'text-primary' : '')} />
                  Seguridad
                </Link>
              </li>
            </ul>
          </div>
        )}
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

// ── Iconos ────────────────────────────────────────────────────

function HomeIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
      d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
  </svg>
}
function CalendarIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
}
function TreeIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
      d="M4 6h16M4 10h16M4 14h16M4 18h16" />
  </svg>
}
function BuildingIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
      d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
  </svg>
}
function BookIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
      d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
  </svg>
}
function PlusSquareIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
      d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
}
function LedgerIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
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
function SettingsIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
      d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
}
function UsersIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
      d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
}
function ShieldIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
      d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
  </svg>
}
function ChevronDownIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
}
function LibroComprasIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
      d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
  </svg>
}
function LibroVentasIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
      d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
  </svg>
}
function LibroHonorIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
      d="M12 14v4m-2-2h4" />
  </svg>
}
function AnalysisCuentaIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
      d="M3 6h18M3 10h18M3 14h10m-10 4h6m8-4l2 2-2 2m4-4l-2 2 2 2" />
  </svg>
}
function AnalysisAuxIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
      d="M17 14l2 2 3-3" />
  </svg>
}
function LogoutIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
      d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
  </svg>
}
