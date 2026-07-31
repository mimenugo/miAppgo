-- Gastro Suite / 005_migrate_demo_data.sql
-- Migra los datos visibles de la demostración a MySQL. Es idempotente.
USE gastro_suite;
SET time_zone = '+00:00';

SET @business_id := (SELECT id FROM businesses WHERE name='Restaurante Fuego' ORDER BY id LIMIT 1);
SET @branch_id := (SELECT id FROM branches WHERE business_id=@business_id AND code='MATRIZ' LIMIT 1);

UPDATE businesses SET name='Gastro Suite', legal_name='Restaurante Fuego', phone='664 581 2107',
  email='contacto@gastrosuite.local', timezone='America/Tijuana'
WHERE id=@business_id;
UPDATE branches SET name='Sucursal principal', phone='664 581 2107', email='contacto@gastrosuite.local',
  address_line1='Tijuana, Baja California', city='Tijuana', state='Baja California'
WHERE id=@branch_id;

INSERT INTO users (business_id,public_id,full_name,email,phone,password_hash,status)
SELECT @business_id,UUID(),v.full_name,v.email,v.phone,'$2b$12$uvbty314be8FTq9BFjFh6eJbc0V.6hv9ckKtD.EJeuNqDm5i8hehe','active'
FROM (
  SELECT 'Administrador Gastro Suite' full_name,'admin@gastrosuite.local' email,'6640000001' phone UNION ALL
  SELECT 'Caja Principal','caja@gastrosuite.local','6640000002' UNION ALL
  SELECT 'Cocina Principal','cocina@gastrosuite.local','6640000003' UNION ALL
  SELECT 'Barra Principal','barra@gastrosuite.local','6640000004' UNION ALL
  SELECT 'Roberto Gómez','repartidor@gastrosuite.local','6640000005'
) v
WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.business_id=@business_id AND u.email=v.email);

INSERT IGNORE INTO user_roles (user_id,role_id,branch_id)
SELECT u.id,r.id,@branch_id FROM users u JOIN roles r ON
  r.code=CASE u.email
    WHEN 'admin@gastrosuite.local' THEN 'administrator'
    WHEN 'caja@gastrosuite.local' THEN 'cashier'
    WHEN 'cocina@gastrosuite.local' THEN 'kitchen'
    WHEN 'barra@gastrosuite.local' THEN 'bar'
    WHEN 'repartidor@gastrosuite.local' THEN 'driver' END
WHERE u.business_id=@business_id AND u.email LIKE '%@gastrosuite.local';

INSERT INTO drivers (user_id,vehicle_type,availability_status,location_sharing_consent_at,active)
SELECT u.id,'Motocicleta','available',UTC_TIMESTAMP(3),TRUE FROM users u
WHERE u.email='repartidor@gastrosuite.local' AND NOT EXISTS (SELECT 1 FROM drivers d WHERE d.user_id=u.id);

INSERT INTO products (business_id,category_id,public_id,sku,name,description,price,image_url,available_for_delivery,active)
SELECT @business_id,c.id,UUID(),v.sku,v.name,v.description,v.price,NULL,TRUE,TRUE
FROM (
  SELECT 'TAC-001' sku,'Tacos al pastor' name,'Piña asada, cebolla, cilantro y salsa tatemada.' description,35.00 price,'tacos' slug UNION ALL
  SELECT 'HAM-001','Smash fuego','Doble carne, cheddar, cebolla caramelizada y papas.',145.00,'hamburguesas' UNION ALL
  SELECT 'PIZ-001','Pizza mexicana','Chorizo, jalapeño, cebolla morada y queso gratinado.',210.00,'pizzas' UNION ALL
  SELECT 'ESP-001','Bowl del huerto','Arroz, vegetales asados, aguacate y aderezo cítrico.',125.00,'especiales' UNION ALL
  SELECT 'BEB-001','Horchata rosa','Horchata artesanal con fresa natural. 1 litro.',52.00,'bebidas' UNION ALL
  SELECT 'POS-001','Flan de la casa','Cremoso, con caramelo de naranja y vainilla.',62.00,'postres' UNION ALL
  SELECT 'ESP-002','Chiles rellenos','Orden de 2 con arroz y frijoles.',150.00,'especiales' UNION ALL
  SELECT 'ESP-003','Tamales','Orden de 3 con frijoles y sopa fría.',130.00,'especiales'
) v JOIN categories c ON c.business_id=@business_id AND c.slug=v.slug
WHERE NOT EXISTS (SELECT 1 FROM products p WHERE p.business_id=@business_id AND p.sku=v.sku);

