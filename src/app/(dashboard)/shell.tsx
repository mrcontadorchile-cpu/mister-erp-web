'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Sidebar } from '@/components/layout/sidebar'
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

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar profile={profile} onLogout={handleLogout} />
      <main className="flex-1 overflow-y-auto bg-background">
        {children}
      </main>
    </div>
  )
}
