-- Gastro Suite / 004_seed_and_procedures.sql
USE gastro_suite;
SET time_zone = '+00:00';

CREATE TABLE order_status_transitions (
  from_status_code VARCHAR(40) NOT NULL,
  to_status_code VARCHAR(40) NOT NULL,
  required_permission VARCHAR(80) NULL,
  PRIMARY KEY (from_status_code, to_status_code),
  CONSTRAINT fk_transition_from FOREIGN KEY (from_status_code) REFERENCES order_statuses(code),
  CONSTRAINT fk_transition_to FOREIGN KEY (to_status_code) REFERENCES order_statuses(code)
) ENGINE=InnoDB;

INSERT INTO order_statuses (code,name,sort_order,is_terminal) VALUES
('pending','Pendiente',10,FALSE),
('pending_payment','Pendiente de pago',20,FALSE),
('paid','Pagado',30,FALSE),
('preparing','En preparación',40,FALSE),
('ready','Listo para entrega',50,FALSE),
('assigned','Asignado a repartidor',60,FALSE),
('en_route','En camino',70,FALSE),
('delivered','Entregado',80,TRUE),
('cancelled','Cancelado',90,TRUE)
ON DUPLICATE KEY UPDATE name=VALUES(name),sort_order=VALUES(sort_order),is_terminal=VALUES(is_terminal);

INSERT INTO order_status_transitions (from_status_code,to_status_code,required_permission) VALUES
('pending','pending_payment','orders.update'),('pending','paid','payments.validate'),('pending','cancelled','orders.cancel'),
('pending_payment','paid','payments.validate'),('pending_payment','cancelled','orders.cancel'),
('paid','preparing','production.accept'),('paid','cancelled','orders.cancel'),
('preparing','ready','production.complete'),('preparing','cancelled','orders.cancel'),
('ready','assigned','delivery.assign'),('ready','delivered','orders.deliver'),('ready','cancelled','orders.cancel'),
('assigned','en_route','delivery.update'),('assigned','ready','delivery.assign'),('assigned','cancelled','orders.cancel'),
('en_route','delivered','delivery.update'),('en_route','cancelled','orders.cancel')
ON DUPLICATE KEY UPDATE required_permission=VALUES(required_permission);

INSERT INTO roles (code,name,description) VALUES
('administrator','Administrador','Acceso completo y configuración'),
('cashier','Caja','POS, cobros y turnos'),
('kitchen','Cocina','Comandas y preparación'),
('bar','Barra','Bebidas, barra y despacho'),
('driver','Repartidor','Asignaciones, ruta y entrega'),
('supervisor','Supervisor','Operación y reportes'),
('customer','Cliente','Pedidos propios desde PWA')
ON DUPLICATE KEY UPDATE name=VALUES(name),description=VALUES(description);

INSERT INTO permissions (code,description) VALUES
('admin.settings','Administrar configuración general'),('admin.audit','Consultar auditoría'),
('users.manage','Administrar usuarios y roles'),('catalog.manage','Administrar productos y categorías'),
('orders.read','Consultar pedidos'),('orders.create','Crear pedidos'),('orders.update','Actualizar pedidos'),('orders.cancel','Cancelar pedidos'),('orders.deliver','Entregar pedido en mostrador'),
('payments.read','Consultar pagos'),('payments.validate','Validar transferencias y pagos'),('payments.refund','Registrar reembolsos'),
('cash.open','Abrir caja'),('cash.close','Cerrar y arquear caja'),('cash.move','Registrar entradas y retiros'),
('production.read','Consultar comandas'),('production.accept','Aceptar comanda'),('production.complete','Terminar preparación'),
('delivery.assign','Asignar repartidor'),('delivery.read','Consultar entregas'),('delivery.update','Actualizar ruta y entrega'),
('reports.read','Consultar reportes'),('reports.export','Exportar reportes'),('printers.manage','Administrar impresoras')
ON DUPLICATE KEY UPDATE description=VALUES(description);

INSERT IGNORE INTO role_permissions (role_id,permission_id)
SELECT r.id,p.id FROM roles r CROSS JOIN permissions p WHERE r.code='administrator';

