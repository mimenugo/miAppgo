-- Gastro Suite / 002_orders_payments.sql
USE gastro_suite;
SET time_zone = '+00:00';

CREATE TABLE order_statuses (
  code VARCHAR(40) PRIMARY KEY, name VARCHAR(100) NOT NULL, sort_order SMALLINT UNSIGNED NOT NULL, is_terminal BOOLEAN NOT NULL DEFAULT FALSE
) ENGINE=InnoDB;

CREATE TABLE orders (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, public_id CHAR(36) NOT NULL UNIQUE, folio VARCHAR(40) NOT NULL,
  business_id BIGINT UNSIGNED NOT NULL, branch_id BIGINT UNSIGNED NOT NULL, customer_id BIGINT UNSIGNED, created_by_user_id BIGINT UNSIGNED,
  source VARCHAR(20) NOT NULL, fulfillment_type VARCHAR(30) NOT NULL, status_code VARCHAR(40) NOT NULL DEFAULT 'pending',
  customer_name VARCHAR(160) NOT NULL, customer_phone VARCHAR(30), delivery_address_snapshot JSON, delivery_zone_id BIGINT UNSIGNED,
  requested_at DATETIME(3), scheduled_for DATETIME(3), subtotal DECIMAL(12,2) NOT NULL,
  discount_total DECIMAL(12,2) NOT NULL DEFAULT 0, tax_total DECIMAL(12,2) NOT NULL DEFAULT 0,
  service_charge DECIMAL(12,2) NOT NULL DEFAULT 0, tip_total DECIMAL(12,2) NOT NULL DEFAULT 0,
  delivery_fee DECIMAL(12,2) NOT NULL DEFAULT 0, total DECIMAL(12,2) NOT NULL, customer_notes VARCHAR(1000),
  accepted_at DATETIME(3), ready_at DATETIME(3), delivered_at DATETIME(3), cancelled_at DATETIME(3), cancellation_reason VARCHAR(500),
  version INT UNSIGNED NOT NULL DEFAULT 1,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_order_folio (branch_id, folio), KEY idx_order_status (branch_id, status_code, created_at),
  KEY idx_order_customer (customer_id, created_at), KEY idx_order_schedule (branch_id, scheduled_for, status_code),
  CONSTRAINT fk_order_business FOREIGN KEY (business_id) REFERENCES businesses(id),
  CONSTRAINT fk_order_branch FOREIGN KEY (branch_id) REFERENCES branches(id),
  CONSTRAINT fk_order_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
  CONSTRAINT fk_order_creator FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_order_zone FOREIGN KEY (delivery_zone_id) REFERENCES delivery_zones(id) ON DELETE SET NULL,
  CONSTRAINT fk_order_status FOREIGN KEY (status_code) REFERENCES order_statuses(code),
  CONSTRAINT chk_order_source CHECK (source IN ('pwa','pos','admin','chatbot','api')),
  CONSTRAINT chk_order_fulfillment CHECK (fulfillment_type IN ('pickup','delivery')),
  CONSTRAINT chk_order_amounts CHECK (subtotal >= 0 AND total >= 0 AND delivery_fee >= 0)
) ENGINE=InnoDB;

CREATE TABLE order_items (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, order_id BIGINT UNSIGNED NOT NULL, product_id BIGINT UNSIGNED,
  product_name VARCHAR(160) NOT NULL, sku VARCHAR(60), quantity DECIMAL(10,3) NOT NULL,
  unit_price DECIMAL(12,2) NOT NULL, modifier_total DECIMAL(12,2) NOT NULL DEFAULT 0,
  line_total DECIMAL(12,2) NOT NULL, preparation_notes VARCHAR(700), created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY idx_item_order (order_id), CONSTRAINT fk_item_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_item_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL,
  CONSTRAINT chk_item_values CHECK (quantity > 0 AND unit_price >= 0 AND line_total >= 0)
) ENGINE=InnoDB;

