// ─────────────────────────────────────────────────────────────
// Tipos TypeScript que mapean el schema conta.* en Supabase
// ─────────────────────────────────────────────────────────────

export type AccountType = 'ACTIVO' | 'PASIVO' | 'PATRIMONIO' | 'INGRESO' | 'EGRESO'
export type AccountNature = 'DEUDOR' | 'ACREEDOR'
export type PeriodStatus = 'open' | 'closed'
export type JournalEntryType = 'MANUAL' | 'SII_FACTURA' | 'SII_HONORARIO' | 'INVENTARIO_VENTA' | 'INVENTARIO_COMPRA'
export type JournalEntryStatus = 'draft' | 'posted' | 'reversed'
export type TaxDocumentType = 'FACTURA_COMPRA' | 'FACTURA_VENTA' | 'BOLETA_HONORARIO' | 'NOTA_CREDITO' | 'NOTA_DEBITO'
export type TaxDocumentStatus = 'pending' | 'journalized' | 'rejected'

export interface Account {
  id: string
  company_id: string
  code: string
  name: string
  type: AccountType
  subtype: string | null
  nature: AccountNature
  level: number
  parent_id: string | null
  allows_entry: boolean
  cost_center_required: boolean
  active: boolean
  created_at: string
  // joins
  parent_code?: string
  parent_name?: string
}

export interface CostCenter {
  id: string
  company_id: string
  code: string
  name: string
  active: boolean
}

export interface Period {
  id: string
  company_id: string
  year: number
  month: number
  status: PeriodStatus
  closed_at: string | null
  closed_by: string | null
}

export interface JournalEntry {
  id: string
  company_id: string
  period_id: string
  number: number
  date: string
  glosa: string
  type: JournalEntryType
  source_id: string | null
  source_module: string | null
  status: JournalEntryStatus
  created_by: string
  created_at: string
  // aggregates from join
  total_debit?: number
  total_credit?: number
  lines_count?: number
}

export interface JournalLine {
  id: string
  entry_id: string
  account_id: string
  cost_center_id: string | null
  debit: number
  credit: number
  description: string | null
  // joins
  account_code?: string
  account_name?: string
  cost_center_name?: string
}

export interface TaxDocument {
  id: string
  company_id: string
  type: TaxDocumentType
  folio: number
  date: string
  rut_counterpart: string
  name_counterpart: string
  net_amount: number
  tax_amount: number
  total_amount: number
  retention_amount: number
  status: TaxDocumentStatus
  journal_entry_id: string | null
  created_at: string
}

export interface AccountBalance {
  account_id: string
  code: string
  name: string
  type: AccountType
  nature: AccountNature
  total_debit: number
  total_credit: number
  balance: number
}

export interface DashboardStats {
  journal_entries: number
  tax_documents: number
  pending_documents: number
}

export interface UserProfile {
  id: string
  role: string
  full_name: string
  company_id: string
  company_name: string
  company_rut: string
  /** Resolved permissions for the active company (from erp_roles) */
  permissions: string[]
  /** All companies this user belongs to */
  companies: { id: string; name: string; rut: string }[]
}
