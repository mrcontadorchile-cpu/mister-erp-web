'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { formatCLP, accountTypeColor } from '@/lib/utils'
import { DOC_TYPES, docTypeShort } from '@/lib/doc-types'
import { createJournalEntry, getOpenDocuments } from '../actions'
import type { OpenDoc } from '../actions'
import type { Account, CostCenter, AccountType } from '@/types/database'

type AccRow = Pick<Account, 'id' | 'code' | 'name' | 'type' | 'nature' | 'cost_center_required'> & { has_auxiliary: boolean }
type CCRow  = Pick<CostCenter, 'id' | 'code' | 'name'>
type AuxRow = { id: string; code: string; name: string; type: string }

interface Line {
  id:             number
  account_id:     string
  cost_center_id: string
  auxiliary_id:   string
  doc_type:       string
  doc_number:     string
  ref_doc_type:   string   // referencia a doc previo
  ref_doc_number: string   // referencia a doc previo
  debit:          string
  credit:         string
  description:    string
}

const newLine = (id: number): Line => ({
  id, account_id: '', cost_center_id: '', auxiliary_id: '',
  doc_type: '', doc_number: '',
  ref_doc_type: '', ref_doc_number: '',
  debit: '', credit: '', description: '',
})

let lineCounter = 2

interface Props {
  accounts:    AccRow[]
  costCenters: CCRow[]
  auxiliaries: AuxRow[]
}

