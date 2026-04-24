import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any

  const [membersResult, rolesResult, pendingResult] = await Promise.all([
    supabase.rpc('get_company_members', { p_company_id: companyId }),
    supabase.rpc('get_company_roles',   { p_company_id: companyId }),
    // Invitaciones enviadas aún no aceptadas para esta empresa
    admin
      .from('user_invitations')
      .select('id, email, token, created_at, expires_at')
      .eq('company_id', companyId)
      .is('accepted_at', null)
      .order('created_at', { ascending: false }),
  ])

  type MemberRow = {
    membership_id: string; user_id: string; status: string; created_at: string
    full_name: string; role_id: string; role_name: string; role_perms: string[]
  }

  const members = ((membersResult.data ?? []) as MemberRow[]).map(m => ({
    id: m.membership_id,
    user_id: m.user_id,
    status: m.status,
    created_at: m.created_at,
    full_name: m.full_name ?? '—',
    system_role: '',
    role_id: m.role_id,
    role_name: m.role_name,
    is_admin: (m.role_perms ?? []).includes('*'),
  }))

  type RoleRow = { id: string; name: string; is_system: boolean }
  const roleList = ((rolesResult.data ?? []) as RoleRow[]).map(r => ({
    id: r.id,
    name: r.name,
    is_system: r.is_system,
  }))

  type PendingRow = { id: string; email: string; token: string; created_at: string; expires_at: string }
  const pendingInvitations: PendingRow[] = (pendingResult.data ?? []) as PendingRow[]

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Usuarios</h1>
        <p className="text-text-secondary text-sm mt-1">
          Gestiona los accesos de usuarios a esta empresa
        </p>
      </div>
      <UsuariosClient
        members={members}
        roles={roleList}
        currentUserId={user!.id}
        pendingInvitations={pendingInvitations}
      />
    </div>
  )
}