INSERT IGNORE INTO role_permissions (role_id,permission_id)
SELECT r.id,p.id FROM roles r JOIN permissions p ON p.code IN
('orders.read','orders.create','orders.update','orders.cancel','orders.deliver','payments.read','payments.validate','cash.open','cash.close','cash.move','reports.read')
WHERE r.code='cashier';

INSERT IGNORE INTO role_permissions (role_id,permission_id)
SELECT r.id,p.id FROM roles r JOIN permissions p ON p.code IN ('orders.read','production.read','production.accept','production.complete')
WHERE r.code IN ('kitchen','bar');

INSERT IGNORE INTO role_permissions (role_id,permission_id)
SELECT r.id,p.id FROM roles r JOIN permissions p ON p.code IN ('orders.read','delivery.read','delivery.update')
WHERE r.code='driver';

INSERT IGNORE INTO role_permissions (role_id,permission_id)
SELECT r.id,p.id FROM roles r JOIN permissions p ON p.code IN
('orders.read','orders.update','orders.cancel','payments.read','cash.close','production.read','delivery.assign','delivery.read','reports.read','reports.export')
WHERE r.code='supervisor';

INSERT IGNORE INTO role_permissions (role_id,permission_id)
SELECT r.id,p.id FROM roles r JOIN permissions p ON p.code IN ('orders.read','orders.create') WHERE r.code='customer';

INSERT INTO payment_methods (code,name,requires_online_gateway,active) VALUES
('cash','Efectivo',FALSE,TRUE),('transfer','Transferencia / depósito',FALSE,TRUE),
('stripe','Stripe',TRUE,FALSE),('mercado_pago','Mercado Pago',TRUE,FALSE),('paypal','PayPal',TRUE,FALSE)
ON DUPLICATE KEY UPDATE name=VALUES(name),requires_online_gateway=VALUES(requires_online_gateway);

INSERT INTO businesses (public_id,name,timezone,currency,status)
SELECT UUID(),'Restaurante Fuego','America/Tijuana','MXN','active'
WHERE NOT EXISTS (SELECT 1 FROM businesses WHERE name='Restaurante Fuego');

SET @business_id := (SELECT id FROM businesses WHERE name='Restaurante Fuego' ORDER BY id LIMIT 1);

INSERT INTO branches (business_id,public_id,name,code,address_line1,city,state,country_code,status)
SELECT @business_id,UUID(),'Sucursal principal','MATRIZ','Dirección pendiente','Tijuana','Baja California','MX','active'
WHERE NOT EXISTS (SELECT 1 FROM branches WHERE business_id=@business_id AND code='MATRIZ');

INSERT INTO preparation_areas (business_id,code,name,sort_order) VALUES
(@business_id,'kitchen','Cocina',10),(@business_id,'bar','Barra',20),
(@business_id,'drinks','Bebidas',30),(@business_id,'dispatch','Listo para entregar',40)
ON DUPLICATE KEY UPDATE name=VALUES(name),sort_order=VALUES(sort_order);

INSERT INTO categories (business_id,name,slug,sort_order) VALUES
(@business_id,'Tacos','tacos',10),(@business_id,'Hamburguesas','hamburguesas',20),
(@business_id,'Pizzas','pizzas',30),(@business_id,'Especiales','especiales',40),
(@business_id,'Bebidas','bebidas',50),(@business_id,'Postres','postres',60)
ON DUPLICATE KEY UPDATE name=VALUES(name),sort_order=VALUES(sort_order);

SET @branch_id := (SELECT id FROM branches WHERE business_id=@business_id AND code='MATRIZ' LIMIT 1);
INSERT INTO business_hours (branch_id,day_of_week,opens_at,closes_at,scheduled_capacity,slot_minutes,preparation_minutes,closed)
VALUES
(@branch_id,0,'11:00','21:00',4,30,30,FALSE),(@branch_id,1,'11:00','21:00',4,30,30,FALSE),
(@branch_id,2,'11:00','21:00',4,30,30,FALSE),(@branch_id,3,'11:00','21:00',4,30,30,FALSE),
(@branch_id,4,'11:00','21:00',4,30,30,FALSE),(@branch_id,5,'11:00','22:00',5,30,30,FALSE),
(@branch_id,6,'11:00','22:00',5,30,30,FALSE)
ON DUPLICATE KEY UPDATE opens_at=VALUES(opens_at),closes_at=VALUES(closes_at),scheduled_capacity=VALUES(scheduled_capacity);

