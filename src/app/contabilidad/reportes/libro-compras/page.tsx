import { createClient } from '@/lib/supabase/server'
import { formatCLP, monthName } from '@/lib/utils'
import { docTypeLabel, docTypeShort } from '@/lib/doc-types'
import { COMPRA_DOC_TYPES, calcTax } from '@/lib/libro-sii'
import { LibroSIIExport } from '../LibroSIIExport'
import { PrintButton } from '@/components/ui/PrintButton'

export default async function LibroComprasPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string; acum?: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('company_id, companies(name, rut)')
    .eq('id', user!.id)
    .single()

  const company = (profile as any)?.companies as { name: string; rut: string } | null
  const companyId = profile?.company_id as string

  const now   = new Date()
  const year  = parseInt(params.year  ?? String(now.getFullYear()))
  const month = parseInt(params.month ?? String(now.getMonth() + 1))
  const acum  = params.acum === '1'

  const lastDay = new Date(year, month, 0).getDate()
  const dateFrom = acum ? `${year}-01-01` : `${year}-${String(month).padStart(2, '0')}-01`
  const dateTo   = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

  const { data: rows } = await supabase
    .schema('conta').from('open_documents')
    .select('aux_code, aux_name, aux_type, aux_rut, doc_type, doc_number, doc_date, glosa, entry_id, entry_number, amount, settled, pending')
    .eq('company_id', companyId)
    .eq('aux_type', 'PROVEEDOR')
    .in('doc_type', COMPRA_DOC_TYPES)
    .gte('doc_date', dateFrom)
    .lte('doc_date', dateTo)
    .order('doc_date')
    .order('doc_number')

  const docs = rows ?? []

  // Calculate totals
  let totalNeto = 0, totalIva = 0, totalExento = 0, totalGeneral = 0

  const processedDocs = docs.map(r => {
    const amount = Number(r.amount ?? 0)
    const pending = Number(r.pending ?? 0)
    const tx = calcTax(amount, r.doc_type ?? '')
    totalNeto    += tx.neto
    totalIva     += tx.iva
    totalExento  += tx.exento
    totalGeneral += tx.total
    return { ...r, amount, pending, ...tx, isNC: r.doc_type === '61' }
  })

  const periodLabel = acum ? `Enero — ${monthName(month)} ${year}` : `${monthName(month)} ${year}`

  // Excel export data
  const excelHeaders = ['N°', 'Fecha', 'Tipo Doc', 'N° Documento', 'RUT', 'Razón Social', 'Neto', 'IVA', 'Exento', 'Total']
  const excelData: (string | number)[][] = processedDocs.map((r, i) => [
    i + 1,
    r.doc_date ? new Date(r.doc_date + 'T12:00:00').toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '',
    docTypeLabel(r.doc_type ?? ''),
    r.doc_number ?? '',
    r.aux_rut ?? '',
    r.aux_name ?? '',
    r.neto,
    r.iva,
    r.exento,
    r.total,
  ])
  const excelTotals: (string | number)[] = ['', '', '', '', '', 'TOTALES', totalNeto, totalIva, totalExento, totalGeneral]

  return (
    <div className="p-8 max-w-7xl mx-auto print:p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 print:mb-3">
        <div>
          <h1 className="text-2xl font-bold">Libro de Compras</h1>
          <p className="text-text-secondary text-sm mt-1">{periodLabel}</p>
        </div>
        <div className="flex items-center gap-2 print:hidden">
          {processedDocs.length > 0 && (
            <LibroSIIExport
              bookName="Libro de Compras"
              headers={excelHeaders}
              data={excelData}
              totals={excelTotals}
              month={month}
              year={year}
              acum={acum}
              filename={`libro-compras-${year}-${String(month).padStart(2, '0')}.xlsx`}
            />
          )}
          {processedDocs.length > 0 && <PrintButton />}
        </div>
      </div>

      {/* Filters */}
      <form className="card p-4 mb-5 flex flex-wrap gap-3 items-end print:hidden">
        <div>
          <label className="text-xs text-text-disabled block mb-1">Año</label>
          <select name="year" defaultValue={year} className="input w-24 text-sm">
            {[year - 1, year, year + 1].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-text-disabled block mb-1">Mes</label>
          <select name="month" defaultValue={month} className="input w-36 text-sm">
            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
              <option key={m} value={m}>{monthName(m)}</option>
            ))}
          </select>
        </div>
        <div className="flex gap-1">
          <button type="submit" name="acum" value="0"
            className={`px-3 py-2 rounded-lg text-sm border transition-colors ${
              !acum ? 'bg-primary text-primary-foreground border-primary' : 'bg-surface border-border text-text-secondary hover:text-text-primary'
            }`}>
            Mensual
          </button>
          <button type="submit" name="acum" value="1"
            className={`px-3 py-2 rounded-lg text-sm border transition-colors ${
              acum ? 'bg-primary text-primary-foreground border-primary' : 'bg-surface border-border text-text-secondary hover:text-text-primary'
            }`}>
            Acumulado
          </button>
        </div>
      </form>

      {/* KPI cards */}
      <div className="grid grid-cols-4 gap-3 mb-5 print:hidden">
        <KpiCard label="N° Documentos" value={String(processedDocs.length)} />
        <KpiCard label="Neto Total" value={formatCLP(totalNeto)} color="text-info" />
        <KpiCard label="IVA Total" value={formatCLP(totalIva)} color="text-warning" />
        <KpiCard label="Total" value={formatCLP(totalGeneral)} color="text-text-primary" />
      </div>

      {/* Table */}
      {processedDocs.length === 0 ? (
        <div className="card p-8 text-center text-text-disabled">
          Sin documentos de compra para {periodLabel}
        </div>
      ) : (
        <div className="card overflow-hidden print:hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="table-header text-xs">
                  <th className="px-3 py-2 text-right w-10">N°</th>
                  <th className="px-3 py-2 text-left w-24">Fecha</th>
                  <th className="px-3 py-2 text-left w-28">Tipo Doc</th>
                  <th className="px-3 py-2 text-left w-24">N° Documento</th>
                  <th className="px-3 py-2 text-left w-28">RUT</th>
                  <th className="px-3 py-2 text-left">Razón Social</th>
                  <th className="px-3 py-2 text-right w-28">Neto</th>
                  <th className="px-3 py-2 text-right w-24">IVA</th>
                  <th className="px-3 py-2 text-right w-28">Exento</th>
                  <th className="px-3 py-2 text-right w-28">Total</th>
                  <th className="px-3 py-2 text-center w-28">Estado Pago</th>
                </tr>
              </thead>
              <tbody>
                {processedDocs.map((r, i) => (
                  <tr key={i} className={`table-row text-xs ${r.isNC ? 'text-error' : ''}`}>
                    <td className="px-3 py-2 text-right text-text-disabled">{i + 1}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {r.doc_date
                        ? new Date(r.doc_date + 'T12:00:00').toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' })
                        : '—'}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`badge text-[10px] ${r.isNC ? 'bg-error/10 text-error' : 'bg-info/10 text-info'}`}>
                        {docTypeShort(r.doc_type ?? '')}
                      </span>
                      {r.isNC && <span className="ml-1 text-[10px] text-error">reducción</span>}
                    </td>
                    <td className="px-3 py-2 font-mono">{r.doc_number ?? '—'}</td>
                    <td className="px-3 py-2 font-mono text-text-secondary">{r.aux_rut ?? '—'}</td>
                    <td className="px-3 py-2 text-text-primary">{r.aux_name ?? '—'}</td>
                    <td className={`px-3 py-2 text-right font-mono ${r.isNC ? 'text-error' : ''}`}>
                      {r.neto !== 0 ? formatCLP(r.neto) : '—'}
                    </td>
                    <td className={`px-3 py-2 text-right font-mono ${r.isNC ? 'text-error' : ''}`}>
                      {r.iva !== 0 ? formatCLP(r.iva) : '—'}
                    </td>
                    <td className={`px-3 py-2 text-right font-mono ${r.isNC ? 'text-error' : ''}`}>
                      {r.exento !== 0 ? formatCLP(r.exento) : '—'}
                    </td>
                    <td className={`px-3 py-2 text-right font-mono font-semibold ${r.isNC ? 'text-error' : ''}`}>
                      {formatCLP(r.total)}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {r.pending <= 0.01
                        ? <span className="badge bg-success/15 text-success text-[10px]">PAGADO</span>
                        : <span className="badge bg-error/15 text-error text-[10px]">PENDIENTE</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-surface-high border-t border-border text-xs font-bold">
                  <td colSpan={6} className="px-3 py-2 text-text-secondary">TOTALES — {processedDocs.length} documentos</td>
                  <td className="px-3 py-2 text-right font-mono text-info">{formatCLP(totalNeto)}</td>
                  <td className="px-3 py-2 text-right font-mono text-warning">{formatCLP(totalIva)}</td>
                  <td className="px-3 py-2 text-right font-mono">{totalExento !== 0 ? formatCLP(totalExento) : '—'}</td>
                  <td className="px-3 py-2 text-right font-mono text-text-primary">{formatCLP(totalGeneral)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* ── Print section ── */}
      <div className="hidden print:block" style={{ fontFamily: 'Arial, sans-serif', fontSize: '11px', color: '#000' }}>
        {/* Company header */}
        <div style={{ textAlign: 'center', marginBottom: '16px', borderBottom: '2px solid #000', paddingBottom: '10px' }}>
          <div style={{ fontSize: '14px', fontWeight: 'bold' }}>{company?.name ?? 'Empresa'}</div>
          <div style={{ fontSize: '11px' }}>RUT: {company?.rut ?? '—'}</div>
          <div style={{ fontSize: '13px', fontWeight: 'bold', marginTop: '6px' }}>LIBRO DE COMPRAS</div>
          <div style={{ fontSize: '11px' }}>Período: {periodLabel}</div>
        </div>

        {/* Print table */}
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }}>
          <thead>
            <tr style={{ backgroundColor: '#f0f0f0' }}>
              <th style={{ border: '1px solid #ccc', padding: '4px 6px', textAlign: 'right' }}>N°</th>
              <th style={{ border: '1px solid #ccc', padding: '4px 6px', textAlign: 'left' }}>Fecha</th>
              <th style={{ border: '1px solid #ccc', padding: '4px 6px', textAlign: 'left' }}>Tipo Doc</th>
              <th style={{ border: '1px solid #ccc', padding: '4px 6px', textAlign: 'left' }}>N° Documento</th>
              <th style={{ border: '1px solid #ccc', padding: '4px 6px', textAlign: 'left' }}>RUT</th>
              <th style={{ border: '1px solid #ccc', padding: '4px 6px', textAlign: 'left' }}>Razón Social</th>
              <th style={{ border: '1px solid #ccc', padding: '4px 6px', textAlign: 'right' }}>Neto</th>
              <th style={{ border: '1px solid #ccc', padding: '4px 6px', textAlign: 'right' }}>IVA</th>
              <th style={{ border: '1px solid #ccc', padding: '4px 6px', textAlign: 'right' }}>Exento</th>
              <th style={{ border: '1px solid #ccc', padding: '4px 6px', textAlign: 'right' }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {processedDocs.map((r, i) => (
              <tr key={i} style={{ color: r.isNC ? '#cc0000' : 'inherit' }}>
                <td style={{ border: '1px solid #ccc', padding: '3px 6px', textAlign: 'right' }}>{i + 1}</td>
                <td style={{ border: '1px solid #ccc', padding: '3px 6px', whiteSpace: 'nowrap' }}>
                  {r.doc_date
                    ? new Date(r.doc_date + 'T12:00:00').toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' })
                    : '—'}
                </td>
                <td style={{ border: '1px solid #ccc', padding: '3px 6px' }}>{docTypeLabel(r.doc_type ?? '')}</td>
                <td style={{ border: '1px solid #ccc', padding: '3px 6px', fontFamily: 'monospace' }}>{r.doc_number ?? '—'}</td>
                <td style={{ border: '1px solid #ccc', padding: '3px 6px', fontFamily: 'monospace' }}>{r.aux_rut ?? '—'}</td>
                <td style={{ border: '1px solid #ccc', padding: '3px 6px' }}>{r.aux_name ?? '—'}</td>
                <td style={{ border: '1px solid #ccc', padding: '3px 6px', textAlign: 'right', fontFamily: 'monospace' }}>
                  {r.neto !== 0 ? formatCLP(r.neto) : '—'}
                </td>
                <td style={{ border: '1px solid #ccc', padding: '3px 6px', textAlign: 'right', fontFamily: 'monospace' }}>
                  {r.iva !== 0 ? formatCLP(r.iva) : '—'}
                </td>
                <td style={{ border: '1px solid #ccc', padding: '3px 6px', textAlign: 'right', fontFamily: 'monospace' }}>
                  {r.exento !== 0 ? formatCLP(r.exento) : '—'}
                </td>
                <td style={{ border: '1px solid #ccc', padding: '3px 6px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 'bold' }}>
                  {formatCLP(r.total)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ backgroundColor: '#f0f0f0', fontWeight: 'bold' }}>
              <td colSpan={6} style={{ border: '1px solid #ccc', padding: '4px 6px' }}>
                TOTALES — {processedDocs.length} documentos
              </td>
              <td style={{ border: '1px solid #ccc', padding: '4px 6px', textAlign: 'right', fontFamily: 'monospace' }}>{formatCLP(totalNeto)}</td>
              <td style={{ border: '1px solid #ccc', padding: '4px 6px', textAlign: 'right', fontFamily: 'monospace' }}>{formatCLP(totalIva)}</td>
              <td style={{ border: '1px solid #ccc', padding: '4px 6px', textAlign: 'right', fontFamily: 'monospace' }}>
                {totalExento !== 0 ? formatCLP(totalExento) : '—'}
              </td>
              <td style={{ border: '1px solid #ccc', padding: '4px 6px', textAlign: 'right', fontFamily: 'monospace' }}>{formatCLP(totalGeneral)}</td>
            </tr>
          </tfoot>
        </table>

        <div style={{ marginTop: '20px', fontSize: '9px', color: '#666', textAlign: 'center', borderTop: '1px solid #ccc', paddingTop: '6px' }}>
          Generado por ERP Mister Group — {new Date().toLocaleDateString('es-CL')}
        </div>
      </div>
    </div>
  )
}

function KpiCard({ label, value, color = 'text-text-primary' }: { label: string; value: string; color?: string }) {
  return (
    <div className="card p-4">
      <p className="text-xs text-text-disabled mb-1">{label}</p>
      <p className={`font-bold text-lg font-mono ${color}`}>{value}</p>
    </div>
  )
}
