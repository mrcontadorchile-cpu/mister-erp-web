import { createClient } from '@/lib/supabase/server'
import { formatCLP, monthName } from '@/lib/utils'
import Link from 'next/link'

export default async function LiquidacionesPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('user_profiles').select('company_id').eq('id', user!.id).single()

  const companyId = profile?.company_id as string

  const { data: periodos } = await supabase
    .schema('remu').from('periodos_remuneracion')
    .select('*')
    .eq('company_id', companyId)
    .order('year', { ascending: false })
    .order('month', { ascending: false })

  // Estadísticas por período
  const periodosConStats = await Promise.all(
    (periodos ?? []).map(async p => {
      const { data: liqs } = await supabase
        .schema('remu').from('liquidaciones')
        .select('liquido_a_pagar, estado')
        .eq('periodo_id', p.id)

      const totalLiquido = (liqs ?? []).reduce((s, l) => s + (l.liquido_a_pagar ?? 0), 0)
      const aprobadas    = (liqs ?? []).filter(l => l.estado === 'aprobada').length
      const total        = liqs?.length ?? 0

      return { ...p, totalLiquido, total, aprobadas }
    })
  )

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Liquidaciones</h1>
          <p className="text-text-secondary text-sm mt-1">Historial de períodos de remuneración</p>
        </div>
        <Link href="/remuneraciones/periodos" className="btn-primary">
          + Nuevo Período
        </Link>
      </div>

      {periodosConStats.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-text-secondary text-sm">No hay períodos creados.</p>
          <Link href="/remuneraciones/periodos" className="btn-primary mt-4 inline-block">
            Crear primer período
          </Link>
        </div>
      ) : (
        <div className="card overflow-hidden overflow-x-auto">
          <table className="w-full min-w-[480px]">
            <thead>
              <tr className="table-header">
                <th className="px-4 py-3 text-left">Período</th>
                <th className="px-4 py-3 text-center">Liquidaciones</th>
                <th className="px-4 py-3 text-right">Total Líquido</th>
                <th className="px-4 py-3 text-center">Estado</th>
                <th className="px-4 py-3 text-right">Acción</th>
              </tr>
            </thead>
            <tbody>
              {periodosConStats.map(p => (
                <tr key={p.id} className="table-row">
                  <td className="px-4 py-3">
                    <p className="text-sm font-semibold text-text-primary">
                      {monthName(p.month)} {p.year}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <p className="text-sm text-text-secondary">
                      {p.total} liquidaciones
                      {p.aprobadas > 0 && (
                        <span className="ml-1 text-xs text-primary">({p.aprobadas} aprobadas)</span>
                      )}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <p className="text-sm font-bold text-text-primary">
                      {p.totalLiquido > 0 ? formatCLP(p.totalLiquido) : '—'}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`badge ${
                      p.estado === 'abierto' ? 'bg-success/10 text-success' : 'bg-error/10 text-error'
                    }`}>
                      {p.estado}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/remuneraciones/liquidaciones/${p.id}`}
                      className="text-xs text-primary hover:underline font-medium"
                    >
                      Gestionar →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
