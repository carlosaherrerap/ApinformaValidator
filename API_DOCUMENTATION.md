# Documentación de la API - Tokenizer Huancayo

Esta documentación técnica cataloga todos los recursos disponibles en la API de Tokenizer, organizados por módulos y flujo de operación.

> [!IMPORTANT]
> **Base URL:** `http://localhost:3001/api/v1` (Puerto 3001 si usas Docker)
>
> **Simulación y Control Global:** 
> - Para pruebas individuales: Añada el header `x-simulator: true` en la petición.
> - Para control global del servidor: Configure `ENABLE_MESSAGING=false` en el archivo `.env` para deshabilitar todos los envíos reales.

---

## � Duración de Sesiones e Invalidación

- **Token de Sesión (JWT):** Expira en **8 horas** (`expires_in: 28800`).
- **Logout:** Invalida el token inmediatamente mediante blacklist en DB.
- **MFA Code:** Expira en **5 minutos**.

---

## �🔑 Matriz de Permisos por Rol

| Recurso | Rol 1 (ADMIN) | Rol 2 (OPERADOR) |
|---------|:---:|:---:|
| Dashboard (números) | ✅ | ✅ |
| Lista de Clientes (datos) | ✅ | ❌ |
| Tokens Planos | ✅ | ❌ |
| Gestión de Usuarios CRUD | ✅ | ❌ |
| WhatsApp QR | Solo `admin` | ❌ |
| **Búsqueda de Cliente** | ✅ (Admin) | ❌ (Prohibido) |

> [!NOTE]
> Los permisos `can_view_stats`, `can_view_data` y `can_view_tokens` se asignan **automáticamente** al crear un usuario según su `rol_id`.

---

## 🛡️ Autenticación y Seguridad

Todas las peticiones a los módulos de **Usuarios**, **Estadísticas** y **QR** requieren un token JWT en el header:
`Authorization: Bearer <TOKEN>`

### 1. Autenticación (OAuth 2.0 + MFA)

Este módulo implementa un flujo de seguridad de dos pasos:
1. **Validación de Aplicación:** Requiere `Authorization: Basic [CLIENT_ID:CLIENT_SECRET]`.
2. **Autenticación de Usuario:** Validación de credenciales.
3. **MFA (WhatsApp):** Verificación de código OTP.

#### A. Iniciar Sesión (Paso 1)
*   **Endpoint:** `POST /auth/login/auth`

> [!IMPORTANT]
> **Configuración en Postman:**
> 1. **Pestaña "Authorization":** Seleccione Tipo `Basic Auth`. 
>    - **Username:** `token_client_2026` (Es el Client ID de la App)
>    - **Password:** `secret_client_vault_2026` (Es el Client Secret de la App)
> 2. **Pestaña "Body":** Seleccione `raw` -> `JSON`.
>    - **Contenido:** `{ "usuario": "admin", "clave": "admin2026" }` (Credenciales del Humano)

*   **Respuesta (Si MFA activo):**
    ```json
    {
        "mfa_required": true,
        "temp_token": "eyJhbG...",
        "message": "Código de verificación enviado vía WhatsApp/SMS"
    }
    ```

#### B. Verificar OTP (Paso 2)
*   **Endpoint:** `POST /auth/login/mfa`
*   **Header Obligatorio:** `Authorization: Basic ...` (Igual al paso 1)
*   **Payload:**
    ```json
    { 
        "temp_token": "TOKEN_RECIBIDO_EN_PASO_1",
        "mfa_code": "123456" 
    }
    ```
*   **Respuesta Éxito (OAuth 2.0):**
    ```json
    {
        "access_token": "JWT_FINAL",
        "token_type": "Bearer",
        "expires_in": 28800,
        "user": { "id": "...", "username": "admin", "role": "ADMIN" }
    }
    ```

