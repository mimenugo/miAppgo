-- Mi Menu Suite / 009_marketing_portal_and_brand_refresh.sql
USE gastro_suite;
SET time_zone = '+00:00';

INSERT INTO roles (code,name,description) VALUES
('marketing','Marketing','Portal comercial para captura de diagnosticos')
ON DUPLICATE KEY UPDATE name=VALUES(name),description=VALUES(description);

INSERT INTO permissions (code,description) VALUES
('discovery.capture','Capturar diagnosticos comerciales')
ON DUPLICATE KEY UPDATE description=VALUES(description);

INSERT IGNORE INTO role_permissions (role_id,permission_id)
SELECT r.id,p.id FROM roles r JOIN permissions p ON p.code='discovery.capture'
WHERE r.code IN ('administrator','marketing');

SET @business_id := (SELECT id FROM businesses ORDER BY id LIMIT 1);
SET @branch_id := (SELECT id FROM branches WHERE business_id=@business_id ORDER BY id LIMIT 1);

UPDATE businesses
SET name='Mi Menu Suite',
    legal_name='Mi Menu Suite',
    email=CASE
      WHEN COALESCE(TRIM(email),'') IN ('','contacto@gastrosuite.local') THEN 'contacto@mimenusuite.local'
      ELSE email
    END
WHERE id=@business_id;

UPDATE branches
SET email=CASE
      WHEN COALESCE(TRIM(email),'') IN ('','contacto@gastrosuite.local') THEN 'contacto@mimenusuite.local'
      ELSE email
    END
WHERE id=@branch_id;

UPDATE users
SET full_name='Administrador Mi Menu Suite'
WHERE business_id=@business_id AND email='admin@gastrosuite.local';

INSERT INTO users (business_id,public_id,full_name,email,phone,password_hash,status)
SELECT @business_id,UUID(),'Portal Marketing','MKT@gastrosuite.local','6640000099',
  '$2b$12$uvbty314be8FTq9BFjFh6eJbc0V.6hv9ckKtD.EJeuNqDm5i8hehe','active'
WHERE NOT EXISTS (
  SELECT 1 FROM users u WHERE u.business_id=@business_id AND u.email='MKT@gastrosuite.local'
);

INSERT IGNORE INTO user_roles (user_id,role_id,branch_id)
SELECT u.id,r.id,@branch_id
FROM users u
JOIN roles r ON r.code='marketing'
WHERE u.business_id=@business_id AND u.email='MKT@gastrosuite.local';

UPDATE app_settings
SET setting_value = JSON_SET(
  setting_value,
  '$.accountHolder',
  CASE
    WHEN COALESCE(JSON_UNQUOTE(JSON_EXTRACT(setting_value,'$.accountHolder')),'') IN ('','Gastro Suite') THEN 'Mi Menu Suite'
    ELSE JSON_UNQUOTE(JSON_EXTRACT(setting_value,'$.accountHolder'))
  END
)
WHERE setting_key='pos';
