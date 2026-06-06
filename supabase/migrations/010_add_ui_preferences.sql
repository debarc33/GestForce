-- Add ui_preferences column to companies table
ALTER TABLE companies
ADD COLUMN IF NOT EXISTS ui_preferences JSONB DEFAULT '{
  "mode": "dark",
  "accent_color": "violeta",
  "background_theme": "auroras",
  "grid_overlay": false
}'::JSONB;

-- Ensure the column is indexed for faster lookups
CREATE INDEX IF NOT EXISTS idx_companies_ui_preferences ON companies USING gin (ui_preferences);
