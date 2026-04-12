'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function RecuperarPage() {
  const [email, setEmail]     = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent]       = useState(false)
  const [error, setError]     = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const supabase = createClient()
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: `${appUrl}/auth/callback?type=recovery`,
    })
    if (error) { setError(error.message); setLoading(false); return }
    setSent(true)
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-sm">

        <div className="flex flex-col items-center mb-10">
          <img src="/logo-white.svg" alt="ERP Mister Group" className="h-14 mb-4" />
          <h1 className="text-xl font-bold text-text-primary">Recuperar contraseña</h1>
          <p className="text-text-secondary text-sm mt-1 text-center">
            Te enviaremos un link para resetear tu contraseña
          </p>
        </div>

        {sent ? (
          <div className="text-center space-y-4">
            <div className="w-14 h-14 bg-success/10 rounded-full flex items-center justify-center mx-auto">
              <svg className="w-7 h-7 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="text-text-primary font-medium">Correo enviado</p>
            <p className="text-text-secondary text-sm">
              Revisa tu bandeja de entrada en <strong>{email}</strong> y haz clic en el link para crear una nueva contraseña.
            </p>
            <Link href="/login" className="block text-primary text-sm hover:underline mt-4">
              ← Volver al inicio de sesión
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-text-secondary mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="input"
                placeholder="nombre@empresa.cl"
                required
                autoComplete="email"
              />
            </div>

            {error && (
              <div className="flex items-start gap-2 p-3 bg-error/10 border border-error/20 rounded-lg">
                <svg className="w-4 h-4 text-error mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-error text-sm">{error}</p>
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full py-3">
              {loading ? 'Enviando...' : 'Enviar link de recuperación'}
            </button>

            <Link href="/login" className="block text-center text-text-disabled text-sm hover:text-text-secondary transition-colors">
              ← Volver al inicio de sesión
            </Link>
          </form>
        )}

        <p className="text-center text-text-disabled text-xs mt-10">Mister Group © {new Date().getFullYear()}</p>
      </div>
    </div>
  )
}
