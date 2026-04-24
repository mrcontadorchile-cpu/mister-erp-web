import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { DashboardShell } from './shell'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role, full_name, company_id, is_superadmin, companies(id, name, rut)')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/login')

  const activeCompany = profile.companies as unknown as { id: string; name: string; rut: string } | null
  const companyId = profile.company_id as string

  const [permData, companiesData, featuresData] = await Promise.all([
    supabase.rpc('get_user_permissions', { p_user_id: user.id, p_company_id: companyId }),
    supabase.rpc('get_user_companies',   { p_user_id: user.id }),
    supabase.rpc('get_company_features', { p_company_id: companyId }),
  ])

  const permissions: string[] = (permData.data as string[] | null) ?? ['*']
  const allCompanies = (companiesData.data as { id: string; name: string; rut: string }[] | null) ?? (activeCompany ? [activeCompany] : [])
  const features: string[] = (featuresData.data as { feature: string }[] | null)?.map(f => f.feature) ?? []

  const userProfile = {
    id: user.id,
    role: profile.role as string,
    full_name: profile.full_name as string,
    company_id: companyId,
    company_name: activeCompany?.name ?? '',
    company_rut: activeCompany?.rut ?? '',
    permissions,
    companies: allCompanies,
    features,
    is_superadmin: (profile.is_superadmin as boolean) ?? false,
  }

  return <DashboardShell profile={userProfile}>{children}</DashboardShell>
}
