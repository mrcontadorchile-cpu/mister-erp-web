'use client'

import { useState, useTransition } from 'react'
import { updateCompany } from './actions'

interface Company {
  id: string
  name: string
  rut: string
  address: string | null
  commune: string | null
  city: string | null
  region: string | null
  phone: string | null
  email: string | null
  giro: string | null
  activity_code: string | null
}

interface Props {
  company: Company | null
}

export function EmpresaForm({ company }: Props) {
  const [form, setForm] = useState({
    name:          company?.name          ?? '',
    rut:           company?.rut           ?? '',
    address:       company?.address       ?? '',
    commune:       company?.commune       ?? '',
    city:          company?.city          ?? '',
    region:        company?.region        ?? '',
    phone:         company?.phone         ?? '',
    email:         company?.email         ?? '',
    giro:          company?.giro          ?? '',
    activity_code: company?.activity_code ?? '',
  })
  const [isPending, startTransition] = useTransition()
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  const set = (field: string, value: string) =>
    setForm(f => ({ ...f, [field]: value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSuccess(false)
    setError('')
    startTransition(async () => {
      const r = await updateCompany(form)
      if (r.error) { setError(r.error); return }
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    })
  }

  const REGIONS = [
    'Región de Arica y Parinacota', 'Región de Tarapacá', 'Región de Antofagasta',
    'Región de Atacama', 'Región de Coquimbo', 'Región de Valparaíso',
    'Región Metropolitana de Santiago', "Región del Libertador Gral. Bernardo O'Higgins",
    'Región del Maule', 'Región de Ñuble', 'Región del Biobío',
    'Región de La Araucanía', 'Región de Los Ríos', 'Región de Los Lagos',
    'Región de Aysén', 'Región de Magallanes y la Antártica Chilena',
  ]

  return (
    <form onSubmit={handleSubmit} className="card p-6 space-y-5">
      {/* Identificación */}
      <div>
        <p className="text-xs font-semibold text-text-disabled uppercase tracking-wider mb-3">
          Identificación fiscal
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-text-disabled block mb-1">Razón Social *</label>
            <input
              value={form.name}
              onChange={e => set('name', e.target.value)}
              className="input text-sm"
              required
            />
          </div>
          <div>
            <label className="text-xs text-text-disabled block mb-1">RUT *</label>
            <input
              value={form.rut}
              onChange={e => set('rut', e.target.value)}
              className="input text-sm font-mono"
              placeholder="78.343.698-1"
              required
            />
          </div>
          <div className="col-span-2">
            <label className="text-xs text-text-disabled block mb-1">Giro comercial</label>
            <input
              value={form.giro}
              onChange={e => set('giro', e.target.value)}
              className="input text-sm"
              placeholder="Ej: Servicios contables y administrativos"
            />
          </div>
          <div>
            <label className="text-xs text-text-disabled block mb-1">Código actividad económica (SII)</label>
            <input
              value={form.activity_code}
              onChange={e => set('activity_code', e.target.value)}
              className="input text-sm font-mono"
              placeholder="Ej: 741000"
            />
          </div>
        </div>
      </div>

      <div className="border-t border-border" />

      {/* Dirección */}
      <div>
        <p className="text-xs font-semibold text-text-disabled uppercase tracking-wider mb-3">
          Dirección
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="text-xs text-text-disabled block mb-1">Calle y número</label>
            <input
              value={form.address}
              onChange={e => set('address', e.target.value)}
              className="input text-sm"
              placeholder="Ej: Av. Providencia 1234, Of. 501"
            />
          </div>
          <div>
            <label className="text-xs text-text-disabled block mb-1">Comuna</label>
            <input
              value={form.commune}
              onChange={e => set('commune', e.target.value)}
              className="input text-sm"
              placeholder="Ej: Providencia"
            />
          </div>
          <div>
            <label className="text-xs text-text-disabled block mb-1">Ciudad</label>
            <input
              value={form.city}
              onChange={e => set('city', e.target.value)}
              className="input text-sm"
              placeholder="Ej: Santiago"
            />
          </div>
          <div className="col-span-2">
            <label className="text-xs text-text-disabled block mb-1">Región</label>
            <select
              value={form.region}
              onChange={e => set('region', e.target.value)}
              className="input text-sm"
            >
              <option value="">Selecciona región...</option>
              {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="border-t border-border" />

      {/* Contacto */}
      <div>
        <p className="text-xs font-semibold text-text-disabled uppercase tracking-wider mb-3">
          Contacto
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-text-disabled block mb-1">Teléfono</label>
            <input
              value={form.phone}
              onChange={e => set('phone', e.target.value)}
              className="input text-sm"
              placeholder="+56 2 2xxx xxxx"
            />
          </div>
          <div>
            <label className="text-xs text-text-disabled block mb-1">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={e => set('email', e.target.value)}
              className="input text-sm"
              placeholder="contacto@empresa.cl"
            />
          </div>
        </div>
      </div>

      {error && (
        <p className="text-xs text-error bg-error/10 px-3 py-2 rounded">{error}</p>
      )}
      {success && (
        <p className="text-xs text-success bg-success/10 px-3 py-2 rounded flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          Datos guardados correctamente
        </p>
      )}

      <div className="flex justify-end">
        <button type="submit" disabled={isPending} className="btn-primary px-6">
          {isPending ? 'Guardando...' : 'Guardar Cambios'}
        </button>
      </div>
    </form>
  )
}
