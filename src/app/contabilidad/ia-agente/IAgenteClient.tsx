'use client'

import { useState, useRef, useEffect, useTransition } from 'react'
import { saveConfigIA } from './actions'
import type { ConfiguracionAsistente, EntidadMapeo } from '@/types/database'

const DEFAULT_INSTRUCCIONES = `Eres un contador chileno experto en contabilidad IFRS Pymes. Tu rol es ayudar al analista contable a crear asientos de ajuste correctos. Siempre confirma los datos antes de crear un borrador. Si te falta información (monto, fecha, origen de fondos, destino), pregunta al analista antes de proceder. Nunca inventes cuentas contables.`

interface Message {
  role: 'user' | 'assistant'
  content: string
  createdBorrador?: boolean
}

const WELCOME_MESSAGE: Message = {
  role: 'assistant',
  content: '¡Hola! Soy tu asistente contable. Puedo ayudarte a crear asientos de ajuste, gastos personales de socios, anticipos y más. ¿Qué necesitas registrar hoy?',
}

// ── Chat ─────────────────────────────────────────────────────

function ChatTab({ companyId }: { companyId: string }) {
  const storageKey = `ia_chat_${companyId}`

  const [messages, setMessages] = useState<Message[]>(() => {
    if (typeof window === 'undefined') return [WELCOME_MESSAGE]
    try {
      const saved = localStorage.getItem(storageKey)
      const parsed = saved ? JSON.parse(saved) : null
      return parsed?.length ? parsed : [WELCOME_MESSAGE]
    } catch {
      return [WELCOME_MESSAGE]
    }
  })
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Persistir en localStorage cada vez que cambian los mensajes
  useEffect(() => {
    try { localStorage.setItem(storageKey, JSON.stringify(messages)) } catch {}
  }, [messages, storageKey])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  function handleNuevaConversacion() {
    if (!confirm('¿Iniciar una nueva conversación? Se borrará el historial actual.')) return
    setMessages([WELCOME_MESSAGE])
    try { localStorage.removeItem(storageKey) } catch {}
  }

  async function sendMessage() {
    const text = input.trim()
    if (!text || loading) return

    const newMessages: Message[] = [...messages, { role: 'user', content: text }]
    setMessages(newMessages)
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/ia-agente', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
        }),
      })

      const responseText = await res.text()
      const createdBorrador = responseText.includes('Borrador creado exitosamente')

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: responseText,
        createdBorrador,
      }])
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: '❌ Error de conexión. Intenta nuevamente.',
      }])
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-220px)] min-h-[400px]">
      {/* Barra superior del chat */}
      <div className="flex items-center justify-between pb-3 border-b border-border mb-1">
        <p className="text-xs text-text-disabled">
          {messages.length - 1 > 0
            ? `${messages.length - 1} mensaje${messages.length - 1 > 1 ? 's' : ''} en esta conversación`
            : 'Conversación nueva'}
        </p>
        <button
          onClick={handleNuevaConversacion}
          className="text-xs text-text-disabled hover:text-error transition-colors px-2 py-1 rounded hover:bg-error/10"
        >
          + Nueva conversación
        </button>
      </div>

      {/* Mensajes */}
      <div className="flex-1 overflow-y-auto space-y-4 py-4 pr-1">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${
              msg.role === 'user'
                ? 'bg-primary text-white rounded-br-sm'
                : 'bg-surface-high text-text-primary rounded-bl-sm border border-border'
            }`}>
              <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
              {msg.createdBorrador && (
                <a
                  href="/contabilidad/validaciones"
                  className="inline-flex items-center gap-1.5 mt-2 text-xs font-semibold bg-success/20 text-success px-2.5 py-1 rounded-full hover:bg-success/30 transition-colors"
                >
                  ✓ Ver en Validaciones →
                </a>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-surface-high border border-border rounded-2xl rounded-bl-sm px-4 py-3">
              <div className="flex gap-1 items-center h-4">
                <span className="w-1.5 h-1.5 bg-text-disabled rounded-full animate-bounce [animation-delay:0ms]" />
                <span className="w-1.5 h-1.5 bg-text-disabled rounded-full animate-bounce [animation-delay:150ms]" />
                <span className="w-1.5 h-1.5 bg-text-disabled rounded-full animate-bounce [animation-delay:300ms]" />
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-border pt-4">
        <div className="flex gap-2 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Escribe una instrucción… (ej: &quot;Gasto personal de Juan Pérez por $50.000 de caja chica&quot;)"
            disabled={loading}
            rows={2}
            className="flex-1 bg-surface-high border border-border rounded-xl px-4 py-3 text-sm text-text-primary placeholder:text-text-disabled focus:outline-none focus:border-primary resize-none disabled:opacity-60"
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || loading}
            className="px-4 py-3 bg-primary text-white rounded-xl font-semibold text-sm hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
          >
            Enviar
          </button>
        </div>
        <p className="text-[10px] text-text-disabled mt-1.5 ml-1">
          Enter para enviar · Shift+Enter para nueva línea
        </p>
      </div>
    </div>
  )
}

// ── Configuración ─────────────────────────────────────────────

function ConfigTab({ config }: { config: ConfiguracionAsistente | null }) {
  const [instrucciones, setInstrucciones] = useState(config?.instrucciones_maestras ?? DEFAULT_INSTRUCCIONES)
  const [umbral, setUmbral] = useState(config?.umbral_autonomia ?? 0.75)
  const [autoNC, setAutoNC] = useState(config?.auto_matching_nc ?? false)
  const [entidades, setEntidades] = useState<EntidadMapeo[]>(config?.mapeo_entidades ?? [])
  const [pending, startTransition] = useTransition()
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function addEntidad() {
    setEntidades(prev => [...prev, { nombre: '', rut: '', cuenta_particular: '', cuenta_empresa: '' }])
  }

  function updateEntidad(i: number, field: keyof EntidadMapeo, value: string) {
    setEntidades(prev => prev.map((e, idx) => idx === i ? { ...e, [field]: value } : e))
  }

  function removeEntidad(i: number) {
    setEntidades(prev => prev.filter((_, idx) => idx !== i))
  }

  function handleSave() {
    setError(null)
    setSaved(false)
    startTransition(async () => {
      try {
        await saveConfigIA({
          instrucciones_maestras: instrucciones,
          umbral_autonomia: umbral,
          auto_matching_nc: autoNC,
          mapeo_entidades: entidades.filter(e => e.nombre.trim()),
        })
        setSaved(true)
        setTimeout(() => setSaved(false), 3000)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error al guardar')
      }
    })
  }

  return (
    <div className="space-y-8 max-w-2xl">

      {/* Instrucciones maestras */}
      <div>
        <label className="block text-sm font-semibold text-text-primary mb-2">
          Instrucciones del Agente
        </label>
        <p className="text-xs text-text-secondary mb-2">
          Define el comportamiento del asistente: su rol, tono, reglas de negocio específicas de tu empresa.
        </p>
        <textarea
          value={instrucciones}
          onChange={e => setInstrucciones(e.target.value)}
          rows={6}
          className="w-full bg-surface-high border border-border rounded-xl px-4 py-3 text-sm text-text-primary focus:outline-none focus:border-primary resize-y"
        />
      </div>

      {/* Umbral de autonomía */}
      <div>
        <label className="block text-sm font-semibold text-text-primary mb-2">
          Umbral de Autonomía: <span className="text-primary">{Math.round(umbral * 100)}%</span>
        </label>
        <p className="text-xs text-text-secondary mb-3">
          Si la confianza del agente en las cuentas es menor a este umbral, pedirá confirmación antes de crear el borrador.
        </p>
        <input
          type="range"
          min={50}
          max={100}
          step={5}
          value={Math.round(umbral * 100)}
          onChange={e => setUmbral(Number(e.target.value) / 100)}
          className="w-full accent-primary"
        />
        <div className="flex justify-between text-[10px] text-text-disabled mt-1">
          <span>50% — Siempre pregunta</span>
          <span>100% — Máxima autonomía</span>
        </div>
      </div>

      {/* Auto-matching NC */}
      <div className="flex items-center justify-between p-4 bg-surface-high rounded-xl border border-border">
        <div>
          <p className="text-sm font-semibold text-text-primary">Auto-matching Notas de Crédito</p>
          <p className="text-xs text-text-secondary mt-0.5">
            El agente intentará cruzar automáticamente las NC pendientes con sus facturas originales.
          </p>
        </div>
        <button
          onClick={() => setAutoNC(v => !v)}
          className={`relative w-11 h-6 rounded-full transition-colors ${autoNC ? 'bg-primary' : 'bg-surface-high border border-border'}`}
        >
          <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${autoNC ? 'translate-x-5' : 'translate-x-0.5'}`} />
        </button>
      </div>

      {/* Mapeo de entidades */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-sm font-semibold text-text-primary">Mapa de Entidades</p>
            <p className="text-xs text-text-secondary mt-0.5">
              Asocia personas (socios, empleados) con sus cuentas contables para que el agente las identifique automáticamente.
            </p>
          </div>
          <button
            onClick={addEntidad}
            className="text-xs font-semibold text-primary hover:underline shrink-0 ml-4"
          >
            + Agregar
          </button>
        </div>

        {entidades.length === 0 ? (
          <div className="text-center py-8 border border-dashed border-border rounded-xl text-text-disabled text-xs">
            Sin entidades configuradas. Agrega socios o personas para que el agente las reconozca.
          </div>
        ) : (
          <div className="space-y-3">
            {entidades.map((e, i) => (
              <div key={i} className="grid grid-cols-[1fr_1fr_1fr_1fr_auto] gap-2 items-center bg-surface-high border border-border rounded-xl px-3 py-3">
                <input
                  value={e.nombre}
                  onChange={ev => updateEntidad(i, 'nombre', ev.target.value)}
                  placeholder="Nombre"
                  className="bg-surface border border-border rounded-lg px-2.5 py-1.5 text-xs text-text-primary focus:outline-none focus:border-primary"
                />
                <input
                  value={e.rut}
                  onChange={ev => updateEntidad(i, 'rut', ev.target.value)}
                  placeholder="RUT (12345678-9)"
                  className="bg-surface border border-border rounded-lg px-2.5 py-1.5 text-xs text-text-primary focus:outline-none focus:border-primary font-mono"
                />
                <input
                  value={e.cuenta_particular ?? ''}
                  onChange={ev => updateEntidad(i, 'cuenta_particular', ev.target.value)}
                  placeholder="Cta. personal"
                  className="bg-surface border border-border rounded-lg px-2.5 py-1.5 text-xs text-text-primary focus:outline-none focus:border-primary font-mono"
                />
                <input
                  value={e.cuenta_empresa ?? ''}
                  onChange={ev => updateEntidad(i, 'cuenta_empresa', ev.target.value)}
                  placeholder="Cta. empresa"
                  className="bg-surface border border-border rounded-lg px-2.5 py-1.5 text-xs text-text-primary focus:outline-none focus:border-primary font-mono"
                />
                <button
                  onClick={() => removeEntidad(i)}
                  className="text-error hover:text-error/70 transition-colors text-xs px-1"
                  title="Eliminar"
                >
                  ✕
                </button>
              </div>
            ))}
            <p className="text-[10px] text-text-disabled px-1">
              Columnas: Nombre · RUT · Cuenta personal (1.1.9.x) · Cuenta empresa (2.1.9.x)
            </p>
          </div>
        )}
      </div>

      {/* Guardar */}
      {error && <p className="text-xs text-error">{error}</p>}
      <button
        onClick={handleSave}
        disabled={pending}
        className="px-6 py-2.5 bg-primary text-white font-semibold text-sm rounded-xl hover:bg-primary/90 disabled:opacity-50 transition-colors"
      >
        {pending ? 'Guardando…' : saved ? '✓ Guardado' : 'Guardar configuración'}
      </button>
    </div>
  )
}

// ── Pantalla principal ────────────────────────────────────────

export function IAgenteClient({ config, companyId }: { config: ConfiguracionAsistente | null; companyId: string }) {
  const [tab, setTab] = useState<'chat' | 'config'>('chat')

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-xl">✨</div>
          <div>
            <h1 className="text-2xl font-bold text-text-primary">Agente IA</h1>
            <p className="text-text-secondary text-sm">Asistente contable inteligente — crea asientos con lenguaje natural</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-surface-high rounded-xl p-1 mb-6 w-fit">
        {(['chat', 'config'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-5 py-2 text-sm font-medium rounded-lg transition-colors ${
              tab === t
                ? 'bg-surface text-text-primary shadow-sm'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            {t === 'chat' ? '💬 Chat' : '⚙️ Configuración'}
          </button>
        ))}
      </div>

      {tab === 'chat' ? <ChatTab companyId={companyId} /> : <ConfigTab config={config} />}
    </div>
  )
}
