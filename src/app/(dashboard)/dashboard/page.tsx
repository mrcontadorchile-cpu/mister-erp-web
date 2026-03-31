import { createClient } from '@/lib/supabase/server'
import { formatNumber, monthName } from '@/lib/utils'

export default async function DashboardPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile }  = await supabase
    .from('user_profiles')
    .select('company_id, companies(name, rut)')
    .eq('id', user!.id)
    .single()

  const companyId = profile?.company_id as string
  const now = new Date()
  const year  = now.getFullYear()
  const month = now.getMonth() + 1

  // Período actual
  const { data: period } = await supabase
    .from('conta.periods')
    .select('*')
    .eq('company_id', companyId)
    .eq('year', year)
    .eq('month', month)
    .maybeSingle()

  // Conteos en paralelo
  const [journalRes, taxRes, pendingRes] = await Promise.all([
    supabase.from('conta.journal_entries')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .eq('status', 'posted'),
    supabase.from('conta.tax_documents')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', companyId),
    supabase.from('conta.tax_documents')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .eq('status', 'pending'),
  ])

  const stats = {
    journalEntries:   journalRes.count ?? 0,
    taxDocuments:     taxRes.count ?? 0,
    pendingDocuments: pendingRes.count ?? 0,
  }

  const isClosed = period?.status === 'closed'

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text-primary">Dashboard</h1>
        <p className="text-text-secondary text-sm mt-1">
          {(profile?.companies as unknown as { name: string } | null)?.name ?? ''}
        </p>
      </div>

      {/* Período activo */}
      <div className={`flex items-center gap-3 p-4 rounded-lg border mb-8 ${
        isClosed
          ? 'bg-error/5 border-error/20'
          : 'bg-success/5 border-success/20'
      }`}>
        <div className={`w-2 h-2 rounded-full ${isClosed ? 'bg-error' : 'bg-success'}`} />
        <div>
          <p className={`text-sm font-semibold ${isClosed ? 'text-error' : 'text-success'}`}>
            Período {monthName(month)} {year}
          </p>
          <p className="text-xs text-text-disabled">
            {isClosed ? 'Cerrado — no permite modificaciones' : 'Abierto'}
          </p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4 mb-10">
        <KpiCard
          label="Asientos contables"
          value={formatNumber(stats.journalEntries)}
          color="#FFD700"
          icon="📋"
        />
        <KpiCard
          label="Documentos SII"
          value={formatNumber(stats.taxDocuments)}
          color="#2196F3"
          icon="📄"
        />
        <KpiCard
          label="Pendientes de contabilizar"
          value={formatNumber(stats.pendingDocuments)}
          color={stats.pendingDocuments > 0 ? '#FF9800' : '#4CAF50'}
          icon="⏳"
        />
      </div>

      {/* Accesos rápidos */}
      <SectionTitle title="Contabilidad" />
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-8">
        <NavCard href="/plan-cuentas"  label="Plan de Cuentas"  color="#4CAF50" />
        <NavCard href="/libro-diario"  label="Libro Diario"     color="#FFD700" />
        <NavCard href="/centros-costo" label="Centros de Costo" color="#2196F3" />
      </div>

      <SectionTitle title="Reportes" />
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-8">
        <NavCard href="/reportes/balance-8col"        label="Balance 8 Columnas"  color="#9C27B0" />
        <NavCard href="/reportes/balance-clasificado" label="Balance Clasificado" color="#FF9800" />
        <NavCard href="/reportes/eerr"                label="Estado de Resultados" color="#4CAF50" />
      </div>

      <SectionTitle title="Documentos SII" />
      <div className="grid grid-cols-2 gap-3">
        <NavCard href="/importar-sii"   label="Importar SII"  color="#FFD700" />
        <NavCard href="/documentos-sii" label="Ver Documentos" color="#2196F3" />
      </div>
    </div>
  )
}

function KpiCard({ label, value, color, icon }: {
  label: string; value: string; color: string; icon: string
}) {
  return (
    <div className="card p-5">
      <div className="text-2xl mb-2">{icon}</div>
      <p className="text-2xl font-black" style={{ color }}>{value}</p>
      <p className="text-text-disabled text-xs mt-1">{label}</p>
    </div>
  )
}

function NavCard({ href, label, color }: { href: string; label: string; color: string }) {
  return (
    <a
      href={href}
      className="card p-4 flex items-center gap-3 hover:border-primary/40 transition-colors group"
    >
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
        style={{ backgroundColor: `${color}18` }}
      >
        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
      </div>
      <span className="text-sm text-text-secondary group-hover:text-text-primary transition-colors font-medium">
        {label}
      </span>
    </a>
  )
}

function SectionTitle({ title }: { title: string }) {
  return (
    <p className="text-[11px] font-semibold text-text-disabled tracking-wider uppercase mb-3">
      {title}
    </p>
  )
}