INSERT IGNORE INTO product_preparation_areas (product_id,preparation_area_id)
SELECT p.id,a.id FROM products p JOIN preparation_areas a ON a.business_id=p.business_id
WHERE p.business_id=@business_id AND a.code=CASE WHEN p.sku LIKE 'BEB-%' THEN 'drinks'
  WHEN p.sku IN ('ESP-001','ESP-002','ESP-003','POS-001') THEN 'bar' ELSE 'kitchen' END;

INSERT INTO delivery_zones (branch_id,name,delivery_fee,minimum_order,estimated_minutes,active)
SELECT @branch_id,'Tijuana urbana',39.00,0.00,35,TRUE
WHERE NOT EXISTS (SELECT 1 FROM delivery_zones WHERE branch_id=@branch_id AND name='Tijuana urbana');
SET @zone_id := (SELECT id FROM delivery_zones WHERE branch_id=@branch_id AND name='Tijuana urbana' LIMIT 1);

INSERT INTO customers (business_id,public_id,full_name,phone,email,privacy_accepted_at)
SELECT @business_id,UUID(),v.full_name,v.phone,NULL,UTC_TIMESTAMP(3)
FROM (
  SELECT 'Valeria Soto' full_name,'664 123 5678' phone UNION ALL
  SELECT 'Marco Luna','664 765 1122' UNION ALL
  SELECT 'Ana Torres','664 881 2299' UNION ALL
  SELECT 'Sofía Ramírez','664 310 2840' UNION ALL
  SELECT 'Daniel Ortega','664 222 7810' UNION ALL
  SELECT 'Elena Castro','664 542 9031'
) v WHERE NOT EXISTS (SELECT 1 FROM customers c WHERE c.business_id=@business_id AND c.phone=v.phone);

INSERT INTO customer_addresses (customer_id,label,address_line1,city,state,references_text,latitude,longitude,is_default)
SELECT c.id,'Casa',v.address,'Tijuana','Baja California','Dirección migrada desde la demostración',v.lat,v.lng,TRUE
FROM (
  SELECT '664 123 5678' phone,'Blvd. Cucapah 21907-Interior 220, Villafontana, Lomas del Matamoros, 22206 Tijuana, B.C.' address,32.4965 lat,-116.9145 lng UNION ALL
  SELECT '664 765 1122','Veracruz & Del Cubilete, El Pipila, 22206 Tijuana, B.C.',32.4975,-116.8970 UNION ALL
  SELECT '664 881 2299','Blvd. Gustavo Aubanel Vallejo 9058, Cacho, 22414 Tijuana, B.C.',32.5209,-117.0278 UNION ALL
  SELECT '664 310 2840','Calle Tabasco 2040, Cacho, 22414 Tijuana, B.C.',32.5196,-117.0248 UNION ALL
  SELECT '664 222 7810','Plaza Mariana, Ruta Independencia 23696-4, Mariano Matamoros, 22206 Tijuana, B.C.',32.5005,-116.8735 UNION ALL
  SELECT '664 542 9031','Av de La Joya 990, Matamoros Norte-Centro-Sur, Las Américas, 22215 Tijuana, B.C.',32.4885,-116.8855
) v JOIN customers c ON c.business_id=@business_id AND c.phone=v.phone
WHERE NOT EXISTS (SELECT 1 FROM customer_addresses a WHERE a.customer_id=c.id);

SET @creator_id := (SELECT id FROM users WHERE email='caja@gastrosuite.local' LIMIT 1);

INSERT INTO orders (public_id,folio,business_id,branch_id,customer_id,created_by_user_id,source,fulfillment_type,status_code,
 customer_name,customer_phone,delivery_address_snapshot,delivery_zone_id,requested_at,subtotal,delivery_fee,total,created_at)