DELIMITER $$

DROP PROCEDURE IF EXISTS sp_change_order_status$$
CREATE PROCEDURE sp_change_order_status(
  IN p_order_id BIGINT UNSIGNED,
  IN p_new_status VARCHAR(40),
  IN p_actor_user_id BIGINT UNSIGNED,
  IN p_notes VARCHAR(500)
)
BEGIN
  DECLARE v_old_status VARCHAR(40);
  DECLARE v_business_id BIGINT UNSIGNED;
  DECLARE v_branch_id BIGINT UNSIGNED;

  START TRANSACTION;
  SELECT status_code,business_id,branch_id INTO v_old_status,v_business_id,v_branch_id
  FROM orders WHERE id=p_order_id FOR UPDATE;

  IF v_old_status IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Pedido no encontrado';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM order_status_transitions WHERE from_status_code=v_old_status AND to_status_code=p_new_status) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Transición de estado no permitida';
  END IF;

  UPDATE orders SET status_code=p_new_status,version=version+1,
    accepted_at=IF(p_new_status='preparing',COALESCE(accepted_at,UTC_TIMESTAMP(3)),accepted_at),
    ready_at=IF(p_new_status='ready',UTC_TIMESTAMP(3),ready_at),
    delivered_at=IF(p_new_status='delivered',UTC_TIMESTAMP(3),delivered_at),
    cancelled_at=IF(p_new_status='cancelled',UTC_TIMESTAMP(3),cancelled_at),
    cancellation_reason=IF(p_new_status='cancelled',p_notes,cancellation_reason)
  WHERE id=p_order_id;

  INSERT INTO order_status_history(order_id,from_status_code,to_status_code,changed_by_user_id,notes)
  VALUES(p_order_id,v_old_status,p_new_status,p_actor_user_id,p_notes);

  INSERT INTO audit_logs(business_id,branch_id,actor_user_id,action,entity_type,entity_id,old_values,new_values)
  VALUES(v_business_id,v_branch_id,p_actor_user_id,'order.status.changed','order',CAST(p_order_id AS CHAR),
    JSON_OBJECT('status',v_old_status),JSON_OBJECT('status',p_new_status,'notes',p_notes));
  COMMIT;
END$$

DROP PROCEDURE IF EXISTS sp_reconcile_payment$$
CREATE PROCEDURE sp_reconcile_payment(
  IN p_payment_id BIGINT UNSIGNED,
  IN p_amount_received DECIMAL(12,2),
  IN p_reference VARCHAR(190),
  IN p_actor_user_id BIGINT UNSIGNED
)
BEGIN
  DECLARE v_expected DECIMAL(12,2);
  DECLARE v_old_status VARCHAR(30);
  DECLARE v_new_status VARCHAR(30);
  DECLARE v_order_id BIGINT UNSIGNED;
  DECLARE v_business_id BIGINT UNSIGNED;
  DECLARE v_branch_id BIGINT UNSIGNED;

  START TRANSACTION;
  SELECT p.amount_expected,p.status,p.order_id,o.business_id,o.branch_id
  INTO v_expected,v_old_status,v_order_id,v_business_id,v_branch_id
  FROM payments p JOIN orders o ON o.id=p.order_id WHERE p.id=p_payment_id FOR UPDATE;

  IF v_expected IS NULL THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Pago no encontrado'; END IF;
  SET v_new_status=IF(p_amount_received=v_expected,'paid','difference');

  UPDATE payments SET amount_received=p_amount_received,status=v_new_status,reference=p_reference,
    validated_by_user_id=p_actor_user_id,validated_at=UTC_TIMESTAMP(3),paid_at=IF(v_new_status='paid',UTC_TIMESTAMP(3),paid_at)
  WHERE id=p_payment_id;

  INSERT INTO audit_logs(business_id,branch_id,actor_user_id,action,entity_type,entity_id,old_values,new_values)
  VALUES(v_business_id,v_branch_id,p_actor_user_id,'payment.reconciled','payment',CAST(p_payment_id AS CHAR),
    JSON_OBJECT('status',v_old_status),JSON_OBJECT('status',v_new_status,'amount_received',p_amount_received,'reference',p_reference));
  COMMIT;
END$$

DELIMITER ;