#### C. Cerrar Sesión (Logout)
*   **Endpoint:** `POST /auth/logout/auth`
*   **Header:** `Authorization: Bearer [JWT]`
*   **Comportamiento:** El token se registra en una **Blacklist** y queda **permanentemente invalidado**. Cualquier intento de usarlo después del logout recibirá `401 Unauthorized`.
*   **Respuesta:**
    ```json
    {
        "message": "Sesión de 'admin' cerrada exitosamente",
        "invalidated_at": "2026-02-24T16:30:00.000Z"
    }
    ```

#### D. Ver Perfil Propio
*   **Endpoint:** `GET /auth/profile`
*   **Header:** `Authorization: Bearer [JWT]`
*   **Respuesta:**
    ```json
    {
        "data": {
            "id": "uuid",
            "username": "admin",
            "role": "ADMIN",
            "email": "admin@tokenizer.pe",
            "nombres": "Administrador",
            "ap_paterno": "Perez",
            "ap_materno": "Gomez",
            "documento": "12345678",
            "telefono": "987654321",
            "departamento": "JUNIN",
            "provincia": "HUANCAYO",
            "distrito": "EL TAMBO",
            "can_view_stats": true,
            "can_view_data": true,
            "can_view_tokens": true
        }
    }
    ```

#### E. Modificar Mi Perfil (Full)
*   **Endpoint:** `PUT /auth/profile`
*   **Header:** `Authorization: Bearer [JWT]`
*   **Payload (Todos los campos opcionales):**
    ```json
    {
        "nombres": "Juan",
        "ap_paterno": "Perez",
        "ap_materno": "Soto",
        "documento": "12345678",
        "email": "nuevo@correo.com",
        "telefono": "999888777",
        "departamento": "LIMA",
        "provincia": "LIMA",
        "distrito": "MIRAFLORES",
        "photo": "https://url-de-mi-foto.com",
        "current_password": "claveActual",
        "new_password": "claveNueva2026"
    }
    ```
*   **Respuesta:**
    ```json
    {
        "message": "Perfil actualizado exitosamente",
        "data": { "id": "uuid", "username": "admin", "email": "nuevo@correo.com", "..." : "..." }
    }
    ```

---

## 📱 Ciclo de Vida del Registro (Flujo del Cliente)

Módulo que gestiona la validación de identidad para clientes externos.

### 1. Registro Inicial (Paso 1)
*   **Endpoint:** `POST /client/`
*   **Payload:**
    ```json
    {
        "tipo_documento": "DNI",
        "documento": "12345678",
        "dv": "9",
        "nombres": "Juan",
        "ap_paterno": "Perez",
        "ap_materno": "Gomez"
    }
    ```
*   **Respuesta:**
    ```json
    {
        "message": "Cliente registrado correctamente",
        "data": { "id": "uuid-del-cliente" }
    }
    ```

### 2. Solicitud de Token (Paso 2)
*   **Endpoint:** `POST /client/:id/token`
*   **Payload:**
    ```json
    {
        "celular": "987654321",
        "operador": "BITEL",
        "via": "S"
    }
    ```
    > **Vías disponibles:** `S` = SMS, `W` = WhatsApp.
    > **Operadores:** `MOVISTAR`, `BITEL`, `CLARO`, `ENTEL`.
*   **Respuesta:**
    ```json
    {
        "message": "Token enviado vía SMS",
        "data": {
            "token_id": "uuid-del-token",
            "expires_in_seconds": 150,
            "via": "S",
            "intentos": 0,
            "token_length": 4
        }
    }
    ```
*   **Error (Cooldown activo):**
    ```json
    {
        "error": "Debe esperar antes de solicitar un nuevo token por este medio.",
        "remaining_seconds": 120,
        "intentos": 3,
        "via_bloqueada": "S",
        "code": "ERR_COOLDOWN"
    }
    ```

