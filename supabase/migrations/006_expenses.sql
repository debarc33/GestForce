-- ============================================================
-- MIGRACIÓN 006: Módulo de Gastos
--
-- Crea tres tablas:
--   1. expense_categories  — categorías (fijo / variable)
--   2. expenses            — gastos individuales
--   3. recurring_expenses  — plantillas de gastos recurrentes
-- ============================================================

-- 1. Categorías de gasto
CREATE TABLE IF NOT EXISTS expense_categories (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name        TEXT        NOT NULL,
  type        TEXT        NOT NULL CHECK (type IN ('fijo', 'variable')),
  account_code TEXT       NOT NULL DEFAULT '5195',   -- cuenta PUC (Diversos por defecto)
  is_active   BOOLEAN     NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Gastos individuales
CREATE TABLE IF NOT EXISTS expenses (
  id                   UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id           UUID         NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  category_id          UUID         REFERENCES expense_categories(id) ON DELETE SET NULL,
  expense_date         DATE         NOT NULL,
  description          TEXT         NOT NULL,
  amount               NUMERIC(14,2) NOT NULL,
  payment_method       TEXT         NOT NULL DEFAULT 'transferencia'
                         CHECK (payment_method IN ('efectivo','transferencia','tarjeta','otro')),
  status               TEXT         NOT NULL DEFAULT 'pagado'
                         CHECK (status IN ('pagado','pendiente')),
  receipt_url          TEXT,
  journal_entry_id     UUID         REFERENCES journal_entries(id) ON DELETE SET NULL,
  recurring_expense_id UUID,        -- FK añadida después de crear recurring_expenses
  notes                TEXT,
  created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- 3. Plantillas de gastos recurrentes
CREATE TABLE IF NOT EXISTS recurring_expenses (
  id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id     UUID         NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  category_id    UUID         REFERENCES expense_categories(id) ON DELETE SET NULL,
  description    TEXT         NOT NULL,
  amount         NUMERIC(14,2) NOT NULL,
  frequency      TEXT         NOT NULL DEFAULT 'mensual'
                   CHECK (frequency IN ('mensual','trimestral','semestral','anual')),
  day_of_month   SMALLINT     NOT NULL DEFAULT 1 CHECK (day_of_month BETWEEN 1 AND 28),
  start_date     DATE         NOT NULL,
  end_date       DATE,
  is_active      BOOLEAN      NOT NULL DEFAULT true,
  payment_method TEXT         NOT NULL DEFAULT 'transferencia',
  notes          TEXT,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- FK de expenses → recurring_expenses
ALTER TABLE expenses
  ADD CONSTRAINT fk_expenses_recurring
  FOREIGN KEY (recurring_expense_id)
  REFERENCES recurring_expenses(id) ON DELETE SET NULL;

-- Índices
CREATE INDEX IF NOT EXISTS idx_expenses_company_date
  ON expenses(company_id, expense_date DESC);

CREATE INDEX IF NOT EXISTS idx_expense_categories_company
  ON expense_categories(company_id) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_recurring_expenses_company
  ON recurring_expenses(company_id) WHERE is_active = true;

-- ============================================================
-- VERIFICACIÓN:
--   SELECT table_name FROM information_schema.tables
--   WHERE table_name IN ('expense_categories','expenses','recurring_expenses');
-- ============================================================
