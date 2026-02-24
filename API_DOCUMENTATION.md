# Documentación de la API - Tokenizer Huancayo

Esta documentación técnica cataloga todos los recursos disponibles en la API de Tokenizer, organizados por módulos y flujo de operación.

> [!IMPORTANT]
> **Base URL:** `http://localhost:3000/api/v1`
>
> **Simulación y Control Global:** 
> - Para pruebas individuales: Añada el header `x-simulator: true` en la petición.
> - Para control global del servidor: Configure `ENABLE_MESSAGING=false` en el archivo `.env` para deshabilitar todos los envíos reales.

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

---

## 📱 Ciclo de Vida del Registro (Flujo del Cliente)

### 1. Registro Inicial (Paso 1)
Crea la identidad del cliente en el sistema.
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

### 2. Solicitud de Token (Paso 2)
Envía un código de validación al celular.
*   **Endpoint:** `POST /client/:id/token`
*   **Payload:**
    ```json
    { "celular": "987654321", "operador": "BITEL", "via": "S" }
    ```
*   **Vías:** `S` (SMS), `W` (WhatsApp).
*   **Nota:** Si el servicio falla, el token queda en estado `N` (No enviado).

### 3. Verificar Código (Paso 3)
Valida el token ingresado por el usuario.
*   **Endpoint:** `GET /client/:id/verify/:codigo`
*   **Status:** Retorna `VALIDADO` si el código es correcto.

### 4. Finalizar Registro (Paso 4)
Completa los datos de ubicación y correo tras la validación exitosa.
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

### 5. Acciones Adicionales
*   **Cancelar Token:** `POST /client/:id/cancel` (Invalida el token actual manualmente).
*   **Expirar Token:** `POST /client/:id/expire` (Marca el token como expirado).
*   **Estado Cooldown:** `GET /client/:id/cooldown` (Muestra intentos y tiempo de espera restante).

---

## 👥 Gestión de Usuarios ADMINISTRACION (CRUD)

Módulo exclusivo para administradores para gestionar el personal.

-   **Listar Todos:** `GET /auth/users`
-   **Crear:** `POST /auth/user`
    - Payload: `username`, `password`, `email`, `nombres`, `ap_paterno`, `ap_materno`, `documento`, `telefono`, `departamento`, `provincia`, `distrito`, `rol_id`.
-   **Editar:** `PUT /auth/user/:id`
-   **Eliminar:** `DELETE /auth/user/:id`

---

## 📊 Estadísticas y Consultas de las validaciones

-   **Dashboard Global:** `GET /stats/dashboard` (Resumen de clientes y estados de tokens).
-   **Lista de Clientes:** `GET /stats/clients` (Soporta `?page=X`, `?search=Y`).
-   **Detalle de Cliente:** `GET /stats/clients/:id` (Incluye historial completo de gestiones).
-   **Búsqueda Rápida:** `GET /client/:type/:value` (Busca por `documento` o `telefono`).
-   **Ver Token Plano:** `GET /stats/tokens/:tokenId` (Permite ver el código generado para soporte técnico).

---

## 🛠️ Herramientas de Sistema

### 1. Gestión de WhatsApp QR
*   **Generar QR:** `POST /auth/qr/generate`
*   **Invalidar QR:** `POST /auth/qr/invalidate`

### 2. Salud del Sistema
*   **Health Check:** `GET /api/v1/status` (Muestra uptime y conexión a DB).

---

## 🚀 Guía para Postman

1.  **Variables:** Use `{{base_url}}` para `http://localhost:3000/api/v1`.
2.  **Auth:** Use el tipo "Bearer Token" en la pestaña Authorization para los endpoints protegidos.
3.  **Visualizadores:** El endpoint de **Dashboard** retorna JSON estructurado ideal para paneles de control.