CREATE TABLE order_item_modifiers (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, order_item_id BIGINT UNSIGNED NOT NULL, modifier_option_id BIGINT UNSIGNED,
  modifier_name VARCHAR(120) NOT NULL, quantity SMALLINT UNSIGNED NOT NULL DEFAULT 1, unit_price_delta DECIMAL(12,2) NOT NULL DEFAULT 0,
  CONSTRAINT fk_oim_item FOREIGN KEY (order_item_id) REFERENCES order_items(id) ON DELETE CASCADE,
  CONSTRAINT fk_oim_option FOREIGN KEY (modifier_option_id) REFERENCES modifier_options(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE order_status_history (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, order_id BIGINT UNSIGNED NOT NULL,
  from_status_code VARCHAR(40), to_status_code VARCHAR(40) NOT NULL, changed_by_user_id BIGINT UNSIGNED,
  notes VARCHAR(500), latitude DECIMAL(10,7), longitude DECIMAL(10,7), created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY idx_history_order (order_id, created_at),
  CONSTRAINT fk_history_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_history_from FOREIGN KEY (from_status_code) REFERENCES order_statuses(code),
  CONSTRAINT fk_history_to FOREIGN KEY (to_status_code) REFERENCES order_statuses(code),
  CONSTRAINT fk_history_user FOREIGN KEY (changed_by_user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE production_tickets (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, order_id BIGINT UNSIGNED NOT NULL, preparation_area_id SMALLINT UNSIGNED NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending', accepted_by_user_id BIGINT UNSIGNED,
  accepted_at DATETIME(3), completed_at DATETIME(3), reprint_count SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_ticket_area (order_id, preparation_area_id), KEY idx_ticket_queue (preparation_area_id, status, created_at),
  CONSTRAINT fk_ticket_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_ticket_area FOREIGN KEY (preparation_area_id) REFERENCES preparation_areas(id),
  CONSTRAINT fk_ticket_user FOREIGN KEY (accepted_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT chk_ticket_status CHECK (status IN ('pending','accepted','preparing','ready','cancelled'))
) ENGINE=InnoDB;

CREATE TABLE production_ticket_items (
  production_ticket_id BIGINT UNSIGNED NOT NULL, order_item_id BIGINT UNSIGNED NOT NULL,
  quantity DECIMAL(10,3) NOT NULL, status VARCHAR(20) NOT NULL DEFAULT 'pending',
  PRIMARY KEY (production_ticket_id, order_item_id),
  CONSTRAINT fk_pti_ticket FOREIGN KEY (production_ticket_id) REFERENCES production_tickets(id) ON DELETE CASCADE,
  CONSTRAINT fk_pti_item FOREIGN KEY (order_item_id) REFERENCES order_items(id) ON DELETE CASCADE,
  CONSTRAINT chk_pti_status CHECK (status IN ('pending','preparing','ready','cancelled'))
) ENGINE=InnoDB;

CREATE TABLE payment_methods (
  code VARCHAR(30) PRIMARY KEY, name VARCHAR(80) NOT NULL, requires_online_gateway BOOLEAN NOT NULL DEFAULT FALSE, active BOOLEAN NOT NULL DEFAULT TRUE
) ENGINE=InnoDB;

CREATE TABLE payment_gateway_configs (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, business_id BIGINT UNSIGNED NOT NULL,
  provider VARCHAR(30) NOT NULL, environment VARCHAR(20) NOT NULL DEFAULT 'test', public_key VARCHAR(500),
  secret_reference VARCHAR(500) COMMENT 'Identificador en bóveda; nunca el secreto',
  webhook_url VARCHAR(500), webhook_secret_reference VARCHAR(500), currency CHAR(3) NOT NULL DEFAULT 'MXN',
  configuration JSON, active BOOLEAN NOT NULL DEFAULT FALSE, last_validated_at DATETIME(3), last_validation_status VARCHAR(30),
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_gateway (business_id, provider, environment),
  CONSTRAINT fk_gateway_business FOREIGN KEY (business_id) REFERENCES businesses(id),
  CONSTRAINT chk_gateway_provider CHECK (provider IN ('stripe','mercado_pago','paypal')),
  CONSTRAINT chk_gateway_env CHECK (environment IN ('test','production'))
) ENGINE=InnoDB;

CREATE TABLE bank_accounts (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, business_id BIGINT UNSIGNED NOT NULL,
  holder_name VARCHAR(200) NOT NULL, bank_name VARCHAR(120) NOT NULL,
  account_number_encrypted VARBINARY(1024) NOT NULL, account_number_last4 CHAR(4) NOT NULL,
  clabe_encrypted VARBINARY(1024) NOT NULL, clabe_last4 CHAR(4) NOT NULL,
  card_number_encrypted VARBINARY(1024), card_number_last4 CHAR(4),
  suggested_reference VARCHAR(160), customer_instructions TEXT, payment_qr_url VARCHAR(500),
  encryption_key_version VARCHAR(40) NOT NULL, active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  KEY idx_bank_active (business_id, active), CONSTRAINT fk_bank_business FOREIGN KEY (business_id) REFERENCES businesses(id)
) ENGINE=InnoDB;

CREATE TABLE payments (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, public_id CHAR(36) NOT NULL UNIQUE, order_id BIGINT UNSIGNED NOT NULL,
  payment_method_code VARCHAR(30) NOT NULL, gateway_config_id BIGINT UNSIGNED, status VARCHAR(30) NOT NULL DEFAULT 'pending',
  amount_expected DECIMAL(12,2) NOT NULL, amount_received DECIMAL(12,2) NOT NULL DEFAULT 0, currency CHAR(3) NOT NULL DEFAULT 'MXN',
  external_transaction_id VARCHAR(190), reference VARCHAR(190), proof_file_url VARCHAR(500),
  paid_at DATETIME(3), validated_by_user_id BIGINT UNSIGNED, validated_at DATETIME(3), metadata JSON,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  KEY idx_payment_order (order_id, status), KEY idx_payment_external (external_transaction_id),
  KEY idx_payment_filters (created_at, payment_method_code, status),
  CONSTRAINT fk_payment_order FOREIGN KEY (order_id) REFERENCES orders(id),
  CONSTRAINT fk_payment_method FOREIGN KEY (payment_method_code) REFERENCES payment_methods(code),
  CONSTRAINT fk_payment_gateway FOREIGN KEY (gateway_config_id) REFERENCES payment_gateway_configs(id) ON DELETE SET NULL,
  CONSTRAINT fk_payment_validator FOREIGN KEY (validated_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT chk_payment_status CHECK (status IN ('pending','pending_validation','paid','difference','rejected','refunded','cancelled')),
  CONSTRAINT chk_payment_amounts CHECK (amount_expected >= 0 AND amount_received >= 0)
) ENGINE=InnoDB;

CREATE TABLE payment_events (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, payment_id BIGINT UNSIGNED NOT NULL, provider VARCHAR(30) NOT NULL,
  external_event_id VARCHAR(190), event_type VARCHAR(120) NOT NULL, payload JSON,
  signature_verified BOOLEAN NOT NULL DEFAULT FALSE, processed_at DATETIME(3), processing_error VARCHAR(1000),
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_payment_event (provider, external_event_id),
  CONSTRAINT fk_event_payment FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE refunds (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, payment_id BIGINT UNSIGNED NOT NULL, amount DECIMAL(12,2) NOT NULL,
  reason VARCHAR(500) NOT NULL, status VARCHAR(30) NOT NULL DEFAULT 'pending', external_refund_id VARCHAR(190),
  requested_by_user_id BIGINT UNSIGNED NOT NULL, approved_by_user_id BIGINT UNSIGNED,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), completed_at DATETIME(3),
  CONSTRAINT fk_refund_payment FOREIGN KEY (payment_id) REFERENCES payments(id),
  CONSTRAINT fk_refund_requester FOREIGN KEY (requested_by_user_id) REFERENCES users(id),
  CONSTRAINT fk_refund_approver FOREIGN KEY (approved_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT chk_refund_values CHECK (amount > 0 AND status IN ('pending','approved','completed','rejected','failed'))
) ENGINE=InnoDB;

CREATE OR REPLACE VIEW v_order_payment_summary AS
SELECT o.id order_id, o.folio, o.branch_id, o.customer_name, o.customer_phone, o.total amount_expected,
  COALESCE(SUM(CASE WHEN p.status IN ('paid','difference','refunded') THEN p.amount_received ELSE 0 END),0) amount_received,
  CASE
    WHEN COALESCE(SUM(CASE WHEN p.status IN ('paid','difference') THEN p.amount_received ELSE 0 END),0)=0 THEN 'pending'
    WHEN COALESCE(SUM(CASE WHEN p.status IN ('paid','difference') THEN p.amount_received ELSE 0 END),0)=o.total THEN 'paid'
    ELSE 'difference' END reconciliation_status,
  o.created_at
FROM orders o LEFT JOIN payments p ON p.order_id=o.id AND p.status<>'cancelled'
GROUP BY o.id,o.folio,o.branch_id,o.customer_name,o.customer_phone,o.total,o.created_at;
