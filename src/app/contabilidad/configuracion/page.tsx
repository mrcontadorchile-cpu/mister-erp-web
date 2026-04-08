import { createClient } from '@/lib/supabase/server'
import { EmpresaForm } from './EmpresaForm'
import { SIIConfigForm } from './SIIConfigForm'

export default async function ConfiguracionPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role, full_name, company_id, companies(*)')
    .eq('id', user!.id)
    .single()

  const company = profile?.companies as unknown as {
    id: string
    name: string
    rut: string
    address: string | null
    commune: string | null
    city: string | null
    region: string | null
    phone: string | null
    email: string | null
    giro: string | null
    activity_code: string | null
  } | null

  const { data: siiConfig } = await supabase
    .from('company_sii_configs')
    .select('sii_rut, sii_rut_usuario, cert_enabled, cert_subject, cert_expires_at, last_sync_at, last_sync_status, last_sync_message, sii_token, sii_token_obtained_at')
    .eq('company_id', profile?.company_id)
    .maybeSingle()

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Configuración</h1>
        <p className="text-text-secondary text-sm mt-1">
          Datos de la empresa y conexión con el SII
        </p>
      </div>

      {/* Tabs */}
      <div className="space-y-6">
        {/* Empresa */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-6 h-6 rounded-md bg-primary/20 flex items-center justify-center">
              <svg className="w-3.5 h-3.5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <h2 className="text-base font-bold text-text-primary">Datos de la Empresa</h2>
          </div>
          <EmpresaForm company={company} />
        </section>

        {/* SII */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-6 h-6 rounded-md bg-info/20 flex items-center justify-center">
              <svg className="w-3.5 h-3.5 text-info" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
              </svg>
            </div>
            <h2 className="text-base font-bold text-text-primary">Conexión SII</h2>
          </div>
          <SIIConfigForm
            siiRut={siiConfig?.sii_rut ?? ''}
            siiRutUsuario={siiConfig?.sii_rut_usuario ?? ''}
            certEnabled={siiConfig?.cert_enabled ?? false}
            certSubject={siiConfig?.cert_subject ?? ''}
            certExpiresAt={siiConfig?.cert_expires_at ?? ''}
            lastSyncAt={siiConfig?.last_sync_at ?? null}
            lastSyncStatus={siiConfig?.last_sync_status ?? null}
            lastSyncMessage={siiConfig?.last_sync_message ?? null}
            hasToken={!!siiConfig?.sii_token}
            tokenObtainedAt={siiConfig?.sii_token_obtained_at ?? null}
          />
        </section>

        {/* Usuario */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-6 h-6 rounded-md bg-success/20 flex items-center justify-center">
              <svg className="w-3.5 h-3.5 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <h2 className="text-base font-bold text-text-primary">Usuario Activo</h2>
          </div>
          <div className="card p-5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-text-disabled mb-1">Nombre</p>
                <p className="text-sm font-medium text-text-primary">{profile?.full_name ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs text-text-disabled mb-1">Email</p>
                <p className="text-sm text-text-secondary">{user?.email ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs text-text-disabled mb-1">Rol</p>
                <span className="badge bg-primary/10 text-primary capitalize">{profile?.role ?? '—'}</span>
              </div>
              <div>
                <p className="text-xs text-text-disabled mb-1">ID</p>
                <p className="text-xs text-text-disabled font-mono truncate">{user?.id}</p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
