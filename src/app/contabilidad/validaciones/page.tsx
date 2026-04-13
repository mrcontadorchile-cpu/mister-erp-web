import { createClient } from '@/lib/supabase/server'
import { ValidacionesClient } from './ValidacionesClient'
import type { AsientoBorrador } from '@/types/database'

export const metadata = { title: 'Validaciones IA — Contabilidad' }

export default async function ValidacionesPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('company_id')
    .eq('id', user!.id)
    .single()

  const companyId = profile?.company_id as string

  // Borradores pendientes
  const { data: pendientes } = await supabase
    .schema('conta')
    .from('asientos_borrador')
    .select('*')
    .eq('company_id', companyId)
    .eq('status', 'pendiente')
    .order('created_at', { ascending: false })

  // Historial reciente (últimos 50)
  const { data: historial } = await supabase
    .schema('conta')
    .from('asientos_borrador')
    .select('*')
    .eq('company_id', companyId)
    .neq('status', 'pendiente')
    .order('reviewed_at', { ascending: false })
    .limit(50)

  // Cuentas de detalle (para el corrector)
  const { data: cuentas } = await supabase
    .schema('conta')
    .from('accounts')
    .select('id, code, name')
    .eq('company_id', companyId)
    .eq('allows_entry', true)
    .eq('active', true)
    .order('code')

  return (
    <ValidacionesClient
      pendientes={(pendientes ?? []) as AsientoBorrador[]}
      historial={(historial ?? []) as AsientoBorrador[]}
      cuentas={cuentas ?? []}
    />
  )
}
