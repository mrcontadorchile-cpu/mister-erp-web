import { createClient } from '@/lib/supabase/server'
import { crearPeriodo } from './actions'
import { PeriodosTable } from './PeriodosClient'

const MESES = ['', 'Enero','Febrero','Marzo','Abril','Mayo','Junio',
                'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

export default async function PeriodosPage() {
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

  // Contar liquidaciones por período
  const periodosConConteo = await Promise.all(
    (periodos ?? []).map(async p => {
      const { count } = await supabase
        .schema('remu').from('liquidaciones')
        .select('*', { count: 'exact', head: true })
        .eq('periodo_id', p.id)
      return { ...p, liquidaciones_count: count ?? 0 }
    })
  )

  const now = new Date()
  const currentYear  = now.getFullYear()
  const currentMonth = now.getMonth() + 1

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Períodos</h1>
          <p className="text-text-secondary text-sm mt-1">Gestión de períodos de remuneración</p>
        </div>
      </div>

      {/* Crear período */}
      <div className="card p-6 mb-6">
        <h2 className="text-sm font-semibold text-text-primary mb-4">Crear Nuevo Período</h2>
        <form action={crearPeriodo} className="flex gap-3 items-end">
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">Año</label>
            <select name="year" className="input w-28" defaultValue={currentYear}>
              {[currentYear - 1, currentYear, currentYear + 1].map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">Mes</label>
            <select name="month" className="input w-40" defaultValue={currentMonth}>
              {MESES.slice(1).map((mes, i) => (
                <option key={i + 1} value={i + 1}>{mes}</option>
              ))}
            </select>
          </div>
          <button type="submit" className="btn-primary">
            Crear Período
          </button>
        </form>
      </div>

      {/* Lista de períodos */}
      {periodosConConteo.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-text-secondary text-sm">No hay períodos creados aún.</p>
          <p className="text-text-disabled text-xs mt-1">Crea el primer período para comenzar a liquidar sueldos.</p>
        </div>
      ) : (
        <PeriodosTable periodos={periodosConConteo} />
      )}
    </div>
  )
}
