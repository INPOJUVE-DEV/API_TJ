-- Snapshot del esquema Tarjeta Joven extraido desde scripts/seed.js
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS staging_push_attempts;
DROP TABLE IF EXISTS integration_jti_log;
DROP TABLE IF EXISTS integration_audit_log;
DROP TABLE IF EXISTS admin_activity_log;
DROP TABLE IF EXISTS service_client_keys;
DROP TABLE IF EXISTS service_clients;
DROP TABLE IF EXISTS sync_audit_log;
DROP TABLE IF EXISTS beneficiario_staging;
DROP TABLE IF EXISTS coin_transactions;
DROP TABLE IF EXISTS coin_daily_awards;
DROP TABLE IF EXISTS user_qr_tokens;
DROP TABLE IF EXISTS otp_codes;
DROP TABLE IF EXISTS refresh_tokens;
DROP TABLE IF EXISTS beneficiarios_sync_log;
DROP TABLE IF EXISTS solicitudes_registro;
DROP TABLE IF EXISTS cardholders_sync;
DROP TABLE IF EXISTS cardholder_audit_logs;
DROP TABLE IF EXISTS beneficios;
DROP TABLE IF EXISTS cardholders;
DROP TABLE IF EXISTS usuarios;
DROP TABLE IF EXISTS categorias;
DROP TABLE IF EXISTS municipios;

