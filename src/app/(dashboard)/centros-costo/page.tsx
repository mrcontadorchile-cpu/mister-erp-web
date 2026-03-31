import { createClient } from '@/lib/supabase/server'

export default async function CentrosCostoPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile }  = await supabase
    .from('user_profiles').select('company_id').eq('id', user!.id).single()

  const { data: items } = await supabase
    .from('conta.cost_centers')
    .select('*')
    .eq('company_id', profile?.company_id)
    .order('code')

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Centros de Costo</h1>
          <p className="text-text-secondary text-sm mt-1">
            {items?.length ?? 0} centros registrados
          </p>
        </div>
      </div>

      {!items?.length ? (
        <div className="card p-12 text-center">
          <p className="text-text-disabled">Sin centros de costo configurados</p>
          <p className="text-text-disabled text-sm mt-2">
            Crea centros de costo para segmentar ingresos y gastos por área o proyecto
          </p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="table-header">
                <th className="px-5 py-3 text-left w-24">Código</th>
                <th className="px-5 py-3 text-left">Nombre</th>
                <th className="px-5 py-3 text-center w-24">Estado</th>
              </tr>
            </thead>
            <tbody>
              {items.map(cc => (
                <tr key={cc.id} className="table-row">
                  <td className="px-5 py-3 font-mono text-info text-xs">{cc.code}</td>
                  <td className="px-5 py-3 text-text-primary">{cc.name}</td>
                  <td className="px-5 py-3 text-center">
                    <span className={`badge ${cc.active ? 'bg-success/10 text-success' : 'bg-surface-high text-text-disabled'}`}>
                      {cc.active ? 'Activo' : 'Inactivo'}
                    </span>
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
