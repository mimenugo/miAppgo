-- Gastro Suite / 001_core.sql
-- MySQL 8.0+. Las fechas DATETIME(3) se almacenan en UTC.
CREATE DATABASE IF NOT EXISTS gastro_suite CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
USE gastro_suite;
SET time_zone = '+00:00';

CREATE TABLE businesses (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  public_id CHAR(36) NOT NULL UNIQUE,
  name VARCHAR(150) NOT NULL,
  legal_name VARCHAR(200), rfc VARCHAR(20), phone VARCHAR(30), email VARCHAR(190), logo_url VARCHAR(500),
  timezone VARCHAR(64) NOT NULL DEFAULT 'America/Tijuana', currency CHAR(3) NOT NULL DEFAULT 'MXN',
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  CONSTRAINT chk_business_status CHECK (status IN ('active','inactive'))
) ENGINE=InnoDB;

CREATE TABLE branches (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  business_id BIGINT UNSIGNED NOT NULL, public_id CHAR(36) NOT NULL UNIQUE,
  name VARCHAR(150) NOT NULL, code VARCHAR(30) NOT NULL, phone VARCHAR(30), email VARCHAR(190),
  address_line1 VARCHAR(220) NOT NULL, address_line2 VARCHAR(220), neighborhood VARCHAR(120),
  city VARCHAR(120) NOT NULL, state VARCHAR(120) NOT NULL, postal_code VARCHAR(12), country_code CHAR(2) NOT NULL DEFAULT 'MX',
  latitude DECIMAL(10,7), longitude DECIMAL(10,7), timezone VARCHAR(64), status VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_branch_code (business_id, code), KEY idx_branch_status (business_id, status),
  CONSTRAINT fk_branch_business FOREIGN KEY (business_id) REFERENCES businesses(id),
  CONSTRAINT chk_branch_status CHECK (status IN ('active','inactive'))
) ENGINE=InnoDB;

CREATE TABLE roles (
  id SMALLINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, code VARCHAR(40) NOT NULL UNIQUE,
  name VARCHAR(80) NOT NULL, description VARCHAR(255), is_system BOOLEAN NOT NULL DEFAULT TRUE
) ENGINE=InnoDB;

CREATE TABLE permissions (
  id SMALLINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, code VARCHAR(80) NOT NULL UNIQUE, description VARCHAR(255) NOT NULL
) ENGINE=InnoDB;

