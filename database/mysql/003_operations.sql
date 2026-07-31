-- Gastro Suite / 003_operations.sql
USE gastro_suite;
SET time_zone = '+00:00';

CREATE TABLE drivers (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, user_id BIGINT UNSIGNED NOT NULL UNIQUE,
  vehicle_type VARCHAR(40), vehicle_plate VARCHAR(30), availability_status VARCHAR(30) NOT NULL DEFAULT 'offline',
  location_sharing_consent_at DATETIME(3), active BOOLEAN NOT NULL DEFAULT TRUE,
  CONSTRAINT fk_driver_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT chk_driver_status CHECK (availability_status IN ('offline','available','busy','paused'))
) ENGINE=InnoDB;

CREATE TABLE delivery_assignments (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, order_id BIGINT UNSIGNED NOT NULL, driver_id BIGINT UNSIGNED NOT NULL,
  assigned_by_user_id BIGINT UNSIGNED NOT NULL, status VARCHAR(30) NOT NULL DEFAULT 'assigned',
  assigned_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), accepted_at DATETIME(3), route_started_at DATETIME(3), delivered_at DATETIME(3),
  delivery_proof_url VARCHAR(500), recipient_name VARCHAR(160), notes VARCHAR(500),
  KEY idx_assignment_order (order_id, status), KEY idx_assignment_driver (driver_id, status, assigned_at),
  CONSTRAINT fk_assignment_order FOREIGN KEY (order_id) REFERENCES orders(id),
  CONSTRAINT fk_assignment_driver FOREIGN KEY (driver_id) REFERENCES drivers(id),
  CONSTRAINT fk_assignment_user FOREIGN KEY (assigned_by_user_id) REFERENCES users(id),
  CONSTRAINT chk_assignment_status CHECK (status IN ('assigned','accepted','en_route','delivered','rejected','cancelled'))
) ENGINE=InnoDB;

CREATE TABLE driver_locations (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, driver_id BIGINT UNSIGNED NOT NULL, delivery_assignment_id BIGINT UNSIGNED,
  latitude DECIMAL(10,7) NOT NULL, longitude DECIMAL(10,7) NOT NULL, accuracy_meters DECIMAL(8,2),
  heading_degrees DECIMAL(6,2), speed_kph DECIMAL(7,2), recorded_at DATETIME(3) NOT NULL, expires_at DATETIME(3),
  KEY idx_location_assignment (delivery_assignment_id, recorded_at), KEY idx_location_driver (driver_id, recorded_at),
  CONSTRAINT fk_location_driver FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE CASCADE,
  CONSTRAINT fk_location_assignment FOREIGN KEY (delivery_assignment_id) REFERENCES delivery_assignments(id) ON DELETE CASCADE,
  CONSTRAINT chk_location CHECK (latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180)
) ENGINE=InnoDB;

