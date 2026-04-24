'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Resend } from 'resend'
import { revalidatePath } from 'next/cache'
import type { CompanyFeature } from '@/types/database'

type Result = { ok: true } | { ok: false; error: string }

async function assertSuperadmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: p } = await supabase.from('user_profiles').select('is_superadmin').eq('id', user.id).single()
  if (!p?.is_superadmin) return null
  return { supabase, admin: createAdminClient(), userId: user.id }
}

export async function setCompanyFeature(
  companyId: string,
  feature: CompanyFeature,
  active: boolean
): Promise<Result> {
  const ctx = await assertSuperadmin()
  if (!ctx) return { ok: false, error: 'Sin acceso' }

  if (active) {
    const { error } = await ctx.admin.from('company_features').upsert(
      { company_id: companyId, feature, active: true, activated_by: ctx.userId },
      { onConflict: 'company_id,feature' }
    )
    if (error) return { ok: false, error: error.message }
  } else {
    const { error } = await ctx.admin.from('company_features')
      .update({ active: false })
      .eq('company_id', companyId)
      .eq('feature', feature)
    if (error) return { ok: false, error: error.message }
  }

  revalidatePath('/superadmin/empresas')
  revalidatePath(`/superadmin/empresas/${companyId}`)
  return { ok: true }
}

export async function createCompany(data: {
  name: string
  rut: string
  email: string
  giro: string
  adminEmail: string
  adminRoleId: string
  features: CompanyFeature[]
}): Promise<Result & { companyId?: string }> {
  const ctx = await assertSuperadmin()
  if (!ctx) return { ok: false, error: 'Sin acceso' }

  // 1. Crear empresa
  const { data: company, error: compErr } = await ctx.admin
    .from('companies')
    .insert({
      name: data.name,
      rut: data.rut,
      email: data.email,
      giro: data.giro,
      owner_id: ctx.userId,
      is_active: true,
      currency: 'CLP',
    })
    .select('id')
    .single()

  if (compErr || !company) return { ok: false, error: compErr?.message ?? 'Error creando empresa' }

  // 2. Asignar features contratadas
  if (data.features.length > 0) {
    await ctx.admin.from('company_features').insert(
      data.features.map(f => ({ company_id: company.id, feature: f, activated_by: ctx.userId }))
    )
  }

  // 3. Invitar al admin de la empresa
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://erp.mistercontador.cl'
  const inviteRedirect = `${appUrl}/auth/callback?type=invite`
  const resend = new Resend(process.env.RESEND_API_KEY)

  const existing = await ctx.admin.auth.admin.listUsers()
  const existingUser = existing.data?.users?.find(u => u.email?.toLowerCase() === data.adminEmail.toLowerCase())

  if (existingUser) {
    // Ya existe → agregar a la empresa
    await ctx.admin.from('user_company_memberships').upsert({
      user_id: existingUser.id,
      company_id: company.id,
      role_id: data.adminRoleId,
      status: 'active',
      invited_by: ctx.userId,
    }, { onConflict: 'user_id,company_id' })
    await ctx.admin.from('user_profiles')
      .update({ company_id: company.id })
      .eq('id', existingUser.id)
      .is('company_id', null)
  } else {
    // Nuevo usuario → generar invite link
    const { data: linkData } = await ctx.admin.auth.admin.generateLink({
      type: 'invite',
      email: data.adminEmail,
      options: { redirectTo: inviteRedirect },
    })

    if (linkData?.user) {
      await ctx.admin.from('user_profiles').upsert({
        id: linkData.user.id,
        full_name: data.adminEmail.split('@')[0],
        role: 'admin',
        company_id: null,
      }, { onConflict: 'id', ignoreDuplicates: true })

      await ctx.admin.from('user_company_memberships').upsert({
        user_id: linkData.user.id,
        company_id: company.id,
        role_id: data.adminRoleId,
        status: 'invited',
        invited_by: ctx.userId,
      }, { onConflict: 'user_id,company_id' })

      const inviteUrl = linkData.properties?.action_link ?? `${appUrl}/login`
      await resend.emails.send({
        from: 'Mister Contabilidad <no-reply@mistercontador.cl>',
        to: data.adminEmail,
        subject: `Invitación a ${data.name} — ERP Mister Group`,
        html: buildInviteEmail(data.name, inviteUrl),
      })
    }
  }

  revalidatePath('/superadmin/empresas')
  return { ok: true, companyId: company.id }
}

export async function toggleCompanyActive(companyId: string, active: boolean): Promise<Result> {
  const ctx = await assertSuperadmin()
  if (!ctx) return { ok: false, error: 'Sin acceso' }
  const { error } = await ctx.admin.from('companies').update({ is_active: active }).eq('id', companyId)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/superadmin/empresas')
  return { ok: true }
}

function buildInviteEmail(companyName: string, url: string) {
  return `<!DOCTYPE html><html><body style="background:#0a0a0a;font-family:Arial,sans-serif;margin:0;padding:0">
  <div style="max-width:520px;margin:40px auto;background:#111;border-radius:12px;border:1px solid #222;overflow:hidden">
    <div style="background:#161616;padding:24px 32px;border-bottom:1px solid #222">
      <span style="display:inline-block;width:40px;height:40px;background:#d4a017;border-radius:10px;text-align:center;line-height:40px;font-weight:900;font-size:14px;color:#000">MC</span>
      <span style="vertical-align:middle;margin-left:10px;font-size:15px;font-weight:700;color:#fff">ERP Mister Group</span>
    </div>
    <div style="padding:32px">
      <h2 style="color:#fff;margin:0 0 12px;font-size:20px">Acceso a ${companyName}</h2>
      <p style="color:#aaa;font-size:14px;line-height:1.7;margin:0 0 24px">Fuiste invitado a gestionar la contabilidad de <strong style="color:#d4a017">${companyName}</strong>.</p>
      <div style="text-align:center;margin-bottom:24px">
        <a href="${url}" style="display:inline-block;background:#d4a017;color:#000;font-weight:700;font-size:15px;padding:14px 36px;border-radius:8px;text-decoration:none">Crear contraseña e ingresar →</a>
      </div>
      <p style="color:#666;font-size:12px;text-align:center">Este enlace expira en 24 horas.</p>
    </div>
  </div>
</body></html>`
}
