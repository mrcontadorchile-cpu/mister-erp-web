import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { HomeHeader } from './_components/HomeHeader'
import { hasAnyPermission, PERMISSIONS } from '@/lib/permissions'

const modules = [
  {
    id: 'contabilidad',
    label: 'Contabilidad',
    description: 'Libro diario, mayor, plan de cuentas, balance y estado de resultados',
    href: '/contabilidad/dashboard',
    available: true,
  },
  {
    id: 'remuneraciones',
    label: 'Remuneraciones',
    description: 'Liquidaciones de sueldo, cotizaciones y finiquitos',
    href: '/remuneraciones/dashboard',
    available: true,
  },
  {
    id: 'facturacion',
    label: 'Facturación',
    description: 'Emisión de facturas, boletas y notas de crédito electrónicas',
    href: '#',
    available: false,
  },
  {
    id: 'tesoreria',
    label: 'Tesorería',
    description: 'Conciliación bancaria, flujo de caja y cobranza',
    href: '#',
    available: false,
  },
]

export default async function HomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return <LandingPage />

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('full_name, company_id, companies(id, name, rut)')
    .eq('id', user.id)
    .single()

  const activeCompany = profile?.companies as unknown as { id: string; name: string; rut: string } | null
  const companyId = profile?.company_id as string

  // Load permissions and all companies via SECURITY DEFINER functions
  const { data: permData } = await supabase
    .rpc('get_user_permissions', { p_user_id: user.id, p_company_id: companyId })

  const { data: companiesData } = await supabase
    .rpc('get_user_companies', { p_user_id: user.id })

  const permissions: string[] = (permData as string[] | null) ?? ['*']
  const allCompanies = (companiesData as { id: string; name: string; rut: string }[] | null)
    ?? (activeCompany ? [activeCompany] : [])

  const canAccessSistema = hasAnyPermission(permissions, [
    PERMISSIONS.SISTEMA_USUARIOS,
    PERMISSIONS.SISTEMA_ROLES,
  ])

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <HomeHeader
        fullName={profile?.full_name ?? ''}
        activeCompany={activeCompany}
        allCompanies={allCompanies}
        canAccessSistema={canAccessSistema}
      />

      {/* Main */}
      <main className="flex-1 max-w-5xl mx-auto px-6 py-12 w-full">
        <div className="mb-10">
          <h1 className="text-2xl font-bold text-text-primary mb-1">Selecciona un módulo</h1>
          <p className="text-text-secondary text-sm">¿En qué vas a trabajar hoy?</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {modules.map(mod => (
            mod.available ? (
              <Link
                key={mod.id}
                href={mod.href}
                className="group relative rounded-xl border border-primary/20 bg-primary/5 hover:border-primary/50 hover:bg-primary/10 p-6 transition-all duration-150"
              >
                <ModuleIcon id={mod.id} available />
                <h2 className="text-base font-bold text-text-primary mb-1 mt-4">{mod.label}</h2>
                <p className="text-xs text-text-secondary leading-relaxed">{mod.description}</p>
                <div className="mt-4 flex items-center gap-1 text-xs text-primary font-medium">
                  Ingresar
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </Link>
            ) : (
              <div
                key={mod.id}
                className="relative rounded-xl border border-border bg-surface p-6 opacity-50"
              >
                <ModuleIcon id={mod.id} available={false} />
                <h2 className="text-base font-bold text-text-primary mb-1 mt-4">{mod.label}</h2>
                <p className="text-xs text-text-secondary leading-relaxed">{mod.description}</p>
                <span className="absolute top-4 right-4 text-[10px] font-semibold text-text-disabled bg-surface-high px-2 py-0.5 rounded-full border border-border">
                  Próximamente
                </span>
              </div>
            )
          ))}
        </div>
      </main>

      <footer className="border-t border-border py-4 text-center">
        <p className="text-xs text-text-disabled">Mister Group · ERP Contable Chile</p>
      </footer>
    </div>
  )
}

// ── Public landing page (shown when not logged in) ───────────────────────────
function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-text-primary flex flex-col">
      {/* Nav */}
      <header className="border-b border-border">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo-white.svg" alt="ERP Mister Group" className="h-8" />
          </div>
          <Link href="/login"
            className="bg-primary text-primary-foreground font-semibold text-sm px-5 py-2 rounded-xl hover:bg-primary/90 transition-colors">
            Ingresar
          </Link>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1">
        <div className="max-w-5xl mx-auto px-6 py-20 text-center">
          <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 text-primary text-xs font-semibold px-3 py-1.5 rounded-full mb-6">
            ERP Contable para Pymes chilenas
          </div>
          <h1 className="text-4xl sm:text-5xl font-black text-text-primary mb-6 leading-tight">
            Contabilidad simple,<br />
            <span className="text-primary">sin complicaciones</span>
          </h1>
          <p className="text-text-secondary text-lg max-w-xl mx-auto mb-10 leading-relaxed">
            Mister Contabilidad es un ERP diseñado para contadores y Pymes en Chile.
            Gestiona contabilidad, remuneraciones y facturación desde un solo lugar.
          </p>
          <Link href="/login"
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground font-bold text-base px-8 py-3.5 rounded-xl hover:bg-primary/90 transition-colors">
            Acceder al sistema
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>

        {/* Features */}
        <div className="max-w-5xl mx-auto px-6 pb-20">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { icon: '📒', title: 'Contabilidad', desc: 'Libro diario, mayor, balance y estado de resultados' },
              { icon: '👥', title: 'Remuneraciones', desc: 'Liquidaciones, cotizaciones y finiquitos' },
              { icon: '🧾', title: 'Facturación', desc: 'Facturas y boletas electrónicas con el SII' },
              { icon: '🏢', title: 'Multiempresa', desc: 'Gestiona varias empresas desde una sola cuenta' },
            ].map(({ icon, title, desc }) => (
              <div key={title} className="p-5 bg-surface rounded-2xl border border-border">
                <div className="text-2xl mb-3">{icon}</div>
                <h3 className="font-semibold text-text-primary text-sm mb-1">{title}</h3>
                <p className="text-xs text-text-secondary leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-6 text-center">
        <p className="text-xs text-text-disabled">
          Mister Group © {new Date().getFullYear()} ·{' '}
          <Link href="/politica-de-privacidad" className="hover:text-text-secondary transition-colors">Política de privacidad</Link>
          {' · '}
          <Link href="/terminos-de-servicio" className="hover:text-text-secondary transition-colors">Términos de servicio</Link>
        </p>
      </footer>
    </div>
  )
}

function ModuleIcon({ id, available }: { id: string; available: boolean }) {
  const base = `w-12 h-12 rounded-xl flex items-center justify-center ${available ? 'bg-primary/20 text-primary' : 'bg-surface-high text-text-disabled'}`
  const icons: Record<string, React.ReactNode> = {
    contabilidad: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
      </svg>
    ),
    remuneraciones: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    facturacion: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    tesoreria: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  }
  return <div className={base}>{icons[id]}</div>
}
