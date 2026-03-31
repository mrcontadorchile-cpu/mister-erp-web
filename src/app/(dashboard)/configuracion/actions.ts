'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// ── Autenticación SII desde el servidor Vercel ────────────────
// (IPs distintas a Supabase/Deno Deploy — puede no estar bloqueada por SII)

function normalizeRut(rut: string): string {
  return rut.replace(/\./g, '').trim()
}

async function getSiiToken(rut: string, clave: string): Promise<string> {
  const rutNorm = normalizeRut(rut)
  const lastDash = rutNorm.lastIndexOf('-')
  const rutNum = rutNorm.substring(0, lastDash)
  const dv = rutNorm.substring(lastDash + 1).toUpperCase()

  const LOGIN_URL = 'https://zeusr.sii.cl/AUT2000/CAutenticacion/autenticar'

  const BROWSER_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'es-CL,es;q=0.9,en-US;q=0.8,en;q=0.7',
    'Accept-Encoding': 'gzip, deflate, br',
    'Cache-Control': 'max-age=0',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'same-origin',
    'Sec-Fetch-User': '?1',
  }

  // Paso 1: GET login page para obtener cookies de sesión
  let sessionCookies = ''
  try {
    const getRes = await fetch(LOGIN_URL, {
      method: 'GET',
      headers: BROWSER_HEADERS,
      redirect: 'follow',
    })
    const raw = getRes.headers.get('set-cookie') ?? ''
    // Extraer pares nombre=valor de cada cookie
    sessionCookies = raw
      .split(/,(?=[A-Za-z_-]+=)/)
      .map(c => c.split(';')[0].trim())
      .filter(Boolean)
      .join('; ')
  } catch (_) { /* ignorar si falla el GET previo */ }

  // Paso 2: POST credenciales
  const formData = new URLSearchParams({
    rutcntr: rutNum,
    dvcntr: dv,
    clave,
    referencia: 'https://www.sii.cl/',
    dummy: '',
  })

  const postRes = await fetch(LOGIN_URL, {
    method: 'POST',
    headers: {
      ...BROWSER_HEADERS,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Origin': 'https://zeusr.sii.cl',
      'Referer': LOGIN_URL,
      ...(sessionCookies ? { Cookie: sessionCookies } : {}),
    },
    body: formData.toString(),
    redirect: 'manual',
  })

  // Buscar TOKEN en Set-Cookie
  const setCookieHeader = postRes.headers.get('set-cookie') ?? ''
  const tokenMatch = setCookieHeader.match(/TOKEN=([^;,\s]+)/)
  if (tokenMatch) return tokenMatch[1]

  // Buscar token en Location (algunos flujos lo pasan en la URL)
  const location = postRes.headers.get('location') ?? ''
  const tokenInUrl = location.match(/[?&][Tt]oken=([^&\s]+)/)
  if (tokenInUrl) return tokenInUrl[1]

  // Error — leer respuesta para diagnóstico
  let bodySnippet = ''
  try {
    bodySnippet = (await postRes.text())
      .substring(0, 500)
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  } catch (_) { /* ignorar */ }

  throw new Error(
    `RUT/Clave incorrectos o SII no disponible (status ${postRes.status}). ` +
    (bodySnippet ? `Respuesta SII: ${bodySnippet}` : '')
  )
}

