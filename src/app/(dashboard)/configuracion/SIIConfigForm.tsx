'use client'

import { useState, useTransition, useRef } from 'react'
import { saveSiiConfig, saveSiiCertificate, saveManualToken, clearSiiToken } from './actions'

interface Props {
  siiRut: string
  certEnabled: boolean
  certSubject: string
  certExpiresAt: string
  lastSyncAt: string | null
  lastSyncStatus: string | null
  lastSyncMessage: string | null
  hasToken: boolean
  tokenObtainedAt: string | null
}

export function SIIConfigForm({
  siiRut,
  certEnabled,
  certSubject,
  certExpiresAt,
  lastSyncAt,
  lastSyncStatus,
  lastSyncMessage,
  hasToken,
  tokenObtainedAt,
}: Props) {
  const [tab, setTab] = useState<'clave' | 'cert'>('clave')
  const [isPending, startTransition] = useTransition()
  const [success, setSuccess] = useState('')
  const [error, setError]   = useState('')

  // Clave tributaria
  const [rut, setRut]     = useState(siiRut)
  const [pass, setPass]   = useState('')
  const [showPass, setShowPass] = useState(false)

  // Token manual
  const [manualToken, setManualToken] = useState('')

  // Certificado
  const fileRef = useRef<HTMLInputElement>(null)
  const [certFile, setCertFile]     = useState<File | null>(null)
  const [certPass, setCertPass]     = useState('')
  const [certExp, setCertExp]       = useState(certExpiresAt)
  const [certSubjectLocal, setCertSubjectLocal] = useState(certSubject)
  const [certOwnerRut, setCertOwnerRut] = useState('')

  const flash = (msg: string, isError = false) => {
    if (isError) { setError(msg); setSuccess('') }
    else { setSuccess(msg); setError('') }
    setTimeout(() => { setSuccess(''); setError('') }, 6000)
  }

  const handleSaveClave = async (e: React.FormEvent) => {
    e.preventDefault()
    startTransition(async () => {
      const r = await saveSiiConfig({ sii_rut: rut, sii_password: pass })
      if (r.error) flash(r.error, true)
      else flash('Credenciales guardadas correctamente')
    })
  }

  const handleSaveToken = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!manualToken.trim()) { flash('Pega el valor del TOKEN', true); return }
    startTransition(async () => {
      const r = await saveManualToken(manualToken.trim())
      if (r.error) flash(r.error, true)
      else {
        flash('¡TOKEN SII guardado! Ya puedes importar documentos.')
        setManualToken('')
      }
    })
  }

  const handleClearToken = () => {
    startTransition(async () => {
      await clearSiiToken()
      flash('Sesión SII desconectada')
    })
  }

  const handleSaveCert = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!certFile) { flash('Selecciona un archivo .pfx', true); return }
    startTransition(async () => {
      const arrayBuffer = await certFile.arrayBuffer()
      const b64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)))
      const r = await saveSiiCertificate({
        cert_data:       b64,
        cert_password:   certPass,
        cert_subject:    certSubjectLocal,
        cert_expires_at: certExp,
        cert_owner_rut:  certOwnerRut,
      })
      if (r.error) flash(r.error, true)
      else flash('Certificado guardado correctamente')
    })
  }

  const syncColor = lastSyncStatus === 'success' ? 'text-success' :
    lastSyncStatus === 'error' ? 'text-error' : 'text-text-disabled'

  return (
    <div className="card overflow-hidden">

      {/* ── Estado de sesión SII ── */}
      <div className={`px-5 py-4 border-b border-border ${hasToken ? 'bg-success/5' : 'bg-warning/5'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${hasToken ? 'bg-success animate-pulse' : 'bg-warning'}`} />
            <div>
              <p className={`text-sm font-semibold ${hasToken ? 'text-success' : 'text-warning'}`}>
                {hasToken ? 'Sesión SII activa' : 'Sin sesión SII activa'}
              </p>
              {hasToken && tokenObtainedAt && (
                <p className="text-xs text-text-disabled">
                  Conectado {new Date(tokenObtainedAt).toLocaleDateString('es-CL', {
                    day: 'numeric', month: 'short', year: 'numeric',
                    hour: '2-digit', minute: '2-digit',
                  })}
                </p>
              )}
              {!hasToken && (
                <p className="text-xs text-text-disabled">Sigue los pasos de abajo para conectar</p>
              )}
            </div>
          </div>
          {hasToken && (
            <button
              type="button"
              onClick={handleClearToken}
              disabled={isPending}
              className="text-xs text-error hover:underline disabled:opacity-50"
            >
              Desconectar
            </button>
          )}
        </div>
      </div>

      {/* ── TOKEN: siempre visible, es el método principal ── */}
      <div className="p-5 border-b border-border">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-base">🔑</span>
          <h3 className="text-sm font-bold text-text-primary">Conectar con TOKEN SII</h3>
          <span className="badge bg-primary/10 text-primary text-xs">Recomendado</span>
        </div>

        {/* Instrucciones compactas */}
        <div className="bg-surface-high rounded-lg p-3 mb-4 text-xs text-text-secondary space-y-1.5">
          <p className="font-semibold text-text-primary">Cómo obtener tu TOKEN (2 minutos):</p>
          <div className="space-y-1">
            <p>1. Abre <strong className="text-text-primary">www.sii.cl</strong> en tu navegador e inicia sesión</p>
            <p>2. Presiona <kbd className="bg-surface px-1.5 py-0.5 rounded border border-border font-mono">F12</kbd> para abrir DevTools</p>
            <p>3. Ve a <strong className="text-text-primary">Application</strong> → <strong className="text-text-primary">Cookies</strong> → selecciona <code className="bg-surface px-1 rounded font-mono">https://sii.cl</code></p>
            <p>4. Busca la cookie <strong className="text-text-primary font-mono">TOKEN</strong> y copia su valor</p>
            <p>5. Pégalo aquí abajo ↓</p>
          </div>
        </div>

        <form onSubmit={handleSaveToken} className="flex gap-2">
          <div className="flex-1">
            <input
              value={manualToken}
              onChange={e => setManualToken(e.target.value)}
              className="input text-sm font-mono w-full"
              placeholder="Pega aquí el valor de la cookie TOKEN"
              autoComplete="off"
              spellCheck={false}
            />
            <p className="text-xs text-text-disabled mt-1">
              El TOKEN expira cuando cierras sesión en SII o después de ~24 horas. Renuévalo cuando dejes de funcionar.
            </p>
          </div>
          <button
            type="submit"
            disabled={isPending || !manualToken.trim()}
            className="btn-primary px-5 self-start whitespace-nowrap"
          >
            {isPending ? 'Guardando...' : 'Guardar TOKEN'}
          </button>
        </form>
      </div>

      {/* ── Tabs: Clave tributaria y Certificado ── */}
      <div>
        <div className="flex border-b border-border px-5">
          {(['clave', 'cert'] as const).map(t => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors -mb-px ${
                tab === t
                  ? 'border-primary text-primary'
                  : 'border-transparent text-text-disabled hover:text-text-secondary'
              }`}
            >
              {t === 'clave' ? '🔒  Guardar Credenciales' : '🪪  Certificado Digital'}
            </button>
          ))}
        </div>

        <div className="p-5">
          {/* Clave tributaria */}
          {tab === 'clave' && (
            <form onSubmit={handleSaveClave} className="space-y-4">
              <p className="text-xs text-text-disabled">
                Guarda tu RUT y clave SII. Se usan solo para intentar obtener el TOKEN automáticamente cuando el servidor pueda conectarse.
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
                  <p className="text-xs text-text-disabled mt-1">Sin puntos, con guión</p>
                </div>
                <div>
                  <label className="text-xs text-text-disabled block mb-1">
                    Clave SII
                    {siiRut && <span className="text-success ml-2">● Guardada</span>}
                  </label>
                  <div className="relative">
                    <input
                      type={showPass ? 'text' : 'password'}
                      value={pass}
                      onChange={e => setPass(e.target.value)}
                      className="input text-sm pr-10"
                      placeholder={siiRut ? '••••••• (vacío = no cambiar)' : 'Clave tributaria SII'}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass(s => !s)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-text-disabled hover:text-text-secondary"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        {showPass
                          ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                          : <><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></>
                        }
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
              <button type="submit" disabled={isPending} className="btn-ghost px-5 text-sm">
                {isPending ? 'Guardando...' : 'Guardar credenciales'}
              </button>
            </form>
          )}

          {/* Certificado digital */}
          {tab === 'cert' && (
            <form onSubmit={handleSaveCert} className="space-y-4">
              <div className="bg-info/5 border border-info/20 rounded-lg px-4 py-3 text-xs text-text-secondary">
                <p className="font-semibold text-info mb-1">Certificado digital — conexión permanente y sin expiración</p>
                <p>Con un certificado digital (.pfx) la conexión al SII es automática y no requiere TOKEN manual. Ideal para múltiples empresas. Obtén el certificado con <strong>E-Sign</strong> (esign.cl) o <strong>Acepta</strong> (acepta.com).</p>
              </div>

              <div>
                <label className="text-xs text-text-disabled block mb-1">Archivo certificado (.pfx / .p12) *</label>
                <div
                  className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => fileRef.current?.click()}
                >
                  <input ref={fileRef} type="file" accept=".pfx,.p12" className="hidden"
                    onChange={e => setCertFile(e.target.files?.[0] ?? null)} />
                  {certFile ? (
                    <div className="text-success text-sm">
                      <p className="font-medium">✓ {certFile.name}</p>
                      <p className="text-xs text-text-disabled mt-1">{(certFile.size / 1024).toFixed(1)} KB</p>
                    </div>
                  ) : (
                    <>
                      <svg className="w-8 h-8 text-text-disabled mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                          d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                      <p className="text-sm text-text-disabled">Haz clic para seleccionar el archivo .pfx</p>
                      {certEnabled && certSubject && (
                        <p className="text-xs text-success mt-2">Certificado actual: {certSubject}</p>
                      )}
                    </>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-text-disabled block mb-1">Contraseña del certificado *</label>
                  <input type="password" value={certPass} onChange={e => setCertPass(e.target.value)}
                    className="input text-sm" placeholder="Contraseña del .pfx" />
                </div>
                <div>
                  <label className="text-xs text-text-disabled block mb-1">Fecha de vencimiento</label>
                  <input type="date" value={certExp} onChange={e => setCertExp(e.target.value)} className="input text-sm" />
                </div>
                <div>
                  <label className="text-xs text-text-disabled block mb-1">Nombre del titular (CN)</label>
                  <input value={certSubjectLocal} onChange={e => setCertSubjectLocal(e.target.value)}
                    className="input text-sm" placeholder="Ej: JUAN PEREZ GONZALEZ" />
                </div>
                <div>
                  <label className="text-xs text-text-disabled block mb-1">
                    RUT del titular del certificado
                    <span className="text-text-disabled font-normal ml-1">(si difiere del RUT empresa)</span>
                  </label>
                  <input value={certOwnerRut} onChange={e => setCertOwnerRut(e.target.value)}
                    className="input text-sm font-mono" placeholder="Ej: 12345678-9" />
                  <p className="text-xs text-text-disabled mt-1">Solo si el cert. fue emitido a nombre de una persona natural</p>
                </div>
              </div>

              <button type="submit" disabled={isPending} className="btn-primary px-5">
                {isPending ? 'Guardando...' : 'Guardar certificado'}
              </button>
            </form>
          )}

          {/* Mensajes flash */}
          {error && (
            <p className="mt-4 text-xs text-error bg-error/10 px-3 py-2.5 rounded flex items-start gap-1.5">
              <svg className="w-3.5 h-3.5 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              {error}
            </p>
          )}
          {success && (
            <p className="mt-4 text-xs text-success bg-success/10 px-3 py-2.5 rounded flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              {success}
            </p>
          )}
        </div>
      </div>

      {/* Estado último sync */}
      {lastSyncAt && (
        <div className="px-5 py-3 border-t border-border bg-surface-high/50 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <div className={`w-1.5 h-1.5 rounded-full ${lastSyncStatus === 'success' ? 'bg-success' : 'bg-error'}`} />
            <span className={`text-xs ${syncColor}`}>
              Último acceso: {new Date(lastSyncAt).toLocaleDateString('es-CL', {
                day: 'numeric', month: 'short', year: 'numeric',
                hour: '2-digit', minute: '2-digit',
              })}
            </span>
          </div>
          {lastSyncMessage && (
            <span className={`text-xs ${syncColor} max-w-sm text-right`}>{lastSyncMessage}</span>
          )}
        </div>
      )}
    </div>
  )
}
