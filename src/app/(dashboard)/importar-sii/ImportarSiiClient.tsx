'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

const MONTHS = ['','Enero','Febrero','Marzo','Abril','Mayo','Junio',
                'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

interface Props {
  companyId: string
  savedRut: string
  hasPassword: boolean
}

type DocType = 'FACTURA_COMPRA' | 'FACTURA_VENTA' | 'BOLETA_HONORARIO'

interface Result {
  imported: number
  journalized: number
  skipped: number
  errors: string[]
}

export function ImportarSiiClient({ companyId, savedRut, hasPassword }: Props) {
  const now = new Date()
  const [year,  setYear]  = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [type,  setType]  = useState<DocType>('FACTURA_COMPRA')
  const [useCustomCreds, setUseCustomCreds] = useState(!hasPassword)
  const [rut,   setRut]   = useState(savedRut)
  const [pass,  setPass]  = useState('')
  const [loading, setLoading] = useState(false)
  const [result,  setResult]  = useState<Result | null>(null)
  const [error,   setError]   = useState<string | null>(null)

  async function handleImport(e: React.FormEvent) {
    e.preventDefault()
    if (!rut) { setError('Configura el RUT en Configuración → Conexión SII'); return }
    if (!hasPassword && !pass) { setError('Ingresa la clave SII'); return }

    setLoading(true)
    setResult(null)
    setError(null)

    const supabase = createClient()

    try {
      const { data, error: fnError } = await supabase.functions.invoke('sii-fetch-invoices', {
        body: {
          company_id: companyId,
          rut,
          clave_sii: useCustomCreds ? pass : undefined,
          use_saved_password: !useCustomCreds,
          year, month, type,
        },
      })

      if (fnError) throw new Error(fnError.message)
      setResult(data)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al importar')
    } finally {
      setLoading(false)
    }
  }

  const docTypes: { value: DocType; label: string; icon: string; desc: string }[] = [
    { value: 'FACTURA_COMPRA',   label: 'Facturas de Compra',    icon: '📥', desc: 'Facturas recibidas de proveedores' },
    { value: 'FACTURA_VENTA',    label: 'Facturas de Venta',     icon: '📤', desc: 'Facturas emitidas a clientes' },
    { value: 'BOLETA_HONORARIO', label: 'Boletas de Honorarios', icon: '👤', desc: 'Honorarios recibidos por servicios' },
  ]

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Importar desde SII</h1>
        <p className="text-text-secondary text-sm mt-1">
          Descarga y contabiliza automáticamente documentos del SII
        </p>
      </div>

      {/* Estado credenciales */}
      <div className={`flex items-center gap-3 p-3 rounded-lg border text-sm mb-6 ${
        hasPassword && savedRut
          ? 'bg-success/5 border-success/20'
          : 'bg-warning/5 border-warning/20'
      }`}>
        <div className={`w-2 h-2 rounded-full shrink-0 ${hasPassword && savedRut ? 'bg-success' : 'bg-warning'}`} />
        <div className="flex-1">
          {hasPassword && savedRut ? (
            <>
              <span className="text-success font-medium">Credenciales SII configuradas</span>
              <span className="text-text-disabled ml-2">RUT: {savedRut}</span>
            </>
          ) : (
            <span className="text-warning font-medium">Sin credenciales SII guardadas</span>
          )}
        </div>
        <Link href="/configuracion" className="text-xs text-primary hover:underline">
          {hasPassword ? 'Cambiar →' : 'Configurar →'}
        </Link>
      </div>

      <form onSubmit={handleImport} className="space-y-5">
        {/* Tipo de documento */}
        <div className="card p-4">
          <p className="text-xs font-semibold text-text-disabled uppercase tracking-wider mb-3">
            Tipo de documento
          </p>
          <div className="grid grid-cols-3 gap-2">
            {docTypes.map(dt => (
              <button
                key={dt.value}
                type="button"
                onClick={() => setType(dt.value)}
                className={`p-3 rounded-lg border text-left transition-all ${
                  type === dt.value
                    ? 'border-primary bg-primary/10'
                    : 'border-border hover:border-border/80 hover:bg-surface-high'
                }`}
              >
                <div className="text-xl mb-1">{dt.icon}</div>
                <p className={`text-xs font-medium ${type === dt.value ? 'text-primary' : 'text-text-primary'}`}>
                  {dt.label}
                </p>
                <p className="text-xs text-text-disabled mt-0.5">{dt.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Período */}
        <div className="card p-4">
          <p className="text-xs font-semibold text-text-disabled uppercase tracking-wider mb-3">
            Período a importar
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-text-disabled block mb-1">Mes</label>
              <select value={month} onChange={e => setMonth(+e.target.value)} className="input text-sm">
                {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                  <option key={m} value={m}>{MONTHS[m]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-text-disabled block mb-1">Año</label>
              <select value={year} onChange={e => setYear(+e.target.value)} className="input text-sm">
                {[year - 1, year, year + 1].map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Credenciales opcionales */}
        {hasPassword && (
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="custom_creds"
              checked={useCustomCreds}
              onChange={e => setUseCustomCreds(e.target.checked)}
              className="w-3.5 h-3.5 accent-primary"
            />
            <label htmlFor="custom_creds" className="text-sm text-text-secondary cursor-pointer">
              Usar credenciales diferentes (sobrescribir temporalmente)
            </label>
          </div>
        )}

        {(useCustomCreds || !hasPassword) && (
          <div className="card p-4 space-y-3">
            <p className="text-xs font-semibold text-text-disabled uppercase tracking-wider">
              Credenciales SII
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-text-disabled block mb-1">RUT empresa</label>
                <input
                  value={rut}
                  onChange={e => setRut(e.target.value)}
                  className="input text-sm font-mono"
                  placeholder="78343698-1"
                />
              </div>
              <div>
                <label className="text-xs text-text-disabled block mb-1">Clave SII</label>
                <input
                  type="password"
                  value={pass}
                  onChange={e => setPass(e.target.value)}
                  className="input text-sm"
                  placeholder="••••••••"
                />
              </div>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-start gap-2 p-3 bg-error/10 border border-error/20 rounded-lg text-sm text-error">
            <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {error}
          </div>
        )}

        {/* Resultado */}
        {result && (
          <div className="p-4 bg-success/10 border border-success/20 rounded-lg space-y-3">
            <p className="text-sm font-semibold text-success flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Importación completada
            </p>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-surface rounded-lg p-3">
                <p className="text-2xl font-black text-primary">{result.imported}</p>
                <p className="text-xs text-text-disabled mt-1">Importados</p>
              </div>
              <div className="bg-surface rounded-lg p-3">
                <p className="text-2xl font-black text-success">{result.journalized}</p>
                <p className="text-xs text-text-disabled mt-1">Contabilizados</p>
              </div>
              <div className="bg-surface rounded-lg p-3">
                <p className="text-2xl font-black text-text-secondary">{result.skipped ?? 0}</p>
                <p className="text-xs text-text-disabled mt-1">Ya existían</p>
              </div>
            </div>
            {result.errors.length > 0 && (
              <div className="space-y-1">
                {result.errors.map((e, i) => (
                  <p key={i} className="text-xs text-error">{e}</p>
                ))}
              </div>
            )}
          </div>
        )}

        <button type="submit" disabled={loading} className="btn-primary w-full py-3">
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Importando desde SII...
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
              </svg>
              Importar documentos SII
            </span>
          )}
        </button>
      </form>
    </div>
  )
}
