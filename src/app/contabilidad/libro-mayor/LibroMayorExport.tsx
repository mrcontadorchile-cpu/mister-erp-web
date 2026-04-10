'use client'

import * as XLSX from 'xlsx'
import { monthName } from '@/lib/utils'
import { docTypeLabel } from '@/lib/doc-types'

export interface MayorRow {
  cuenta_codigo?: string
  cuenta_nombre?: string
  tipo:           string
  numero:         number
  fecha:          string
  glosa:          string
  descripcion:    string
  cc_codigo:      string
  cc_nombre:      string
  auxiliar:       string
  doc_tipo:       string
  doc_numero:     string
  ref_tipo:       string
  ref_numero:     string
  debe:           number
  haber:          number
  saldo:          number
}

interface Props {
  rows:        MayorRow[]
  accountCode: string
  accountName: string
  month:       number
  year:        number
  acum?:       boolean
}

export function LibroMayorExport({ rows, accountCode, accountName, month, year, acum }: Props) {
  function handleExport() {
    const allAccounts = accountCode === 'TODAS'

    const header = [
      ...(allAccounts ? ['Cta. Código', 'Cta. Nombre'] : []),
      'Tipo Asiento',
      'N° Comprobante',
      'Fecha',
      'Glosa',
      'Descripción línea',
      'CC Código',
      'CC Nombre',
      'Auxiliar',
      'Tipo Documento',
      'N° Documento',
      'Ref. Tipo Doc.',
      'Ref. N° Doc.',
      'DEBE',
      'HABER',
      'SALDO',
    ]

    const data = rows.map(r => [
      ...(allAccounts ? [r.cuenta_codigo ?? '', r.cuenta_nombre ?? ''] : []),
      r.tipo,
      r.numero,
      r.fecha ? new Date(r.fecha + 'T12:00:00').toLocaleDateString('es-CL') : '',
      r.glosa,
      r.descripcion,
      r.cc_codigo,
      r.cc_nombre,
      r.auxiliar,
      r.doc_tipo ? docTypeLabel(r.doc_tipo) : '',
      r.doc_numero,
      r.ref_tipo ? docTypeLabel(r.ref_tipo) : '',
      r.ref_numero,
      r.debe,
      r.haber,
      r.saldo,
    ])

    const totalDebe  = rows.reduce((s, r) => s + r.debe,  0)
    const totalHaber = rows.reduce((s, r) => s + r.haber, 0)
    const saldoFinal = rows[rows.length - 1]?.saldo ?? 0

    const emptyPad = allAccounts ? ['', ''] : []
    // columnas: tipo, numero, fecha, glosa, desc, cc_cod, cc_nom, aux, doc_tipo, doc_num, ref_tipo, ref_num → 12 cols antes de montos
    const totals = [...emptyPad, '', '', '', '', '', '', '', '', '', '', '', 'TOTALES', totalDebe, totalHaber, saldoFinal]

    const periodLabel = acum ? `Enero — ${monthName(month)} ${year}` : `${monthName(month)} ${year}`

    const ws = XLSX.utils.aoa_to_sheet([
      [`Libro Mayor — ${accountCode} ${accountName}`],
      [`Período: ${periodLabel}`],
      [`Generado: ${new Date().toLocaleDateString('es-CL')}`],
      [],
      header,
      ...data,
      [],
      totals,
    ])

    ws['!cols'] = [
      ...(allAccounts ? [{ wch: 12 }, { wch: 32 }] : []),
      { wch: 14 }, // Tipo Asiento
      { wch: 14 }, // N° Comprobante
      { wch: 12 }, // Fecha
      { wch: 42 }, // Glosa
      { wch: 28 }, // Descripción
      { wch: 10 }, // CC código
      { wch: 22 }, // CC nombre
      { wch: 32 }, // Auxiliar
      { wch: 22 }, // Tipo Documento
      { wch: 14 }, // N° Documento
      { wch: 20 }, // Ref. Tipo Doc.
      { wch: 14 }, // Ref. N° Doc.
      { wch: 16 }, // DEBE
      { wch: 16 }, // HABER
      { wch: 16 }, // SALDO
    ]

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Mayor')

    const filename = `mayor_${accountCode}_${year}${String(month).padStart(2, '0')}${acum ? '_acum' : ''}.xlsx`
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
