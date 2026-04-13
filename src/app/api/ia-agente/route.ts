import { createClient } from '@/lib/supabase/server'
import { NextRequest } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    // Autenticar usuario
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'No autorizado' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Obtener company_id
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('company_id')
      .eq('id', user.id)
      .single()

    if (!profile?.company_id) {
      return new Response(JSON.stringify({ error: 'Sin empresa asociada' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const body = await req.json()
    const { messages } = body as { messages: { role: string; content: string }[] }

    // Llamar a la edge function ia-agente
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY!

    const edgeResponse = await fetch(
      `${supabaseUrl}/functions/v1/ia-agente`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({
          company_id: profile.company_id,
          messages,
        }),
      }
    )

    if (!edgeResponse.ok) {
      const errText = await edgeResponse.text()
      return new Response(
        JSON.stringify({ error: `Error del agente: ${errText}` }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Re-transmitir la respuesta al browser
    const text = await edgeResponse.text()
    return new Response(text, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })

  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : 'Error interno' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
