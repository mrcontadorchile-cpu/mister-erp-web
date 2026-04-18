'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Resend } from 'resend'

async function getContext() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('company_id')
    .eq('id', user.id)
    .single()
  if (!profile?.company_id) return null

  return { supabase, userId: user.id, companyId: profile.company_id as string }
}

type ActionResult = { ok: true } | { ok: false; error: string }

export async function changeUserRole(membershipId: string, roleId: string): Promise<ActionResult> {
  const ctx = await getContext()
  if (!ctx) return { ok: false, error: 'No autenticado' }

  const { error } = await ctx.supabase.rpc('update_member_role', {
    p_caller_id:     ctx.userId,
    p_company_id:    ctx.companyId,
    p_membership_id: membershipId,
    p_new_role_id:   roleId,
  })
  if (error) return { ok: false, error: error.message }
  revalidatePath('/sistema/usuarios')
  return { ok: true }
}

export async function changeUserStatus(membershipId: string, status: 'active' | 'suspended'): Promise<ActionResult> {
  const ctx = await getContext()
  if (!ctx) return { ok: false, error: 'No autenticado' }

  const { error } = await ctx.supabase.rpc('update_member_status', {
    p_caller_id:     ctx.userId,
    p_company_id:    ctx.companyId,
    p_membership_id: membershipId,
    p_status:        status,
  })
  if (error) return { ok: false, error: error.message }
  revalidatePath('/sistema/usuarios')
  return { ok: true }
}

