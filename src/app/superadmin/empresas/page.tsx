import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { FEATURE_LABELS } from '@/types/database'

export default async function EmpresasPage() {
  const supabase = await createClient()
  const { data: companies } = await supabase.rpc('get_all_companies_admin')

  type CompanyRow = {
    id: string; name: string; rut: string; is_active: boolean
    created_at: string; features: string[]; member_count: number
  }
  const list = (companies ?? []) as CompanyRow[]

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Empresas clientes</h1>
          <p className="text-text-secondary text-sm mt-1">{list.length} empresas registradas</p>
        </div>
        <Link href="/superadmin/empresas/nueva"
          className="btn-primary flex items-center gap-2 text-sm">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nueva empresa
        </Link>
      </div>

      <div className="space-y-3">
        {list.map(c => (
          <Link key={c.id} href={`/superadmin/empresas/${c.id}`}
            className="block card p-5 hover:border-primary/30 transition-colors group">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-semibold text-text-primary group-hover:text-primary transition-colors">
                    {c.name}
                  </p>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                    c.is_active
                      ? 'bg-success/10 text-success border border-success/20'
                      : 'bg-error/10 text-error border border-error/20'
                  }`}>
                    {c.is_active ? 'Activa' : 'Inactiva'}
                  </span>
                </div>
                <p className="text-xs text-text-disabled font-mono">{c.rut}</p>
              </div>

              <div className="flex flex-col items-end gap-2 shrink-0">
                <div className="flex gap-1.5 flex-wrap justify-end">
                  {(c.features ?? []).map(f => (
                    <span key={f} className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                      {FEATURE_LABELS[f as keyof typeof FEATURE_LABELS]?.icon} {FEATURE_LABELS[f as keyof typeof FEATURE_LABELS]?.label ?? f}
                    </span>
                  ))}
                  {(c.features ?? []).length === 0 && (
                    <span className="text-[10px] text-text-disabled italic">Sin módulos</span>
                  )}
                </div>
                <p className="text-[10px] text-text-disabled">
                  {c.member_count} usuario{c.member_count !== 1 ? 's' : ''} ·{' '}
                  {new Date(c.created_at).toLocaleDateString('es-CL')}
                </p>
              </div>
            </div>
          </Link>
        ))}

        {list.length === 0 && (
          <div className="text-center py-16">
            <p className="text-4xl mb-4">🏢</p>
            <p className="text-text-secondary text-sm">No hay empresas aún. Crea la primera.</p>
          </div>
        )}
      </div>
    </div>
  )
}
