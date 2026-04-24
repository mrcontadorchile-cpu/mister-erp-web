import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import { EmpresaDetailClient } from './EmpresaDetailClient'
import type { CompanyFeature } from '@/types/database'

export default async function EmpresaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const admin = createAdminClient()
  const supabase = await createClient()

  const [companyRes, featuresRes, membersRes, rolesRes] = await Promise.all([
    admin.from('companies').select('id,name,rut,email,giro,is_active,created_at').eq('id', id).single(),
    admin.from('company_features').select('feature,active').eq('company_id', id),
    supabase.rpc('get_company_members', { p_company_id: id }),
    supabase.rpc('get_company_roles', { p_company_id: id }),
  ])

  if (!companyRes.data) notFound()

  const activeFeatures = (featuresRes.data ?? [])
    .filter(f => f.active)
    .map(f => f.feature as CompanyFeature)

  type MemberRow = { full_name: string; role_name: string; status: string }
  const members = (membersRes.data ?? []) as MemberRow[]

  type RoleRow = { id: string; name: string }
  const roles = (rolesRes.data ?? []) as RoleRow[]

  return (
    <EmpresaDetailClient
      company={companyRes.data}
      activeFeatures={activeFeatures}
      members={members}
      roles={roles}
    />
  )
}
