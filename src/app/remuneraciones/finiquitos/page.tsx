import { createClient } from '@/lib/supabase/server'
import { formatCLP } from '@/lib/utils'
import Link from 'next/link'

export default async function FiniquitosPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('user_profiles').select('company_id').eq('id', user!.id).single()

  const companyId = profile?.company_id as string

  const { data: finiquitos } = await supabase
    .schema('remu').from('finiquitos')
    .select('*, empleado:empleado_id(nombres, apellido_paterno, rut, cargo)')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Finiquitos</h1>
          <p className="text-text-secondary text-sm mt-1">{finiquitos?.length ?? 0} registros</p>
        </div>
        <Link href="/remuneraciones/finiquitos/nuevo" className="btn-primary">
          + Nuevo Finiquito
        </Link>
      </div>

      {(finiquitos ?? []).length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-text-secondary text-sm">No hay finiquitos registrados.</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="table-header">
                <th className="px-4 py-3 text-left">Trabajador</th>
                <th className="px-4 py-3 text-left">Fecha Término</th>
                <th className="px-4 py-3 text-left">Causa</th>
                <th className="px-4 py-3 text-right">Total Finiquito</th>
                <th className="px-4 py-3 text-center">Estado</th>
              </tr>
            </thead>
            <tbody>
              {(finiquitos ?? []).map(f => {
                const emp = f.empleado as unknown as {
                  nombres: string; apellido_paterno: string; rut: string; cargo: string
                } | null
                return (
                  <tr key={f.id} className="table-row">
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-text-primary">
                        {emp?.apellido_paterno}, {emp?.nombres}
                      </p>
                      <p className="text-xs text-text-disabled">{emp?.rut}</p>
                    </td>
                    <td className="px-4 py-3 text-sm text-text-secondary">
                      {new Date(f.fecha_termino).toLocaleDateString('es-CL')}
                    </td>
                    <td className="px-4 py-3 text-sm text-text-secondary">{f.causa_termino}</td>
                    <td className="px-4 py-3 text-right font-bold text-text-primary">
                      {formatCLP(f.total_finiquito)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`badge ${
                        f.estado === 'pagado'  ? 'bg-success/10 text-success' :
                        f.estado === 'firmado' ? 'bg-primary/10 text-primary' :
                        'bg-surface-high text-text-disabled'
                      }`}>
                        {f.estado}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
