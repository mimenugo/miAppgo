-- Gastro Suite / 008_business_discovery_questionnaire.sql
USE gastro_suite;
SET time_zone = '+00:00';

CREATE TABLE business_discovery_questions (
  code VARCHAR(12) PRIMARY KEY,
  block_code VARCHAR(40) NOT NULL,
  block_title VARCHAR(180) NOT NULL,
  sort_order SMALLINT UNSIGNED NOT NULL,
  question_text VARCHAR(700) NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_discovery_question_order (sort_order),
  KEY idx_discovery_question_block (block_code, active, sort_order)
) ENGINE=InnoDB;

CREATE TABLE business_discovery_submissions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  public_id CHAR(36) NOT NULL UNIQUE,
  business_id BIGINT UNSIGNED NOT NULL,
  branch_id BIGINT UNSIGNED,
  business_name VARCHAR(180) NOT NULL,
  respondent_name VARCHAR(180) NOT NULL,
  respondent_role VARCHAR(120),
  phone VARCHAR(30),
  email VARCHAR(190),
  status VARCHAR(20) NOT NULL DEFAULT 'draft',
  total_questions SMALLINT UNSIGNED NOT NULL DEFAULT 32,
  answered_questions SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  created_by_user_id BIGINT UNSIGNED,
  completed_at DATETIME(3),
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  KEY idx_discovery_submission_list (business_id, branch_id, status, created_at),
  KEY idx_discovery_submission_contact (business_id, business_name, respondent_name),
  CONSTRAINT fk_discovery_submission_business FOREIGN KEY (business_id) REFERENCES businesses(id),
  CONSTRAINT fk_discovery_submission_branch FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE SET NULL,
  CONSTRAINT fk_discovery_submission_user FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT chk_discovery_submission_status CHECK (status IN ('draft','completed'))
) ENGINE=InnoDB;

CREATE TABLE business_discovery_answers (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  submission_id BIGINT UNSIGNED NOT NULL,
  question_code VARCHAR(12) NOT NULL,
  answer_text MEDIUMTEXT NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_discovery_answer (submission_id, question_code),
  KEY idx_discovery_answer_question (question_code),
  CONSTRAINT fk_discovery_answer_submission FOREIGN KEY (submission_id) REFERENCES business_discovery_submissions(id) ON DELETE CASCADE,
  CONSTRAINT fk_discovery_answer_question FOREIGN KEY (question_code) REFERENCES business_discovery_questions(code)
) ENGINE=InnoDB;

