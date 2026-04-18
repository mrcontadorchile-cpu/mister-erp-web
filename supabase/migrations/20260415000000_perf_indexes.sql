-- Índices de rendimiento para queries frecuentes

-- asientos_borrador: filtros por status + company + fecha
CREATE INDEX IF NOT EXISTS idx_asientos_borrador_company_status
  ON conta.asientos_borrador (company_id, status, created_at DESC);

-- accounts: plan de cuentas por company + código
CREATE INDEX IF NOT EXISTS idx_accounts_company_code
  ON conta.accounts (company_id, code);

-- journal_entries: libro diario por company + period + fecha
CREATE INDEX IF NOT EXISTS idx_journal_entries_period_company
  ON conta.journal_entries (company_id, period_id, created_at DESC);
