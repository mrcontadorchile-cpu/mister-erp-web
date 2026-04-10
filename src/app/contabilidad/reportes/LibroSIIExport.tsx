'use client'
import * as XLSX from 'xlsx'
import { monthName } from '@/lib/utils'

interface Props {
  bookName: string
  headers:  string[]
  data:     (string | number)[][]
  totals:   (string | number)[]
  month:    number
  year:     number
  acum?:    boolean
  filename: string
}

export function LibroSIIExport({ bookName, headers, data, totals, month, year, acum, filename }: Props) {
  function handleExport() {
    const periodLabel = acum ? `Enero — ${monthName(month)} ${year}` : `${monthName(month)} ${year}`
    const ws = XLSX.utils.aoa_to_sheet([
      [bookName],
      [`Período: ${periodLabel}`],
      [`Generado: ${new Date().toLocaleDateString('es-CL')}`],
      [],
      headers,
      ...data,
      [],
      totals,
    ])
    // Auto column widths
    const colWidths = headers.map((h, i) => ({
      wch: Math.max(h.length, ...data.map(r => String(r[i] ?? '').length), 12)
    }))
    ws['!cols'] = colWidths
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, bookName.slice(0, 31))
    XLSX.writeFile(wb, filename)
  }
  return (
    <button
      onClick={handleExport}
      className="btn-ghost flex items-center gap-2 text-sm border border-border px-3 py-2 rounded-lg hover:border-primary/40 print:hidden"
    >
      <svg className="w-4 h-4 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
      </svg>
      Exportar Excel
    </button>
  )
}