CREATE TABLE role_permissions (
  role_id SMALLINT UNSIGNED NOT NULL, permission_id SMALLINT UNSIGNED NOT NULL,
  PRIMARY KEY (role_id, permission_id),
  CONSTRAINT fk_rp_role FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
  CONSTRAINT fk_rp_permission FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE users (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, business_id BIGINT UNSIGNED NOT NULL,
  public_id CHAR(36) NOT NULL UNIQUE, full_name VARCHAR(160) NOT NULL, email VARCHAR(190), phone VARCHAR(30),
  password_hash VARCHAR(255) NOT NULL COMMENT 'Argon2id o bcrypt; nunca texto plano',
  status VARCHAR(20) NOT NULL DEFAULT 'active', last_login_at DATETIME(3),
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_user_email (business_id, email), KEY idx_user_status (business_id, status),
  CONSTRAINT fk_user_business FOREIGN KEY (business_id) REFERENCES businesses(id),
  CONSTRAINT chk_user_status CHECK (status IN ('active','inactive','locked'))
) ENGINE=InnoDB;

CREATE TABLE user_roles (
  user_id BIGINT UNSIGNED NOT NULL, role_id SMALLINT UNSIGNED NOT NULL, branch_id BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (user_id, role_id, branch_id),
  CONSTRAINT fk_ur_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_ur_role FOREIGN KEY (role_id) REFERENCES roles(id),
  CONSTRAINT fk_ur_branch FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE auth_sessions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, user_id BIGINT UNSIGNED NOT NULL,
  refresh_token_hash CHAR(64) NOT NULL UNIQUE, device_name VARCHAR(160), ip_address VARCHAR(45), user_agent VARCHAR(500),
  expires_at DATETIME(3) NOT NULL, revoked_at DATETIME(3), created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY idx_session_active (user_id, revoked_at, expires_at),
  CONSTRAINT fk_session_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE customers (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, business_id BIGINT UNSIGNED NOT NULL,
  public_id CHAR(36) NOT NULL UNIQUE, user_id BIGINT UNSIGNED,
  full_name VARCHAR(160) NOT NULL, phone VARCHAR(30) NOT NULL, email VARCHAR(190),
  marketing_consent BOOLEAN NOT NULL DEFAULT FALSE, privacy_accepted_at DATETIME(3),
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_customer_phone (business_id, phone), KEY idx_customer_name (business_id, full_name),
  CONSTRAINT fk_customer_business FOREIGN KEY (business_id) REFERENCES businesses(id),
  CONSTRAINT fk_customer_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE customer_addresses (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, customer_id BIGINT UNSIGNED NOT NULL,
  label VARCHAR(60) NOT NULL DEFAULT 'Casa', recipient_name VARCHAR(160), recipient_phone VARCHAR(30),
  address_line1 VARCHAR(220) NOT NULL, address_line2 VARCHAR(220), neighborhood VARCHAR(120),
  city VARCHAR(120) NOT NULL, state VARCHAR(120) NOT NULL, postal_code VARCHAR(12), references_text VARCHAR(500),
  latitude DECIMAL(10,7), longitude DECIMAL(10,7), is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  KEY idx_address_customer (customer_id, is_default),
  CONSTRAINT fk_address_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE categories (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, business_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(100) NOT NULL, slug VARCHAR(120) NOT NULL, sort_order INT NOT NULL DEFAULT 0, active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_category_slug (business_id, slug),
  CONSTRAINT fk_category_business FOREIGN KEY (business_id) REFERENCES businesses(id)
) ENGINE=InnoDB;

CREATE TABLE preparation_areas (
  id SMALLINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, business_id BIGINT UNSIGNED NOT NULL,
  code VARCHAR(40) NOT NULL, name VARCHAR(100) NOT NULL, active BOOLEAN NOT NULL DEFAULT TRUE, sort_order INT NOT NULL DEFAULT 0,
  UNIQUE KEY uq_area_code (business_id, code),
  CONSTRAINT fk_area_business FOREIGN KEY (business_id) REFERENCES businesses(id)
) ENGINE=InnoDB;

CREATE TABLE products (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, business_id BIGINT UNSIGNED NOT NULL, category_id BIGINT UNSIGNED,
  public_id CHAR(36) NOT NULL UNIQUE, sku VARCHAR(60), name VARCHAR(160) NOT NULL, description TEXT,
  price DECIMAL(12,2) NOT NULL, image_url VARCHAR(500), available_for_delivery BOOLEAN NOT NULL DEFAULT TRUE,
  track_inventory BOOLEAN NOT NULL DEFAULT FALSE, stock_quantity DECIMAL(12,3), low_stock_threshold DECIMAL(12,3),
  active BOOLEAN NOT NULL DEFAULT TRUE, available_from TIME, available_until TIME,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_product_sku (business_id, sku), KEY idx_product_catalog (business_id, category_id, active),
  CONSTRAINT fk_product_business FOREIGN KEY (business_id) REFERENCES businesses(id),
  CONSTRAINT fk_product_category FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
  CONSTRAINT chk_product_values CHECK (price >= 0 AND (stock_quantity IS NULL OR stock_quantity >= 0))
) ENGINE=InnoDB;

CREATE TABLE product_preparation_areas (
  product_id BIGINT UNSIGNED NOT NULL, preparation_area_id SMALLINT UNSIGNED NOT NULL, print_quantity SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  PRIMARY KEY (product_id, preparation_area_id),
  CONSTRAINT fk_ppa_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  CONSTRAINT fk_ppa_area FOREIGN KEY (preparation_area_id) REFERENCES preparation_areas(id)
) ENGINE=InnoDB;

CREATE TABLE modifier_groups (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, business_id BIGINT UNSIGNED NOT NULL, name VARCHAR(120) NOT NULL,
  min_choices SMALLINT UNSIGNED NOT NULL DEFAULT 0, max_choices SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  required BOOLEAN NOT NULL DEFAULT FALSE, active BOOLEAN NOT NULL DEFAULT TRUE,
  CONSTRAINT fk_modifier_business FOREIGN KEY (business_id) REFERENCES businesses(id),
  CONSTRAINT chk_modifier_choices CHECK (max_choices >= min_choices)
) ENGINE=InnoDB;

CREATE TABLE modifier_options (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, modifier_group_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(120) NOT NULL, price_delta DECIMAL(12,2) NOT NULL DEFAULT 0, active BOOLEAN NOT NULL DEFAULT TRUE, sort_order INT NOT NULL DEFAULT 0,
  CONSTRAINT fk_option_group FOREIGN KEY (modifier_group_id) REFERENCES modifier_groups(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE product_modifier_groups (
  product_id BIGINT UNSIGNED NOT NULL, modifier_group_id BIGINT UNSIGNED NOT NULL, sort_order INT NOT NULL DEFAULT 0,
  PRIMARY KEY (product_id, modifier_group_id),
  CONSTRAINT fk_pmg_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  CONSTRAINT fk_pmg_group FOREIGN KEY (modifier_group_id) REFERENCES modifier_groups(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE delivery_zones (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, branch_id BIGINT UNSIGNED NOT NULL, name VARCHAR(120) NOT NULL,
  polygon_geojson JSON, delivery_fee DECIMAL(12,2) NOT NULL DEFAULT 0, minimum_order DECIMAL(12,2) NOT NULL DEFAULT 0,
  estimated_minutes SMALLINT UNSIGNED NOT NULL DEFAULT 30, active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  KEY idx_zone_branch (branch_id, active), CONSTRAINT fk_zone_branch FOREIGN KEY (branch_id) REFERENCES branches(id),
  CONSTRAINT chk_zone_amounts CHECK (delivery_fee >= 0 AND minimum_order >= 0)
) ENGINE=InnoDB;
