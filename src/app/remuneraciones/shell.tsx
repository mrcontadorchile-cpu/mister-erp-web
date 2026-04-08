'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { SidebarRemu } from '@/components/layout/sidebar-remu'
import type { UserProfile } from '@/types/database'

interface RemuShellProps {
  profile: UserProfile
  children: React.ReactNode
}

export function RemuShell({ profile, children }: RemuShellProps) {
  const router = useRouter()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <SidebarRemu profile={profile} onLogout={handleLogout} />
      <main className="flex-1 overflow-y-auto bg-background">
        {children}
      </main>
    </div>
  )
}
