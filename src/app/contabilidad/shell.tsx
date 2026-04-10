'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Sidebar } from '@/components/layout/sidebar'
import { switchCompany } from './actions'
import type { UserProfile } from '@/types/database'

interface DashboardShellProps {
  profile: UserProfile
  children: React.ReactNode
}

export function DashboardShell({ profile, children }: DashboardShellProps) {
  const router = useRouter()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  async function handleSwitchCompany(companyId: string) {
    await switchCompany(companyId)
    router.refresh()
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <div className="print:hidden">
        <Sidebar
          profile={profile}
          onLogout={handleLogout}
          onSwitchCompany={handleSwitchCompany}
        />
      </div>
      <main className="flex-1 overflow-y-auto bg-background print:overflow-visible print:h-auto">
        {children}
      </main>
    </div>
  )
}