export async function updateCompany(data: {
  name: string
  rut: string
  address: string
  commune: string
  city: string
  region: string
  phone: string
  email: string
  giro: string
  activity_code: string
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('user_profiles').select('company_id').eq('id', user!.id).single()

  const { error } = await supabase
    .from('companies')
    .update(data)
    .eq('id', profile!.company_id)

  if (error) return { error: error.message }
  revalidatePath('/configuracion')
  return { success: true }
}

export async function saveSiiConfig(data: {
  sii_rut: string
  sii_password: string
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('user_profiles').select('company_id').eq('id', user!.id).single()

  const companyId = profile!.company_id

  // Construir objeto de actualización — no sobrescribir contraseña si viene vacía
  const updateData: Record<string, unknown> = {
    company_id: companyId,
    sii_rut: data.sii_rut,
    cert_enabled: false,
  }
  if (data.sii_password) {
    updateData.sii_password = data.sii_password
  }

  const { error } = await supabase
    .from('company_sii_configs')
    .upsert(updateData, { onConflict: 'company_id' })

  if (error) return { error: error.message }
  revalidatePath('/configuracion')
  return { success: true }
}

export async function saveSiiCertificate(data: {
  cert_data: string
  cert_password: string
  cert_subject: string
  cert_expires_at: string
  cert_owner_rut?: string
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('user_profiles').select('company_id').eq('id', user!.id).single()

  const companyId = profile!.company_id

  const { error } = await supabase
    .from('company_sii_configs')
    .upsert({
      company_id:       companyId,
      cert_enabled:     true,
      cert_data:        data.cert_data,
      cert_password:    data.cert_password,
      cert_subject:     data.cert_subject,
      cert_owner_rut:   data.cert_owner_rut || null,
      cert_expires_at:  data.cert_expires_at || null,
    }, { onConflict: 'company_id' })

  if (error) return { error: error.message }
  revalidatePath('/configuracion')
  return { success: true }
}

// ── Conectar SII: obtiene TOKEN desde el servidor Vercel ─────
export async function connectSii(data: { rut: string; password: string }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('user_profiles').select('company_id').eq('id', user!.id).single()
  const companyId = profile!.company_id

  try {
    const token = await getSiiToken(data.rut, data.password)

    await supabase.from('company_sii_configs').upsert({
      company_id: companyId,
      sii_rut: data.rut,
      sii_token: token,
      sii_token_obtained_at: new Date().toISOString(),
      last_sync_at: new Date().toISOString(),
      last_sync_status: 'success',
      last_sync_message: 'Conexión exitosa con el SII',
    }, { onConflict: 'company_id' })

    revalidatePath('/configuracion')
    return { success: true }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error desconocido'
    await supabase.from('company_sii_configs').update({
      last_sync_at: new Date().toISOString(),
      last_sync_status: 'error',
      last_sync_message: msg,
    }).eq('company_id', companyId)
    revalidatePath('/configuracion')
    return { error: msg }
  }
}

// ── Guardar TOKEN manual (copiado desde el navegador) ─────────
export async function saveManualToken(token: string) {
  if (!token?.trim()) return { error: 'Token vacío' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('user_profiles').select('company_id').eq('id', user!.id).single()
  const companyId = profile!.company_id

  const { error } = await supabase.from('company_sii_configs').upsert({
    company_id: companyId,
    sii_token: token.trim(),
    sii_token_obtained_at: new Date().toISOString(),
    last_sync_at: new Date().toISOString(),
    last_sync_status: 'success',
    last_sync_message: 'Token SII guardado manualmente',
  }, { onConflict: 'company_id' })

  if (error) return { error: error.message }
  revalidatePath('/configuracion')
  return { success: true }
}

// ── Limpiar TOKEN SII guardado ─────────────────────────────────
export async function clearSiiToken() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('user_profiles').select('company_id').eq('id', user!.id).single()

  await supabase.from('company_sii_configs')
    .update({ sii_token: null, sii_token_obtained_at: null })
    .eq('company_id', profile!.company_id)

  revalidatePath('/configuracion')
  return { success: true }
}

export async function testSiiConnection() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('user_profiles').select('company_id').eq('id', user!.id).single()

  const { data: siiConfig } = await supabase
    .from('company_sii_configs')
    .select('sii_rut, sii_password, sii_token')
    .eq('company_id', profile!.company_id)
    .single()

  // Si hay token guardado, úsalo directamente en la edge function
  if (siiConfig?.sii_token) {
    const { data, error: fnError } = await supabase.functions.invoke('sii-fetch-invoices', {
      body: {
        company_id: profile!.company_id,
        rut: siiConfig.sii_rut ?? '',
        test_only: true,
      },
    })
    if (fnError) return { error: fnError.message }
    if (data?.error) {
      await supabase.from('company_sii_configs').update({
        last_sync_at: new Date().toISOString(),
        last_sync_status: 'error',
        last_sync_message: data.error,
      }).eq('company_id', profile!.company_id)
      revalidatePath('/configuracion')
      return { error: data.error }
    }
    revalidatePath('/configuracion')
    return { success: true }
  }

  // Sin token — intentar conectar desde el servidor Vercel
  if (!siiConfig?.sii_rut || !siiConfig?.sii_password) {
    return { error: 'No hay credenciales SII configuradas' }
  }

  return connectSii({ rut: siiConfig.sii_rut, password: siiConfig.sii_password })
}
