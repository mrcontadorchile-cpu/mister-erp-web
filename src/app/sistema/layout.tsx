import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { hasAnyPermission, PERMISSIONS } from '@/lib/permissions'
import { SistemaShell } from './shell'

export default async function SistemaLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role, full_name, company_id, companies(id, name, rut)')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/login')

  const activeCompany = profile.companies as unknown as { id: string; name: string; rut: string } | null
  const companyId = profile.company_id as string

  // Load permissions via SECURITY DEFINER function (avoids RLS circular dependency)
  const { data: permData } = await supabase
    .rpc('get_user_permissions', { p_user_id: user.id, p_company_id: companyId })

  const permissions: string[] = (permData as string[] | null) ?? ['*']

  if (!hasAnyPermission(permissions, [PERMISSIONS.SISTEMA_USUARIOS, PERMISSIONS.SISTEMA_ROLES])) {
    redirect('/contabilidad/dashboard')
  }

  const userProfile = {
    id: user.id,
    role: profile.role as string,
    full_name: profile.full_name as string,
    company_id: companyId,
    company_name: activeCompany?.name ?? '',
    company_rut: activeCompany?.rut ?? '',
    permissions,
    companies: [],
    features: [] as string[],
  }

  return <SistemaShell profile={userProfile}>{children}</SistemaShell>
}
