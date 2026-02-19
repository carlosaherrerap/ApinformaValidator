# Documentación de la API - Tokenizer Huancayo

Esta guía detalla los endpoints disponibles, los formatos de datos (payloads) y las respuestas esperadas para la integración del sistema Tokenizer.

> [!NOTE]
> Todos los endpoints de la API deben llevar el prefijo `/api/v1/`.

## 🌐 Base URL
`http://localhost:3000/api/v1`

---

## 🔑 Autenticación y Sesión

### 1. Iniciar Sesión (Login)
Autentica a un administrador u operador para obtener un token JWT.

*   **Endpoint:** `POST /auth/login/auth`
*   **Payload (JSON):**
```json
{
  "usuario": "admin",
  "clave": "admin2026"
}
```
*   **Respuesta Exitosa (200 OK):**
```json
{
    "token": "eyJhbGciOiJIUzI1...",
    "user": {
        "id": "...",
        "username": "admin",
        "role": "ADMIN",
        "nombres": "Admin"
    }
}
```

### 2. Cerrar Sesión (Logout)
Finaliza la sesión del usuario.

*   **Endpoint:** `POST /auth/logout/auth`

---

## 👥 Gestión de Usuarios (CRUD)
*Requiere cabecera `Authorization: Bearer <TOKEN>`*

### 1. Listar Usuarios
Obtiene la lista de todos los usuarios registrados.

*   **Endpoint:** `GET /auth/users`

### 2. Crear Usuario
Registra un nuevo usuario administrativo u operador.

*   **Endpoint:** `POST /auth/user`
*   **Payload (JSON):**
```json
{
    "username": "operador1",
    "password": "password123",
    "email": "operador@tokenizer.pe",
    "nombres": "Carlos",
    "ap_paterno": "Herrera",
    "ap_materno": "Palma",
    "documento": "75747335",
    "rol_id": 2
}
```

### 3. Editar Usuario
Actualiza los datos de un usuario existente.

*   **Endpoint:** `PUT /auth/user/:id`

### 4. Eliminar Usuario
Elimina un usuario del sistema.

*   **Endpoint:** `DELETE /auth/user/:id`

-----------

## 📱 Flujo de Cliente y Token

### 1. Registro Inicial (Paso 1)
Crea un nuevo cliente en estado pendiente.

*   **Endpoint:** `POST /client`
*   **Payload (JSON):**
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

### 2. Solicitud de Token (Paso 2)
Genera un código y lo envía vía SMS o WhatsApp.

*   **Endpoint:** `POST /client/:id/token`
*   **Payload (JSON):**
```json
{
  "celular": "987654321",
  "operador": "MOVISTAR",
  "via": "S" 
}
```
*   **Vías:** `S` (SMS), `W` (WhatsApp).
*   **Status 'N':** Si el envío falla, el token se registrará con estado `N` (No enviado).

### 3. Verificación de Código (Paso 3)
Valida el token ingresado por el usuario.

*   **Endpoint:** `GET /client/:id/verify/:token`

### 4. Búsqueda Flexible de Clientes
Busca un cliente y su historial por documento o teléfono.

*   **Endpoint:** `GET /client/:type/:value`
*   **Ejemplos:**
    - `/api/v1/client/documento/75747335`
    - `/api/v1/client/telefono/987654321`

---

## 📊 Estadísticas y Monitoreo

### 1. Dashboard de Estadísticas
Obtiene contadores generales de clientes y estados de tokens.

*   **Endpoint:** `GET /stats/dashboard`
*   **Respuesta:** Incluye el conteo de tokens `no_enviados` (status N).

### 2. Estado del Sistema
*   **Endpoint:** `GET /status` (Mueve a `/api/v1/status`)

---

## 🚀 Uso con Postman

1.  **Variables de Entorno:** Crea un entorno en Postman con `base_url = http://localhost:3000/api/v1`.
2.  **Login:** Ejecuta el POST de Login, copia el `token` recibido.
3.  **Auth:** En la pestaña "Auth" de tus peticiones, selecciona "Bearer Token" y pega el token.
4.  **Headers:** Para el simulador de carga, añade el header `x-simulator: true`.
