'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

type ProcesarResult =
  | { ok: true; journal_entry_id: string; accion: string }
  | { ok: false; error: string }

async function callProcesarBorrador(params: {
  p_borrador_id: string
  p_accion: string
  p_debe_code?: string
  p_haber_code?: string
}): Promise<ProcesarResult> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase.rpc('procesar_borrador', params)

    if (error) {
      // Extraer mensaje limpio del error de Postgres
      const msg = error.message
        .replace(/^ERROR:\s*/i, '')
        .replace(/\s*CONTEXT:[\s\S]*$/, '')
        .trim()
      return { ok: false, error: msg }
    }

    revalidatePath('/contabilidad/validaciones')
    return data as { ok: true; journal_entry_id: string; accion: string }

  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Error inesperado al procesar el borrador',
    }
  }
}

export async function aprobarBorrador(borradorId: string): Promise<ProcesarResult> {
  return callProcesarBorrador({
    p_borrador_id: borradorId,
    p_accion: 'aprobar',
  })
}

export async function corregirBorrador(
  borradorId: string,
  debeCode: string,
  haberCode: string
): Promise<ProcesarResult> {
  return callProcesarBorrador({
    p_borrador_id: borradorId,
    p_accion: 'corregir',
    p_debe_code: debeCode,
    p_haber_code: haberCode,
  })
}

export async function rechazarBorrador(borradorId: string): Promise<ProcesarResult> {
  return callProcesarBorrador({
    p_borrador_id: borradorId,
    p_accion: 'rechazar',
  })
}
