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

export interface BudgetLine {
  account_id:     string
  cost_center_id: string | null
  month:          number      // 1-12
  amount:         number
}

export interface Budget {
  id:          string
  name:        string
  description: string | null
  fiscal_year: number
  status:      'draft' | 'approved' | 'active' | 'closed'
  created_at:  string
  updated_at:  string
}

// ── Listar ───────────────────────────────────────────────────

export async function listBudgets(): Promise<Budget[]> {
  const ctx = await getCtx()
  if (!ctx) return []
  const { data } = await ctx.supabase
    .schema('conta').from('budgets')
    .select('id, name, description, fiscal_year, status, created_at, updated_at')
    .eq('company_id', ctx.companyId)
    .order('fiscal_year', { ascending: false })
    .order('created_at', { ascending: false })
  return (data ?? []) as Budget[]
}

// ── Obtener uno con líneas ────────────────────────────────────

export async function getBudget(id: string) {
  const ctx = await getCtx()
  if (!ctx) return null
  const { data } = await ctx.supabase
    .schema('conta').from('budgets')
    .select('id, name, description, fiscal_year, status, created_at, updated_at')
    .eq('id', id)
    .eq('company_id', ctx.companyId)
    .single()
  return data as Budget | null
}

export async function getBudgetLines(budgetId: string): Promise<BudgetLine[]> {
  const ctx = await getCtx()
  if (!ctx) return []
  const { data } = await ctx.supabase
    .schema('conta').from('budget_lines')
    .select('account_id, cost_center_id, month, amount')
    .eq('budget_id', budgetId)
    .order('month')
  return (data ?? []) as BudgetLine[]
}

// ── Crear ─────────────────────────────────────────────────────

export async function createBudget(
  name:        string,
  fiscal_year: number,
  description: string,
  lines:       BudgetLine[],
): Promise<{ ok: boolean; id?: string; error?: string }> {
  const ctx = await getCtx()
  if (!ctx) return { ok: false, error: 'No autenticado' }

  // Crear presupuesto maestro
  const { data: budget, error: budgetErr } = await ctx.supabase
    .schema('conta').from('budgets')
    .insert({
      company_id:  ctx.companyId,
      created_by:  ctx.userId,
      name:        name.trim(),
      description: description.trim() || null,
      fiscal_year,
      status:      'draft',
    })
    .select('id')
    .single()

  if (budgetErr || !budget) return { ok: false, error: budgetErr?.message ?? 'Error al crear presupuesto' }

  // Insertar líneas (ignorar las con amount = 0)
  const validLines = lines.filter(l => l.amount > 0)
  if (validLines.length > 0) {
    const { error: linesErr } = await ctx.supabase
      .schema('conta').from('budget_lines')
      .insert(
        validLines.map(l => ({
          budget_id:      budget.id,
          account_id:     l.account_id,
          cost_center_id: l.cost_center_id || null,
          month:          l.month,
          amount:         l.amount,
        }))
      )
    if (linesErr) {
      // Limpiar presupuesto huérfano
      await ctx.supabase.schema('conta').from('budgets').delete().eq('id', budget.id)
      return { ok: false, error: linesErr.message }
    }
  }

  revalidatePath('/gestion/presupuestos')
  return { ok: true, id: budget.id }
}

// ── Actualizar líneas ─────────────────────────────────────────

export async function upsertBudgetLines(
  budgetId: string,
  lines: BudgetLine[],
): Promise<{ ok: boolean; error?: string }> {
  const ctx = await getCtx()
  if (!ctx) return { ok: false, error: 'No autenticado' }

  // Verificar ownership
  const { data: budget } = await ctx.supabase
    .schema('conta').from('budgets')
    .select('id, status')
    .eq('id', budgetId)
    .eq('company_id', ctx.companyId)
    .single()

  if (!budget) return { ok: false, error: 'Presupuesto no encontrado' }
  if (budget.status === 'closed') return { ok: false, error: 'El presupuesto está cerrado' }

  // Borrar todas las líneas y reinsertar (upsert completo)
  await ctx.supabase.schema('conta').from('budget_lines').delete().eq('budget_id', budgetId)

  const validLines = lines.filter(l => l.amount > 0)
  if (validLines.length > 0) {
    const { error } = await ctx.supabase
      .schema('conta').from('budget_lines')
      .insert(
        validLines.map(l => ({
          budget_id:      budgetId,
          account_id:     l.account_id,
          cost_center_id: l.cost_center_id || null,
          month:          l.month,
          amount:         l.amount,
        }))
      )
    if (error) return { ok: false, error: error.message }
  }

  revalidatePath(`/gestion/presupuestos/${budgetId}`)
  revalidatePath('/gestion/control')
  return { ok: true }
}

// ── Cambiar estado ────────────────────────────────────────────

export async function updateBudgetStatus(
  budgetId: string,
  status: 'approved' | 'active' | 'closed' | 'draft',
): Promise<{ ok: boolean; error?: string }> {
  const ctx = await getCtx()
  if (!ctx) return { ok: false, error: 'No autenticado' }

  const patch: Record<string, unknown> = { status }
  if (status === 'approved') {
    patch.approved_by = ctx.userId
    patch.approved_at = new Date().toISOString()
  }

  const { error } = await ctx.supabase
    .schema('conta').from('budgets')
    .update(patch)
    .eq('id', budgetId)
    .eq('company_id', ctx.companyId)

  if (error) return { ok: false, error: error.message }
  revalidatePath('/gestion/presupuestos')
  revalidatePath(`/gestion/presupuestos/${budgetId}`)
  return { ok: true }
}

// ── Actualizar nombre/descripción ─────────────────────────────

export async function updateBudgetMeta(
  budgetId:    string,
  name:        string,
  description: string,
): Promise<{ ok: boolean; error?: string }> {
  const ctx = await getCtx()
  if (!ctx) return { ok: false, error: 'No autenticado' }

  const { error } = await ctx.supabase
    .schema('conta').from('budgets')
    .update({ name: name.trim(), description: description.trim() || null })
    .eq('id', budgetId)
    .eq('company_id', ctx.companyId)

  if (error) return { ok: false, error: error.message }
  revalidatePath(`/gestion/presupuestos/${budgetId}`)
  revalidatePath('/gestion/presupuestos')
  return { ok: true }
}

// ── Eliminar ──────────────────────────────────────────────────

export async function deleteBudget(
  budgetId: string,
): Promise<{ ok: boolean; error?: string }> {
  const ctx = await getCtx()
  if (!ctx) return { ok: false, error: 'No autenticado' }

  const { error } = await ctx.supabase
    .schema('conta').from('budgets')
    .delete()
    .eq('id', budgetId)
    .eq('company_id', ctx.companyId)

  if (error) return { ok: false, error: error.message }
  revalidatePath('/gestion/presupuestos')
  return { ok: true }
}
