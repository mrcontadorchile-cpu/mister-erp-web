import { createClient } from '@/lib/supabase/server'
import { formatCLP, monthName } from '@/lib/utils'
import { honorRetentionRate } from '@/lib/libro-sii'
import { LibroSIIExport } from '../LibroSIIExport'
import { PrintButton } from '@/components/ui/PrintButton'

export default async function LibroHonorariosPage({
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

  const retentionRate = honorRetentionRate(year)
  const retentionPct  = `${(retentionRate * 100).toFixed(2)}%`

  const lastDay = new Date(year, month, 0).getDate()
  const dateFrom = acum ? `${year}-01-01` : `${year}-${String(month).padStart(2, '0')}-01`
  const dateTo   = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

  const { data: rows } = await supabase
    .schema('conta').from('open_documents')
    .select('aux_code, aux_name, aux_type, aux_rut, doc_type, doc_number, doc_date, glosa, entry_id, entry_number, amount, settled, pending')
    .eq('company_id', companyId)
    .eq('doc_type', 'BHE')
    .gte('doc_date', dateFrom)
    .lte('doc_date', dateTo)
    .order('doc_date')
    .order('doc_number')

  const docs = rows ?? []

  // Calculate totals
  let totalBruto = 0, totalRetencion = 0, totalLiquido = 0

  const processedDocs = docs.map(r => {
    const bruto     = Number(r.amount ?? 0)
    const retencion = Math.round(bruto * retentionRate)
    const liquido   = bruto - retencion
    totalBruto     += bruto
    totalRetencion += retencion
    totalLiquido   += liquido
    return { ...r, bruto, retencion, liquido }
  })

  const periodLabel = acum ? `Enero — ${monthName(month)} ${year}` : `${monthName(month)} ${year}`

  // Excel export data
  const excelHeaders = ['N°', 'Fecha', 'N° Boleta', 'RUT', 'Prestador', 'Honorario Bruto', `Retención (${retentionPct})`, 'Honorario Líquido']
  const excelData: (string | number)[][] = processedDocs.map((r, i) => [
    i + 1,
    r.doc_date ? new Date(r.doc_date + 'T12:00:00').toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '',
    r.doc_number ?? '',
    r.aux_rut ?? '',
    r.aux_name ?? '',
    r.bruto,
    r.retencion,
    r.liquido,
  ])
  const excelTotals: (string | number)[] = ['', '', '', '', 'TOTALES', totalBruto, totalRetencion, totalLiquido]

  return (
    <div className="p-8 max-w-7xl mx-auto print:p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 print:mb-3">
        <div>
          <h1 className="text-2xl font-bold">Libro de Honorarios</h1>
          <p className="text-text-secondary text-sm mt-1">
            {periodLabel}
            <span className="ml-2 badge bg-primary/10 text-primary text-xs">Retención {retentionPct}</span>
          </p>
        </div>
        <div className="flex items-center gap-2 print:hidden">
          {processedDocs.length > 0 && (
            <LibroSIIExport
              bookName="Libro de Honorarios"
              headers={excelHeaders}
              data={excelData}
              totals={excelTotals}
              month={month}
              year={year}
              acum={acum}
              filename={`libro-honorarios-${year}-${String(month).padStart(2, '0')}.xlsx`}
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
        <KpiCard label="N° Boletas" value={String(processedDocs.length)} />
        <KpiCard label="Bruto Total" value={formatCLP(totalBruto)} color="text-info" />
        <KpiCard label="Retención Total" value={formatCLP(totalRetencion)} color="text-warning" />
        <KpiCard label="Líquido Total" value={formatCLP(totalLiquido)} color="text-success" />
      </div>

      {/* Table */}
      {processedDocs.length === 0 ? (
        <div className="card p-8 text-center text-text-disabled">
          Sin boletas de honorarios para {periodLabel}
        </div>
      ) : (
        <div className="card overflow-hidden print:hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="table-header text-xs">
                  <th className="px-3 py-2 text-right w-10">N°</th>
                  <th className="px-3 py-2 text-left w-24">Fecha</th>
                  <th className="px-3 py-2 text-left w-28">N° Boleta</th>
                  <th className="px-3 py-2 text-left w-32">RUT</th>
                  <th className="px-3 py-2 text-left">Prestador</th>
                  <th className="px-3 py-2 text-right w-32">Honorario Bruto</th>
                  <th className="px-3 py-2 text-right w-36">Retención ({retentionPct})</th>
                  <th className="px-3 py-2 text-right w-32">Honorario Líquido</th>
                </tr>
              </thead>
              <tbody>
                {processedDocs.map((r, i) => (
                  <tr key={i} className="table-row text-xs">
                    <td className="px-3 py-2 text-right text-text-disabled">{i + 1}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {r.doc_date
                        ? new Date(r.doc_date + 'T12:00:00').toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' })
                        : '—'}
                    </td>
                    <td className="px-3 py-2 font-mono">{r.doc_number ?? '—'}</td>
                    <td className="px-3 py-2 font-mono text-text-secondary">{r.aux_rut ?? '—'}</td>
                    <td className="px-3 py-2 text-text-primary">{r.aux_name ?? '—'}</td>
                    <td className="px-3 py-2 text-right font-mono text-info">{formatCLP(r.bruto)}</td>
                    <td className="px-3 py-2 text-right font-mono text-warning">{formatCLP(r.retencion)}</td>
                    <td className="px-3 py-2 text-right font-mono text-success font-semibold">{formatCLP(r.liquido)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-surface-high border-t border-border text-xs font-bold">
                  <td colSpan={5} className="px-3 py-2 text-text-secondary">TOTALES — {processedDocs.length} boletas</td>
                  <td className="px-3 py-2 text-right font-mono text-info">{formatCLP(totalBruto)}</td>
                  <td className="px-3 py-2 text-right font-mono text-warning">{formatCLP(totalRetencion)}</td>
                  <td className="px-3 py-2 text-right font-mono text-success">{formatCLP(totalLiquido)}</td>
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
          <div style={{ fontSize: '13px', fontWeight: 'bold', marginTop: '6px' }}>LIBRO DE HONORARIOS</div>
          <div style={{ fontSize: '11px' }}>Período: {periodLabel}</div>
          <div style={{ fontSize: '11px' }}>Tasa de retención: {retentionPct}</div>
        </div>

        {/* Print table */}
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }}>
          <thead>
            <tr style={{ backgroundColor: '#f0f0f0' }}>
              <th style={{ border: '1px solid #ccc', padding: '4px 6px', textAlign: 'right' }}>N°</th>
              <th style={{ border: '1px solid #ccc', padding: '4px 6px', textAlign: 'left' }}>Fecha</th>
              <th style={{ border: '1px solid #ccc', padding: '4px 6px', textAlign: 'left' }}>N° Boleta</th>
              <th style={{ border: '1px solid #ccc', padding: '4px 6px', textAlign: 'left' }}>RUT</th>
              <th style={{ border: '1px solid #ccc', padding: '4px 6px', textAlign: 'left' }}>Prestador</th>
              <th style={{ border: '1px solid #ccc', padding: '4px 6px', textAlign: 'right' }}>Honorario Bruto</th>
              <th style={{ border: '1px solid #ccc', padding: '4px 6px', textAlign: 'right' }}>Retención ({retentionPct})</th>
              <th style={{ border: '1px solid #ccc', padding: '4px 6px', textAlign: 'right' }}>Honorario Líquido</th>
            </tr>
          </thead>
          <tbody>
            {processedDocs.map((r, i) => (
              <tr key={i}>
                <td style={{ border: '1px solid #ccc', padding: '3px 6px', textAlign: 'right' }}>{i + 1}</td>
                <td style={{ border: '1px solid #ccc', padding: '3px 6px', whiteSpace: 'nowrap' }}>
                  {r.doc_date
                    ? new Date(r.doc_date + 'T12:00:00').toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' })
                    : '—'}
                </td>
                <td style={{ border: '1px solid #ccc', padding: '3px 6px', fontFamily: 'monospace' }}>{r.doc_number ?? '—'}</td>
                <td style={{ border: '1px solid #ccc', padding: '3px 6px', fontFamily: 'monospace' }}>{r.aux_rut ?? '—'}</td>
                <td style={{ border: '1px solid #ccc', padding: '3px 6px' }}>{r.aux_name ?? '—'}</td>
                <td style={{ border: '1px solid #ccc', padding: '3px 6px', textAlign: 'right', fontFamily: 'monospace' }}>{formatCLP(r.bruto)}</td>
                <td style={{ border: '1px solid #ccc', padding: '3px 6px', textAlign: 'right', fontFamily: 'monospace' }}>{formatCLP(r.retencion)}</td>
                <td style={{ border: '1px solid #ccc', padding: '3px 6px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 'bold' }}>{formatCLP(r.liquido)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ backgroundColor: '#f0f0f0', fontWeight: 'bold' }}>
              <td colSpan={5} style={{ border: '1px solid #ccc', padding: '4px 6px' }}>
                TOTALES — {processedDocs.length} boletas
              </td>
              <td style={{ border: '1px solid #ccc', padding: '4px 6px', textAlign: 'right', fontFamily: 'monospace' }}>{formatCLP(totalBruto)}</td>
              <td style={{ border: '1px solid #ccc', padding: '4px 6px', textAlign: 'right', fontFamily: 'monospace' }}>{formatCLP(totalRetencion)}</td>
              <td style={{ border: '1px solid #ccc', padding: '4px 6px', textAlign: 'right', fontFamily: 'monospace' }}>{formatCLP(totalLiquido)}</td>
            </tr>
          </tfoot>
        </table>

        <div style={{ marginTop: '20px', fontSize: '9px', color: '#666', textAlign: 'center', borderTop: '1px solid #ccc', paddingTop: '6px' }}>
          Generado por Mister Contabilidad — {new Date().toLocaleDateString('es-CL')}
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
