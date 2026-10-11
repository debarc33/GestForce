-- Vincula cada período de nómina cerrado con el comprobante contable que genera
-- automáticamente en Contabilidad (costo total de nómina: devengado + aportes patronales).
ALTER TABLE payroll_periods
  ADD COLUMN IF NOT EXISTS journal_entry_id UUID REFERENCES journal_entries(id) ON DELETE SET NULL;
