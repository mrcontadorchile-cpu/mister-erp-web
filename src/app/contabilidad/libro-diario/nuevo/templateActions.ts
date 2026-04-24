'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

async function getCtx() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase
    .from('user_profiles').select('company_id').eq('id', user.id).single()
  if (!profile?.company_id) return null
  return { supabase, userId: user.id, companyId: profile.company_id as string }
}

export interface TemplateLine {
  account_id:     string
  cost_center_id: string | null
  auxiliary_id:   string | null
  doc_type:       string | null
  debit:          number
  credit:         number
  description:    string
}

export interface Template {
  id:         string
  name:       string
  glosa:      string
  lines:      TemplateLine[]
  created_at: string
}

export async function listTemplates(): Promise<Template[]> {
  const ctx = await getCtx()
  if (!ctx) return []
  const { data } = await ctx.supabase
    .schema('conta').from('asiento_templates')
    .select('id, name, glosa, lines, created_at')
    .eq('company_id', ctx.companyId)
    .order('name')
  return (data ?? []) as Template[]
}

export async function saveTemplate(
  name:  string,
  glosa: string,
  lines: TemplateLine[],
): Promise<{ ok: boolean; error?: string }> {
  const ctx = await getCtx()
  if (!ctx) return { ok: false, error: 'No autenticado' }

  const { error } = await ctx.supabase
    .schema('conta').from('asiento_templates')
    .insert({
      company_id: ctx.companyId,
      created_by: ctx.userId,
      name:  name.trim(),
      glosa: glosa.trim(),
      lines,
    })

  if (error) return { ok: false, error: error.message }
  revalidatePath('/contabilidad/libro-diario/nuevo')
  return { ok: true }
}

export async function deleteTemplate(id: string): Promise<{ ok: boolean; error?: string }> {
  const ctx = await getCtx()
  if (!ctx) return { ok: false, error: 'No autenticado' }

  const { error } = await ctx.supabase
    .schema('conta').from('asiento_templates')
    .delete()
    .eq('id', id)
    .eq('company_id', ctx.companyId)

  if (error) return { ok: false, error: error.message }
  revalidatePath('/contabilidad/libro-diario/nuevo')
  return { ok: true }
}
