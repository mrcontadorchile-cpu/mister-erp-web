import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { AccountType } from '@/types/database'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCLP(amount: number): string {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    minimumFractionDigits: 0,
  }).format(amount)
}

export function formatNumber(amount: number): string {
  return new Intl.NumberFormat('es-CL').format(amount)
}

export const MONTHS = [
  '', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

export function monthName(m: number): string {
  return MONTHS[m] ?? ''
}

export function accountTypeColor(type: AccountType): string {
  switch (type) {
    case 'ACTIVO':     return '#4CAF50'
    case 'PASIVO':     return '#E53935'
    case 'PATRIMONIO': return '#9C27B0'
    case 'INGRESO':    return '#2196F3'
    case 'EGRESO':     return '#FF9800'
  }
}

export function accountTypeLabel(type: AccountType): string {
  switch (type) {
    case 'ACTIVO':     return 'Activo'
    case 'PASIVO':     return 'Pasivo'
    case 'PATRIMONIO': return 'Patrimonio'
    case 'INGRESO':    return 'Ingreso'
    case 'EGRESO':     return 'Egreso'
  }
}

export function taxDocTypeLabel(type: string): string {
  switch (type) {
    case 'FACTURA_COMPRA':   return 'Factura Compra'
    case 'FACTURA_VENTA':    return 'Factura Venta'
    case 'BOLETA_HONORARIO': return 'Boleta Honorario'
    case 'NOTA_CREDITO':     return 'Nota Crédito'
    case 'NOTA_DEBITO':      return 'Nota Débito'
    default:                 return type
  }
}

export function lastDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}
