'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { setCompanyFeature, toggleCompanyActive } from '../actions'
import { FEATURE_LABELS, type CompanyFeature } from '@/types/database'

const ALL_FEATURES: CompanyFeature[] = ['contabilidad', 'remuneraciones', 'documentos_sii', 'ia_asistente', 'ia_documentos']

interface Props {
  company: { id: string; name: string; rut: string; email?: string; giro?: string; is_active: boolean; created_at: string }
  activeFeatures: CompanyFeature[]
  members: { full_name: string; role_name: string; status: string }[]
  roles: { id: string; name: string }[]
}

export function EmpresaDetailClient({ company, activeFeatures, members, roles }: Props) {
  const [features, setFeatures] = useState<Set<CompanyFeature>>(new Set(activeFeatures))
  const [isActive, setIsActive] = useState(company.is_active)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleFeatureToggle(feature: CompanyFeature, checked: boolean) {
    setError(null)
    const next = new Set(features)
    checked ? next.add(feature) : next.delete(feature)
    setFeatures(next)

    startTransition(async () => {
      const result = await setCompanyFeature(company.id, feature, checked)
      if (!result.ok) { setError(result.error); setFeatures(features) }
    })
  }

  function handleToggleActive() {
    const next = !isActive
    setIsActive(next)
    startTransition(async () => {
      const result = await toggleCompanyActive(company.id, next)
      if (!result.ok) { setError(result.error); setIsActive(isActive) }
    })
  }

  return (
    <div className="max-w-3xl space-y-6">
      {/* Back */}
      <Link href="/superadmin/empresas" className="flex items-center gap-1.5 text-xs text-text-disabled hover:text-text-secondary transition-colors">
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Volver a empresas
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">{company.name}</h1>
          <p className="text-text-disabled text-sm font-mono mt-0.5">{company.rut}</p>
          {company.giro && <p className="text-text-secondary text-xs mt-1">{company.giro}</p>}
        </div>
        <button
          onClick={handleToggleActive}
          disabled={isPending}
          className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors ${
            isActive
              ? 'bg-success/10 text-success border-success/20 hover:bg-error/10 hover:text-error hover:border-error/20'
              : 'bg-error/10 text-error border-error/20 hover:bg-success/10 hover:text-success hover:border-success/20'
          }`}
        >
          {isActive ? 'Activa — clic para suspender' : 'Suspendida — clic para activar'}
        </button>
      </div>

      {error && <p className="text-xs text-error bg-error/10 px-3 py-2 rounded-lg">{error}</p>}

      {/* Módulos contratados */}
      <div className="card p-5">
        <h2 className="text-sm font-semibold text-text-primary mb-4">Módulos contratados</h2>
        <div className="space-y-3">
          {ALL_FEATURES.map(feature => {
            const meta = FEATURE_LABELS[feature]
            const active = features.has(feature)
            const isExtra = feature === 'ia_documentos'
            return (
              <label key={feature} className="flex items-center gap-4 cursor-pointer group">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0 transition-colors ${
                  active ? 'bg-primary/20' : 'bg-surface-high'
                }`}>
                  {meta.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className={`text-sm font-medium transition-colors ${active ? 'text-text-primary' : 'text-text-secondary'}`}>
                      {meta.label}
                    </p>
                    {isExtra && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-warning/10 text-warning border border-warning/20">
                        EXTRA
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-text-disabled">{meta.desc}</p>
                </div>
                <div className="shrink-0">
                  <button
                    role="switch"
                    aria-checked={active}
                    onClick={() => handleFeatureToggle(feature, !active)}
                    disabled={isPending}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none disabled:opacity-50 ${
                      active ? 'bg-primary' : 'bg-surface-high border border-border'
                    }`}
                  >
                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform shadow-sm ${
                      active ? 'translate-x-4' : 'translate-x-0.5'
                    }`} />
                  </button>
                </div>
              </label>
            )
          })}
        </div>
      </div>

      {/* Usuarios */}
      <div className="card p-5">
        <h2 className="text-sm font-semibold text-text-primary mb-4">
          Usuarios ({members.length})
        </h2>
        {members.length === 0 ? (
          <p className="text-xs text-text-disabled italic">Sin usuarios aún</p>
        ) : (
          <div className="space-y-2">
            {members.map((m, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <div>
                  <p className="text-sm text-text-primary">{m.full_name}</p>
                  <p className="text-xs text-text-disabled">{m.role_name}</p>
                </div>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                  m.status === 'active'
                    ? 'bg-success/10 text-success border-success/20'
                    : m.status === 'invited'
                    ? 'bg-warning/10 text-warning border-warning/20'
                    : 'bg-surface-high text-text-disabled border-border'
                }`}>
                  {m.status === 'active' ? 'Activo' : m.status === 'invited' ? 'Invitado' : m.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="text-xs text-text-disabled px-1">
        Empresa creada el {new Date(company.created_at).toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' })}
        {company.email && ` · ${company.email}`}
      </div>
    </div>
  )
}
