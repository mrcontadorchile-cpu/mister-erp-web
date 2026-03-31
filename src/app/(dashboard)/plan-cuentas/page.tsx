import { createClient } from '@/lib/supabase/server'
import type { Account } from '@/types/database'
import { PlanCuentasClient } from './PlanCuentasClient'

export default async function PlanCuentasPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('user_profiles').select('company_id').eq('id', user!.id).single()

  const { data: accounts } = await supabase
    .from('conta.accounts')
    .select('*')
    .eq('company_id', profile?.company_id)
    .order('code')

  return <PlanCuentasClient accounts={(accounts ?? []) as Account[]} />
}