CREATE TABLE cash_register_shifts (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, branch_id BIGINT UNSIGNED NOT NULL,
  opened_by_user_id BIGINT UNSIGNED NOT NULL, closed_by_user_id BIGINT UNSIGNED,
  opening_amount DECIMAL(12,2) NOT NULL DEFAULT 0, expected_amount DECIMAL(12,2), counted_amount DECIMAL(12,2), difference_amount DECIMAL(12,2),
  status VARCHAR(20) NOT NULL DEFAULT 'open', opened_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  closed_at DATETIME(3), closing_notes VARCHAR(1000), KEY idx_shift_status (branch_id, status, opened_at),
  CONSTRAINT fk_shift_branch FOREIGN KEY (branch_id) REFERENCES branches(id),
  CONSTRAINT fk_shift_opener FOREIGN KEY (opened_by_user_id) REFERENCES users(id),
  CONSTRAINT fk_shift_closer FOREIGN KEY (closed_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT chk_shift_status CHECK (status IN ('open','closed','cancelled'))
) ENGINE=InnoDB;

CREATE TABLE cash_movements (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, cash_register_shift_id BIGINT UNSIGNED NOT NULL,
  order_id BIGINT UNSIGNED, user_id BIGINT UNSIGNED NOT NULL, movement_type VARCHAR(30) NOT NULL,
  amount DECIMAL(12,2) NOT NULL, concept VARCHAR(300) NOT NULL, created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY idx_movement_shift (cash_register_shift_id, created_at),
  CONSTRAINT fk_movement_shift FOREIGN KEY (cash_register_shift_id) REFERENCES cash_register_shifts(id),
  CONSTRAINT fk_movement_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL,
  CONSTRAINT fk_movement_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT chk_movement CHECK (movement_type IN ('opening','sale','income','withdrawal','refund','closing_adjustment') AND amount > 0)
) ENGINE=InnoDB;

CREATE TABLE printers (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, branch_id BIGINT UNSIGNED NOT NULL, preparation_area_id SMALLINT UNSIGNED,
  name VARCHAR(150) NOT NULL, connection_type VARCHAR(30) NOT NULL, ip_address VARCHAR(45), port SMALLINT UNSIGNED,
  system_queue_name VARCHAR(190), model_driver VARCHAR(190), paper_width_mm SMALLINT UNSIGNED NOT NULL DEFAULT 80,
  copies SMALLINT UNSIGNED NOT NULL DEFAULT 1, drawer_command VARBINARY(64), is_cash_printer BOOLEAN NOT NULL DEFAULT FALSE,
  active BOOLEAN NOT NULL DEFAULT TRUE, last_seen_at DATETIME(3),
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  KEY idx_printer_area (branch_id, preparation_area_id, active),
  CONSTRAINT fk_printer_branch FOREIGN KEY (branch_id) REFERENCES branches(id),
  CONSTRAINT fk_printer_area FOREIGN KEY (preparation_area_id) REFERENCES preparation_areas(id) ON DELETE SET NULL,
  CONSTRAINT chk_printer_connection CHECK (connection_type IN ('network','usb','bluetooth','system_shared')),
  CONSTRAINT chk_printer_values CHECK (paper_width_mm IN (58,80) AND copies BETWEEN 1 AND 10)
) ENGINE=InnoDB;

CREATE TABLE print_jobs (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, printer_id BIGINT UNSIGNED NOT NULL, order_id BIGINT UNSIGNED,
  production_ticket_id BIGINT UNSIGNED, job_type VARCHAR(30) NOT NULL, payload JSON NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending', attempts SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  last_error VARCHAR(1000), available_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), printed_at DATETIME(3),
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  KEY idx_print_queue (printer_id, status, available_at),
  CONSTRAINT fk_print_printer FOREIGN KEY (printer_id) REFERENCES printers(id),
  CONSTRAINT fk_print_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_print_ticket FOREIGN KEY (production_ticket_id) REFERENCES production_tickets(id) ON DELETE CASCADE,
  CONSTRAINT chk_print_status CHECK (status IN ('pending','processing','printed','failed','cancelled'))
) ENGINE=InnoDB;

CREATE TABLE cash_drawer_events (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, printer_id BIGINT UNSIGNED NOT NULL,
  cash_register_shift_id BIGINT UNSIGNED NOT NULL, order_id BIGINT UNSIGNED, user_id BIGINT UNSIGNED NOT NULL,
  reason VARCHAR(80) NOT NULL, success BOOLEAN NOT NULL DEFAULT FALSE, error_message VARCHAR(500),
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_drawer_printer FOREIGN KEY (printer_id) REFERENCES printers(id),
  CONSTRAINT fk_drawer_shift FOREIGN KEY (cash_register_shift_id) REFERENCES cash_register_shifts(id),
  CONSTRAINT fk_drawer_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL,
  CONSTRAINT fk_drawer_user FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB;

CREATE TABLE business_hours (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, branch_id BIGINT UNSIGNED NOT NULL, day_of_week TINYINT UNSIGNED NOT NULL,
  opens_at TIME, closes_at TIME, pickup_enabled BOOLEAN NOT NULL DEFAULT TRUE, delivery_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  scheduled_capacity SMALLINT UNSIGNED NOT NULL DEFAULT 4, slot_minutes SMALLINT UNSIGNED NOT NULL DEFAULT 30,
  preparation_minutes SMALLINT UNSIGNED NOT NULL DEFAULT 30, closed BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE KEY uq_hours_day (branch_id, day_of_week), CONSTRAINT fk_hours_branch FOREIGN KEY (branch_id) REFERENCES branches(id),
  CONSTRAINT chk_day CHECK (day_of_week BETWEEN 0 AND 6)
) ENGINE=InnoDB;

CREATE TABLE branch_closures (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, branch_id BIGINT UNSIGNED NOT NULL,
  starts_at DATETIME(3) NOT NULL, ends_at DATETIME(3) NOT NULL, reason VARCHAR(300) NOT NULL, created_by_user_id BIGINT UNSIGNED NOT NULL,
  CONSTRAINT fk_closure_branch FOREIGN KEY (branch_id) REFERENCES branches(id),
  CONSTRAINT fk_closure_user FOREIGN KEY (created_by_user_id) REFERENCES users(id),
  CONSTRAINT chk_closure_range CHECK (ends_at > starts_at)
) ENGINE=InnoDB;

CREATE TABLE push_subscriptions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, user_id BIGINT UNSIGNED, customer_id BIGINT UNSIGNED,
  endpoint_hash CHAR(64) NOT NULL UNIQUE, endpoint TEXT NOT NULL, p256dh_key VARCHAR(255) NOT NULL, auth_key VARCHAR(255) NOT NULL,
  device_name VARCHAR(160), active BOOLEAN NOT NULL DEFAULT TRUE, created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), last_used_at DATETIME(3),
  CONSTRAINT fk_push_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_push_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
  CONSTRAINT chk_push_owner CHECK (user_id IS NOT NULL OR customer_id IS NOT NULL)
) ENGINE=InnoDB;

