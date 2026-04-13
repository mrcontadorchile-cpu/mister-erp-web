'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function aprobarBorrador(borradorId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('procesar_borrador', {
    p_borrador_id: borradorId,
    p_accion: 'aprobar',
  })
  if (error) throw new Error(error.message)
  revalidatePath('/contabilidad/validaciones')
  return data as { ok: boolean; journal_entry_id: string }
}

export async function corregirBorrador(
  borradorId: string,
  debeCode: string,
  haberCode: string
) {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('procesar_borrador', {
    p_borrador_id: borradorId,
    p_accion: 'corregir',
    p_debe_code: debeCode,
    p_haber_code: haberCode,
  })
  if (error) throw new Error(error.message)
  revalidatePath('/contabilidad/validaciones')
  return data as { ok: boolean; journal_entry_id: string }
}

export async function rechazarBorrador(borradorId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('procesar_borrador', {
    p_borrador_id: borradorId,
    p_accion: 'rechazar',
  })
  if (error) throw new Error(error.message)
  revalidatePath('/contabilidad/validaciones')
  return data as { ok: boolean }
}
