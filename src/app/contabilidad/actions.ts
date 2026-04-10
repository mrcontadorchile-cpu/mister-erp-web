'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function switchCompany(companyId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No autenticado')

  // Verify the user is actually a member of this company
  const { count } = await supabase
    .from('user_company_memberships')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('company_id', companyId)
    .eq('status', 'active')

  if (!count || count === 0) throw new Error('Sin acceso a esta empresa')

  await supabase
    .from('user_profiles')
    .update({ company_id: companyId })
    .eq('id', user.id)

  revalidatePath('/contabilidad', 'layout')
}
