-- Renumera los pedidos de compra con identificador "legacy" (asignado por la
-- migración 014 como parche temporal, ej. OC-LEGACY-3466f455) a un número de
-- orden limpio y secuencial, con el mismo formato que ya usa el resto de la
-- app (ej. COT-000001 en cotizaciones): OC-000001, OC-000002, etc.,
-- consecutivo por empresa.
--
-- Confirmado con el usuario (9 oct 2026): los registros actuales con este
-- identificador son únicamente pruebas creadas en su propio usuario
-- superadmin, así que no hay problema en reasignarles un número nuevo
-- (Fase 5, punto 14 del plan de corrección UX/UI).

WITH legacy AS (
  SELECT id, company_id,
         ROW_NUMBER() OVER (PARTITION BY company_id ORDER BY created_at) AS rn
  FROM purchase_orders
  WHERE order_number LIKE 'OC-LEGACY-%'
),
starting_point AS (
  SELECT company_id,
         MAX(substring(order_number from '^OC-(\d+)$')::int) AS max_num
  FROM purchase_orders
  WHERE order_number ~ '^OC-\d+$'
  GROUP BY company_id
)
UPDATE purchase_orders po
SET order_number = 'OC-' || lpad((COALESCE(sp.max_num, 0) + l.rn)::text, 6, '0')
FROM legacy l
LEFT JOIN starting_point sp ON sp.company_id = l.company_id
WHERE po.id = l.id;
