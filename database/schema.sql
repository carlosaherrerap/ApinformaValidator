CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ROL
CREATE TABLE IF NOT EXISTS rol (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO rol (nombre) VALUES ('ADMIN'), ('OPERATOR'), ('VIEWER')
ON CONFLICT (nombre) DO NOTHING;

-- USUARIO
CREATE TABLE IF NOT EXISTS usuario (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    rol_id INTEGER REFERENCES rol(id),
    can_view_stats BOOLEAN DEFAULT false,
    can_view_tokens BOOLEAN DEFAULT false,
    photo VARCHAR(500),
    nombres VARCHAR(100),
    ap_paterno VARCHAR(100),
    ap_materno VARCHAR(100),
    documento VARCHAR(20),
    telefono VARCHAR(20),
    departamento VARCHAR(100),
    provincia VARCHAR(100),
    distrito VARCHAR(100),
    status BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Admin por defecto: admin / admin2026
-- Hash bcrypt de 'admin2026'
INSERT INTO usuario (username, password, email, rol_id, can_view_stats, can_view_tokens)
VALUES (
    'admin',
    '$2b$10$.6C7As44nN4RV8SoN/UZYOZ0CUEWUVVNqkH8uuXIJVWAviJ0ETJmQu',
    'admin@tokenizer.pe',
    1,
    true,
    true
) ON CONFLICT (username) DO NOTHING;

-- CLIENTE
CREATE TABLE IF NOT EXISTS cliente (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tipo_doc CHAR(3) NOT NULL CHECK (tipo_doc IN ('DNI', 'RUC', 'CDE')),
    documento VARCHAR(11) NOT NULL UNIQUE,
    dv CHAR(1) NOT NULL,
    nombres VARCHAR(100) NOT NULL,
    ap_paterno VARCHAR(100) NOT NULL,
    ap_materno VARCHAR(100) NOT NULL,
    celular CHAR(9),
    operador VARCHAR(10),
    email VARCHAR(255),
    departamento VARCHAR(100),
    provincia VARCHAR(100),
    distrito VARCHAR(100),
    acepto_terminos BOOLEAN DEFAULT false,
    estado BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- TOKEN
CREATE TABLE IF NOT EXISTS token (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    id_cliente UUID NOT NULL REFERENCES cliente(id),
    codigo VARCHAR(5) NOT NULL,
    codigo_hash VARCHAR(255) NOT NULL,
    via CHAR(1) NOT NULL CHECK (via IN ('S', 'W')),
    status CHAR(1) DEFAULT 'P' CHECK (status IN ('P', 'V', 'E', 'X', 'N')), -- P: Pendiente, V: Validado, E: Expirado, X: Cancelado, N: No enviado
    ip_solicitante VARCHAR(45),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RESULTADO ENVIO (cooldown por medio)
CREATE TABLE IF NOT EXISTS resultado_envio (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    id_cliente UUID NOT NULL REFERENCES cliente(id),
    via CHAR(1) NOT NULL CHECK (via IN ('S', 'W')),
    intentos INTEGER DEFAULT 0,
    ultimo_intento TIMESTAMPTZ,
    bloqueado BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (id_cliente, via)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_cliente_documento ON cliente(documento);
CREATE INDEX IF NOT EXISTS idx_token_cliente ON token(id_cliente);
CREATE INDEX IF NOT EXISTS idx_token_status ON token(status);
CREATE INDEX IF NOT EXISTS idx_resultado_cliente_via ON resultado_envio(id_cliente, via);
