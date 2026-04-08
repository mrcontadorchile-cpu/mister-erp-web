'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// ──────────────────────────────────────────────
// Constantes legales vigentes (usadas como referencia UF)
// ──────────────────────────────────────────────
const TOPE_AFP_SALUD_UF = 90.0    // vigente 2026 (DL 3500)
const TOPE_AFC_UF       = 135.2   // vigente 2026 (Ley 19.728)

// ──────────────────────────────────────────────
// Sincronizar UF + UTM desde mindicador.cl
// Guarda en BD y recalcula topes en CLP
// ──────────────────────────────────────────────
export async function sincronizarIndicadores(): Promise<{
  uf: number
  utm: number
  topeAfpSaludCLP: number
  topeAfcCLP: number
  fechaUF: string
  fechaUTM: string
}> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No autenticado')

  // Llamar mindicador.cl en paralelo
  const [resUF, resUTM] = await Promise.all([
    fetch('https://mindicador.cl/api/uf',  { cache: 'no-store' }),
    fetch('https://mindicador.cl/api/utm', { cache: 'no-store' }),
  ])

  if (!resUF.ok || !resUTM.ok) throw new Error('mindicador.cl no disponible')

  const [jsonUF, jsonUTM] = await Promise.all([resUF.json(), resUTM.json()])

  const uf  = jsonUF?.serie?.[0]?.valor  as number
  const utm = jsonUTM?.serie?.[0]?.valor as number
  const fechaUF  = jsonUF?.serie?.[0]?.fecha  as string
  const fechaUTM = jsonUTM?.serie?.[0]?.fecha as string

  if (!uf || !utm) throw new Error('Respuesta inválida de mindicador.cl')

  const now   = new Date()
  const year  = now.getFullYear()
  const month = now.getMonth() + 1

  // Fecha real de la UF (puede ser de ayer — mindicador publica al día siguiente)
  const dUF  = new Date(fechaUF)
  const dUTM = new Date(fechaUTM)

  // Topes calculados con la UF del día
  const topeAfpSaludCLP = Math.round(TOPE_AFP_SALUD_UF * uf)
  const topeAfcCLP      = Math.round(TOPE_AFC_UF * uf)

  const fuente = `mindicador.cl — ${now.toLocaleDateString('es-CL')} ${now.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}`

  // Guardar todos en una sola transacción (upserts paralelos)
  await Promise.all([
    // UF del día
    supabase.schema('remu').from('parametros_legales').upsert({
      tipo:   'UF',
      year:   dUF.getFullYear(),
      month:  dUF.getMonth() + 1,
      valor:  uf,
      fuente,
    }, { onConflict: 'tipo,year,month' }),

    // UTM del mes
    supabase.schema('remu').from('parametros_legales').upsert({
      tipo:   'UTM',
      year:   dUTM.getFullYear(),
      month:  dUTM.getMonth() + 1,
      valor:  utm,
      fuente,
    }, { onConflict: 'tipo,year,month' }),

    // Tope AFP/Salud en CLP
    supabase.schema('remu').from('parametros_legales').upsert({
      tipo:   'TOPE_AFP_SALUD_CLP',
      year,
      month,
      valor:  topeAfpSaludCLP,
      fuente: `${TOPE_AFP_SALUD_UF} UF × ${uf.toLocaleString('es-CL')} — ${fuente}`,
    }, { onConflict: 'tipo,year,month' }),

    // Tope AFC en CLP
    supabase.schema('remu').from('parametros_legales').upsert({
      tipo:   'TOPE_AFC_CLP',
      year,
      month,
      valor:  topeAfcCLP,
      fuente: `${TOPE_AFC_UF} UF × ${uf.toLocaleString('es-CL')} — ${fuente}`,
    }, { onConflict: 'tipo,year,month' }),
  ])

  revalidatePath('/remuneraciones/parametros')

  return { uf, utm, topeAfpSaludCLP, topeAfcCLP, fechaUF, fechaUTM }
}

// ──────────────────────────────────────────────
// Actualizar tasa AFP + SIS manualmente
// ──────────────────────────────────────────────
export async function actualizarTasaAfp(
  afpId: number,
  tasaTrabajador: number,
  tasaSis: number,
  fuente: string
) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No autenticado')

  const { error } = await supabase.schema('remu').from('afp').update({
    tasa_trabajador: tasaTrabajador,
    tasa_sis:        tasaSis,
  }).eq('id', afpId)

  if (error) throw new Error(error.message)

  // Registro de auditoría
  const now = new Date()
  await supabase.schema('remu').from('parametros_legales').upsert({
    tipo:       `AFP_AUDIT_ID_${afpId}`,
    year:       now.getFullYear(),
    month:      now.getMonth() + 1,
    datos_json: { afp_id: afpId, tasa_trabajador: tasaTrabajador, tasa_sis: tasaSis, fuente },
    fuente,
  }, { onConflict: 'tipo,year,month' })

  revalidatePath('/remuneraciones/parametros')
}