export async function inviteUserByEmail(email: string, roleId: string): Promise<ActionResult> {
  try {
    const ctx = await getContext()
    if (!ctx) return { ok: false, error: 'No autenticado' }

    // Verify permissions
    const { data: perms } = await ctx.supabase
      .rpc('get_user_permissions', { p_user_id: ctx.userId, p_company_id: ctx.companyId })
    const permissions: string[] = (perms as string[] | null) ?? []
    if (!permissions.includes('*') && !permissions.includes('sistema.usuarios')) {
      return { ok: false, error: 'Sin permiso para invitar usuarios' }
    }

    // Get company name for the email
    const { data: companyData } = await ctx.supabase
      .from('companies')
      .select('name')
      .eq('id', ctx.companyId)
      .single()
    const companyName = (companyData as { name: string } | null)?.name ?? 'tu empresa'

    const resendKey = process.env.RESEND_API_KEY
    if (!resendKey) return { ok: false, error: 'RESEND_API_KEY no configurada — configúrala en Vercel para enviar invitaciones' }

    const admin   = createAdminClient()
    const resend  = new Resend(resendKey)
    const trimmed = email.trim().toLowerCase()
    const appUrl  = process.env.NEXT_PUBLIC_APP_URL ?? 'https://erp.mistercontador.cl'

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = admin as any

    // Insert invitation record (works for new AND existing users — matched by email)
    const { error: invErr } = await db.from('user_invitations').insert({
      email:      trimmed,
      company_id: ctx.companyId,
      role_id:    roleId,
      invited_by: ctx.userId,
    })
    if (invErr) return { ok: false, error: invErr.message as string }

    // Read back the token just created
    const { data: inv, error: readErr } = await db
      .from('user_invitations')
      .select('token')
      .eq('email', trimmed)
      .is('accepted_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .single() as { data: { token: string } | null; error: unknown }
    if (readErr || !inv) return { ok: false, error: 'Error leyendo token de invitación' }

    const acceptUrl = `${appUrl}/auth/aceptar-invitacion?token=${inv.token}`

    const { error: emailError } = await resend.emails.send({
      from:    'Mister Contabilidad <no-reply@mistercontador.cl>',
      to:      trimmed,
      subject: `Invitación a ${companyName} — ERP Mister Group`,
      html:    buildInviteEmail(companyName, acceptUrl),
    })
    if (emailError) return { ok: false, error: `Invitación creada pero error al enviar email: ${emailError.message}` }

    revalidatePath('/sistema/usuarios')
    return { ok: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error inesperado al enviar la invitación'
    return { ok: false, error: msg }
  }
}

// ── Email templates ───────────────────────────────────────────────────────────

function emailShell(body: string) {
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:Arial,sans-serif;">
  <div style="max-width:520px;margin:40px auto;background:#111;border-radius:12px;overflow:hidden;border:1px solid #222;">
    <div style="background:#161616;padding:24px 32px;border-bottom:1px solid #222;">
      <div style="display:inline-block;width:40px;height:40px;background:#d4a017;border-radius:10px;text-align:center;line-height:40px;vertical-align:middle;">
        <span style="color:#000;font-weight:900;font-size:14px;">MC</span>
      </div>
      <div style="display:inline-block;vertical-align:middle;margin-left:10px;">
        <p style="margin:0;font-size:15px;font-weight:700;color:#fff;">ERP Mister Group</p>
        <p style="margin:0;font-size:12px;color:#888;">ERP Contable Chile</p>
      </div>
    </div>
    <div style="padding:32px;">${body}</div>
    <div style="background:#0d0d0d;padding:16px 32px;border-top:1px solid #1e1e1e;text-align:center;">
      <p style="font-size:11px;color:#555;margin:0;">
        Mister Group · ERP Contable Chile<br>
        <a href="https://erp.mistercontador.cl" style="color:#666;text-decoration:none;">erp.mistercontador.cl</a>
      </p>
    </div>
  </div>
</body>
</html>`
}

function buildInviteEmail(companyName: string, url: string) {
  return emailShell(`
    <h2 style="font-size:20px;font-weight:700;color:#fff;margin:0 0 12px;">Te invitaron a colaborar</h2>
    <p style="font-size:14px;color:#aaa;line-height:1.7;margin:0 0 8px;">Fuiste invitado a acceder al sistema de contabilidad de</p>
    <p style="font-size:16px;font-weight:700;color:#d4a017;margin:0 0 24px;">${companyName}</p>
    <p style="font-size:14px;color:#aaa;line-height:1.7;margin:0 0 24px;">Haz clic en el botón para crear tu cuenta e ingresar al sistema. Puedes registrarte con Google o con email y contraseña.</p>
    <div style="text-align:center;margin-bottom:28px;">
      <a href="${url}" style="display:inline-block;background:#d4a017;color:#000;font-weight:700;font-size:15px;padding:14px 36px;border-radius:8px;text-decoration:none;">
        Crear cuenta e ingresar →
      </a>
    </div>
    <div style="background:#1a1a1a;border-radius:8px;padding:14px 16px;">
      <p style="font-size:12px;color:#666;margin:0;line-height:1.6;">
        ⏱ Este enlace expira en <strong style="color:#888;">7 días</strong>.<br>
        Si no esperabas esta invitación, puedes ignorar este correo.
      </p>
    </div>
  `)
}

function buildAccessEmail(companyName: string, url: string) {
  return emailShell(`
    <h2 style="font-size:20px;font-weight:700;color:#fff;margin:0 0 12px;">Tienes acceso a una nueva empresa</h2>
    <p style="font-size:14px;color:#aaa;line-height:1.7;margin:0 0 8px;">Se te ha dado acceso al sistema de contabilidad de</p>
    <p style="font-size:16px;font-weight:700;color:#d4a017;margin:0 0 24px;">${companyName}</p>
    <p style="font-size:14px;color:#aaa;line-height:1.7;margin:0 0 24px;">Ingresa con tu cuenta existente usando el botón de abajo.</p>
    <div style="text-align:center;margin-bottom:28px;">
      <a href="${url}" style="display:inline-block;background:#d4a017;color:#000;font-weight:700;font-size:15px;padding:14px 36px;border-radius:8px;text-decoration:none;">
        Ir al ERP →
      </a>
    </div>
  `)
}
