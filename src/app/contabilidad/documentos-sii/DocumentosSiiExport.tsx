'use client'

import * as XLSX from 'xlsx'

interface DocRow {
  type: string
  folio: number
  date: string
  rut_counterpart: string
  name_counterpart: string
  net_amount: number
  tax_amount: number
  total_amount: number
  retention_amount: number
  status: string
}

const TYPE_LABEL: Record<string, string> = {
  FACTURA_COMPRA:   'Factura Compra',
  FACTURA_VENTA:    'Factura Venta',
  BOLETA_HONORARIO: 'Boleta Honorario',
  NOTA_CREDITO:     'Nota Crédito',
  NOTA_DEBITO:      'Nota Débito',
}

const STATUS_LABEL: Record<string, string> = {
  pending:     'Pendiente',
  journalized: 'Contabilizado',
  rejected:    'Rechazado',
}

interface Props {
  docs: DocRow[]
  companyName: string
  filterLabel?: string
}

export function DocumentosSiiExport({ docs, companyName, filterLabel }: Props) {
  function handleExport() {
    const data: (string | number | null)[][] = [
      [companyName],
      ['Documentos Tributarios SII'],
      [filterLabel ?? `${docs.length} documentos`],
      [],
      ['Tipo', 'Folio', 'Fecha', 'RUT', 'Nombre', 'Neto ($)', 'IVA ($)', 'Total ($)', 'Retención ($)', 'Estado'],
      ...docs.map(d => [
        TYPE_LABEL[d.type] ?? d.type,
        d.folio,
        d.date,
        d.rut_counterpart,
        d.name_counterpart,
        d.net_amount,
        d.tax_amount,
        d.total_amount,
        d.retention_amount,
        STATUS_LABEL[d.status] ?? d.status,
      ]),
      [],
      [
        '', '', '', '', 'TOTALES',
        docs.reduce((s, d) => s + d.net_amount, 0),
        docs.reduce((s, d) => s + d.tax_amount, 0),
        docs.reduce((s, d) => s + d.total_amount, 0),
        docs.reduce((s, d) => s + d.retention_amount, 0),
        '',
      ],
    ]

    const ws = XLSX.utils.aoa_to_sheet(data)
    ws['!cols'] = [
      { wch: 18 }, // Tipo
      { wch: 8  }, // Folio
      { wch: 12 }, // Fecha
      { wch: 14 }, // RUT
      { wch: 30 }, // Nombre
      { wch: 14 }, // Neto
      { wch: 12 }, // IVA
      { wch: 14 }, // Total
      { wch: 14 }, // Retención
      { wch: 14 }, // Estado
    ]

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Documentos SII')
    XLSX.writeFile(wb, `documentos_sii_${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  return (
    <button
      onClick={handleExport}
      className="btn-ghost flex items-center gap-2 text-sm border border-border px-3 py-2 rounded-lg hover:border-primary/40"
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
