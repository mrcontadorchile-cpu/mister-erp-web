import { createClient } from '@/lib/supabase/server'
import { formatCLP, accountTypeColor } from '@/lib/utils'
import { docTypeLabel } from '@/lib/doc-types'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ReverseButton } from './ReverseButton'
import { PrintButton } from './PrintButton'
import type { AccountType } from '@/types/database'

const ENTRY_TYPE_LABEL: Record<string, string> = {
  MANUAL:            'Manual',
  SII_FACTURA:       'Factura SII',
  SII_HONORARIO:     'Honorario SII',
  INVENTARIO_VENTA:  'Venta Inventario',
  INVENTARIO_COMPRA: 'Compra Inventario',
}

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  posted:   { label: 'Contabilizado', cls: 'bg-success/10 text-success' },
  draft:    { label: 'Borrador',      cls: 'bg-warning/10 text-warning' },
  reversed: { label: 'Revertido',     cls: 'bg-error/10 text-error' },
}

export default async function JournalEntryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('company_id, full_name, companies(id, name, rut)')
    .eq('id', user!.id)
    .single()

  const company = (profile as any)?.companies as { name: string; rut: string } | null

  const { data: entry } = await supabase
    .schema('conta').from('journal_entries')
    .select(`
      id, number, date, glosa, type, status, created_at, updated_at,
      created_by, updated_by,
      journal_lines(
        id, debit, credit, description, doc_type, doc_number, ref_doc_type, ref_doc_number,
        accounts(code, name, type),
        auxiliaries(code, name)
      )
    `)
    .eq('id', id)
    .eq('company_id', profile?.company_id)
    .single()

  if (!entry) notFound()

  // Audit: fetch user names
  const userIds = [entry.created_by, entry.updated_by].filter(Boolean) as string[]
  const userMap: Record<string, string> = {}
  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from('user_profiles')
      .select('id, full_name')
      .in('id', userIds)
    for (const p of profiles ?? []) {
      userMap[p.id] = (p.full_name as string) ?? p.id.slice(0, 8)
    }
  }

  const lines = (entry.journal_lines ?? []) as unknown as {
    id:             string
    debit:          number
    credit:         number
    description:    string | null
    doc_type:       string | null
    doc_number:     string | null
    ref_doc_type:   string | null
    ref_doc_number: string | null
    accounts:       { code: string; name: string; type: string } | null
    auxiliaries:    { code: string; name: string } | null
  }[]

  const totalDebit  = lines.reduce((s, l) => s + l.debit, 0)
  const totalCredit = lines.reduce((s, l) => s + l.credit, 0)
  const statusInfo  = STATUS_MAP[entry.status] ?? { label: entry.status, cls: 'bg-surface-high text-text-disabled' }

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' })

  const fmtDateTime = (iso: string | null) => iso
    ? new Date(iso).toLocaleString('es-CL', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      })
    : '—'

  return (
    <>
      {/* ─── BARRA SUPERIOR (pantalla, oculta al imprimir) ─── */}
      <div className="print:hidden p-8 max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Link href="/contabilidad/libro-diario" className="text-text-disabled hover:text-primary transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </Link>
            <div>
              <h1 className="text-2xl font-bold">Asiento #{entry.number}</h1>
              <p className="text-text-secondary text-sm mt-1">{entry.date} — {entry.glosa}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`badge ${statusInfo.cls} text-sm px-3 py-1`}>{statusInfo.label}</span>
            {entry.status === 'posted' && <ReverseButton entryId={entry.id} />}
            <PrintButton />
          </div>
        </div>

        {/* Vista en pantalla */}
        <div className="card p-5 mb-5">
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <p className="text-xs text-text-disabled mb-1">Glosa</p>
              <p className="text-sm font-medium">{entry.glosa}</p>
            </div>
            <div>
              <p className="text-xs text-text-disabled mb-1">Tipo</p>
              <span className="badge bg-surface-high text-text-secondary text-xs">
                {ENTRY_TYPE_LABEL[entry.type] ?? entry.type}
              </span>
            </div>
          </div>
        </div>

        <div className="card overflow-hidden mb-5">
          <table className="w-full text-sm">
            <thead>
              <tr className="table-header">
                <th className="px-4 py-3 text-left w-36">Código</th>
                <th className="px-4 py-3 text-left">Cuenta</th>
                <th className="px-4 py-3 text-left">Auxiliar / Documento</th>
                <th className="px-4 py-3 text-left">Descripción</th>
                <th className="px-4 py-3 text-right w-36">DEBE</th>
                <th className="px-4 py-3 text-right w-36">HABER</th>
              </tr>
            </thead>
            <tbody>
              {lines.map(l => {
                const acc = l.accounts
                const color = acc ? accountTypeColor(acc.type as AccountType) : '#888'
                return (
                  <tr key={l.id} className="table-row">
                    <td className="px-4 py-3 font-mono text-xs" style={{ color }}>{acc?.code ?? '—'}</td>
                    <td className="px-4 py-3 text-text-primary text-sm">{acc?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-xs">
                      {l.auxiliaries ? (
                        <div>
                          <div className="text-text-primary font-medium">{l.auxiliaries.name}</div>
                          {(l.doc_type || l.doc_number) && (
                            <div className="flex items-center gap-1 mt-0.5">
                              {l.doc_type && (
                                <span className="badge bg-info/10 text-info text-[10px] px-1.5">{docTypeLabel(l.doc_type)}</span>
                              )}
                              {l.doc_number && (
                                <span className="font-mono text-text-secondary text-[10px]">N°{l.doc_number}</span>
                              )}
                            </div>
                          )}
                          {(l.ref_doc_type || l.ref_doc_number) && (
                            <div className="flex items-center gap-1 mt-0.5">
                              <span className="text-text-disabled text-[9px]">↩ Ref:</span>
                              {l.ref_doc_type && (
                                <span className="badge bg-success/10 text-success text-[9px] px-1">{docTypeLabel(l.ref_doc_type)}</span>
                              )}
                              {l.ref_doc_number && (
                                <span className="font-mono text-success text-[9px]">N°{l.ref_doc_number}</span>
                              )}
                            </div>
                          )}
                        </div>
                      ) : <span className="text-text-disabled">—</span>}
                    </td>
                    <td className="px-4 py-3 text-text-secondary text-xs">{l.description ?? '—'}</td>
                    <td className="px-4 py-3 text-right font-mono text-info text-sm">{l.debit > 0 ? formatCLP(l.debit) : ''}</td>
                    <td className="px-4 py-3 text-right font-mono text-warning text-sm">{l.credit > 0 ? formatCLP(l.credit) : ''}</td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="bg-surface-high border-t-2 border-border font-bold">
                <td colSpan={4} className="px-4 py-3 text-xs text-text-secondary">TOTALES</td>
                <td className="px-4 py-3 text-right font-mono text-info text-base">{formatCLP(totalDebit)}</td>
                <td className="px-4 py-3 text-right font-mono text-warning text-base">{formatCLP(totalCredit)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Auditoría en pantalla */}
        <div className="card p-5">
          <p className="text-xs font-bold text-text-disabled uppercase tracking-wide mb-3">Auditoría</p>
          <div className="flex gap-10 text-sm">
            <div>
              <p className="text-xs text-text-disabled mb-0.5">Contabilizado por</p>
              <p className="font-medium">{userMap[entry.created_by] ?? '—'}</p>
              <p className="text-xs text-text-disabled">{fmtDateTime(entry.created_at)}</p>
            </div>
            {entry.updated_by && (
              <div>
                <p className="text-xs text-text-disabled mb-0.5">Modificado por</p>
                <p className="font-medium">{userMap[entry.updated_by] ?? '—'}</p>
                <p className="text-xs text-text-disabled">{fmtDateTime(entry.updated_at)}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────
          COMPROBANTE PARA IMPRESIÓN
          Solo visible al imprimir — diseño A4 profesional
          ───────────────────────────────────────────────── */}
      <div className="hidden print:block print:p-8 print:text-black print:text-[11pt] print:font-sans">

        {/* Encabezado empresa */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', paddingBottom: '14px', borderBottom: '2px solid black' }}>
          <div>
            <div style={{ fontSize: '18pt', fontWeight: 900, letterSpacing: '-0.5px', textTransform: 'uppercase' }}>
              {company?.name ?? 'Empresa'}
            </div>
            {company?.rut && (
              <div style={{ fontSize: '9pt', color: '#555', marginTop: '2px' }}>RUT: {company.rut}</div>
            )}
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '14pt', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>
              Comprobante Contable
            </div>
            <div style={{ fontSize: '9pt', color: '#555', marginTop: '4px' }}>
              N° <strong style={{ fontSize: '11pt', color: 'black' }}>{String(entry.number).padStart(6, '0')}</strong>
            </div>
          </div>
        </div>

        {/* Datos del comprobante */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0', marginBottom: '16px', border: '1px solid #ccc' }}>
          <div style={{ padding: '8px 12px', borderRight: '1px solid #ccc' }}>
            <div style={{ fontSize: '7pt', color: '#777', textTransform: 'uppercase', marginBottom: '2px' }}>Fecha</div>
            <div style={{ fontWeight: 700 }}>{fmtDate(entry.date)}</div>
          </div>
          <div style={{ padding: '8px 12px', borderRight: '1px solid #ccc' }}>
            <div style={{ fontSize: '7pt', color: '#777', textTransform: 'uppercase', marginBottom: '2px' }}>Tipo</div>
            <div>{ENTRY_TYPE_LABEL[entry.type] ?? entry.type}</div>
          </div>
          <div style={{ padding: '8px 12px' }}>
            <div style={{ fontSize: '7pt', color: '#777', textTransform: 'uppercase', marginBottom: '2px' }}>Estado</div>
            <div style={{ fontWeight: 600 }}>{statusInfo.label}</div>
          </div>
        </div>

        {/* Glosa */}
        <div style={{ padding: '8px 12px', marginBottom: '16px', border: '1px solid #ccc', borderTop: 'none' }}>
          <div style={{ fontSize: '7pt', color: '#777', textTransform: 'uppercase', marginBottom: '2px' }}>Glosa / Descripción</div>
          <div style={{ fontWeight: 600, fontSize: '11pt' }}>{entry.glosa}</div>
        </div>

        {/* Tabla de movimientos */}
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '16px', fontSize: '10pt' }}>
          <thead>
            <tr style={{ backgroundColor: '#f0f0f0', borderTop: '2px solid black', borderBottom: '1px solid black' }}>
              <th style={{ padding: '7px 10px', textAlign: 'left', fontWeight: 700, width: '90px' }}>Código</th>
              <th style={{ padding: '7px 10px', textAlign: 'left', fontWeight: 700 }}>Cuenta Contable</th>
              <th style={{ padding: '7px 10px', textAlign: 'left', fontWeight: 700 }}>Auxiliar</th>
              <th style={{ padding: '7px 10px', textAlign: 'left', fontWeight: 700 }}>Descripción / Detalle</th>
              <th style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 700, width: '100px' }}>DEBE</th>
              <th style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 700, width: '100px' }}>HABER</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={l.id} style={{ borderBottom: '1px solid #e0e0e0', backgroundColor: i % 2 === 0 ? 'white' : '#fafafa' }}>
                <td style={{ padding: '7px 10px', fontFamily: 'monospace', fontSize: '9pt' }}>
                  {l.accounts?.code ?? '—'}
                </td>
                <td style={{ padding: '7px 10px' }}>{l.accounts?.name ?? '—'}</td>
                <td style={{ padding: '7px 10px', fontSize: '9pt', color: '#444' }}>
                  {l.auxiliaries ? (
                    <>
                      <div>{l.auxiliaries.name}</div>
                      {(l.doc_type || l.doc_number) && (
                        <div style={{ fontSize: '8pt', color: '#666', marginTop: '2px' }}>
                          {l.doc_type && <span style={{ marginRight: '4px' }}>{docTypeLabel(l.doc_type)}</span>}
                          {l.doc_number && <span style={{ fontFamily: 'monospace' }}>N°{l.doc_number}</span>}
                        </div>
                      )}
                      {(l.ref_doc_type || l.ref_doc_number) && (
                        <div style={{ fontSize: '7.5pt', color: '#2a7a45', marginTop: '2px' }}>
                          <span style={{ marginRight: '3px' }}>↩ Ref:</span>
                          {l.ref_doc_type && <span style={{ marginRight: '4px' }}>{docTypeLabel(l.ref_doc_type)}</span>}
                          {l.ref_doc_number && <span style={{ fontFamily: 'monospace' }}>N°{l.ref_doc_number}</span>}
                        </div>
                      )}
                    </>
                  ) : '—'}
                </td>
                <td style={{ padding: '7px 10px', color: '#555', fontSize: '9pt' }}>{l.description ?? ''}</td>
                <td style={{ padding: '7px 10px', textAlign: 'right', fontFamily: 'monospace' }}>
                  {l.debit > 0 ? formatCLP(l.debit) : ''}
                </td>
                <td style={{ padding: '7px 10px', textAlign: 'right', fontFamily: 'monospace' }}>
                  {l.credit > 0 ? formatCLP(l.credit) : ''}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ borderTop: '2px solid black', backgroundColor: '#f0f0f0', fontWeight: 700 }}>
              <td colSpan={4} style={{ padding: '8px 10px', fontSize: '9pt', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Total
              </td>
              <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'monospace', fontSize: '11pt' }}>
                {formatCLP(totalDebit)}
              </td>
              <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'monospace', fontSize: '11pt' }}>
                {formatCLP(totalCredit)}
              </td>
            </tr>
          </tfoot>
        </table>

        {/* Auditoría sistema */}
        <div style={{ fontSize: '8pt', color: '#666', marginBottom: '40px', padding: '6px 10px', backgroundColor: '#f9f9f9', border: '1px solid #e0e0e0' }}>
          <strong>Registro de auditoría — </strong>
          Contabilizado por: <strong>{userMap[entry.created_by] ?? '—'}</strong> el {fmtDateTime(entry.created_at)}
          {entry.updated_by && (
            <> &nbsp;|&nbsp; Modificado por: <strong>{userMap[entry.updated_by] ?? '—'}</strong> el {fmtDateTime(entry.updated_at)}</>
          )}
        </div>

        {/* Firmas */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px', marginTop: '20px' }}>
          <div>
            <div style={{ borderTop: '1px solid black', paddingTop: '6px' }}>
              <div style={{ fontWeight: 700, fontSize: '10pt' }}>{userMap[entry.created_by] ?? '___________________'}</div>
              <div style={{ fontSize: '8pt', color: '#555', marginTop: '2px' }}>Elaborado por</div>
              <div style={{ fontSize: '8pt', color: '#888' }}>{fmtDateTime(entry.created_at)}</div>
            </div>
          </div>
          <div>
            <div style={{ borderTop: '1px solid black', paddingTop: '6px' }}>
              <div style={{ fontSize: '10pt' }}>&nbsp;</div>
              <div style={{ fontSize: '8pt', color: '#555', marginTop: '2px' }}>Aprobado por / Jefe de Contabilidad</div>
              <div style={{ fontSize: '8pt', color: '#888' }}>Fecha: _______________</div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
