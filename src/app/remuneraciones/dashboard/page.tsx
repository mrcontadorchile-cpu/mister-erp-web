import { createClient } from '@/lib/supabase/server'
import { formatCLP, monthName } from '@/lib/utils'
import Link from 'next/link'

export default async function RemuDashboardPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('company_id, companies(name, rut)')
    .eq('id', user!.id)
    .single()

  const companyId = profile?.company_id as string
  const now = new Date()
  const year  = now.getFullYear()
  const month = now.getMonth() + 1

  // Período actual
  const { data: periodo } = await supabase
    .schema('remu').from('periodos_remuneracion')
    .select('*')
    .eq('company_id', companyId)
    .eq('year', year)
    .eq('month', month)
    .maybeSingle()

  // Conteos en paralelo
  const [empleadosRes, liquidacionesRes, totalPagarRes] = await Promise.all([
    supabase.schema('remu').from('empleados')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .eq('estado', 'activo'),
    supabase.schema('remu').from('liquidaciones')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .eq('estado', 'aprobada'),
    supabase.schema('remu').from('liquidaciones')
      .select('liquido_a_pagar')
      .eq('company_id', companyId)
      .not('periodo_id', 'is', null),
  ])

  // Liquidaciones del período actual
  let liquidacionesMes = 0
  let totalLiquidoPagar = 0
  if (periodo) {
    const { data: liqs, count } = await supabase
      .schema('remu').from('liquidaciones')
      .select('liquido_a_pagar', { count: 'exact' })
      .eq('periodo_id', periodo.id)
    liquidacionesMes = count ?? 0
    totalLiquidoPagar = (liqs ?? []).reduce((s, l) => s + (l.liquido_a_pagar ?? 0), 0)
  }

  const empleadosActivos = empleadosRes.count ?? 0
  const isClosed = periodo?.estado === 'cerrado'

  const company = profile?.companies as unknown as { name: string } | null

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text-primary">Remuneraciones</h1>
        <p className="text-text-secondary text-sm mt-1">{company?.name ?? ''}</p>
      </div>

      {/* Período actual */}
      {periodo ? (
        <div className={`flex items-center gap-3 p-4 rounded-lg border mb-8 ${
          isClosed ? 'bg-error/5 border-error/20' : 'bg-success/5 border-success/20'
        }`}>
          <div className={`w-2 h-2 rounded-full ${isClosed ? 'bg-error' : 'bg-success'}`} />
          <div>
            <p className={`text-sm font-semibold ${isClosed ? 'text-error' : 'text-success'}`}>
              Período {monthName(month)} {year}
            </p>
            <p className="text-xs text-text-disabled">
              {isClosed ? 'Cerrado' : 'Abierto'} · {liquidacionesMes} liquidaciones
              {liquidacionesMes > 0 && ` · Total líquido: ${formatCLP(totalLiquidoPagar)}`}
            </p>
          </div>
          <Link
            href={`/remuneraciones/liquidaciones/${periodo.id}`}
            className="ml-auto text-xs text-primary hover:underline font-medium"
          >
            Ver liquidaciones →
          </Link>
        </div>
      ) : (
        <div className="flex items-center gap-3 p-4 rounded-lg border border-warning/20 bg-warning/5 mb-8">
          <div className="w-2 h-2 rounded-full bg-warning" />
          <div>
            <p className="text-sm font-semibold text-warning">Sin período para {monthName(month)} {year}</p>
            <p className="text-xs text-text-disabled">Crea el período para comenzar a liquidar</p>
          </div>
          <Link
            href="/remuneraciones/periodos"
            className="ml-auto text-xs text-primary hover:underline font-medium"
          >
            Crear período →
          </Link>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
        <KpiCard label="Empleados activos"       value={String(empleadosActivos)} color="#4CAF50" icon="👥" />
        <KpiCard label="Liquidaciones del mes"   value={String(liquidacionesMes)} color="#2196F3" icon="📋" />
        <KpiCard
          label="Total líquido a pagar"
          value={totalLiquidoPagar > 0 ? formatCLP(totalLiquidoPagar) : '$0'}
          color="#9C27B0"
          icon="💰"
        />
      </div>

      {/* Accesos rápidos */}
      <SectionTitle title="Trabajadores" />
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-8">
        <NavCard href="/remuneraciones/empleados"       label="Ver Empleados"    color="#4CAF50" />
        <NavCard href="/remuneraciones/empleados/nuevo" label="Nuevo Empleado"   color="#2196F3" />
        <NavCard href="/remuneraciones/periodos"        label="Períodos"         color="#FF9800" />
      </div>

      <SectionTitle title="Liquidaciones" />
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-8">
        <NavCard href="/remuneraciones/liquidaciones"         label="Liquidaciones"          color="#9C27B0" />
        <NavCard href="/remuneraciones/libro-remuneraciones"  label="Libro de Remuneraciones" color="#2196F3" />
        <NavCard href="/remuneraciones/previred"              label="Archivo Previred"        color="#FF9800" />
      </div>

      <SectionTitle title="Legal" />
      <div className="grid grid-cols-2 gap-3">
        <NavCard href="/remuneraciones/finiquitos"  label="Finiquitos"  color="#E53935" />
        <NavCard href="/remuneraciones/parametros"  label="Parámetros legales" color="#607D8B" />
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
      <p className="text-xl font-black truncate" style={{ color }}>{value}</p>
      <p className="text-text-disabled text-xs mt-1">{label}</p>
    </div>
  )
}

function NavCard({ href, label, color }: { href: string; label: string; color: string }) {
  return (
    <Link
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
    </Link>
  )
}

function SectionTitle({ title }: { title: string }) {
  return (
    <p className="text-[11px] font-semibold text-text-disabled tracking-wider uppercase mb-3">
      {title}
    </p>
  )
}
