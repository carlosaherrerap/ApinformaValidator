# DOCMUENTO EN GENERAL

Esta guía detalla los endpoints disponibles, los formatos de datos (payloads) y las respuestas esperadas para la integración del sistema.

##  Base URL
http://localhost:3000/v1/api

---

# ENDPOINTS:
- http://localhost:3000/v1/api/client` --METHOD: POST
- http://localhost:3000/v1/api/client/:id/token --METHOD: POST
- http://localhost:3000/v1/api/client/:id/verify/:token --METHOD: GET
- http://localhost:3000/v1/api/client/:id/cancel --METHOD: POST
- http://localhost:3000/v1/api/client/:id/expire --METHOD: POST
- http://localhost:3000/v1/api/client/:id/cooldown/:via --METHOD: GET
- http://localhost:3000/v1/api/auth/login --METHOD: POST
- http://localhost:3000/v1/api/status --METHOD: GET

## PARA CLIENTS

### 1. Registro Inicial (Paso 1)
Crea un nuevo cliente en estado pendiente.

  Endpoint:POST /client
  Payload (JSON):

{
  "tipo_documento": "DNI",
  "documento": "12345678",
  "dv": "9",
  "nombres": "Juan",
  "ap_paterno": "Perez",
  "ap_materno": "Gomez",
  "correo": "juan.perez@example.com",
  "departamento": "LIMA",
  "provincia": "LIMA",
  "distrito": "MIRAFLORES"
}


*  Respuesta Exitosa (201 Created):

{
    "message": "Registro en proceso. Continuando...",
    "data": {
        "id": "00715564-b4cf-4cf5-9287-040615459671"
    }
}

-->RESPUESTA NEGATIVA CUANDO EL CLIENTE(DOCUMENTO) YA SE ENCUENTRA REGISTRADO:

{
    "error": "Usted ya se ha registrado y validado anteriormente.",
    "code": "ALREADY_REGISTERED"
}

---

### 2. Solicitud de Token (Paso 2)
Genera un código de 4 caracteres y lo asocia al celular del cliente.

Endpoint:POST /client/:id/token
Parámetros:id es el UUID obtenido en el paso 1.
Payload (JSON):

{
  "celular": "987654321",
  "operador": "MOVISTAR",
  "via": "S" 
}


---> via: 'S' (SMS), 'W' (WhatsApp)

Respuesta Exitosa (200 OK):

{
    "message": "Token enviado vía SMS",
    "data": {
        "token_id": "0dfb5418-01cd-4924-9587-ef1484d624ab",
        "expires_in_seconds": 150,
        "via": "S",
        "intentos": 0,
        "token_length": 4
    }
}


 

#### Horario de Cooldown
| Intento | Tiempo de Espera |
|---------|------------------|
| 3       | 1.5 minutos      |
| 4       | 3 minutos        |
| 5       | 5 minutos        |
| 6       | 10 minutos       |
| 7       | 30 minutos       |
| 8+      | 1 hora           |




### 3. Verificación de Código (Paso 3)
Valida el token ingresado por el usuario final.

  Endpoint: GET /client/:id/verify/:token
   Parámetros:
    -id: UUID del cliente.
    -token: Código de 4 caracteres (ej: `A1B2`).
   Respuesta Exitosa (200 OK):

{
    "message": "Token verificado exitosamente.",
    "data": {
        "status": "VALIDADO"
    }
}

  -->Error por Re-intento (429):

{
    "error": "Token incorrecto.",
    "code": "ERR_TOKEN_INCORRECTO",
    "intentos": 1,
    "bloqueado": false,
    "via_bloqueada": "S"
}

-->Cuando sobrepasas los limites de consultas sabiendo que ya intentaste 3 veces y fallaste!
{
    "error": "Debe esperar el cooldown.",
    "remaining_seconds": 86,
    "intentos": 3,
    "via_bloqueada": "S",
    "code": "ERR_COOLDOWN"
}

-->Cuando el id de cliente no existe, etc:

{
    "error": "ID de cliente inválido"
}

-->Si se intenta expirar un token de un id_cliente no valido/no existente
{
    "error": "No hay token pendiente"
}

-->Cuando el token ha expirado:
{
    "error": "No hay token pendiente. Solicite uno nuevo.",
    "code": "ERR_NO_TOKEN"
}



**Errores Comunes (400 Bad Request):**
- `ERR_INVALID_TOKEN`: El token no coincide (permite hasta 3 intentos).
- `ERR_MAX_ATTEMPTS`: Se agotaron los 3 intentos y el token fue invalidado.
- `ERR_TOKEN_EXPIRED`: El tiempo de 2:30 min ha expirado.
- `ERR_NO_PENDING_TOKEN`: No hay tokens activos para este cliente.

---

### 4. Cancelar Token Actual (Paso 3 - Opcional)
`POST /client/:id/cancel`
Invalida el token actual usando el ID_CLIENT. Cuenta como un intento fallido para el historial

RESPUESTA EXITOSA (200 OK):

{
    "message": "Token cancelado",
    "intentos": 1,
    "via_bloqueada": "W"
}


### 5. Registrar Expiración (Interno)
POST /client/:id/expire
Si el temporizador llega a cero sin intentos del usuario, se llama internamente para auditar como `SIN_RESPUESTA`.

RESPUESTA EXITOSA (200 OK):

{
    "message": "Token expirado registrado"
}

### 6. Consultar Estado de Cooldown
GET /client/:id/cooldown
Permite a la empresa saber cuánto tiempo le queda a un cliente para re-intentar por un medio específico. Devuelve segundos restantes y si puede solicitar.

RESPUESTA EXITOSA (200 OK):

{
    "data": {
        "S": {
            "intentos": 0,
            "bloqueado": false,
            "remaining_seconds": 0
        },
        "W": {
            "intentos": 0,
            "bloqueado": false,
            "remaining_seconds": 0
        }
    }
}



## 🛠️ Utilidades

### 5. Estado del Sistema (Health Check)
Verifica si la API y la base de datos están operativas.

Endpoint: GET /status
Respuesta:

{
    "status": "OK",
    "timestamp": "2026-02-17T16:38:23.982Z",
    "uptime": 9920.809788112,
    "token_length": 4
}