SELECT UUID(),v.folio,@business_id,@branch_id,c.id,@creator_id,'pos','delivery',v.status_code,v.customer,v.phone,
 JSON_OBJECT('address',a.address_line1,'city',a.city,'state',a.state,'references',a.references_text,'latitude',a.latitude,'longitude',a.longitude),
 @zone_id,UTC_TIMESTAMP(3),v.subtotal,39.00,v.total,UTC_TIMESTAMP(3)-INTERVAL v.minutes_ago MINUTE
FROM (
  SELECT 'FG-1048' folio,'Valeria Soto' customer,'664 123 5678' phone,'preparing' status_code,342.00 subtotal,381.00 total,5 minutes_ago UNION ALL
  SELECT 'FG-1047','Marco Luna','664 765 1122','ready',314.00,353.00,16 UNION ALL
  SELECT 'FG-1046','Ana Torres','664 881 2299','en_route',167.00,206.00,31 UNION ALL
  SELECT 'FG-1045','Sofía Ramírez','664 310 2840','assigned',150.00,189.00,49 UNION ALL
  SELECT 'FG-1044','Daniel Ortega','664 222 7810','ready',130.00,169.00,63 UNION ALL
  SELECT 'FG-1043','Elena Castro','664 542 9031','preparing',177.00,216.00,78
) v JOIN customers c ON c.business_id=@business_id AND c.phone=v.phone
JOIN customer_addresses a ON a.customer_id=c.id AND a.is_default=TRUE
WHERE NOT EXISTS (SELECT 1 FROM orders o WHERE o.branch_id=@branch_id AND o.folio=v.folio);

INSERT INTO order_items (order_id,product_id,product_name,sku,quantity,unit_price,line_total)
SELECT o.id,p.id,p.name,p.sku,v.qty,p.price,p.price*v.qty
FROM (
  SELECT 'FG-1048' folio,'HAM-001' sku,2 qty UNION ALL SELECT 'FG-1048','BEB-001',1 UNION ALL
  SELECT 'FG-1047','PIZ-001',1 UNION ALL SELECT 'FG-1047','BEB-001',2 UNION ALL
  SELECT 'FG-1046','TAC-001',3 UNION ALL SELECT 'FG-1046','POS-001',1 UNION ALL
  SELECT 'FG-1045','ESP-002',1 UNION ALL SELECT 'FG-1044','ESP-003',1 UNION ALL
  SELECT 'FG-1043','ESP-001',1 UNION ALL SELECT 'FG-1043','BEB-001',1
) v JOIN orders o ON o.branch_id=@branch_id AND o.folio=v.folio
JOIN products p ON p.business_id=@business_id AND p.sku=v.sku
WHERE NOT EXISTS (SELECT 1 FROM order_items oi WHERE oi.order_id=o.id AND oi.product_id=p.id);

INSERT INTO payments (public_id,order_id,payment_method_code,status,amount_expected,amount_received,currency,paid_at,created_at)
SELECT UUID(),o.id,v.method,IF(v.paid,'paid','pending'),o.total,IF(v.paid,o.total,0),'MXN',IF(v.paid,o.created_at,NULL),o.created_at
FROM (
 SELECT 'FG-1048' folio,'stripe' method,TRUE paid UNION ALL SELECT 'FG-1047','cash',FALSE UNION ALL
 SELECT 'FG-1046','stripe',TRUE UNION ALL SELECT 'FG-1045','cash',FALSE UNION ALL
 SELECT 'FG-1044','stripe',TRUE UNION ALL SELECT 'FG-1043','cash',FALSE
) v JOIN orders o ON o.branch_id=@branch_id AND o.folio=v.folio
WHERE NOT EXISTS (SELECT 1 FROM payments p WHERE p.order_id=o.id);

INSERT INTO production_tickets (order_id,preparation_area_id,status,accepted_at,completed_at,created_at)
SELECT DISTINCT o.id,ppa.preparation_area_id,
 CASE WHEN o.status_code='ready' THEN 'ready' WHEN o.status_code IN ('preparing','assigned','en_route') THEN 'preparing' ELSE 'pending' END,
 IF(o.status_code<>'pending',o.created_at,NULL),IF(o.status_code='ready',o.created_at,NULL),o.created_at
