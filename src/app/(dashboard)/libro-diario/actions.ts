'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

interface JournalLine {
  account_id: string
  cost_center_id: string | null
  debit: number
  credit: number
  description: string
}

export async function createJournalEntry(data: {
  date: string
  glosa: string
  lines: JournalLine[]
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('user_profiles').select('company_id').eq('id', user!.id).single()

  const companyId = profile!.company_id

  // Validar partida doble
  const totalDebit  = data.lines.reduce((s, l) => s + l.debit, 0)
  const totalCredit = data.lines.reduce((s, l) => s + l.credit, 0)
  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    return { error: 'El asiento no cuadra: debe = haber' }
  }
  if (data.lines.length < 2) {
    return { error: 'Se requieren al menos 2 líneas' }
  }

  // Obtener o crear período
  const entryDate = new Date(data.date)
  const year  = entryDate.getFullYear()
  const month = entryDate.getMonth() + 1

  let { data: period } = await supabase
    .schema('conta').from('periods')
    .select('id, status')
    .eq('company_id', companyId)
    .eq('year', year)
    .eq('month', month)
    .maybeSingle()

  if (!period) {
    const { data: newPeriod, error: pe } = await supabase
      .schema('conta').from('periods')
      .insert({ company_id: companyId, year, month, status: 'open' })
      .select('id, status')
      .single()
    if (pe) return { error: pe.message }
    period = newPeriod
  }

  if (period!.status === 'closed') {
    return { error: 'El período está cerrado. Reabre el período antes de contabilizar.' }
  }

  // Siguiente número de asiento
  const { count } = await supabase
    .schema('conta').from('journal_entries')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', companyId)
  const number = (count ?? 0) + 1

  // Crear asiento
  const { data: entry, error: ee } = await supabase
    .schema('conta').from('journal_entries')
    .insert({
      company_id: companyId,
      period_id: period!.id,
      number,
      date: data.date,
      glosa: data.glosa,
      type: 'MANUAL',
      status: 'posted',
      created_by: user!.id,
    })
    .select('id')
    .single()

  if (ee) return { error: ee.message }

  // Insertar líneas
  const { error: le } = await supabase.schema('conta').from('journal_lines').insert(
    data.lines.map(l => ({
      entry_id: entry.id,
      account_id: l.account_id,
      cost_center_id: l.cost_center_id || null,
      debit: l.debit,
      credit: l.credit,
      description: l.description || null,
    }))
  )

  if (le) return { error: le.message }

  revalidatePath('/libro-diario')
  return { success: true, entryId: entry.id }
}

export async function reverseJournalEntry(entryId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('user_profiles').select('company_id').eq('id', user!.id).single()

  // Obtener asiento original con líneas
  const { data: entry } = await supabase
    .schema('conta').from('journal_entries')
    .select('*, conta_journal_lines(*)')
    .eq('id', entryId)
    .single()

  if (!entry) return { error: 'Asiento no encontrado' }
  if (entry.status === 'reversed') return { error: 'El asiento ya está revertido' }

  const companyId = profile!.company_id
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1

  // Obtener o crear período actual
  let { data: period } = await supabase
    .schema('conta').from('periods')
    .select('id, status')
    .eq('company_id', companyId)
    .eq('year', year).eq('month', month)
    .maybeSingle()

  if (!period) {
    const { data: np } = await supabase
      .schema('conta').from('periods')
      .insert({ company_id: companyId, year, month, status: 'open' })
      .select('id, status').single()
    period = np
  }

  if (period!.status === 'closed') return { error: 'El período actual está cerrado' }

  const { count } = await supabase
    .schema('conta').from('journal_entries')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', companyId)
  const number = (count ?? 0) + 1

  const { data: reversal, error: re } = await supabase
    .schema('conta').from('journal_entries')
    .insert({
      company_id: companyId,
      period_id: period!.id,
      number,
      date: now.toISOString().split('T')[0],
      glosa: `REVERSO: ${entry.glosa}`,
      type: 'MANUAL',
      status: 'posted',
      created_by: user!.id,
      source_id: entryId,
    })
    .select('id').single()

  if (re) return { error: re.message }

  const lines = (entry.conta_journal_lines ?? []) as { account_id: string; cost_center_id: string | null; debit: number; credit: number; description: string | null }[]
  await supabase.schema('conta').from('journal_lines').insert(
    lines.map(l => ({
      entry_id: reversal.id,
      account_id: l.account_id,
      cost_center_id: l.cost_center_id,
      debit: l.credit,
      credit: l.debit,
      description: l.description,
    }))
  )

  // Marcar original como revertido
  await supabase.schema('conta').from('journal_entries')
    .update({ status: 'reversed' }).eq('id', entryId)

  revalidatePath('/libro-diario')
  return { success: true }
}
