'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function ImportarSiiPage() {
  const [year,  setYear]  = useState(new Date().getFullYear())
  const [month, setMonth] = useState(new Date().getMonth() + 1)
  const [type,  setType]  = useState<'FACTURA_COMPRA' | 'FACTURA_VENTA' | 'BOLETA_HONORARIO'>('FACTURA_COMPRA')
  const [loading, setLoading] = useState(false)
  const [result,  setResult]  = useState<{ imported: number; journalized: number; errors: string[] } | null>(null)
  const [error,   setError]   = useState<string | null>(null)

  const MONTHS = ['','Enero','Febrero','Marzo','Abril','Mayo','Junio',
                  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

  async function handleImport(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setResult(null)
    setError(null)

    const form = new FormData(e.currentTarget)
    const supabase = createClient()

    const { data: { user } } = await supabase.auth.getUser()
    const { data: profile }  = await supabase
      .from('user_profiles').select('company_id').eq('id', user!.id).single()

    try {
      const { data, error: fnError } = await supabase.functions.invoke('sii-fetch-invoices', {
        body: {
          company_id: profile?.company_id,
          rut:        form.get('rut'),
          clave_sii:  form.get('clave_sii'),
          year, month, type,
        },
      })

      if (fnError) throw new Error(fnError.message)
      setResult(data)
    } catch (err: any) {
      setError(err.message ?? 'Error al importar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-8 max-w-xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">Importar desde SII</h1>
      <p className="text-text-secondary text-sm mb-8">
        Descarga y contabiliza automáticamente documentos del SII
      </p>

      <form onSubmit={handleImport} className="space-y-5">
        <div className="card p-5 space-y-4">
          <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wide">
            Credenciales SII
          </h2>

          <div>
            <label className="block text-sm text-text-secondary mb-1.5">RUT empresa</label>
            <input name="rut" className="input" placeholder="78343698-1" required />
          </div>

          <div>
            <label className="block text-sm text-text-secondary mb-1.5">Clave SII</label>
            <input name="clave_sii" type="password" className="input" placeholder="••••••••" required />
          </div>
        </div>

        <div className="card p-5 space-y-4">
          <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wide">
            Parámetros
          </h2>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-text-secondary mb-1.5">Mes</label>
              <select value={month} onChange={e => setMonth(+e.target.value)} className="input text-sm">
                {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                  <option key={m} value={m}>{MONTHS[m]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-text-secondary mb-1.5">Año</label>
              <select value={year} onChange={e => setYear(+e.target.value)} className="input text-sm">
                {[year - 1, year, year + 1].map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm text-text-secondary mb-1.5">Tipo de documento</label>
            <select
              value={type}
              onChange={e => setType(e.target.value as any)}
              className="input text-sm"
            >
              <option value="FACTURA_COMPRA">Facturas de Compra</option>
              <option value="FACTURA_VENTA">Facturas de Venta</option>
              <option value="BOLETA_HONORARIO">Boletas de Honorarios</option>
            </select>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-start gap-2 p-3 bg-error/10 border border-error/20 rounded-lg text-sm text-error">
            <span>⚠</span> {error}
          </div>
        )}

        {/* Resultado */}
        {result && (
          <div className="p-4 bg-success/10 border border-success/20 rounded-lg space-y-2">
            <p className="text-sm font-semibold text-success">Importación completada</p>
            <div className="grid grid-cols-2 gap-2 text-sm text-text-secondary">
              <span>Importados:</span>
              <span className="text-text-primary font-mono">{result.imported}</span>
              <span>Contabilizados:</span>
              <span className="text-text-primary font-mono">{result.journalized}</span>
              {result.errors.length > 0 && (
                <>
                  <span className="text-error">Errores:</span>
                  <span className="text-error font-mono">{result.errors.length}</span>
                </>
              )}
            </div>
            {result.errors.length > 0 && (
              <div className="mt-2 space-y-1">
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
          ) : 'Importar documentos'}
        </button>
      </form>
    </div>
  )
}
