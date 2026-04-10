'use client'

import * as XLSX from 'xlsx'

interface Row {
  cc_codigo:  string
  cc_nombre:  string
  cta_codigo: string
  cta_nombre: string
  numero:     number
  fecha:      string
  glosa:      string
  debe:       number
  haber:      number
}

export function CentroCostoExport({ rows, periodo }: { rows: Row[]; periodo: string }) {
  function handleExport() {
    const header = [
      'CC Código', 'CC Nombre', 'Cta. Código', 'Cta. Nombre',
      'N° Asiento', 'Fecha', 'Glosa', 'DEBE', 'HABER', 'NETO',
    ]

    const data = rows.map(r => [
      r.cc_codigo,
      r.cc_nombre,
      r.cta_codigo,
      r.cta_nombre,
      r.numero,
      r.fecha ? new Date(r.fecha).toLocaleDateString('es-CL') : '',
      r.glosa,
      r.debe,
      r.haber,
      r.debe - r.haber,
    ])

    const totalDebe  = rows.reduce((s, r) => s + r.debe, 0)
    const totalHaber = rows.reduce((s, r) => s + r.haber, 0)
    const totals = ['', '', '', '', '', '', 'TOTALES', totalDebe, totalHaber, totalDebe - totalHaber]

    const ws = XLSX.utils.aoa_to_sheet([
      [`Gastos por Centro de Costo — ${periodo}`],
      [],
      header,
      ...data,
      [],
      totals,
    ])

    ws['!cols'] = [
      { wch: 10 }, { wch: 25 }, { wch: 12 }, { wch: 30 },
      { wch: 12 }, { wch: 12 }, { wch: 40 }, { wch: 14 }, { wch: 14 }, { wch: 14 },
    ]

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'CC')
    XLSX.writeFile(wb, `gastos_cc_${periodo.replace(/\s/g, '_')}.xlsx`)
  }

  return (
    <button
      onClick={handleExport}
      className="btn-ghost flex items-center gap-2 text-sm border border-border px-3 py-2 rounded-lg hover:border-primary/40"
    >
      <svg className="w-4 h-4 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
      </svg>
      Exportar Excel
    </button>
  )
}