CREATE TABLE notifications (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, business_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED, customer_id BIGINT UNSIGNED, order_id BIGINT UNSIGNED,
  channel VARCHAR(20) NOT NULL, template_code VARCHAR(80) NOT NULL, recipient VARCHAR(255), payload JSON NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending', attempts SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  last_error VARCHAR(1000), sent_at DATETIME(3), created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY idx_notification_queue (status, created_at),
  CONSTRAINT fk_notification_business FOREIGN KEY (business_id) REFERENCES businesses(id),
  CONSTRAINT fk_notification_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_notification_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
  CONSTRAINT fk_notification_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  CONSTRAINT chk_notification_channel CHECK (channel IN ('push','whatsapp','email','in_app')),
  CONSTRAINT chk_notification_status CHECK (status IN ('pending','processing','sent','failed','cancelled'))
) ENGINE=InnoDB;

CREATE TABLE app_settings (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, business_id BIGINT UNSIGNED NOT NULL, branch_id BIGINT UNSIGNED,
  setting_key VARCHAR(120) NOT NULL, setting_value JSON NOT NULL, is_secret BOOLEAN NOT NULL DEFAULT FALSE,
  updated_by_user_id BIGINT UNSIGNED NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_setting_scope (business_id, branch_id, setting_key),
  CONSTRAINT fk_setting_business FOREIGN KEY (business_id) REFERENCES businesses(id),
  CONSTRAINT fk_setting_branch FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE,
  CONSTRAINT fk_setting_user FOREIGN KEY (updated_by_user_id) REFERENCES users(id)
) ENGINE=InnoDB;

CREATE TABLE audit_logs (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, business_id BIGINT UNSIGNED NOT NULL, branch_id BIGINT UNSIGNED,
  actor_user_id BIGINT UNSIGNED, action VARCHAR(100) NOT NULL, entity_type VARCHAR(80) NOT NULL, entity_id VARCHAR(80) NOT NULL,
  old_values JSON, new_values JSON, ip_address VARCHAR(45), user_agent VARCHAR(500), request_id CHAR(36),
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY idx_audit_entity (business_id, entity_type, entity_id, created_at), KEY idx_audit_actor (actor_user_id, created_at),
  CONSTRAINT fk_audit_business FOREIGN KEY (business_id) REFERENCES businesses(id),
  CONSTRAINT fk_audit_branch FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE SET NULL,
  CONSTRAINT fk_audit_user FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE webhook_inbox (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, provider VARCHAR(40) NOT NULL, external_event_id VARCHAR(190) NOT NULL,
  signature_verified BOOLEAN NOT NULL DEFAULT FALSE, payload JSON NOT NULL, status VARCHAR(20) NOT NULL DEFAULT 'pending',
  attempts SMALLINT UNSIGNED NOT NULL DEFAULT 0, last_error VARCHAR(1000),
  received_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), processed_at DATETIME(3),
  UNIQUE KEY uq_webhook_event (provider, external_event_id), KEY idx_webhook_queue (status, received_at),
  CONSTRAINT chk_webhook_status CHECK (status IN ('pending','processing','processed','failed','ignored'))
) ENGINE=InnoDB;
