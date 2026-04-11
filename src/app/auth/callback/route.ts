import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const type = searchParams.get('type') // 'recovery' | 'invite' | undefined
  const next = searchParams.get('next') ?? '/'

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
      // Ensure user_profiles row exists
      await supabase.from('user_profiles').upsert({
        id:         data.user.id,
        full_name:  data.user.user_metadata?.full_name
                    ?? data.user.user_metadata?.name
                    ?? data.user.email?.split('@')[0]
                    ?? 'Usuario',
        role:       'admin',
        company_id: null,
      }, { onConflict: 'id', ignoreDuplicates: true })

      // Activate any pending invited memberships
      await supabase
        .from('user_company_memberships')
        .update({ status: 'active' })
        .eq('user_id', data.user.id)
        .eq('status', 'invited')

      // Set company_id on profile if not set yet
      const { data: membership } = await supabase
        .from('user_company_memberships')
        .select('company_id')
        .eq('user_id', data.user.id)
        .eq('status', 'active')
        .order('created_at')
        .limit(1)
        .single()

      if (membership?.company_id) {
        await supabase
          .from('user_profiles')
          .update({ company_id: membership.company_id })
          .eq('id', data.user.id)
          .is('company_id', null)
      }

      // Redirect based on flow type
      if (type === 'recovery') {
        return NextResponse.redirect(`${origin}/auth/nueva-contrasena`)
      }
      if (type === 'invite') {
        return NextResponse.redirect(`${origin}/auth/configurar-cuenta`)
      }

      // Google OAuth or normal session: check they have access
      if (!membership?.company_id) {
        // No company membership → no access
        return NextResponse.redirect(`${origin}/login?error=sin_acceso`)
      }

      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=link_invalido`)
}
