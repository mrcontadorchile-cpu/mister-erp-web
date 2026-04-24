'use client'

import { useState, useTransition } from 'react'
import { saveTemplate, deleteTemplate } from './templateActions'
import type { Template, TemplateLine } from './templateActions'

interface Props {
  templates:  Template[]
  currentGlosa: string
  currentLines: TemplateLine[]
  onLoad: (glosa: string, lines: TemplateLine[]) => void
}

export function TemplatePanel({ templates: initial, currentGlosa, currentLines, onLoad }: Props) {
  const [open, setOpen]           = useState(false)
  const [templates, setTemplates] = useState<Template[]>(initial)
  const [tab, setTab]             = useState<'load' | 'save'>('load')
  const [name, setName]           = useState('')
  const [isPending, startTransition] = useTransition()
  const [msg, setMsg]             = useState('')

  function handleLoad(t: Template) {
    onLoad(t.glosa, t.lines)
    setOpen(false)
  }

  function handleSave() {
    if (!name.trim()) { setMsg('Ingresa un nombre para la plantilla'); return }
    const validLines = currentLines.filter(l => l.account_id && (l.debit > 0 || l.credit > 0))
    if (validLines.length < 2) { setMsg('La plantilla debe tener al menos 2 líneas con montos'); return }
    setMsg('')
    startTransition(async () => {
      const res = await saveTemplate(name.trim(), currentGlosa, validLines)
      if (!res.ok) { setMsg(res.error ?? 'Error al guardar'); return }
      // Agregar a la lista local sin recargar
      setTemplates(prev => [...prev, {
        id:         crypto.randomUUID(),
        name:       name.trim(),
        glosa:      currentGlosa,
        lines:      validLines,
        created_at: new Date().toISOString(),
      }].sort((a, b) => a.name.localeCompare(b.name)))
      setName('')
      setMsg('Plantilla guardada ✓')
      setTimeout(() => setMsg(''), 3000)
    })
  }

  function handleDelete(id: string) {
    if (!confirm('¿Eliminar esta plantilla?')) return
    startTransition(async () => {
      await deleteTemplate(id)
      setTemplates(prev => prev.filter(t => t.id !== id))
    })
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn-ghost flex items-center gap-2 text-sm border border-border px-3 py-2 rounded-lg hover:border-primary/40"
        title="Plantillas de asientos recurrentes"
      >
        <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
        Plantillas
      </button>

      {open && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
          onClick={e => { if (e.target === e.currentTarget) setOpen(false) }}
        >
          <div className="bg-surface border border-border rounded-xl w-full max-w-lg shadow-2xl flex flex-col max-h-[80vh]">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h3 className="font-bold text-text-primary">Plantillas de asientos</h3>
              <button onClick={() => setOpen(false)} className="text-text-disabled hover:text-text-primary">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-border">
              {(['load', 'save'] as const).map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => { setTab(t); setMsg('') }}
                  className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
                    tab === t
                      ? 'text-primary border-b-2 border-primary'
                      : 'text-text-disabled hover:text-text-secondary'
                  }`}
                >
                  {t === 'load' ? 'Cargar plantilla' : 'Guardar actual como plantilla'}
                </button>
              ))}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-5">
              {tab === 'load' && (
                templates.length === 0 ? (
                  <div className="text-center py-10 text-text-disabled text-sm">
                    <p className="mb-1">Sin plantillas guardadas</p>
                    <p className="text-xs">Crea un asiento y guárdalo como plantilla →</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {templates.map(t => (
                      <div key={t.id} className="flex items-center gap-3 card p-3 hover:border-primary/30 transition-colors">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-text-primary truncate">{t.name}</p>
                          {t.glosa && (
                            <p className="text-xs text-text-disabled truncate">{t.glosa}</p>
                          )}
                          <p className="text-xs text-text-disabled mt-0.5">
                            {t.lines.length} línea{t.lines.length !== 1 ? 's' : ''}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleLoad(t)}
                          className="text-xs text-primary hover:underline shrink-0 px-2 py-1"
                        >
                          Cargar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(t.id)}
                          disabled={isPending}
                          className="text-xs text-error/70 hover:text-error shrink-0 px-1"
                          title="Eliminar plantilla"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )
              )}

              {tab === 'save' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1.5">
                      Nombre de la plantilla <span className="text-error">*</span>
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      placeholder="Ej: Depreciación mensual, Provisión sueldos..."
                      className="input w-full text-sm"
                    />
                  </div>

                  <div className="bg-surface-high rounded-lg p-3 text-xs text-text-disabled">
                    <p className="font-medium text-text-secondary mb-1">Se guardará:</p>
                    <p>• Glosa: <span className="text-text-primary">{currentGlosa || '(vacía)'}</span></p>
                    <p>• {currentLines.filter(l => l.account_id && (l.debit > 0 || l.credit > 0)).length} línea(s) con cuenta y monto</p>
                    <p className="mt-1 text-text-disabled/70 italic">Los montos se guardan para reutilizar como base (puedes editarlos al cargar)</p>
                  </div>

                  {msg && (
                    <p className={`text-xs ${msg.includes('✓') ? 'text-success' : 'text-error'}`}>{msg}</p>
                  )}

                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={isPending}
                    className="btn-primary w-full text-sm"
                  >
                    {isPending ? 'Guardando...' : 'Guardar como plantilla'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
