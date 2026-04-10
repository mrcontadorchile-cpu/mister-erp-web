'use client'

import * as XLSX from 'xlsx'

export interface BalItem { code: string; name: string; amount: number }
export interface BalSection { title: string; items: BalItem[]; total: number }

interface Props {
  dateLabel: string
  companyName: string
  companyRut?: string
  activo: BalSection[]
  totalActivo: number
  pasivo: BalSection[]
  totalPasivo: number
  patrimonio: BalSection[]
  totalPatrimonio: number
  totalPasPat: number
  balanced: boolean
}

export function BalanceExport({
  dateLabel, companyName, companyRut,
  activo, totalActivo,
  pasivo, totalPasivo,
  patrimonio, totalPatrimonio,
  totalPasPat, balanced,
}: Props) {
  function fmt(n: number) {
    return n < 0 ? `(${Math.abs(n).toLocaleString('es-CL')})` : n.toLocaleString('es-CL')
  }

  function handleExport() {
    const rows: (string | number | null)[][] = [
      [companyName],
      [companyRut ? `RUT: ${companyRut}` : ''],
      ['Balance General Clasificado'],
      [dateLabel],
      [balanced ? 'Balance cuadrado ✓' : `Balance descuadrado ⚠ — Diferencia: ${fmt(Math.abs(totalActivo - totalPasPat))}`],
      [],
      // Header
      ['', 'ACTIVO', '', '', 'PASIVO Y PATRIMONIO', ''],
      ['Código', 'Cuenta', 'Monto ($)', '', 'Código', 'Cuenta', 'Monto ($)'],
    ]

    // Construir filas activo + pasivo en paralelo
    type Side = (string | number | null)[]
    const leftRows: Side[] = []
    const rightRows: Side[] = []

    const addSection = (target: Side[], section: BalSection) => {
      target.push([`— ${section.title.toUpperCase()} —`, '', ''])
      for (const item of section.items) {
        target.push([item.code, item.name, item.amount])
      }
      target.push(['', `Total ${section.title}`, section.total])
      target.push(['', '', ''])
    }

    for (const s of activo)    addSection(leftRows, s)
    leftRows.push(['', 'TOTAL ACTIVO', totalActivo])

    for (const s of pasivo)    addSection(rightRows, s)
    for (const s of patrimonio) addSection(rightRows, s)
    rightRows.push(['', 'TOTAL PASIVO + PATRIMONIO', totalPasPat])

    const maxLen = Math.max(leftRows.length, rightRows.length)
    for (let i = 0; i < maxLen; i++) {
      const l = leftRows[i]  ?? ['', '', '']
      const r = rightRows[i] ?? ['', '', '']
      rows.push([...l, '', ...r])
    }

    const ws = XLSX.utils.aoa_to_sheet(rows)
    ws['!cols'] = [
      { wch: 10 }, { wch: 35 }, { wch: 16 }, { wch: 4 },
      { wch: 10 }, { wch: 35 }, { wch: 16 },
    ]

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Balance')

    const safeDate = dateLabel.replace(/[^a-zA-Z0-9]/g, '_')
    XLSX.writeFile(wb, `balance_${safeDate}.xlsx`)
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
