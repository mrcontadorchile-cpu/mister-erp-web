export const COMPRA_DOC_TYPES = ['33', '34', '46', '56', '61', 'LIQ', 'OTR']
export const VENTA_DOC_TYPES  = ['33', '34', '39', '41', '52', '56', '61']

// Types with IVA 19%
const AFECTO = new Set(['33', '46', '56', '39', 'LIQ'])

export function calcTax(amount: number, docType: string) {
  // NC-61 is negative (reduces totals)
  const sign = docType === '61' ? -1 : 1
  const abs  = Math.abs(amount)
  let neto = 0, iva = 0, exento = 0
  if (AFECTO.has(docType)) {
    neto = Math.round(abs / 1.19)
    iva  = abs - neto
  } else {
    exento = abs
  }
  return { neto: sign * neto, iva: sign * iva, exento: sign * exento, total: sign * abs }
}

// BHE retention rate by year (Chilean law)
export function honorRetentionRate(year: number): number {
  const r: Record<number, number> = {
    2020: 0.1075, 2021: 0.115, 2022: 0.1225, 2023: 0.13,
    2024: 0.1375, 2025: 0.145, 2026: 0.1525, 2027: 0.16, 2028: 0.17,
  }
  return r[year] ?? 0.17
}
