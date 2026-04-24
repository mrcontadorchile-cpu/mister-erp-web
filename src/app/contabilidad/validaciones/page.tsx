import { createClient } from '@/lib/supabase/server'
import { ValidacionesClient } from './ValidacionesClient'
import type { AsientoBorrador } from '@/types/database'

export const metadata = { title: 'Validaciones IA — Contabilidad' }

export default async function ValidacionesPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('user_profiles').select('company_id').eq('id', user!.id).single()

  const companyId = profile?.company_id as string

  // Las 3 queries de datos en paralelo (antes eran secuenciales: ~500ms → ~200ms)
  const [
    { data: pendientes },
    { data: historial },
    { data: cuentas },
  ] = await Promise.all([
    supabase
      .schema('conta')
      .from('asientos_borrador')
      .select('*')
      .eq('company_id', companyId)
      .eq('status', 'pendiente')
      .order('created_at', { ascending: false }),

    supabase
      .schema('conta')
      .from('asientos_borrador')
      .select('*')
      .eq('company_id', companyId)
      .neq('status', 'pendiente')
      .order('reviewed_at', { ascending: false })
      .limit(50),

    supabase
      .schema('conta')
      .from('accounts')
      .select('id, code, name')
      .eq('company_id', companyId)
      .eq('allows_entry', true)
      .eq('active', true)
      .order('code'),
  ])

  return (
    <ValidacionesClient
      pendientes={(pendientes ?? []) as AsientoBorrador[]}
      historial={(historial ?? []) as AsientoBorrador[]}
      cuentas={cuentas ?? []}
    />
  )
}
