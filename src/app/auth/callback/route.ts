import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * Handles Supabase auth callbacks: email confirmations, magic links, invites.
 * After token exchange, redirects to the app.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code  = searchParams.get('code')
  const next  = searchParams.get('next') ?? '/'

  if (code) {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: (list) => {
            list.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options as Parameters<typeof cookieStore.set>[2])
            )
          },
        },
      }
    )

    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && data.user) {
      // Ensure user_profiles row exists (first time invite acceptance)
      await supabase.from('user_profiles').upsert({
        id:         data.user.id,
        full_name:  data.user.user_metadata?.full_name ?? data.user.email?.split('@')[0] ?? 'Usuario',
        role:       'user',
        company_id: null,
      }, { onConflict: 'id', ignoreDuplicates: true })

      // If they have a pending/invited membership, activate it and set their active company
      const { data: membership } = await supabase
        .from('user_company_memberships')
        .select('company_id')
        .eq('user_id', data.user.id)
        .order('created_at')
        .limit(1)
        .single()

      if (membership?.company_id) {
        await supabase
          .from('user_profiles')
          .update({ company_id: membership.company_id })
          .eq('id', data.user.id)

        await supabase
          .from('user_company_memberships')
          .update({ status: 'active' })
          .eq('user_id', data.user.id)
          .eq('company_id', membership.company_id)
      }

      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // Something went wrong
  return NextResponse.redirect(`${origin}/login?error=invite_invalid`)
}