### 3. Verificar Código (Paso 3)
*   **Endpoint:** `GET /client/:id/verify/:codigo`
*   **Respuesta Éxito:**
    ```json
    {
        "message": "Token verificado exitosamente.",
        "data": { "status": "VALIDADO" }
    }
    ```
*   **Error (Código incorrecto):**
    ```json
    {
        "error": "Token incorrecto.",
        "code": "ERR_TOKEN_INCORRECTO",
        "intentos": 2,
        "bloqueado": false,
        "via_bloqueada": "S"
    }
    ```

### 4. Finalizar Registro (Paso 4)
*   **Endpoint:** `POST /client/:id/finalize`
*   **Payload:**
    ```json
    {
        "correo": "juan@example.com",
        "departamento": "JUNIN",
        "provincia": "HUANCAYO",
        "distrito": "EL TAMBO",
        "acepto_terminos": true
    }
    ```
*   **Respuesta:**
    ```json
    {
        "message": "Registro completado exitosamente",
        "data": { "status": "COMPLETADO" }
    }
    ```

### 5. Acciones Adicionales

#### Cancelar Token
*   **Endpoint:** `POST /client/:id/cancel`
*   **Descripción:** Invalida el token pendiente actual y aumenta el contador de intentos.
*   **Respuesta:**
    ```json
    {
        "message": "Token cancelado",
        "intentos": 1,
        "via_bloqueada": "S"
    }
    ```

#### Expirar Token
*   **Endpoint:** `POST /client/:id/expire`
*   **Descripción:** Marca como expirado el token pendiente.
*   **Respuesta:**
    ```json
    {
        "message": "Token expirado registrado"
    }
    ```

#### Estado Cooldown
*   **Endpoint:** `GET /client/:id/cooldown`
*   **Descripción:** Muestra los intentos por cada medio (SMS y WhatsApp).
*   **Respuesta:**
    ```json
    {
        "data": {
            "S": {
                "intentos": 3,
                "bloqueado": true,
                "remaining_seconds": 120
            },
            "W": {
                "intentos": 0,
                "bloqueado": false,
                "remaining_seconds": 0
            }
        }
    }
    ```

#### Búsqueda Rápida (SÓLO ADMIN)
*   **Endpoint:** `GET /client/:type/:value`
*   **Auth:** `Bearer Token` requerido + Rol ADMIN.
*   **Descripción:** Busca por `documento` o `telefono`. Los operadores (Rol 2) reciben `403 Forbidden`. Oculta el código en texto plano por seguridad, devolviendo solo el `codigo_hash`.

> [!WARNING]
> **Sobre el Hashing:** La API utiliza **Bcrypt** (Cost: 8) para encriptar los tokens. 
> 1. Es un algoritmo de **un solo sentido (irreversible)**. No existe una librería para "desencriptar" el hash y obtener el token original.
> 2. Si necesita ver el token original por auditoría, use el endpoint: `GET /stats/tokens/:tokenId` (Solo Admin).

*   **Ejemplo:** `GET /client/documento/12345678`
*   **Respuesta:**
    ```json
    {
        "data": {
            "id": "uuid",
            "documento": "12345678",
            "nombres": "Juan",
            "tokens": [
                {
                    "id": "uuid-token",
                    "codigo_hash": "$2b$08$...",
                    "via": "S",
                    "status": "V",
                    "created_at": "2026-02-25 09:15:00"
                }
            ]
        }
    }
    ```

---

## 👥 Gestión de Usuarios ADMINISTRACION (CRUD)

Módulo exclusivo para administradores. Requiere `Bearer Token` + rol ADMIN.

#### B. Crear Usuario (ADMIN)
*   **Endpoint:** `POST /auth/user`
*   **Payload con Validaciones:**
    ```json
    {
        "username": "asesor5",      // Único, obligatorio
        "password": "clavesecreta", // Mínimo 4 caracteres
        "email": "asesor5@tok.pe",  // Formato email válido
        "nombres": "Juan",          // Obligatorio
        "ap_paterno": "Perez",    
        "documento": "12345678",    // Exactamente 8 dígitos
        "telefono": "987654321",    // Exactamente 9 dígitos
        "rol_id": 2                 // 1 (Admin), 2 (Operador) o 3
    }
    ```

