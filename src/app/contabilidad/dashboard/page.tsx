import { createClient } from '@/lib/supabase/server'
import { formatNumber, monthName } from '@/lib/utils'
import { DashboardCharts } from './DashboardCharts'

export default async function DashboardPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('user_profiles').select('company_id, companies(name, rut)').eq('id', user!.id).single()

  const companyId = profile?.company_id as string
  const now = new Date()
  const year  = now.getFullYear()
  const month = now.getMonth() + 1

  // Período + conteos todos en paralelo (period antes era secuencial)
  const [periodRes, journalRes, taxRes, pendingRes, validacionesRes] = await Promise.all([
    supabase
      .schema('conta').from('periods')
      .select('*')
      .eq('company_id', companyId)
      .eq('year', year)
      .eq('month', month)
      .maybeSingle(),
    supabase.schema('conta').from('journal_entries')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .eq('status', 'posted'),
    supabase.schema('conta').from('tax_documents')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', companyId),
    supabase.schema('conta').from('tax_documents')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .eq('status', 'pending'),
    supabase.schema('conta').from('asientos_borrador')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .eq('status', 'pendiente'),
  ])

  const period = periodRes.data
  const stats = {
    journalEntries:   journalRes.count ?? 0,
    taxDocuments:     taxRes.count ?? 0,
    pendingDocuments: pendingRes.count ?? 0,
    validacionesPend: validacionesRes.count ?? 0,
  }

  const isClosed = period?.status === 'closed'

  // ── Datos para gráficos: últimos 6 meses ─────────────────────────────────
  const MES_SHORT = ['', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

  // Generar los 6 pares (año, mes) anteriores al mes actual inclusive
  const periods6: { year: number; month: number }[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(year, month - 1 - i, 1)
    periods6.push({ year: d.getFullYear(), month: d.getMonth() + 1 })
  }

  // Traer balances de los últimos 6 meses en paralelo
  const balanceResults = await Promise.all(
    periods6.map(p =>
      supabase.rpc('get_account_balances', {
        p_company_id: companyId,
        p_year:       p.year,
        p_month_from: p.month,
        p_month_to:   p.month,
      })
    )
  )

  const evolucion = periods6.map((p, i) => {
    const rows = balanceResults[i].data ?? []
    let ingresos = 0, gastos = 0
    for (const b of rows as any[]) {
      const bal = Number(b.balance)
      if (b.type === 'INGRESO') ingresos += b.nature === 'DEUDOR' ? bal : -bal
      if (b.type === 'EGRESO' || b.type === 'COSTO') gastos += b.nature === 'DEUDOR' ? bal : -bal
    }
    return {
      mes:       MES_SHORT[p.month],
      ingresos:  Math.max(0, ingresos),
      gastos:    Math.max(0, gastos),
      resultado: ingresos - gastos,
    }
  }).filter(p => p.ingresos > 0 || p.gastos > 0)

  // Saldos de cuentas clave del mes actual
  const cuentasClaveMap: { prefix: string; name: string; color: string }[] = [
    { prefix: '1.1.1.', name: 'Caja y Bancos',        color: '#4CAF50' },
    { prefix: '1.1.3.', name: 'Clientes',              color: '#2196F3' },
    { prefix: '2.1.1.', name: 'Proveedores',           color: '#E53935' },
    { prefix: '1.1.6.', name: 'IVA Crédito Fiscal',   color: '#9C27B0' },
    { prefix: '2.1.3.', name: 'IVA Débito Fiscal',    color: '#FF9800' },
  ]

  const currentRows = (balanceResults[5].data ?? []) as any[]
  const cuentasClave = cuentasClaveMap.map(c => {
    const matching = currentRows.filter((b: any) => b.code.startsWith(c.prefix))
    const saldo = matching.reduce((s: number, b: any) => {
      const bal = Number(b.balance)
      return s + (b.nature === 'DEUDOR' ? bal : -bal)
    }, 0)
    return { ...c, saldo }
  }).filter(c => c.saldo !== 0)

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
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
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
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
      {/* Gráficos */}
      {(evolucion.length > 0 || cuentasClave.length > 0) && (
        <div className="mb-10">
          <DashboardCharts evolucion={evolucion} cuentasClave={cuentasClave} />
        </div>
      )}

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
      <div className="grid grid-cols-2 gap-3 mb-8">
        <NavCard href="/importar-sii"   label="Importar SII"  color="#FFD700" />
        <NavCard href="/documentos-sii" label="Ver Documentos" color="#2196F3" />
      </div>

      <SectionTitle title="IA Contable" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-2">
      <a
        href="/contabilidad/ia-agente"
        className="card p-4 flex items-center gap-3 hover:border-primary/40 transition-colors group"
      >
        <div className="w-9 h-9 rounded-lg bg-purple-500/10 flex items-center justify-center shrink-0 text-lg">🤖</div>
        <div>
          <p className="text-sm font-semibold text-text-primary group-hover:text-primary transition-colors">Agente IA</p>
          <p className="text-xs text-text-disabled mt-0.5">Comandos en lenguaje natural</p>
        </div>
      </a>
      <a
        href="/contabilidad/validaciones"
        className="card p-4 flex items-center justify-between hover:border-primary/40 transition-colors group"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 text-lg">
            ✨
          </div>
          <div>
            <p className="text-sm font-semibold text-text-primary group-hover:text-primary transition-colors">
              Validaciones IA
            </p>
            <p className="text-xs text-text-disabled mt-0.5">
              {stats.validacionesPend > 0
                ? `${stats.validacionesPend} documento${stats.validacionesPend > 1 ? 's' : ''} esperando revisión`
                : 'Sin pendientes'}
            </p>
          </div>
        </div>
        {stats.validacionesPend > 0 && (
          <span className="bg-warning text-black text-xs font-bold px-2.5 py-1 rounded-full shrink-0">
            {stats.validacionesPend}
          </span>
        )}
      </a>
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
