import { createClient } from '@/lib/supabase/server'
import type { Period } from '@/types/database'
import { PeriodosClient } from './PeriodosClient'

export default async function PeriodosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('user_profiles').select('company_id').eq('id', user!.id).single()

  const now = new Date()
  const currentYear = now.getFullYear()

  const { data: periods } = await supabase
    .schema('conta').from('periods')
    .select('*')
    .eq('company_id', profile?.company_id)
    .order('year', { ascending: false })
    .order('month', { ascending: false })

  return (
    <PeriodosClient
      periods={(periods ?? []) as Period[]}
      currentYear={currentYear}
    />
  )
}
