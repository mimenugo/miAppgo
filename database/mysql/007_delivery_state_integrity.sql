-- Gastro Suite / 007_delivery_state_integrity.sql
USE gastro_suite;
SET time_zone = '+00:00';

-- Conserva solo la asignacion activa mas reciente de cada pedido.
UPDATE delivery_assignments da
JOIN (
  SELECT order_id,MAX(id) keep_id
  FROM delivery_assignments
  WHERE status IN ('assigned','accepted','en_route')
  GROUP BY order_id
  HAVING COUNT(*) > 1
) duplicated ON duplicated.order_id=da.order_id
SET da.status='cancelled',da.notes=CONCAT_WS(' · ',da.notes,'Asignacion duplicada corregida por migracion 007')
WHERE da.id<>duplicated.keep_id AND da.status IN ('assigned','accepted','en_route');

-- MySQL permite varios NULL en una clave unica. Solo las asignaciones activas
-- generan active_order_id, impidiendo dos repartidores activos para un pedido.
ALTER TABLE delivery_assignments
  ADD COLUMN active_order_id BIGINT UNSIGNED
    GENERATED ALWAYS AS (CASE WHEN status IN ('assigned','accepted','en_route') THEN order_id ELSE NULL END) STORED,
  ADD UNIQUE KEY uq_delivery_assignment_active_order (active_order_id);

-- Repara pedidos cuyas comandas ya terminaron pero conservaron un estado anterior.
UPDATE orders o
SET o.status_code=CASE
  WHEN EXISTS (
    SELECT 1 FROM delivery_assignments da
    WHERE da.order_id=o.id AND da.status IN ('assigned','accepted','en_route')
  ) THEN 'assigned'
  ELSE 'ready'
END,
o.version=o.version+1
WHERE o.status_code NOT IN ('ready','assigned','en_route','delivered','cancelled')
  AND EXISTS (SELECT 1 FROM production_tickets pt WHERE pt.order_id=o.id)
  AND NOT EXISTS (SELECT 1 FROM production_tickets pt WHERE pt.order_id=o.id AND pt.status<>'ready');
