'use client'

import * as XLSX from 'xlsx'

export interface EerrLine {
  label: string
  amount: number | null  // null = sección/encabezado
  style: 'line' | 'subtotal' | 'total' | 'section' | 'divider'
}

interface Props {
  rows: EerrLine[]
  periodLabel: string
  companyName: string
  companyRut?: string
}

export function EerrExport({ rows, periodLabel, companyName, companyRut }: Props) {
  function handleExport() {
    const data: (string | number | null)[][] = [
      [companyName],
      [companyRut ? `RUT: ${companyRut}` : ''],
      ['Estado de Resultados'],
      [periodLabel],
      [],
      ['Concepto', 'Monto ($)'],
      [],
    ]

    for (const r of rows) {
      if (r.style === 'divider') {
        data.push([])
        continue
      }
      data.push([r.label, r.amount])
    }

    const ws = XLSX.utils.aoa_to_sheet(data)

    // Ancho columnas
    ws['!cols'] = [{ wch: 45 }, { wch: 18 }]

    // Estilos básicos via !merges no disponibles en sheetjs community —
    // usamos row data suficiente para identificar secciones

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'EERR')

    const safeLabel = periodLabel.replace(/[^a-zA-Z0-9]/g, '_')
    XLSX.writeFile(wb, `eerr_${safeLabel}.xlsx`)
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
