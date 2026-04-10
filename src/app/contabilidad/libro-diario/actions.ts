'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// ── Tipos públicos ────────────────────────────────────────────────────────────

export interface OpenDoc {
  doc_type:     string
  doc_number:   string
  date:         string
  glosa:        string
  entry_number: number
  entry_id:     string
  amount:       number   // monto original (absoluto)
  settled:      number   // imputado
  pending:      number   // pendiente
}

interface JournalLine {
  account_id:     string
  cost_center_id: string | null
  auxiliary_id:   string | null
  doc_type:       string | null
  doc_number:     string | null
  ref_doc_type:   string | null   // referencia a doc previo
  ref_doc_number: string | null   // referencia a doc previo
  debit:          number
  credit:         number
  description:    string
}

// ── getOpenDocuments ──────────────────────────────────────────────────────────
// Retorna todos los documentos abiertos (con saldo pendiente) de un auxiliar.
// Llamada desde el formulario de nuevo asiento para mostrar el selector.

export async function getOpenDocuments(auxiliaryId: string): Promise<OpenDoc[]> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []
    const { data: profile } = await supabase
      .from('user_profiles').select('company_id').eq('id', user.id).single()
    if (!profile) return []

    // Usar la vista open_documents creada en la migración
    const { data } = await supabase
      .schema('conta').from('open_documents')
      .select('doc_type, doc_number, doc_date, glosa, entry_number, entry_id, amount, settled, pending')
      .eq('company_id', profile.company_id)
      .eq('auxiliary_id', auxiliaryId)
      .order('doc_date', { ascending: false })

    return (data ?? []).map((r: any) => ({
      doc_type:     r.doc_type,
      doc_number:   r.doc_number,
      date:         r.doc_date ?? '',
      glosa:        r.glosa ?? '',
      entry_number: r.entry_number ?? 0,
      entry_id:     r.entry_id     ?? '',
      amount:       Number(r.amount  ?? 0),
      settled:      Number(r.settled ?? 0),
      pending:      Number(r.pending ?? 0),
    }))
  } catch {
    return []
  }
}

// ── createJournalEntry ────────────────────────────────────────────────────────

