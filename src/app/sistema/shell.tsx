'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { hasPermission, PERMISSIONS } from '@/lib/permissions'
import type { UserProfile } from '@/types/database'

interface SistemaShellProps {
  profile: UserProfile
  children: React.ReactNode
}

export function SistemaShell({ profile, children }: SistemaShellProps) {
  const pathname = usePathname()
  const router = useRouter()
  const perms = profile.permissions ?? []

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const navItems = [
    ...(hasPermission(perms, PERMISSIONS.SISTEMA_USUARIOS)
      ? [{ href: '/sistema/usuarios', label: 'Usuarios', icon: UsersIcon }]
      : []),
    ...(hasPermission(perms, PERMISSIONS.SISTEMA_ROLES)
      ? [{ href: '/sistema/roles', label: 'Roles y Permisos', icon: RolesIcon }]
      : []),
  ]

  return (
    <div className="flex h-screen overflow-hidden">
      <aside className="w-60 shrink-0 bg-surface border-r border-border flex flex-col h-screen sticky top-0">
        {/* Logo */}
        <div className="px-5 py-4 border-b border-border">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 bg-warning/20 rounded-lg flex items-center justify-center shrink-0">
              <ShieldIcon className="w-5 h-5 text-warning" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-text-primary">Sistema</p>
              <p className="text-xs text-text-disabled truncate">{profile.company_name}</p>
            </div>
          </div>
          <Link
            href="/contabilidad/dashboard"
            className="flex items-center gap-1.5 text-xs text-text-disabled hover:text-text-secondary transition-colors"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Volver a Contabilidad
          </Link>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 px-3">
          <p className="text-[10px] font-semibold text-text-disabled tracking-wider px-2 mb-1.5">
            SEGURIDAD
          </p>
          <ul className="space-y-0.5">
            {navItems.map(item => {
              const active = pathname.startsWith(item.href)
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
              <p className="text-[10px] text-text-disabled capitalize">{profile.role}</p>
            </div>
            <button onClick={handleLogout} className="text-text-disabled hover:text-error transition-colors">
              <LogoutIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto bg-background">
        {children}
      </main>
    </div>
  )
}

function UsersIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
      d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
}
function RolesIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
      d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
  </svg>
}
function ShieldIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
      d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
  </svg>
}
function LogoutIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
      d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
  </svg>
}