FROM orders o JOIN order_items oi ON oi.order_id=o.id JOIN product_preparation_areas ppa ON ppa.product_id=oi.product_id
WHERE o.branch_id=@branch_id AND NOT EXISTS (
 SELECT 1 FROM production_tickets pt WHERE pt.order_id=o.id AND pt.preparation_area_id=ppa.preparation_area_id
);

SET @driver_id := (SELECT d.id FROM drivers d JOIN users u ON u.id=d.user_id WHERE u.email='repartidor@gastrosuite.local' LIMIT 1);
INSERT INTO delivery_assignments (order_id,driver_id,assigned_by_user_id,status,assigned_at,accepted_at,route_started_at)
SELECT o.id,@driver_id,@creator_id,
 CASE WHEN o.status_code='en_route' THEN 'en_route' WHEN o.status_code='assigned' THEN 'assigned' ELSE 'accepted' END,
 o.created_at,IF(o.status_code IN ('assigned','en_route'),o.created_at,NULL),IF(o.status_code='en_route',o.created_at,NULL)
FROM orders o WHERE o.branch_id=@branch_id
AND NOT EXISTS (SELECT 1 FROM delivery_assignments da WHERE da.order_id=o.id);

INSERT INTO cash_register_shifts (branch_id,opened_by_user_id,opening_amount,status,opened_at)
SELECT @branch_id,@creator_id,1500.00,'open',UTC_TIMESTAMP(3)-INTERVAL 5 HOUR
WHERE NOT EXISTS (SELECT 1 FROM cash_register_shifts WHERE branch_id=@branch_id AND status='open');
SET @shift_id := (SELECT id FROM cash_register_shifts WHERE branch_id=@branch_id AND status='open' ORDER BY id DESC LIMIT 1);
INSERT INTO cash_movements (cash_register_shift_id,user_id,movement_type,amount,concept,created_at)
SELECT @shift_id,@creator_id,'income',300.00,'Fondo adicional',UTC_TIMESTAMP(3)-INTERVAL 3 HOUR
WHERE NOT EXISTS (SELECT 1 FROM cash_movements WHERE cash_register_shift_id=@shift_id AND concept='Fondo adicional');
INSERT INTO cash_movements (cash_register_shift_id,user_id,movement_type,amount,concept,created_at)
SELECT @shift_id,@creator_id,'withdrawal',450.00,'Pago a proveedor',UTC_TIMESTAMP(3)-INTERVAL 2 HOUR
WHERE NOT EXISTS (SELECT 1 FROM cash_movements WHERE cash_register_shift_id=@shift_id AND concept='Pago a proveedor');

INSERT INTO app_settings (business_id,branch_id,setting_key,setting_value,updated_by_user_id)
SELECT @business_id,@branch_id,'pos',JSON_OBJECT(
 'cashPrinter','Impresora principal de caja','kitchenPrinter','Impresora de cocina','barPrinter','Impresora de barra / mostrador',
 'kitchenPrinterEnabled',TRUE,'barPrinterEnabled',TRUE,'cashDrawerEnabled',TRUE,'cashDrawerCompatible',FALSE,
 'accountHolder','Gastro Suite','bank','Banco de prueba','accountNumber','0123456789','clabe','012345678901234567',
 'openingTime','11:00','closingTime','21:00','slotMinutes',30,'prepMinutes',30,'slotCapacity',4
),@creator_id
WHERE NOT EXISTS (SELECT 1 FROM app_settings WHERE business_id=@business_id AND branch_id=@branch_id AND setting_key='pos');

INSERT INTO audit_logs (business_id,branch_id,actor_user_id,action,entity_type,entity_id,new_values)
SELECT @business_id,@branch_id,@creator_id,'demo.data.migrated','system','demo-v1',
 JSON_OBJECT('products',8,'orders',6,'customers',6,'source','React local demo')
WHERE NOT EXISTS (SELECT 1 FROM audit_logs WHERE business_id=@business_id AND action='demo.data.migrated');
