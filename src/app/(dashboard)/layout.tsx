import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { DashboardShell } from './shell'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role, full_name, company_id, companies(id, name, rut)')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/login')

  const company = profile.companies as { id: string; name: string; rut: string } | null

  const userProfile = {
    id: user.id,
    role: profile.role as string,
    full_name: profile.full_name as string,
    company_id: profile.company_id as string,
    company_name: company?.name ?? '',
    company_rut: company?.rut ?? '',
  }

  return <DashboardShell profile={userProfile}>{children}</DashboardShell>
}
