'use client'

import { useSearchParams } from 'next/navigation'
import { useEffect, useState, Suspense } from 'react'
import { createClient } from '@/lib/supabase/client'

function AceptarInvitacionContent() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token')

  const [companyName, setCompanyName] = useState<string | null>(null)
  const [tokenError, setTokenError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // Email/password form state
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [emailSent, setEmailSent] = useState(false)

  useEffect(() => {
    if (!token) {
      setTokenError('Link inválido: falta el token de invitación.')
      setLoading(false)
      return
    }

    const supabase = createClient()
    supabase
      .from('user_invitations')
      .select('company_id, expires_at, accepted_at, companies(name)')
      .eq('token', token)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error || !data) {
          setTokenError('Este link de invitación no es válido.')
        } else if (data.accepted_at) {
          setTokenError('Esta invitación ya fue utilizada.')
        } else if (new Date(data.expires_at) < new Date()) {
          setTokenError('Esta invitación ha expirado. Pide al administrador que te envíe una nueva.')
        } else {
          const company = data.companies as unknown as { name: string } | null
          setCompanyName(company?.name ?? 'tu empresa')
        }
        setLoading(false)
      })
  }, [token])

  async function handleGoogle() {
    const supabase = createClient()
    // Usar window.location.origin (más confiable en el browser que process.env)
    const origin = window.location.origin
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${origin}/auth/callback?type=invite&token=${token}`,
      },
    })
  }

  async function handleEmailSignup(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)
    setSubmitting(true)

    const supabase = createClient()
    const origin = window.location.origin

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${origin}/auth/callback?type=invite&token=${token}`,
      },
    })

    if (error) {
      setFormError(error.message)
      setSubmitting(false)
    } else {
      setEmailSent(true)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (tokenError) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="max-w-sm w-full text-center">
          <div className="w-14 h-14 bg-error/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-error" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-text-primary mb-2">Invitación inválida</h1>
          <p className="text-sm text-text-secondary mb-6">{tokenError}</p>
          <a href="/login"
            className="text-sm text-primary hover:underline">
            Ir al inicio de sesión →
          </a>
        </div>
      </div>
    )
  }

  if (emailSent) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="max-w-sm w-full text-center">
          <div className="w-14 h-14 bg-success/10 rounded-2xl flex items-center justify-center mx-auto mb-4 text-3xl">
            📧
          </div>
          <h1 className="text-xl font-bold text-text-primary mb-2">Revisa tu correo</h1>
          <p className="text-sm text-text-secondary">
            Te enviamos un email de confirmación a <strong className="text-text-primary">{email}</strong>.
            Haz clic en el link para activar tu cuenta e ingresar a <strong className="text-text-primary">{companyName}</strong>.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="max-w-sm w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">🏢</span>
          </div>
          <h1 className="text-2xl font-bold text-text-primary mb-1">Fuiste invitado</h1>
          <p className="text-sm text-text-secondary">
            Crea tu cuenta para acceder a{' '}
            <span className="font-semibold text-primary">{companyName}</span>
          </p>
        </div>

        {/* Google */}
        <button
          onClick={handleGoogle}
          className="w-full flex items-center justify-center gap-3 bg-surface border border-border hover:border-primary/40 hover:bg-surface-high text-text-primary font-semibold text-sm py-3 px-4 rounded-xl transition-colors mb-4"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Continuar con Google
        </button>

        {/* Divider */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs text-text-disabled">o con email</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        {/* Email/password form */}
        <form onSubmit={handleEmailSignup} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">
              Correo electrónico
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="tu@email.com"
              required
              className="w-full bg-surface border border-border rounded-xl px-4 py-2.5 text-sm text-text-primary placeholder:text-text-disabled focus:outline-none focus:border-primary/50 transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">
              Contraseña
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Mínimo 8 caracteres"
              minLength={8}
              required
              className="w-full bg-surface border border-border rounded-xl px-4 py-2.5 text-sm text-text-primary placeholder:text-text-disabled focus:outline-none focus:border-primary/50 transition-colors"
            />
          </div>

          {formError && (
            <p className="text-xs text-error bg-error/10 rounded-lg px-3 py-2">{formError}</p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-primary text-primary-foreground font-bold text-sm py-3 px-4 rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'Creando cuenta…' : 'Crear cuenta e ingresar'}
          </button>
        </form>

        <p className="text-center text-xs text-text-disabled mt-6">
          ¿Ya tienes cuenta?{' '}
          <a href="/login" className="text-primary hover:underline">Inicia sesión</a>
        </p>
      </div>
    </div>
  )
}

export default function AceptarInvitacionPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <AceptarInvitacionContent />
    </Suspense>
  )
}