export function NuevoAsientoForm({ accounts, costCenters, auxiliaries }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [glosa, setGlosa]   = useState('')
  const [date, setDate]     = useState(new Date().toISOString().split('T')[0])
  const [lines, setLines]   = useState<Line[]>([newLine(0), newLine(1)])
  const [error, setError]   = useState('')

  // Cache de documentos abiertos por auxiliar
  const [openDocsCache, setOpenDocsCache] = useState<Map<string, OpenDoc[]>>(new Map())
  const [loadingAux, setLoadingAux]       = useState<Set<string>>(new Set())

  const totalDebit  = lines.reduce((s, l) => s + (parseFloat(l.debit)  || 0), 0)
  const totalCredit = lines.reduce((s, l) => s + (parseFloat(l.credit) || 0), 0)
  const balanced    = Math.abs(totalDebit - totalCredit) < 0.01 && totalDebit > 0

  const addLine = () => {
    setLines(l => [...l, newLine(lineCounter++)])
  }

  const removeLine = (id: number) => {
    if (lines.length <= 2) return
    setLines(l => l.filter(x => x.id !== id))
  }

  const updateLine = (id: number, field: keyof Line, value: string) => {
    setLines(l => l.map(x => {
      if (x.id !== id) return x
      if (field === 'account_id') {
        return { ...x, account_id: value, cost_center_id: '', auxiliary_id: '', ref_doc_type: '', ref_doc_number: '' }
      }
      if (field === 'auxiliary_id') {
        // Limpiar referencias al cambiar auxiliar
        const updated = { ...x, auxiliary_id: value, ref_doc_type: '', ref_doc_number: '' }
        // Cargar documentos abiertos si no están en cache
        if (value && !openDocsCache.has(value)) {
          setLoadingAux(prev => new Set(prev).add(value))
          getOpenDocuments(value).then(docs => {
            setOpenDocsCache(prev => new Map(prev).set(value, docs))
            setLoadingAux(prev => { const s = new Set(prev); s.delete(value); return s })
          })
        }
        return updated
      }
      return { ...x, [field]: value }
    }))
  }

  // Setter atómico para referencia (tipo + número a la vez)
  const setRef = (lineId: number, refType: string, refNumber: string) => {
    setLines(l => l.map(x => x.id === lineId
      ? { ...x, ref_doc_type: refType, ref_doc_number: refNumber }
      : x
    ))
  }

  const setDebit = (id: number, value: string) => {
    setLines(l => l.map(x => x.id === id ? { ...x, debit: value, credit: value ? '' : x.credit } : x))
  }

  const setCredit = (id: number, value: string) => {
    setLines(l => l.map(x => x.id === id ? { ...x, credit: value, debit: value ? '' : x.debit } : x))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    for (const line of lines) {
      if (!line.account_id) continue
      const acc = accounts.find(a => a.id === line.account_id)
      if (!acc) continue
      if (acc.cost_center_required && !line.cost_center_id) {
        setError(`La cuenta "${acc.code} — ${acc.name}" requiere centro de costo.`)
        return
      }
      if (acc.has_auxiliary && !line.auxiliary_id) {
        setError(`La cuenta "${acc.code} — ${acc.name}" requiere auxiliar.`)
        return
      }
    }

    startTransition(async () => {
      const r = await createJournalEntry({
        date,
        glosa,
        lines: lines.map(l => ({
          account_id:     l.account_id,
          cost_center_id: l.cost_center_id || null,
          auxiliary_id:   l.auxiliary_id   || null,
          doc_type:       l.doc_type        || null,
          doc_number:     l.doc_number      || null,
          ref_doc_type:   l.ref_doc_type    || null,
          ref_doc_number: l.ref_doc_number  || null,
          debit:          parseFloat(l.debit)  || 0,
          credit:         parseFloat(l.credit) || 0,
          description:    l.description,
        })),
      })
      if (r.error) { setError(r.error); return }
      router.push('/contabilidad/libro-diario')
    })
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Nuevo Asiento Contable</h1>
          <p className="text-text-secondary text-sm mt-1">Ingresa la partida doble</p>
        </div>
        <button
          onClick={() => router.back()}
          className="btn-ghost flex items-center gap-2 text-sm"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Volver
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Cabecera */}
        <div className="card p-5">
          <h2 className="text-sm font-bold text-text-primary mb-4">Datos del Asiento</h2>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-xs text-text-disabled block mb-1">Fecha *</label>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="input text-sm"
                required
              />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-text-disabled block mb-1">Glosa *</label>
              <input
                value={glosa}
                onChange={e => setGlosa(e.target.value)}
                className="input text-sm"
                placeholder="Descripción del asiento..."
                required
              />
            </div>
          </div>
        </div>

        {/* Líneas */}
        <div className="card overflow-hidden">
          <div className="px-5 py-3 border-b border-border flex items-center justify-between">
            <h2 className="text-sm font-bold text-text-primary">Líneas del Asiento</h2>
            <div className={`flex items-center gap-2 text-xs font-medium ${balanced ? 'text-success' : 'text-warning'}`}>
              {balanced ? (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Partida cuadrada
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Diferencia: {formatCLP(Math.abs(totalDebit - totalCredit))}
                </>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="table-header">
                  <th className="px-3 py-2.5 text-left min-w-56">Cuenta</th>
                  <th className="px-3 py-2.5 text-left min-w-36">C.Costo</th>
                  <th className="px-3 py-2.5 text-left min-w-52">Auxiliar / Documento</th>
                  <th className="px-3 py-2.5 text-left min-w-40">Descripción</th>
                  <th className="px-3 py-2.5 text-right min-w-32">DEBE</th>
                  <th className="px-3 py-2.5 text-right min-w-32">HABER</th>
                  <th className="px-3 py-2.5 w-8" />
                </tr>
              </thead>
              <tbody>
                {lines.map(line => {
                  const acc = accounts.find(a => a.id === line.account_id)
                  const color = acc ? accountTypeColor(acc.type as AccountType) : undefined
                  const lineAuxiliaries = acc?.has_auxiliary ? auxiliaries : []
                  const openDocs = line.auxiliary_id ? (openDocsCache.get(line.auxiliary_id) ?? []) : []
                  const isLoadingDocs = line.auxiliary_id ? loadingAux.has(line.auxiliary_id) : false
                  const currentRefKey = line.ref_doc_number ? `${line.ref_doc_type}|${line.ref_doc_number}` : ''

                  return (
                    <tr key={line.id} className="border-b border-border/50">
                      <td className="px-3 py-2">
                        <select
                          value={line.account_id}
                          onChange={e => updateLine(line.id, 'account_id', e.target.value)}
                          className="input text-sm"
                          style={color ? { borderColor: `${color}40` } : {}}
                          required
                        >
                          <option value="">Selecciona cuenta...</option>
                          {accounts.map(a => (
                            <option key={a.id} value={a.id}>
                              {a.code} — {a.name}
                            </option>
                          ))}
                        </select>
                      </td>

                      {/* Centro de costo */}
                      <td className="px-3 py-2">
                        {acc?.cost_center_required ? (
                          <select
                            value={line.cost_center_id}
                            onChange={e => updateLine(line.id, 'cost_center_id', e.target.value)}
                            className={`input text-sm ${!line.cost_center_id ? 'border-error/60' : 'border-info/40'}`}
                            required
                          >
                            <option value="">— Selecciona CC * —</option>
                            {costCenters.map(cc => (
                              <option key={cc.id} value={cc.id}>{cc.code} — {cc.name}</option>
                            ))}
                          </select>
                        ) : (
                          <span className="text-xs text-text-disabled px-2">—</span>
                        )}
                      </td>

                      {/* Auxiliar + Documento + Referencia */}
                      <td className="px-3 py-2">
                        {acc?.has_auxiliary ? (
                          <div className="space-y-1.5">
                            {/* Auxiliar */}
                            <select
                              value={line.auxiliary_id}
                              onChange={e => updateLine(line.id, 'auxiliary_id', e.target.value)}
                              className={`input text-sm w-full ${!line.auxiliary_id ? 'border-error/60' : 'border-warning/40'}`}
                              required
                            >
                              <option value="">— Selecciona auxiliar * —</option>
                              {lineAuxiliaries.map(a => (
                                <option key={a.id} value={a.id}>{a.name}</option>
                              ))}
                            </select>

                            {/* Tipo doc + N° doc (documento que CREA esta línea) */}
                            <div className="flex gap-1">
                              <select
                                value={line.doc_type}
                                onChange={e => updateLine(line.id, 'doc_type', e.target.value)}
                                className="input text-xs flex-1 min-w-0"
                                title="Tipo de documento que genera esta línea"
                              >
                                <option value="">Tipo doc.</option>
                                {DOC_TYPES.map(d => (
                                  <option key={d.value} value={d.value}>{d.label}</option>
                                ))}
                              </select>
                              <input
                                type="text"
                                value={line.doc_number}
                                onChange={e => updateLine(line.id, 'doc_number', e.target.value)}
                                className="input text-xs w-24 font-mono"
                                placeholder="N° folio"
                                title="Número / folio del documento"
                              />
                            </div>

                            {/* Referencia a documento previo (para imputación) */}
                            {line.auxiliary_id && (
                              <div>
                                {isLoadingDocs ? (
                                  <div className="text-[10px] text-text-disabled px-1 py-1">
                                    Cargando documentos...
                                  </div>
                                ) : openDocs.length > 0 ? (
                                  <select
                                    value={currentRefKey}
                                    onChange={e => {
                                      const val = e.target.value
                                      if (!val) {
                                        setRef(line.id, '', '')
                                      } else {
                                        const sep = val.indexOf('|')
                                        setRef(line.id, val.substring(0, sep), val.substring(sep + 1))
                                      }
                                    }}
                                    className={`input text-xs w-full ${
                                      currentRefKey ? 'border-success/50 bg-success/5' : 'border-dashed'
                                    }`}
                                    title="Referencia a documento previo — para saldar/imputar"
                                  >
                                    <option value="">↩ Sin referencia</option>
                                    {openDocs.map(doc => {
                                      const key = `${doc.doc_type}|${doc.doc_number}`
                                      const saldado = doc.pending <= 0.01
                                      return (
                                        <option key={key} value={key}>
                                          {docTypeShort(doc.doc_type)} N°{doc.doc_number}
                                          {' '}—{' '}
                                          {saldado
                                            ? '✓ SALDADO'
                                            : `$${doc.pending.toLocaleString('es-CL')} pte.`
                                          }
                                        </option>
                                      )
                                    })}
                                  </select>
                                ) : (
                                  <div className="text-[10px] text-text-disabled px-1">
                                    Sin documentos previos
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Badge de referencia activa */}
                            {currentRefKey && (
                              <div className="flex items-center gap-1">
                                <span className="badge bg-success/10 text-success text-[9px] px-1.5 py-0.5">
                                  ↩ Ref: {docTypeShort(line.ref_doc_type)} N°{line.ref_doc_number}
                                </span>
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-text-disabled px-2">—</span>
                        )}
                      </td>

                      <td className="px-3 py-2">
                        <input
                          value={line.description}
                          onChange={e => updateLine(line.id, 'description', e.target.value)}
                          className="input text-sm"
                          placeholder="Descripción..."
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={line.debit}
                          onChange={e => setDebit(line.id, e.target.value)}
                          className="input text-sm text-right font-mono text-info"
                          placeholder="0"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={line.credit}
                          onChange={e => setCredit(line.id, e.target.value)}
                          className="input text-sm text-right font-mono text-warning"
                          placeholder="0"
                        />
                      </td>
                      <td className="px-3 py-2 text-center">
                        <button
                          type="button"
                          onClick={() => removeLine(line.id)}
                          disabled={lines.length <= 2}
                          className="text-text-disabled hover:text-error transition-colors disabled:opacity-30"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="bg-surface-high border-t-2 border-border">
                  <td colSpan={3} className="px-3 py-3">
                    <button
                      type="button"
                      onClick={addLine}
                      className="flex items-center gap-1.5 text-xs text-primary hover:text-primary-dark transition-colors font-medium"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Agregar línea
                    </button>
                  </td>
                  <td className="px-3 py-3 text-right font-mono font-bold text-info text-sm">
                    {formatCLP(totalDebit)}
                  </td>
                  <td className="px-3 py-3 text-right font-mono font-bold text-warning text-sm">
                    {formatCLP(totalCredit)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {error && (
          <div className="bg-error/10 border border-error/20 text-error text-sm px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-3">
          <button type="button" onClick={() => router.back()} className="btn-ghost px-6">
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isPending || !balanced}
            className="btn-primary px-8 flex items-center gap-2"
          >
            {isPending ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Guardando...
              </>
            ) : 'Contabilizar Asiento'}
          </button>
        </div>
      </form>
    </div>
  )
}
