import { createClient } from '@/lib/supabase/server'
import { accountTypeColor, accountTypeLabel } from '@/lib/utils'
import type { Account, AccountType } from '@/types/database'

export default async function PlanCuentasPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile }  = await supabase
    .from('user_profiles').select('company_id').eq('id', user!.id).single()

  const { data: accounts } = await supabase
    .from('conta.accounts')
    .select('*')
    .eq('company_id', profile?.company_id)
    .eq('active', true)
    .order('code')

  const byType = groupByType(accounts ?? [])
  const types: AccountType[] = ['ACTIVO', 'PASIVO', 'PATRIMONIO', 'INGRESO', 'EGRESO']

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Plan de Cuentas</h1>
          <p className="text-text-secondary text-sm mt-1">
            {accounts?.length ?? 0} cuentas activas
          </p>
        </div>
      </div>

      {/* Filtros por tipo */}
      <div className="flex gap-2 flex-wrap mb-6">
        {types.map(t => (
          <span
            key={t}
            className="px-3 py-1 rounded-full text-xs font-medium border"
            style={{
              color: accountTypeColor(t),
              borderColor: `${accountTypeColor(t)}40`,
              backgroundColor: `${accountTypeColor(t)}0D`,
            }}
          >
            {accountTypeLabel(t)} ({byType[t]?.length ?? 0})
          </span>
        ))}
      </div>

      {/* Tablas por tipo */}
      <div className="space-y-6">
        {types.map(type => {
          const rows = byType[type] ?? []
          if (!rows.length) return null
          const color = accountTypeColor(type)
          return (
            <div key={type} className="card overflow-hidden">
              <div
                className="px-5 py-3 border-b border-border flex items-center gap-2"
                style={{ borderLeftColor: color, borderLeftWidth: 3 }}
              >
                <span className="text-sm font-bold" style={{ color }}>
                  {accountTypeLabel(type)}
                </span>
                <span className="text-text-disabled text-xs">— {rows.length} cuentas</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="table-header">
                      <th className="px-4 py-2.5 text-left">Código</th>
                      <th className="px-4 py-2.5 text-left">Nombre</th>
                      <th className="px-4 py-2.5 text-center">Nivel</th>
                      <th className="px-4 py-2.5 text-center">Naturaleza</th>
                      <th className="px-4 py-2.5 text-center">Movimientos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(acc => (
                      <tr key={acc.id} className="table-row">
                        <td className="px-4 py-2.5">
                          <span
                            className="font-mono text-xs"
                            style={{ color, paddingLeft: `${(acc.level - 1) * 12}px` }}
                          >
                            {acc.code}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          <span
                            className={acc.level <= 2 ? 'font-semibold text-text-primary' : 'text-text-secondary'}
                            style={{ paddingLeft: `${(acc.level - 1) * 12}px` }}
                          >
                            {acc.name}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <span className="badge bg-surface-high text-text-secondary">
                            N{acc.level}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <span className={`badge ${
                            acc.nature === 'DEUDOR'
                              ? 'bg-info/10 text-info'
                              : 'bg-warning/10 text-warning'
                          }`}>
                            {acc.nature}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          {acc.allows_entry ? (
                            <span className="badge bg-success/10 text-success">Sí</span>
                          ) : (
                            <span className="badge bg-surface-high text-text-disabled">No</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function groupByType(accounts: Account[]): Record<string, Account[]> {
  return accounts.reduce((acc, a) => {
    if (!acc[a.type]) acc[a.type] = []
    acc[a.type].push(a)
    return acc
  }, {} as Record<string, Account[]>)
}
