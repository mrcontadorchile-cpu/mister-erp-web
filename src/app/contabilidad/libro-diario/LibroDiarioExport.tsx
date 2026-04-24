'use client'

import * as XLSX from 'xlsx'

interface EntryRow {
  number: number
  date: string
  glosa: string
  type: string
  total_debit: number
  total_credit: number
  status: string
}

const TYPE_LABEL: Record<string, string> = {
  MANUAL:            'Manual',
  SII_FACTURA:       'Factura SII',
  SII_HONORARIO:     'Honorario SII',
  INVENTARIO_VENTA:  'Venta Inventario',
  INVENTARIO_COMPRA: 'Compra Inventario',
}

const STATUS_LABEL: Record<string, string> = {
  posted:   'Contabilizado',
  draft:    'Borrador',
  reversed: 'Revertido',
}

interface Props {
  entries: EntryRow[]
  periodLabel: string
  companyName: string
}

export function LibroDiarioExport({ entries, periodLabel, companyName }: Props) {
  function handleExport() {
    const totalDebe  = entries.reduce((s, e) => s + e.total_debit, 0)
    const totalHaber = entries.reduce((s, e) => s + e.total_credit, 0)

    const data: (string | number | null)[][] = [
      [companyName],
      ['Libro Diario'],
      [periodLabel],
      [],
      ['N°', 'Fecha', 'Glosa', 'Tipo', 'Estado', 'DEBE ($)', 'HABER ($)'],
      ...entries.map(e => [
        e.number,
        e.date,
        e.glosa,
        TYPE_LABEL[e.type] ?? e.type,
        STATUS_LABEL[e.status] ?? e.status,
        e.total_debit,
        e.total_credit,
      ]),
      [],
      ['', '', '', '', 'TOTALES', totalDebe, totalHaber],
    ]

    const ws = XLSX.utils.aoa_to_sheet(data)
    ws['!cols'] = [
      { wch: 6 },  // N°
      { wch: 12 }, // Fecha
      { wch: 40 }, // Glosa
      { wch: 18 }, // Tipo
      { wch: 16 }, // Estado
      { wch: 16 }, // DEBE
      { wch: 16 }, // HABER
    ]

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Libro Diario')
    const safeLabel = periodLabel.replace(/[^a-zA-Z0-9]/g, '_')
    XLSX.writeFile(wb, `libro_diario_${safeLabel}.xlsx`)
  }

  return (
    <button
      onClick={handleExport}
      className="btn-ghost flex items-center gap-2 text-sm border border-border px-3 py-2 rounded-lg hover:border-primary/40 print:hidden"
      title="Exportar a Excel"
    >
      <svg className="w-4 h-4 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
      </svg>
      Excel
    </button>
  )
}