CREATE TABLE municipios (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(120) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE categorias (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(120) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE usuarios (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(120) NULL,
  apellidos VARCHAR(150) NULL,
  curp VARCHAR(20) NULL UNIQUE,
  email VARCHAR(150) NOT NULL UNIQUE,
  telefono VARCHAR(20),
  municipio_id INT,
  password_hash VARCHAR(255) NULL,
  role ENUM('admin','reader','scanner','beneficiary') NOT NULL DEFAULT 'beneficiary',
  creditos INT NOT NULL DEFAULT 0,
  foto_url VARCHAR(255),
  portada_url VARCHAR(255),
  auth0_user_id VARCHAR(191) UNIQUE NULL,
  cardholder_sync_id INT NULL,
  status ENUM('pending','active','blocked') NOT NULL DEFAULT 'active',
  session_version INT NOT NULL DEFAULT 0,
  last_login_at DATETIME NULL,
  last_failed_login_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (municipio_id) REFERENCES municipios(id)
    ON UPDATE CASCADE
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE cardholders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  curp VARCHAR(20) NOT NULL UNIQUE,
  nombres VARCHAR(120) NOT NULL,
  apellidos VARCHAR(150) NOT NULL,
  municipio_id INT,
  tarjeta_numero VARCHAR(50),
  status ENUM('active','inactive','blocked') DEFAULT 'active',
  lookup_attempts INT DEFAULT 0,
  last_lookup_attempt_at DATETIME NULL,
  lookup_blocked_until DATETIME NULL,
  pending_account_until DATETIME NULL,
  account_user_id INT UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (municipio_id) REFERENCES municipios(id)
    ON UPDATE CASCADE
    ON DELETE SET NULL,
  FOREIGN KEY (account_user_id) REFERENCES usuarios(id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE cardholders_sync (
  id INT AUTO_INCREMENT PRIMARY KEY,
  curp_hash CHAR(64) NOT NULL UNIQUE,
  curp_masked VARCHAR(20) NOT NULL,
  tarjeta_numero VARCHAR(50) NOT NULL UNIQUE,
  status ENUM('active','inactive','blocked') NOT NULL DEFAULT 'active',
  sync_source VARCHAR(120),
  synced_at DATETIME NOT NULL,
  account_user_id INT UNIQUE NULL,
  auth0_user_id VARCHAR(191) UNIQUE NULL,
  activation_verified_until DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (account_user_id) REFERENCES usuarios(id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE beneficiario_staging (
  id INT AUTO_INCREMENT PRIMARY KEY,
  external_request_id VARCHAR(120) NOT NULL UNIQUE,
  curp_hash CHAR(64) NOT NULL,
  curp_masked VARCHAR(20) NOT NULL,
  payload_ciphertext LONGTEXT NOT NULL,
  payload_iv VARCHAR(64) NOT NULL,
  payload_tag VARCHAR(64) NOT NULL,
  status ENUM('pending','sent','accepted','rejected','error') NOT NULL DEFAULT 'pending',
  submitted_by_system VARCHAR(120) NOT NULL,
  submitted_at DATETIME NOT NULL,
  sent_at DATETIME NULL,
  resolved_at DATETIME NULL,
  sys_ipj_response_code INT NULL,
  error_message TEXT NULL,
  locked_at DATETIME NULL,
  locked_by VARCHAR(120) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_beneficiario_staging_curp_hash (curp_hash),
  INDEX idx_beneficiario_staging_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE sync_audit_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  direction ENUM('SYS_IPJ_TO_API_TJ','API_TJ_TO_SYS_IPJ') NOT NULL,
  executed_by VARCHAR(120),
  request_count INT NOT NULL DEFAULT 0,
  inserted_count INT NOT NULL DEFAULT 0,
  updated_count INT NOT NULL DEFAULT 0,
  skipped_count INT NOT NULL DEFAULT 0,
  conflict_count INT NOT NULL DEFAULT 0,
  status ENUM('success','partial','failed') NOT NULL,
  request_checksum CHAR(64),
  started_at DATETIME NOT NULL,
  finished_at DATETIME NOT NULL,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE service_clients (
  id INT AUTO_INCREMENT PRIMARY KEY,
  client_code VARCHAR(80) NOT NULL UNIQUE,
  name VARCHAR(160) NOT NULL,
  status ENUM('active','inactive','blocked') NOT NULL DEFAULT 'active',
  allowed_scopes JSON NOT NULL,
  ip_allowlist JSON NULL,
  key_id_current VARCHAR(120) NULL,
  last_used_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE service_client_keys (
  id INT AUTO_INCREMENT PRIMARY KEY,
  client_id INT NOT NULL,
  kid VARCHAR(120) NOT NULL UNIQUE,
  public_key TEXT NOT NULL,
  status ENUM('active','inactive','revoked') NOT NULL DEFAULT 'active',
  valid_from DATETIME NULL,
  valid_until DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES service_clients(id)
    ON DELETE CASCADE,
  INDEX idx_service_client_keys_client (client_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE integration_jti_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  client_id INT NOT NULL,
  jti VARCHAR(191) NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_integration_jti_client (client_id, jti),
  FOREIGN KEY (client_id) REFERENCES service_clients(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE integration_audit_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  client_id INT NULL,
  client_code VARCHAR(80) NULL,
  method VARCHAR(12) NOT NULL,
  path VARCHAR(255) NOT NULL,
  required_scope VARCHAR(120) NULL,
  ip_address VARCHAR(45) NULL,
  status_code INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_integration_audit_client_created (client_code, created_at),
  FOREIGN KEY (client_id) REFERENCES service_clients(id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE admin_activity_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  actor_user_id INT NULL,
  actor_email VARCHAR(150) NULL,
  entity_type VARCHAR(80) NOT NULL,
  entity_id VARCHAR(120) NOT NULL,
  action VARCHAR(80) NOT NULL,
  ip_address VARCHAR(45) NULL,
  payload JSON NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_admin_activity_created (created_at),
  INDEX idx_admin_activity_entity (entity_type, entity_id),
  FOREIGN KEY (actor_user_id) REFERENCES usuarios(id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE staging_push_attempts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  staging_id INT NOT NULL,
  external_request_id VARCHAR(120) NOT NULL,
  actor VARCHAR(120),
  request_checksum CHAR(64),
  response_status INT,
  status ENUM('accepted','rejected','error') NOT NULL,
  error_message TEXT,
  attempted_at DATETIME NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (staging_id) REFERENCES beneficiario_staging(id)
    ON DELETE CASCADE,
  INDEX idx_staging_push_attempts_staging (staging_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE beneficios (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(160) NOT NULL,
  descripcion TEXT,
  categoria_id INT,
  municipio_id INT,
  descuento VARCHAR(80),
  direccion VARCHAR(200),
  horario VARCHAR(120),
  lat DECIMAL(10,8),
  lng DECIMAL(11,8),
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  is_visible_to_beneficiary TINYINT(1) NOT NULL DEFAULT 1,
  published_at DATETIME NULL,
  headline VARCHAR(160) NULL,
  summary VARCHAR(255) NULL,
  image_url VARCHAR(255) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_beneficios_nombre (nombre),
  FOREIGN KEY (categoria_id) REFERENCES categorias(id)
    ON UPDATE CASCADE
    ON DELETE SET NULL,
  FOREIGN KEY (municipio_id) REFERENCES municipios(id)
    ON UPDATE CASCADE
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE cardholder_audit_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  cardholder_id INT NOT NULL,
  action ENUM('lookup','account_created') NOT NULL,
  ip_address VARCHAR(45),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (cardholder_id) REFERENCES cardholders(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE solicitudes_registro (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombres VARCHAR(120) NOT NULL,
  apellidos VARCHAR(150) NOT NULL,
  fecha_nacimiento DATE NOT NULL,
  curp VARCHAR(20) NOT NULL UNIQUE,
  username VARCHAR(150) DEFAULT NULL,
  calle VARCHAR(150) DEFAULT NULL,
  numero VARCHAR(20) DEFAULT NULL,
  cp CHAR(5) DEFAULT NULL,
  colonia VARCHAR(150),
  municipio_id INT,
  password_hash VARCHAR(255) NOT NULL,
  status ENUM('pending','approved','rejected') DEFAULT 'pending',
  acepta_terminos TINYINT(1) DEFAULT 0,
  doc_ine VARCHAR(255),
  doc_comprobante VARCHAR(255),
  doc_curp VARCHAR(255),
  folio VARCHAR(20),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (municipio_id) REFERENCES municipios(id)
    ON UPDATE CASCADE
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE beneficiarios_sync_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  solicitud_id INT,
  curp VARCHAR(20) NOT NULL,
  payload JSON NOT NULL,
  status ENUM('sent','failed','rejected','skipped') NOT NULL,
  response_status INT,
  total_count INT,
  inserted_count INT,
  rejected_count INT,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (solicitud_id) REFERENCES solicitudes_registro(id)
    ON DELETE SET NULL,
  INDEX idx_beneficiarios_sync_curp (curp)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE refresh_tokens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT NOT NULL,
  refresh_token CHAR(64) NOT NULL UNIQUE,
  expiry_date DATETIME NOT NULL,
  revoked_at DATETIME NULL,
  rotated_from INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE password_reset_tokens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT NOT NULL,
  token_hash CHAR(64) NOT NULL UNIQUE,
  expires_at DATETIME NOT NULL,
  consumed_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE otp_codes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  curp VARCHAR(20) NOT NULL,
  code VARCHAR(10) NOT NULL,
  expiry_date DATETIME NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_otp_codes_curp (curp)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE user_qr_tokens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  token_value VARCHAR(64) NOT NULL,
  token_hash CHAR(64) NOT NULL,
  status ENUM('active','rotated','revoked') NOT NULL DEFAULT 'active',
  valid_from DATE NOT NULL,
  valid_until DATE NOT NULL,
  last_used_at DATETIME NULL,
  revoked_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_user_qr_token_hash (token_hash),
  UNIQUE KEY uq_user_qr_token_month (user_id, valid_from),
  FOREIGN KEY (user_id) REFERENCES usuarios(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE coin_daily_awards (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  award_date DATE NOT NULL,
  scanner_id INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_coin_daily_user (user_id, award_date),
  FOREIGN KEY (user_id) REFERENCES usuarios(id)
    ON DELETE CASCADE,
  FOREIGN KEY (scanner_id) REFERENCES usuarios(id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE coin_transactions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  delta INT NOT NULL,
  type ENUM('scan_reward') NOT NULL,
  scanner_id INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES usuarios(id)
    ON DELETE CASCADE,
  FOREIGN KEY (scanner_id) REFERENCES usuarios(id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET FOREIGN_KEY_CHECKS = 1;
