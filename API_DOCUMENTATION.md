# Documentación Técnica de la API - InformaPerú

Esta guía detalla los endpoints disponibles, los formatos de datos (payloads) y las respuestas esperadas para la integración del sistema.

## 📍 Base URL
`http://localhost:3000/v1/api`

---

# ENDPOINTS:
- `http://localhost:3000/v1/api/client` --METHOD: POST
- `http://localhost:3000/v1/api/client/:id/token` --METHOD: POST
- `http://localhost:3000/v1/api/client/:id/verify/:token` --METHOD: GET
- `http://localhost:3000/v1/api/client/:id/cancel` --METHOD: POST
- `http://localhost:3000/v1/api/client/:id/expire` --METHOD: POST
- `http://localhost:3000/v1/api/client/:id/cooldown/:via` --METHOD: GET
- `http://localhost:3000/v1/api/auth/login` --METHOD: POST
- `http://localhost:3000/v1/api/status` --METHOD: GET

## 👥 Módulo de Clientes

### 1. Registro Inicial (Paso 1)
Crea un nuevo cliente en estado pendiente.

*   **Endpoint:** `POST /client`
*   **Payload (JSON):**
```json
{
  "tipo_documento": "DNI",
  "documento": "12345678",
  "digito_verificador": "9",
  "nombres": "Juan",
  "apellido_paterno": "Perez",
  "apellido_materno": "Gomez",
  "correo": "juan.perez@example.com",
  "departamento": "LIMA",
  "provincia": "LIMA",
  "distrito": "MIRAFLORES"
}
```
*   **Respuesta Exitosa (201 Created):**
```json
{
  "message": "Cliente registrado correctamente, proceda a validar su número de celular",
  "data": { "id": "uuid-del-cliente-generado" }
}
```

---

### 2. Solicitud de Token (Paso 2)
Genera un código de 4 caracteres y lo asocia al celular del cliente.

*   **Endpoint:** `POST /client/:id/token`
*   **Parámetros:** `:id` es el UUID obtenido en el paso 1.
*   **Payload (JSON):**
```json
{
  "telefono": "987654321",
  "operador": "MOVISTAR",
  "via": "S" 
}
```
> `via`: 'S' (SMS), 'W' (WhatsApp), 'I' (IVR), 'C' (Correo).

*   **Respuesta Exitosa (200 OK):**
```json
{
  "message": "Token generado y enviado vía S",
  "warning": {
    "message": "Este número ya fue validado el 12/02/2026 por JUAN PEREZ",
    "code": "PHONE_REUSE_WARNING"
  },
  "data": { 
    "token_id": "uuid-del-token",
    "expires_in_seconds": 150
  }
}
```
*   **Error por Re-intento (429):**
```json
{
  "error": "Tiempo de espera obligatorio",
  "message": "Límite de intentos alcanzado. Debe esperar 30 minutos.",
  "code": "ERR_COOLDOWN_ACTIVE"
}
```

#### Horario de Cooldown (en un periodo de 24h)
| Intento | Tiempo de Espera |
|---------|------------------|
| 1-3     | 2 min / 4 min    |
| 4       | 30 minutos       |
| 5       | 1 hora           |
| 6       | 4 horas          |
| 7       | 5 horas          |
| 8       | 8 horas          |
| 9       | 12 horas         |
| 10+     | 24 horas         |

---

### 3. Verificación de Código (Paso 3)
Valida el token ingresado por el usuario final.

*   **Endpoint:** `GET /client/:id/verify/:token`
*   **Parámetros:** 
    - `:id`: UUID del cliente.
    - `:token`: Código de 4 caracteres (ej: `A1B2`).
*   **Respuesta Exitosa (200 OK):**
```json
{
  "message": "Token verificado exitosamente. Registro completado.",
  "data": { "status": "VALIDADO" }
}
```

**Errores Comunes (400 Bad Request):**
- `ERR_INVALID_TOKEN`: El token no coincide (permite hasta 5 intentos).
- `ERR_MAX_ATTEMPTS`: Se agotaron los 5 intentos y el token fue invalidado.
- `ERR_TOKEN_EXPIRED`: El tiempo de 2:30 min ha expirado.
- `ERR_NO_PENDING_TOKEN`: No hay tokens activos para este cliente.

---

### 4. Cancelar Token Actual (Paso 3 - Opcional)
`POST /client/:id/cancel`
Invalida el token actual. Cuenta como un intento fallido para el historial de 24h.

### 5. Registrar Expiración (Interno)
`POST /client/:id/expire`
Si el temporizador llega a cero sin intentos del usuario, se llama internamente para auditar como `SIN_RESPUESTA`.

### 6. Consultar Estado de Cooldown
`GET /client/:id/cooldown/:via`
Permite a la empresa saber cuánto tiempo le queda a un cliente para re-intentar por un medio específico. Devuelve segundos restantes y si puede solicitar.

---

## 🔐 Módulo de Administración

### 4. Inicio de Sesión (Login)
Obtener token de acceso para funciones administrativas.

*   **Endpoint:** `POST /auth/login`
*   **Payload (JSON):**
```json
{
  "username": "admin",
  "password": "tu_password"
}
```
*   **Respuesta:** Devuelve un `token` JWT para usar en cabeceras de autorización.

---

## 🛠️ Utilidades

### 5. Estado del Sistema (Health Check)
Verifica si la API y la base de datos están operativas.

*   **Endpoint:** `GET /status`
*   **Respuesta:**
```json
{
  "status": "ok",
  "timestamp": "2026-02-12T15:30:00.000Z",
  "uptime": 360.5
}
```
