import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code       = searchParams.get('code')
  const type       = searchParams.get('type')       // 'recovery' | 'invite' | undefined
  const companyId  = searchParams.get('company_id') // legacy invite param
  const invToken   = searchParams.get('token')      // new invite token
  const next       = searchParams.get('next') ?? '/'

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

      // Ensure user_profiles row exists (ignoreDuplicates = no sobreescribir datos existentes)
      await admin.from('user_profiles').upsert({
        id:         data.user.id,
        full_name:  data.user.user_metadata?.full_name
                    ?? data.user.user_metadata?.name
                    ?? data.user.email?.split('@')[0]
                    ?? 'Usuario',
        role:       'admin',
        company_id: null,
      }, { onConflict: 'id', ignoreDuplicates: true })

      let invitedCompanyId: string | null = null
      let isNewUser = false

      // ── Flujo con token (Google OAuth + email/contraseña) ───────────────
      // Busca la invitación directamente por token — más confiable que email
      // porque el token viaja en la URL y no depende de coincidencia de email.
      if (invToken) {
        const { data: inv } = await db
          .from('user_invitations')
          .select('id, company_id, role_id, invited_by, expires_at')
          .eq('token', invToken)
          .is('accepted_at', null)
          .maybeSingle() as { data: { id: string; company_id: string; role_id: string; invited_by: string | null; expires_at: string } | null }

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

          // ¿Es usuario nuevo? (sin empresa previa)
          const { data: profile } = await admin
            .from('user_profiles')
            .select('company_id')
            .eq('id', data.user.id)
            .maybeSingle()
          isNewUser = !profile?.company_id
        }
      }

      // ── Fallback: email-based (para flujos sin token) ───────────────────
      if (!invitedCompanyId && data.user.email) {
        const { data: accepted } = await db.rpc('accept_invitation', {
          p_user_id: data.user.id,
          p_email:   data.user.email,
        }) as { data: { company_id: string; is_new_user: boolean }[] | null }
        invitedCompanyId = accepted?.[0]?.company_id ?? null
        isNewUser        = accepted?.[0]?.is_new_user ?? false
      }

      // ── Compatibilidad: activar membresías legacy con status='invited' ───
      await admin
        .from('user_company_memberships')
        .update({ status: 'active' })
        .eq('user_id', data.user.id)
        .eq('status', 'invited')

      // ── Determinar empresa activa ────────────────────────────────────────
      // Prioridad: invitación aceptada > legacy company_id en URL > membresía más reciente
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

      // Actualizar empresa activa en el perfil
      if (targetCompanyId) {
        if (invitedCompanyId) {
          // Siempre cambiar la empresa al aceptar una invitación
          await admin
            .from('user_profiles')
            .update({ company_id: targetCompanyId })
            .eq('id', data.user.id)
        } else {
          // Login normal: solo si no tiene empresa asignada
          await admin
            .from('user_profiles')
            .update({ company_id: targetCompanyId })
            .eq('id', data.user.id)
            .is('company_id', null)
        }
      }

      // ── Redirect ─────────────────────────────────────────────────────────
      if (type === 'recovery') {
        return NextResponse.redirect(`${origin}/auth/nueva-contrasena`)
      }
      if (invitedCompanyId && isNewUser) {
        return NextResponse.redirect(`${origin}/auth/configurar-cuenta`)
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
