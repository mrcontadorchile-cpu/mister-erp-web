import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code      = searchParams.get('code')
  const type      = searchParams.get('type')       // 'recovery' | 'invite' | undefined
  const companyId = searchParams.get('company_id') // legacy invite param
  const urlToken  = searchParams.get('token')      // token en la URL (Google OAuth)
  const next      = searchParams.get('next') ?? '/'

  if (code) {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: (list: { name: string; value: string; options?: object }[]) => {
            list.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options as Parameters<typeof cookieStore.set>[2])
            )
          },
        },
      }
    )

    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && data.user) {
      const admin = createAdminClient()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = admin as any

      const fullName =
        data.user.user_metadata?.full_name
        ?? data.user.user_metadata?.name
        ?? data.user.email?.split('@')[0]
        ?? 'Usuario'

      // El token puede llegar por dos vías:
      // 1. URL query param: Google OAuth siempre lo preserva
      // 2. user_metadata.invite_token: guardado en signUp(), sobrevive aunque
      //    Supabase recorte los query params del emailRedirectTo
      const invToken = urlToken ?? (data.user.user_metadata?.invite_token as string | undefined) ?? null

      let invitedCompanyId: string | null = null

      // ── Flujo con token (Google OAuth + email/contraseña) ───────────────
      if (invToken) {
        const { data: inv } = await db
          .from('user_invitations')
          .select('id, company_id, role_id, invited_by, expires_at')
          .eq('token', invToken)
          .is('accepted_at', null)
          .maybeSingle() as {
            data: { id: string; company_id: string; role_id: string; invited_by: string | null; expires_at: string } | null
          }

        if (inv && new Date(inv.expires_at) > new Date()) {
          // Crear/actualizar membresía
          await admin.from('user_company_memberships').upsert({
            user_id:    data.user.id,
            company_id: inv.company_id,
            role_id:    inv.role_id,
            status:     'active',
            invited_by: inv.invited_by,
          }, { onConflict: 'user_id,company_id', ignoreDuplicates: false })

          // Marcar invitación como aceptada
          await db
            .from('user_invitations')
            .update({ accepted_at: new Date().toISOString() })
            .eq('id', inv.id)

          invitedCompanyId = inv.company_id

          // Verificar si el perfil ya existe con empresa (usuario ya registrado)
          const { data: existingProfile } = await admin
            .from('user_profiles')
            .select('company_id')
            .eq('id', data.user.id)
            .maybeSingle()

          if (!existingProfile) {
            // Usuario nuevo: crear perfil con la empresa de la invitación
            await admin.from('user_profiles').insert({
              id:         data.user.id,
              full_name:  fullName,
              role:       'admin',
              company_id: inv.company_id,
            })
          } else if (!existingProfile.company_id) {
            // Perfil existe pero sin empresa: actualizar
            await admin.from('user_profiles')
              .update({ company_id: inv.company_id })
              .eq('id', data.user.id)
          }
          // Si el perfil ya tiene empresa, NO cambiar — el usuario
          // simplemente ganó acceso a una empresa adicional.
        }
      }

      // ── Fallback: email-based (solo en flujos de invitación explícita) ────
      // IMPORTANTE: solo correr si type==='invite' para evitar que logins
      // normales acepten invitaciones pendientes y cambien la empresa activa.
      if (!invitedCompanyId && data.user.email && type === 'invite') {
        const { data: accepted } = await db.rpc('accept_invitation', {
          p_user_id: data.user.id,
          p_email:   data.user.email,
        }) as { data: { company_id: string; is_new_user: boolean }[] | null }
        invitedCompanyId = accepted?.[0]?.company_id ?? null

        if (invitedCompanyId) {
          await admin.from('user_profiles').upsert({
            id:         data.user.id,
            full_name:  fullName,
            role:       'admin',
            company_id: invitedCompanyId,
          }, { onConflict: 'id', ignoreDuplicates: false })
        }
      }

      // ── Compatibilidad: activar membresías legacy con status='invited' ───
      await admin
        .from('user_company_memberships')
        .update({ status: 'active' })
        .eq('user_id', data.user.id)
        .eq('status', 'invited')

      // ── Para flujos sin invitación: determinar empresa activa ────────────
      let targetCompanyId: string | null = invitedCompanyId

      if (!targetCompanyId && companyId) {
        const { data: specific } = await admin
          .from('user_company_memberships')
          .select('company_id')
          .eq('user_id', data.user.id)
          .eq('company_id', companyId)
          .eq('status', 'active')
          .maybeSingle()
        targetCompanyId = specific?.company_id ?? null
      }

      if (!targetCompanyId) {
        const { data: latest } = await admin
          .from('user_company_memberships')
          .select('company_id')
          .eq('user_id', data.user.id)
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        targetCompanyId = latest?.company_id ?? null
      }

      // Para login normal (no invitación): actualizar empresa si no tiene
      if (targetCompanyId && !invitedCompanyId) {
        await admin
          .from('user_profiles')
          .update({ company_id: targetCompanyId })
          .eq('id', data.user.id)
          .is('company_id', null)
      }

      // ── Redirect ─────────────────────────────────────────────────────────
      if (type === 'recovery') {
        return NextResponse.redirect(`${origin}/auth/nueva-contrasena`)
      }
      if (invitedCompanyId) {
        return NextResponse.redirect(`${origin}/`)
      }
      if (!targetCompanyId) {
        return NextResponse.redirect(`${origin}/login?error=sin_acceso`)
      }
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=link_invalido`)
}