#### C. Editar Usuario (ADMIN)
*   **Endpoint:** `PUT /auth/user/:id`
*   **Descripción:** Acepta todos los campos anteriores de forma opcional.

#### D. Eliminar Usuario (Flexible)
*   **Endpoint:** `DELETE /auth/user/:type/:value`
*   **Ejemplos:**
    - `DELETE /auth/user/username/asesor5`
    - `DELETE /auth/user/documento/12345678`
    - `DELETE /auth/user/telefono/987654321`

---
// ME QUEDE AQUI DOCUMENTANDO 
## 📊 Estadísticas e Informes

> [!TIP]
> **Filtrado RESTful:** El uso de query params como `stats/clients?page=1&limit=20&search=Juan&estado=true` es **totalmente correcto** y es el estándar de la industria para APIs REST paginadas y filtrables.

| Endpoint | Permiso Requerido | Rol 1 | Rol 2 |
|----------|-------------------|:---:|:---:|

| `GET /stats/dashboard` | `can_view_stats` | ✅ | ✅ |
| `GET /stats/clients` | `can_view_data` | ✅ | ❌ |
| `GET /stats/clients/:id` | `can_view_data` | ✅ | ❌ |
| `GET /stats/tokens/:tokenId` | `can_view_tokens` | ✅ | ❌ |

#### Dashboard (`GET /stats/dashboard`)
```json
{
    "data": {
        "clientes": { "total": 150, "completos": 120, "en_proceso": 30 },
        "tokens": { "total": 200, "validados": 150, "expirados": 20, "cancelados": 15, "no_enviados": 5, "pendientes": 10 },
        "actividad": { "registros_24h": 12 }
    }
}
```

#### Lista de Clientes (`GET /stats/clients?page=1&limit=20&search=Juan&estado=true`)
```json
{
    "data": [ { "id": "uuid", "documento": "12345678", "nombres": "Juan", "...": "..." } ],
    "pagination": { "page": 1, "limit": 20, "total": 150, "pages": 8 }
}
```

#### Token Plano (`GET /stats/tokens/:tokenId`)
```json
{
    "data": {
        "token_id": "uuid",
        "codigo": "TK9h",
        "via": "S",
        "status": "V",
        "ip": "192.168.1.1",
        "created_at": "2026-02-24T...",
        "viewed_by": "admin"
    }
}
```

---

## 🛠️ Herramientas de Sistema

### 1. Gestión de WhatsApp QR (Solo username `admin`)
*   **Generar QR:** `POST /auth/qr/generate`
*   **Invalidar QR:** `POST /auth/qr/invalidate`

### 2. Salud del Sistema
*   **Health Check:** `GET /api/v1/status`
*   **Respuesta:**
    ```json
    {
        "status": "OK",
        "timestamp": "2026-02-24T17:00:00.000Z",
        "uptime": 3600,
        "token_length": 4
    }
    ```

---

## 🚀 Guía para Postman

1.  **Variables:** Use `{{base_url}}` para `http://localhost:3001/api/v1`.
2.  **Auth (App):** Use `Basic Auth` con Client ID y Secret para Login/MFA.
3.  **Auth (User):** Use `Bearer Token` para el resto de endpoints una vez obtenido el JWT.

----------------------------


Usuario: api_manager
Contraseña: api_secure_vault_2026
Base de Datos: TOKENIZER_HUANCAYO
Host: localhost
Puerto: 5432 (o 5433 si usas el mapeo externo de Docker).


Usuario: admin
Clave: admin2026
Client ID: token_client_2026
Client Secret: secret_client_vault_2026