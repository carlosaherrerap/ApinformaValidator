-- Extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tabla de Roles
CREATE TABLE IF NOT EXISTS rol (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL UNIQUE, -- 'ADMINISTRADOR', 'USUARIO_REPORTE'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de Usuarios (Empresa que usa la API)
CREATE TABLE IF NOT EXISTS usuarios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    rol_id INT REFERENCES rol(id),
    mfa_secret VARCHAR(255), -- Para TOTP/Autenticador
    status BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de Clientes (Los 200k+ registros)
CREATE TABLE IF NOT EXISTS client_token (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document VARCHAR(20) NOT NULL UNIQUE,
    typeof CHAR(3) NOT NULL CHECK (typeof IN ('RUC', 'DNI', 'CDE')),
    digit_very CHAR(1) NOT NULL,
    names VARCHAR(255),
    lastname_paternal VARCHAR(255), -- Apellido Paterno según imagen
    lastname_maternal VARCHAR(255), -- Apellido Materno según imagen
    cellphone VARCHAR(15), -- Opcional inicialmente
    operator VARCHAR(50), -- Opcional inicialmente
    email VARCHAR(255),
    dept VARCHAR(100),
    prov VARCHAR(100),
    distr VARCHAR(100),
    allow SMALLINT DEFAULT 2, -- 1: Validado, 2: En proceso ,0: Bloqueado
    accept BOOLEAN DEFAULT FALSE, -- Términos y condiciones
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de Tokens
CREATE TABLE IF NOT EXISTS token (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    id_client UUID REFERENCES client_token(id) ON DELETE CASCADE,
    request CHAR(4) NOT NULL, -- Token de 4 caracteres
    via CHAR(1) NOT NULL CHECK (via IN ('S', 'W', 'I', 'C')), -- SMS, WHATSAPP, IVR, CORREO
    date_request TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expiration_time TIMESTAMP NOT NULL, -- Fecha de vencimiento
    time_lapsed INT, -- Segundos que duró activo antes de validarse o vencer
    attempts_failed INT DEFAULT 0,
    status CHAR(1) DEFAULT 'P' CHECK (status IN ('P', 'V', 'E', 'X')), -- PENDIENTE, VALIDADO, EXPIRADO, CANCELADO
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de Auditoría y Seguimiento (result_send)
CREATE TABLE IF NOT EXISTS result_send (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    id_client UUID REFERENCES client_token(id) ON DELETE CASCADE,
    id_token UUID REFERENCES token(id) ON DELETE CASCADE,
    ip VARCHAR(45), -- Captura de IP (v4/v6)
    attempts_failed INT DEFAULT 0,
    attempts_correct INT DEFAULT 0,
    attempts_no_response INT DEFAULT 0,
    via CHAR(1), -- Medio usado
    provider_status VARCHAR(100), -- Estado devuelto por la API externa (e.g. 'ENVIADO', 'PROCESADO')
    raw_log JSONB, -- Logs adicionales del proveedor
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Inserción de roles iniciales
INSERT INTO rol (nombre) VALUES ('ADMINISTRADOR'), ('USUARIO_REPORTE') ON CONFLICT DO NOTHING;

-- Índices para optimizar búsquedas masivas (2M registros)
CREATE INDEX idx_client_document ON client_token(document);
CREATE INDEX idx_token_client ON token(id_client);
CREATE INDEX idx_result_client ON result_send(id_client);
