'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { switchCompany } from '@/app/contabilidad/actions'
import { createClient } from '@/lib/supabase/client'

interface Company {
  id: string
  name: string
  rut: string
}

interface HomeHeaderProps {
  fullName: string
  activeCompany: Company | null
  allCompanies: Company[]
  canAccessSistema: boolean
}

export function HomeHeader({ fullName, activeCompany, allCompanies, canAccessSistema }: HomeHeaderProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleSwitch(companyId: string) {
    setOpen(false)
    if (companyId === activeCompany?.id) return
    startTransition(async () => {
      await switchCompany(companyId)
      router.refresh()
    })
  }

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const multiCompany = allCompanies.length > 1

  return (
    <header className="border-b border-border bg-surface">
      <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
        {/* Logo + empresa */}
        <div className="flex items-center gap-3">
          <img src="/logo-icon.svg" alt="ERP Mister Group" className="w-9 h-9" />
          <div>
            <p className="text-sm font-bold text-text-primary">ERP Mister Group</p>

            {/* Company switcher / display */}
            {activeCompany && (
              multiCompany ? (
                <div className="relative">
                  <button
                    onClick={() => setOpen(v => !v)}
                    disabled={isPending}
                    className="flex items-center gap-1 text-xs text-text-disabled hover:text-text-secondary transition-colors"
                  >
                    <span>{activeCompany.name} · {activeCompany.rut}</span>
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {open && (
                    <div className="absolute left-0 top-full mt-1 z-50 bg-surface border border-border rounded-lg shadow-lg min-w-[220px] py-1">
                      <p className="text-[10px] font-semibold text-text-disabled px-3 pt-1 pb-1.5 uppercase tracking-wider">
                        Cambiar empresa
                      </p>
                      {allCompanies.map(c => (
                        <button
                          key={c.id}
                          onClick={() => handleSwitch(c.id)}
                          className={cn(
                            'w-full text-left px-3 py-2 text-xs hover:bg-surface-high transition-colors',
                            c.id === activeCompany.id ? 'text-primary font-semibold' : 'text-text-secondary'
                          )}
                        >
                          <span className="block">{c.name}</span>
                          <span className="text-[10px] text-text-disabled">{c.rut}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs text-text-disabled">{activeCompany.name} · {activeCompany.rut}</p>
              )
            )}
          </div>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-4">
          {canAccessSistema && (
            <Link
              href="/sistema/usuarios"
              className="flex items-center gap-1.5 text-xs text-text-disabled hover:text-text-secondary transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              Seguridad
            </Link>
          )}
          <span className="text-xs text-text-disabled">{fullName}</span>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 text-xs text-text-disabled hover:text-error transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Cerrar sesión
          </button>
        </div>
      </div>
    </header>
  )
}
