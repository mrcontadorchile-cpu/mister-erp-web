import { createClient } from '@/lib/supabase/server'
import { UsuariosClient } from './UsuariosClient'

export default async function UsuariosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('company_id')
    .eq('id', user!.id)
    .single()

  const companyId = profile?.company_id as string

  // Load all memberships for this company with user + role info
  const { data: memberships } = await supabase
    .from('user_company_memberships')
    .select(`
      id, user_id, status, created_at,
      erp_roles(id, name, permissions),
      user_profiles(full_name, role)
    `)
    .eq('company_id', companyId)
    .order('created_at')

  // Load all roles for role-change dropdown
  const { data: roles } = await supabase
    .from('erp_roles')
    .select('id, name, is_system, permissions')
    .eq('company_id', companyId)
    .order('name')

  // Get auth emails via RPC (we'll use full_name as fallback since we can't get emails directly)
  const members = (memberships ?? []).map(m => ({
    id: m.id as string,
    user_id: m.user_id as string,
    status: m.status as string,
    created_at: m.created_at as string,
    full_name: (m.user_profiles as any)?.full_name ?? '—',
    system_role: (m.user_profiles as any)?.role ?? '—',
    role_id: (m.erp_roles as any)?.id ?? '',
    role_name: (m.erp_roles as any)?.name ?? '—',
    is_admin: ((m.erp_roles as any)?.permissions ?? []).includes('*'),
  }))

  const roleList = (roles ?? []).map(r => ({
    id: r.id as string,
    name: r.name as string,
    is_system: r.is_system as boolean,
  }))

  const currentUserId = user!.id

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Usuarios</h1>
        <p className="text-text-secondary text-sm mt-1">
          Gestiona los accesos de usuarios a esta empresa
        </p>
      </div>
      <UsuariosClient
        members={members}
        roles={roleList}
        currentUserId={currentUserId}
      />
    </div>
  )
}
