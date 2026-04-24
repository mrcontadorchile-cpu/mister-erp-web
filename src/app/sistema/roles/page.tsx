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

  // Use SECURITY DEFINER functions to avoid RLS circular dependency
  const { data: rolesRaw } = await supabase
    .rpc('get_company_roles', { p_company_id: companyId })

  const { data: membersRaw } = await supabase
    .rpc('get_company_members', { p_company_id: companyId })

  // Count active members per role
  const memberCounts: Record<string, number> = {}
  for (const m of (membersRaw ?? []) as { role_id: string; status: string }[]) {
    if (m.status === 'active') {
      memberCounts[m.role_id] = (memberCounts[m.role_id] ?? 0) + 1
    }
  }

  type RoleRow = {
    id: string; name: string; description: string | null
    permissions: string[]; is_system: boolean
  }

  const roleList = ((rolesRaw ?? []) as RoleRow[]).map(r => ({
    id: r.id,
    name: r.name,
    description: r.description,
    permissions: r.permissions,
    is_system: r.is_system,
    member_count: memberCounts[r.id] ?? 0,
  }))

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
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
