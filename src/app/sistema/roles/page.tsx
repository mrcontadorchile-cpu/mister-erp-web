import { createClient } from '@/lib/supabase/server'
import { RolesClient } from './RolesClient'

export default async function RolesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('company_id')
    .eq('id', user!.id)
    .single()

  const companyId = profile?.company_id as string

  const { data: roles } = await supabase
    .from('erp_roles')
    .select('id, name, description, permissions, is_system, created_at')
    .eq('company_id', companyId)
    .order('is_system', { ascending: false })
    .order('name')

  // Count members per role
  const { data: counts } = await supabase
    .from('user_company_memberships')
    .select('role_id')
    .eq('company_id', companyId)
    .eq('status', 'active')

  const memberCounts: Record<string, number> = {}
  for (const c of counts ?? []) {
    memberCounts[c.role_id] = (memberCounts[c.role_id] ?? 0) + 1
  }

  const roleList = (roles ?? []).map(r => ({
    id: r.id as string,
    name: r.name as string,
    description: r.description as string | null,
    permissions: r.permissions as string[],
    is_system: r.is_system as boolean,
    member_count: memberCounts[r.id] ?? 0,
  }))

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Roles y Permisos</h1>
        <p className="text-text-secondary text-sm mt-1">
          Crea y configura roles personalizados para tu empresa
        </p>
      </div>
      <RolesClient roles={roleList} />
    </div>
  )
}
