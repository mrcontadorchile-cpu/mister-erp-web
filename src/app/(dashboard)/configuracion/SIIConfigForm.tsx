'use client'

import { useState, useTransition, useRef } from 'react'
import { saveSiiConfig, saveSiiCertificate, connectSii, saveManualToken, clearSiiToken } from './actions'

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
  const [showTokenForm, setShowTokenForm] = useState(false)
  const [manualToken, setManualToken] = useState('')
  const [showTokenInstr, setShowTokenInstr] = useState(false)

  // Certificado
  const fileRef = useRef<HTMLInputElement>(null)
  const [certFile, setCertFile]     = useState<File | null>(null)
  const [certPass, setCertPass]     = useState('')
  const [certExp, setCertExp]       = useState(certExpiresAt)
  const [certSubjectLocal, setCertSubjectLocal] = useState(certSubject)

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

  const handleConnect = () => {
    if (!rut) { flash('Ingresa el RUT primero', true); return }
    if (!pass) { flash('Ingresa la clave SII', true); return }
    startTransition(async () => {
      // Primero guardar credenciales
      await saveSiiConfig({ sii_rut: rut, sii_password: pass })
      // Luego intentar conectar desde Vercel
      const r = await connectSii({ rut, password: pass })
      if (r.error) {
        // Si falla desde Vercel, mostrar instrucciones para token manual
        flash(`No fue posible conectar automáticamente. ${r.error}`, true)
        setShowTokenInstr(true)
      } else {
        flash('¡Conexión SII establecida correctamente!')
        setShowTokenInstr(false)
      }
    })
  }

  const handleSaveToken = async (e: React.FormEvent) => {
    e.preventDefault()
    startTransition(async () => {
      const r = await saveManualToken(manualToken)
      if (r.error) flash(r.error, true)
      else {
        flash('Token SII guardado correctamente')
        setShowTokenForm(false)
        setManualToken('')
        setShowTokenInstr(false)
      }
    })
  }

  const handleClearToken = () => {
    startTransition(async () => {
      await clearSiiToken()
      flash('Token eliminado')
    })
  }

  const handleSaveCert = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!certFile) { flash('Selecciona un archivo .pfx', true); return }
    startTransition(async () => {
      const arrayBuffer = await certFile.arrayBuffer()
      const b64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)))
      const r = await saveSiiCertificate({
        cert_data: b64,
        cert_password: certPass,
        cert_subject: certSubjectLocal,
        cert_expires_at: certExp,
      })
      if (r.error) flash(r.error, true)
      else flash('Certificado guardado correctamente')
    })
  }

  const syncColor = lastSyncStatus === 'success' ? 'text-success' :
    lastSyncStatus === 'error' ? 'text-error' : 'text-text-disabled'

  return (
    <div className="card overflow-hidden">
      {/* Info box */}
      <div className="px-5 py-4 bg-info/5 border-b border-border">
        <div className="flex items-start gap-3">
          <svg className="w-4 h-4 text-info mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="text-xs text-text-secondary space-y-1">
            <p><span className="text-text-primary font-semibold">Clave tributaria</span> — RUT + contraseña del portal SII (misiir.sii.cl). Permite rescatar facturas y boletas de honorarios.</p>
            <p><span className="text-text-primary font-semibold">Certificado digital</span> — Archivo .pfx emitido por E-Sign, Acepta u otra CA acreditada. Necesario para emitir DTEs electrónicos.</p>
          </div>
        </div>
      </div>

      {/* Estado de conexión TOKEN */}
      <div className={`px-5 py-3 border-b border-border flex items-center justify-between ${
        hasToken ? 'bg-success/5' : 'bg-surface-high/50'
      }`}>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${hasToken ? 'bg-success' : 'bg-text-disabled'}`} />
          <span className={`text-sm font-medium ${hasToken ? 'text-success' : 'text-text-disabled'}`}>
            {hasToken ? 'Sesión SII activa' : 'Sin sesión SII'}
          </span>
          {hasToken && tokenObtainedAt && (
            <span className="text-xs text-text-disabled">
              · Obtenida {new Date(tokenObtainedAt).toLocaleDateString('es-CL', {
                day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
              })}
            </span>
          )}
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

      {/* Tabs */}
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
            {t === 'clave' ? '🔑  Clave Tributaria' : '🪪  Certificado Digital'}
          </button>
        ))}
      </div>

      <div className="p-5">
        {/* Clave tributaria */}
        {tab === 'clave' && (
          <div className="space-y-4">
            <form onSubmit={handleSaveClave} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-text-disabled block mb-1">RUT empresa *</label>
                  <input
                    value={rut}
                    onChange={e => setRut(e.target.value)}
                    className="input text-sm font-mono"
                    placeholder="78.343.698-1"
                    required
                  />
                  <p className="text-xs text-text-disabled mt-1">Sin puntos, con guión. Ej: 78343698-1</p>
                </div>
                <div>
                  <label className="text-xs text-text-disabled block mb-1">
                    Clave SII *
                    {siiRut && <span className="text-success ml-2">● Guardada</span>}
                  </label>
                  <div className="relative">
                    <input
                      type={showPass ? 'text' : 'password'}
                      value={pass}
                      onChange={e => setPass(e.target.value)}
                      className="input text-sm pr-10"
                      placeholder={siiRut ? '••••••• (dejar vacío = no cambiar)' : 'Ingresa tu clave SII'}
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

              <div className="flex items-center gap-3 flex-wrap">
                <button type="submit" disabled={isPending} className="btn-ghost px-5 text-sm">
                  {isPending ? 'Guardando...' : 'Solo guardar'}
                </button>
                <button
                  type="button"
                  onClick={handleConnect}
                  disabled={isPending}
                  className="btn-primary flex items-center gap-2 px-5"
                >
                  {isPending ? (
                    <>
                      <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                      </svg>
                      Conectando...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      Guardar y conectar SII
                    </>
                  )}
                </button>
              </div>
            </form>

            {/* Instrucciones token manual (si la conexión automática falló) */}
            {showTokenInstr && (
              <div className="bg-warning/5 border border-warning/20 rounded-lg p-4 space-y-3">
                <p className="text-sm font-semibold text-warning flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                  El servidor no pudo conectar con SII directamente
                </p>
                <p className="text-xs text-text-secondary">
                  El SII bloquea conexiones automáticas desde servidores en la nube. Puedes conectarte manualmente copiando tu TOKEN de sesión desde el navegador:
                </p>
                <ol className="text-xs text-text-secondary space-y-1.5 list-decimal list-inside">
                  <li>Abre <strong className="text-text-primary">www.sii.cl</strong> en tu navegador e inicia sesión con tu clave tributaria</li>
                  <li>Presiona <kbd className="bg-surface-high px-1.5 py-0.5 rounded text-xs font-mono">F12</kbd> para abrir DevTools</li>
                  <li>Ve a la pestaña <strong className="text-text-primary">Application</strong> (o Aplicación)</li>
                  <li>En el panel izquierdo: <strong className="text-text-primary">Cookies → https://sii.cl</strong></li>
                  <li>Busca la cookie llamada <strong className="text-text-primary font-mono">TOKEN</strong> y copia su valor</li>
                  <li>Pégalo en el campo de abajo</li>
                </ol>
                <button
                  type="button"
                  onClick={() => setShowTokenForm(true)}
                  className="text-sm text-primary hover:underline font-medium"
                >
                  Ingresar TOKEN manualmente →
                </button>
              </div>
            )}

            {/* Botón para mostrar form de token manual sin haber intentado auto-conexión */}
            {!showTokenInstr && (
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => { setShowTokenForm(v => !v); setShowTokenInstr(false) }}
                  className="text-xs text-text-disabled hover:text-primary transition-colors"
                >
                  {showTokenForm ? '▲ Ocultar token manual' : '▼ Ingresar TOKEN SII manualmente'}
                </button>
              </div>
            )}

            {/* Form TOKEN manual */}
            {(showTokenForm || showTokenInstr) && (
              <form onSubmit={handleSaveToken} className="space-y-3 border border-border rounded-lg p-4 bg-surface-high/30">
                <p className="text-xs font-semibold text-text-disabled uppercase tracking-wider">TOKEN de sesión SII</p>
                <div>
                  <label className="text-xs text-text-disabled block mb-1">
                    Valor de la cookie TOKEN{' '}
                    <span className="text-text-disabled font-normal">(válido ~24 horas después de iniciar sesión en SII)</span>
                  </label>
                  <input
                    value={manualToken}
                    onChange={e => setManualToken(e.target.value)}
                    className="input text-xs font-mono w-full"
                    placeholder="Pega aquí el valor de la cookie TOKEN del SII"
                    required
                  />
                </div>
                <div className="flex gap-2">
                  <button type="submit" disabled={isPending || !manualToken.trim()} className="btn-primary px-4 text-sm">
                    {isPending ? 'Guardando...' : 'Guardar TOKEN'}
                  </button>
                  <button type="button" onClick={() => { setShowTokenForm(false); setManualToken('') }} className="btn-ghost px-4 text-sm">
                    Cancelar
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* Certificado digital */}
        {tab === 'cert' && (
          <form onSubmit={handleSaveCert} className="space-y-4">
            <div className="bg-warning/5 border border-warning/20 rounded-lg px-4 py-3 text-xs text-text-secondary">
              <p className="font-semibold text-warning mb-1">¿Cómo obtener el certificado digital?</p>
              <ol className="list-decimal list-inside space-y-1">
                <li>Contrata un certificado con <strong>E-Sign</strong> (esign.cl) o <strong>Acepta</strong> (acepta.com)</li>
                <li>Una vez emitido, descarga el archivo <strong>.pfx</strong> (o .p12)</li>
                <li>Súbelo aquí junto con su contraseña</li>
                <li>El sistema lo usará para autenticarse directamente con los Web Services del SII</li>
              </ol>
            </div>

            <div>
              <label className="text-xs text-text-disabled block mb-1">Archivo certificado (.pfx / .p12) *</label>
              <div
                className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => fileRef.current?.click()}
              >
                <input
                  ref={fileRef}
                  type="file"
                  accept=".pfx,.p12"
                  className="hidden"
                  onChange={e => setCertFile(e.target.files?.[0] ?? null)}
                />
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
                <input
                  type="password"
                  value={certPass}
                  onChange={e => setCertPass(e.target.value)}
                  className="input text-sm"
                  placeholder="Contraseña del .pfx"
                />
              </div>
              <div>
                <label className="text-xs text-text-disabled block mb-1">Fecha de vencimiento</label>
                <input
                  type="date"
                  value={certExp}
                  onChange={e => setCertExp(e.target.value)}
                  className="input text-sm"
                />
              </div>
              <div className="col-span-2">
                <label className="text-xs text-text-disabled block mb-1">Nombre del titular (CN)</label>
                <input
                  value={certSubjectLocal}
                  onChange={e => setCertSubjectLocal(e.target.value)}
                  className="input text-sm"
                  placeholder="Ej: MISTER CONTADOR SPA"
                />
              </div>
            </div>

            <button type="submit" disabled={isPending} className="btn-primary px-5">
              {isPending ? 'Guardando...' : 'Guardar certificado'}
            </button>
          </form>
        )}

        {/* Mensajes flash */}
        {error && (
          <p className="mt-4 text-xs text-error bg-error/10 px-3 py-2 rounded flex items-start gap-1.5">
            <svg className="w-3.5 h-3.5 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            {error}
          </p>
        )}
        {success && (
          <p className="mt-4 text-xs text-success bg-success/10 px-3 py-2 rounded flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            {success}
          </p>
        )}
      </div>

      {/* Estado último sync */}
      {lastSyncAt && (
        <div className="px-5 py-3 border-t border-border bg-surface-high/50 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <div className={`w-1.5 h-1.5 rounded-full ${lastSyncStatus === 'success' ? 'bg-success' : 'bg-error'}`} />
            <span className={`text-xs ${syncColor}`}>
              Última conexión: {new Date(lastSyncAt).toLocaleDateString('es-CL', {
                day: 'numeric', month: 'short', year: 'numeric',
                hour: '2-digit', minute: '2-digit',
              })}
            </span>
          </div>
          {lastSyncMessage && (
            <span className={`text-xs ${syncColor} max-w-md text-right`}>{lastSyncMessage}</span>
          )}
        </div>
      )}
    </div>
  )
}