INSERT INTO business_discovery_questions(code,block_code,block_title,sort_order,question_text) VALUES
('Q01','business_model','Bloque 1. Modelo de negocio y propuesta de valor',1,'¿Qué tipo de servicio ofreces? (comer en local, delivery, take-out, food truck en eventos, etc.)'),
('Q02','business_model','Bloque 1. Modelo de negocio y propuesta de valor',2,'¿Cuál es tu menú principal y qué platos son los más vendidos?'),
('Q03','business_model','Bloque 1. Modelo de negocio y propuesta de valor',3,'¿En qué te diferencias de tu competencia directa? (precio, calidad, rapidez, experiencia, ubicación, concepto)'),
('Q04','business_model','Bloque 1. Modelo de negocio y propuesta de valor',4,'¿Qué días y horarios son tus picos de venta?'),
('Q05','operations','Bloque 2. Operaciones y flujo de trabajo',5,'¿Cómo se toman los pedidos hoy? (mesero, QR, app, teléfono, mostrador)'),
('Q06','operations','Bloque 2. Operaciones y flujo de trabajo',6,'¿Cómo llegan los pedidos a cocina? (comandas impresas, pantalla, verbal)'),
('Q07','operations','Bloque 2. Operaciones y flujo de trabajo',7,'¿Qué pasos sigue un pedido desde que se crea hasta que se cobra?'),
('Q08','operations','Bloque 2. Operaciones y flujo de trabajo',8,'¿Cómo manejas mesas, reservas o colas (si aplica)?'),
('Q09','operations','Bloque 2. Operaciones y flujo de trabajo',9,'¿Qué reportes necesitas diariamente o semanalmente? (ventas por hora, productos top, por canal)'),
('Q10','operations','Bloque 2. Operaciones y flujo de trabajo',10,'¿Qué problemas te causan más retrasos o errores en el servicio?'),
('Q11','technology','Bloque 3. Tecnología y sistemas actuales',11,'¿Qué POS o sistema usas actualmente (si tienes)? ¿Qué te gusta y qué no?'),
('Q12','technology','Bloque 3. Tecnología y sistemas actuales',12,'¿Qué dispositivos usas para operar? (tablets, móviles, PC, impresoras, terminales de pago)'),
('Q13','technology','Bloque 3. Tecnología y sistemas actuales',13,'¿Tienes conexión a internet estable en el punto de venta? ¿Qué pasa cuando se cae?'),
('Q14','technology','Bloque 3. Tecnología y sistemas actuales',14,'¿Usas integraciones con delivery, contabilidad, inventario o marketing? ¿Cuáles?'),
('Q15','technology','Bloque 3. Tecnología y sistemas actuales',15,'¿Cómo controlas inventario y costos de ingredientes?'),
('Q16','customers','Bloque 4. Clientes y mercado',16,'¿Quién es tu cliente ideal? (edad, perfil, ocasiones de consumo)'),
('Q17','customers','Bloque 4. Clientes y mercado',17,'¿Con qué frecuencia repiten los clientes? ¿Tienes programa de fidelización?'),
('Q18','customers','Bloque 4. Clientes y mercado',18,'¿Qué canales usan tus clientes para enterarse de ti? (redes, aplicaciones de delivery, pasar por la zona, eventos)'),
('Q19','customers','Bloque 4. Clientes y mercado',19,'¿Qué esperan tus clientes de ti: rapidez, calidad, precio, experiencia o conveniencia?'),
('Q20','customers','Bloque 4. Clientes y mercado',20,'¿Qué otros restaurantes o food trucks visitan tus clientes con frecuencia? ¿Qué valoran allí?'),
('Q21','goals','Bloque 5. Objetivos y visión',21,'¿Qué metas tienes a 6–12 meses? (más ventas, más puntos, lanzar delivery, mejorar control, reducir costos)'),
('Q22','goals','Bloque 5. Objetivos y visión',22,'¿Qué significa para ti “éxito” en el próximo año?'),
('Q23','goals','Bloque 5. Objetivos y visión',23,'¿Planeas abrir más puntos, vender en eventos, franquiciar o crecer online?'),
('Q24','goals','Bloque 5. Objetivos y visión',24,'¿Qué KPIs te gustaría ver en un dashboard? (ventas por hora, ticket promedio, margen, desperdicio, etc.)'),
('Q25','decision','Bloque 6. Limitaciones y toma de decisión',25,'¿Qué presupuesto mensual tienes para software y hardware?'),
('Q26','decision','Bloque 6. Limitaciones y toma de decisión',26,'¿Quién decide la compra de tecnología y qué criterios usan? (precio, facilidad, soporte, integración, seguridad)'),
('Q27','decision','Bloque 6. Limitaciones y toma de decisión',27,'¿Qué te ha frustrado de proveedores anteriores? ¿Qué te haría cambiar de proveedor?'),
('Q28','decision','Bloque 6. Limitaciones y toma de decisión',28,'¿Qué nivel de soporte y capacitación necesitas? (horario, idioma, remoto, en sitio)'),
('Q29','high_impact','Preguntas de alto impacto',29,'¿Qué es lo que más te gusta de tu sistema actual y qué cambiarías si pudieras?'),
('Q30','high_impact','Preguntas de alto impacto',30,'Si tu POS ideal hiciera una sola cosa mejor que el actual, ¿qué debería ser?'),
('Q31','high_impact','Preguntas de alto impacto',31,'¿Qué pasa si no resuelves este problema en los próximos meses?'),
('Q32','high_impact','Preguntas de alto impacto',32,'¿Qué funcionalidades son esenciales pero tus soluciones actuales no te ofrecen?')
ON DUPLICATE KEY UPDATE block_code=VALUES(block_code),block_title=VALUES(block_title),sort_order=VALUES(sort_order),question_text=VALUES(question_text),active=TRUE;
