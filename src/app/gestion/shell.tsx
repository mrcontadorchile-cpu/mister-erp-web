'use client'

import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { SidebarGestion } from '@/components/layout/sidebar-gestion'
import type { UserProfile } from '@/types/database'

interface GestionShellProps {
  profile: UserProfile
  children: React.ReactNode
}

export function GestionShell({ profile, children }: GestionShellProps) {
  const router   = useRouter()
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => { setMobileOpen(false) }, [pathname])

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  async function handleSwitchCompany() {
    router.refresh()
  }

  return (
    <div className="flex h-screen overflow-hidden">

      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <div className={`
        fixed inset-y-0 left-0 z-50 transition-transform duration-300
        md:relative md:z-auto md:translate-x-0 print:hidden
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        <SidebarGestion
          profile={profile}
          onLogout={handleLogout}
          onSwitchCompany={handleSwitchCompany}
        />
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="flex md:hidden items-center gap-3 px-4 h-14 bg-surface border-b border-border shrink-0 print:hidden">
          <button
            onClick={() => setMobileOpen(true)}
            className="text-text-secondary hover:text-text-primary transition-colors"
            aria-label="Abrir menú"
          >
            <MenuIcon className="w-5 h-5" />
          </button>
          <img src="/logo-icon.svg" alt="ERP" className="w-6 h-6" />
          <span className="text-sm font-bold text-text-primary flex-1">Gestión</span>
          <div className="w-7 h-7 rounded-full bg-surface-high flex items-center justify-center">
            <span className="text-xs font-semibold text-text-secondary">
              {profile.full_name?.charAt(0)?.toUpperCase() ?? '?'}
            </span>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto bg-background print:overflow-visible print:h-auto">
          {children}
        </main>
      </div>
    </div>
  )
}

function MenuIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  )
}
