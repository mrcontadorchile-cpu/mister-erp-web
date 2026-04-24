'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createCompany } from '../actions'
import { FEATURE_LABELS, type CompanyFeature } from '@/types/database'

const ALL_FEATURES: CompanyFeature[] = ['contabilidad', 'remuneraciones', 'documentos_sii', 'ia_asistente', 'ia_documentos']

// Default role ID — admin. This will be fetched dynamically in a real implementation.
// For now the user must have at least one role. We'll use a hardcoded fallback.
const DEFAULT_ROLE_ID = '' // filled from roles list

export default function NuevaEmpresaPage() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [name, setName]           = useState('')
  const [rut, setRut]             = useState('')
  const [email, setEmail]         = useState('')
  const [giro, setGiro]           = useState('')
  const [adminEmail, setAdminEmail] = useState('')
  const [features, setFeatures]   = useState<Set<CompanyFeature>>(new Set(['contabilidad']))

  function toggleFeature(f: CompanyFeature) {
    const next = new Set(features)
    next.has(f) ? next.delete(f) : next.add(f)
    setFeatures(next)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !rut.trim() || !adminEmail.trim()) {
      setError('Nombre, RUT y email del administrador son obligatorios.')
      return
    }
    setError(null)
    startTransition(async () => {
      const result = await createCompany({
        name: name.trim(),
        rut: rut.trim(),
        email: email.trim(),
        giro: giro.trim(),
        adminEmail: adminEmail.trim(),
        adminRoleId: DEFAULT_ROLE_ID,
        features: Array.from(features),
      })
      if (!result.ok) { setError(result.error); return }
      router.push(`/superadmin/empresas/${result.companyId}`)
    })
  }

  return (
    <div className="max-w-2xl">
      <Link href="/superadmin/empresas" className="flex items-center gap-1.5 text-xs text-text-disabled hover:text-text-secondary mb-6 transition-colors">
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Volver a empresas
      </Link>

      <h1 className="text-2xl font-bold text-text-primary mb-6">Nueva empresa cliente</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Datos empresa */}
        <div className="card p-5 space-y-4">
          <h2 className="text-sm font-semibold text-text-primary">Datos de la empresa</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-text-disabled block mb-1">Nombre *</label>
              <input value={name} onChange={e => setName(e.target.value)}
                className="input text-sm" placeholder="Ej: Empresa ABC SpA" required />
            </div>
            <div>
              <label className="text-xs text-text-disabled block mb-1">RUT *</label>
              <input value={rut} onChange={e => setRut(e.target.value)}
                className="input text-sm font-mono" placeholder="76.123.456-7" required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-text-disabled block mb-1">Email empresa</label>
              <input value={email} onChange={e => setEmail(e.target.value)}
                type="email" className="input text-sm" placeholder="contacto@empresa.cl" />
            </div>
            <div>
              <label className="text-xs text-text-disabled block mb-1">Giro</label>
              <input value={giro} onChange={e => setGiro(e.target.value)}
                className="input text-sm" placeholder="Ej: Servicios de consultoría" />
            </div>
          </div>
        </div>

        {/* Admin */}
        <div className="card p-5 space-y-3">
          <h2 className="text-sm font-semibold text-text-primary">Administrador de la empresa</h2>
          <p className="text-xs text-text-disabled">Recibirá un email para crear su contraseña y acceder al sistema.</p>
          <div>
            <label className="text-xs text-text-disabled block mb-1">Email del administrador *</label>
            <input value={adminEmail} onChange={e => setAdminEmail(e.target.value)}
              type="email" className="input text-sm" placeholder="admin@empresa.cl" required />
          </div>
        </div>

        {/* Módulos */}
        <div className="card p-5 space-y-4">
          <h2 className="text-sm font-semibold text-text-primary">Módulos contratados</h2>
          <div className="space-y-3">
            {ALL_FEATURES.map(feature => {
              const meta = FEATURE_LABELS[feature]
              const active = features.has(feature)
              const isExtra = feature === 'ia_documentos'
              return (
                <label key={feature} className="flex items-center gap-4 cursor-pointer">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0 ${active ? 'bg-primary/20' : 'bg-surface-high'}`}>
                    {meta.icon}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className={`text-sm font-medium ${active ? 'text-text-primary' : 'text-text-secondary'}`}>{meta.label}</p>
                      {isExtra && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-warning/10 text-warning border border-warning/20">EXTRA</span>}
                    </div>
                    <p className="text-xs text-text-disabled">{meta.desc}</p>
                  </div>
                  <button type="button" role="switch" aria-checked={active}
                    onClick={() => toggleFeature(feature)}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${active ? 'bg-primary' : 'bg-surface-high border border-border'}`}
                  >
                    <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform ${active ? 'translate-x-4' : 'translate-x-0.5'}`} />
                  </button>
                </label>
              )
            })}
          </div>
        </div>

        {error && <p className="text-xs text-error bg-error/10 px-3 py-2 rounded-lg">{error}</p>}

        <div className="flex gap-3">
          <Link href="/superadmin/empresas" className="btn-ghost flex-1 text-center text-sm py-2.5">
            Cancelar
          </Link>
          <button type="submit" disabled={isPending} className="btn-primary flex-1 text-sm py-2.5">
            {isPending ? 'Creando empresa...' : 'Crear empresa e invitar admin'}
          </button>
        </div>
      </form>
    </div>
  )
}
