-- Snapshot del esquema Tarjeta Joven extraído desde scripts/seed.js
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS otp_codes;
DROP TABLE IF EXISTS refresh_tokens;
DROP TABLE IF EXISTS solicitudes_registro;
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
  nombre VARCHAR(120) NOT NULL,
  apellidos VARCHAR(150) NOT NULL,
  curp VARCHAR(20) NOT NULL UNIQUE,
  email VARCHAR(150) NOT NULL UNIQUE,
  telefono VARCHAR(20),
  municipio_id INT,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
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

CREATE TABLE refresh_tokens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT NOT NULL,
  refresh_token VARCHAR(255) NOT NULL UNIQUE,
  expiry_date DATETIME NOT NULL,
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

SET FOREIGN_KEY_CHECKS = 1;
