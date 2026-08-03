-- Gastro Suite / 006_pos_business_rules.sql
USE gastro_suite;
SET time_zone = '+00:00';

ALTER TABLE orders
  ADD COLUMN ticket_number VARCHAR(40) NULL AFTER folio,
  ADD COLUMN business_date DATE NULL AFTER ticket_number,
  ADD COLUMN daily_sequence INT UNSIGNED NULL AFTER business_date;

UPDATE orders
SET ticket_number = folio,
    business_date = DATE(created_at),
    daily_sequence = CAST(SUBSTRING_INDEX(folio, '-', -1) AS UNSIGNED)
WHERE ticket_number IS NULL;

ALTER TABLE orders
  MODIFY ticket_number VARCHAR(40) NOT NULL,
  MODIFY business_date DATE NOT NULL,
  MODIFY daily_sequence INT UNSIGNED NOT NULL,
  ADD UNIQUE KEY uq_order_daily_sequence (branch_id, business_date, daily_sequence),
  ADD KEY idx_order_business_date (branch_id, business_date, created_at);

ALTER TABLE cash_register_shifts
  ADD COLUMN shift_name VARCHAR(80) NOT NULL DEFAULT 'General' AFTER branch_id,
  ADD COLUMN business_date DATE NULL AFTER shift_name,
  ADD COLUMN close_type VARCHAR(10) NULL AFTER status;

UPDATE cash_register_shifts
SET business_date = DATE(opened_at)
WHERE business_date IS NULL;

ALTER TABLE cash_register_shifts
  MODIFY business_date DATE NOT NULL,
  ADD KEY idx_cash_business_date (branch_id, business_date, status),
  ADD CONSTRAINT chk_cash_close_type CHECK (close_type IS NULL OR close_type IN ('X','Z'));

INSERT INTO payment_methods (code,name,requires_online_gateway,active) VALUES
  ('card_terminal','Tarjeta en caja',FALSE,TRUE),
  ('qr','Pago con QR',FALSE,TRUE),
  ('codi','CoDi',FALSE,TRUE),
  ('dimo','DiMo',FALSE,TRUE)
ON DUPLICATE KEY UPDATE name=VALUES(name),requires_online_gateway=VALUES(requires_online_gateway),active=TRUE;

UPDATE order_statuses SET name='Recibido' WHERE code='pending';
UPDATE order_statuses SET name='Confirmado' WHERE code='paid';
UPDATE order_statuses SET name='En preparación' WHERE code='preparing';
UPDATE order_statuses SET name='Listo' WHERE code='ready';
UPDATE order_statuses SET name='Asignado a repartidor' WHERE code='assigned';