export async function createJournalEntry(data: {
  date: string
  glosa: string
  lines: JournalLine[]
}) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user) return { error: 'Sesión expirada. Vuelve a iniciar sesión.' }

    const { data: profile, error: profileErr } = await supabase
      .from('user_profiles').select('company_id').eq('id', user.id).single()
    if (profileErr || !profile) return { error: 'No se encontró el perfil del usuario.' }

    const companyId = profile.company_id

    // Validar partida doble
    const totalDebit  = data.lines.reduce((s, l) => s + l.debit, 0)
    const totalCredit = data.lines.reduce((s, l) => s + l.credit, 0)
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      return { error: `El asiento no cuadra: DEBE ${totalDebit.toFixed(0)} ≠ HABER ${totalCredit.toFixed(0)}` }
    }
    if (data.lines.filter(l => l.account_id).length < 2) {
      return { error: 'Se requieren al menos 2 líneas con cuenta seleccionada.' }
    }

    // ── Validar unicidad de documentos nuevos ─────────────────────────────────
    // Un (auxiliar, tipo_doc, n°_doc) sin referencia solo puede existir una vez.
    const newDocLines = data.lines.filter(
      l => l.account_id && l.auxiliary_id && l.doc_type && l.doc_number && !l.ref_doc_type
    )
    for (const line of newDocLines) {
      const { count } = await supabase
        .schema('conta').from('open_documents')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .eq('auxiliary_id', line.auxiliary_id!)
        .eq('doc_type', line.doc_type!)
        .eq('doc_number', line.doc_number!)

      if ((count ?? 0) > 0) {
        return {
          error: `El documento tipo "${line.doc_type}" N°${line.doc_number} ya existe para este auxiliar. ` +
                 `Si quieres imputarlo, usa el campo "Referencia" en lugar de crear uno nuevo.`,
        }
      }
    }

    // ── Período ───────────────────────────────────────────────────────────────
    const [yearStr, monthStr] = data.date.split('-')
    const year  = parseInt(yearStr)
    const month = parseInt(monthStr)

    let { data: period, error: periodErr } = await supabase
      .schema('conta').from('periods')
      .select('id, status')
      .eq('company_id', companyId)
      .eq('year', year)
      .eq('month', month)
      .maybeSingle()

    if (periodErr) return { error: `Error buscando período: ${periodErr.message}` }

    if (!period) {
      const { data: newPeriod, error: pe } = await supabase
        .schema('conta').from('periods')
        .insert({ company_id: companyId, year, month, status: 'open' })
        .select('id, status')
        .single()
      if (pe) return { error: `Error creando período: ${pe.message}` }
      period = newPeriod
    }

    if (period!.status === 'closed') {
      return { error: `El período ${month}/${year} está cerrado. Reabre el período antes de contabilizar.` }
    }

    // ── Número de asiento ─────────────────────────────────────────────────────
    const { count, error: countErr } = await supabase
      .schema('conta').from('journal_entries')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', companyId)
    if (countErr) return { error: `Error calculando número: ${countErr.message}` }
    const number = (count ?? 0) + 1

    // ── Crear asiento ─────────────────────────────────────────────────────────
    const { data: entry, error: ee } = await supabase
      .schema('conta').from('journal_entries')
      .insert({
        company_id: companyId,
        period_id:  period!.id,
        number,
        date:       data.date,
        glosa:      data.glosa,
        type:       'MANUAL',
        status:     'posted',
        created_by: user.id,
      })
      .select('id')
      .single()

    if (ee) return { error: `Error creando asiento: ${ee.message}` }

    // ── Insertar líneas ───────────────────────────────────────────────────────
    const lineRows = data.lines
      .filter(l => l.account_id)
      .map(l => ({
        entry_id:       entry.id,
        account_id:     l.account_id,
        cost_center_id: l.cost_center_id  || null,
        auxiliary_id:   l.auxiliary_id    || null,
        doc_type:       l.doc_type        || null,
        doc_number:     l.doc_number      || null,
        ref_doc_type:   l.ref_doc_type    || null,
        ref_doc_number: l.ref_doc_number  || null,
        debit:          l.debit,
        credit:         l.credit,
        description:    l.description     || null,
      }))

    const { error: le } = await supabase
      .schema('conta').from('journal_lines')
      .insert(lineRows)

    if (le) {
      await supabase.schema('conta').from('journal_entries').delete().eq('id', entry.id)
      return { error: `Error guardando líneas: ${le.message}` }
    }

    revalidatePath('/contabilidad/libro-diario')
    revalidatePath('/contabilidad/libro-mayor')
    revalidatePath('/contabilidad/auxiliares')
    return { success: true, entryId: entry.id }

  } catch (e: any) {
    console.error('[createJournalEntry] excepción:', e)
    return { error: `Error inesperado: ${e?.message ?? String(e)}` }
  }
}

// ── reverseJournalEntry ───────────────────────────────────────────────────────

export async function reverseJournalEntry(entryId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('user_profiles').select('company_id').eq('id', user!.id).single()

  const { data: entry } = await supabase
    .schema('conta').from('journal_entries')
    .select('*, journal_lines(*)')
    .eq('id', entryId)
    .single()

  if (!entry) return { error: 'Asiento no encontrado' }
  if (entry.status === 'reversed') return { error: 'El asiento ya está revertido' }

  const companyId = profile!.company_id
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1

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

  const lines = (entry.journal_lines ?? []) as {
    account_id: string; cost_center_id: string | null
    debit: number; credit: number; description: string | null
  }[]

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

  await supabase.schema('conta').from('journal_entries')
    .update({ status: 'reversed' }).eq('id', entryId)

  revalidatePath('/contabilidad/libro-diario')
  return { success: true }
}
