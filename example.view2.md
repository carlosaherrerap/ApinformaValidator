# 📱 DOCUMENTACIÓN DE ENDPOINTS - API VALIDADOR SMS/WA

Esta API permite el registro de clientes y la validación de sus números de teléfono mediante el envío de tokens por SMS o WhatsApp.

---

## 🔒 AUTENTICACIÓN (AUTH)
Base Path: `/api/v1/auth`

### LOGIN (Paso 1)
`POST /login/auth`
- **Payload:**
    ```json
    {
        "usuario": "string",
        "clave": "string"
    }
    ```
- **Nota:** Si el MFA está habilitado, devolverá un `temp_token`.


    ```

### CERRAR SESIÓN
`POST /logout/auth`
- **Headers:** `Authorization: Bearer <token>`

### MI PERFIL
`GET /profile` (Ver mi perfil)
`PUT /profile` (Actualizar mi perfil)
- **Payload (PUT):**
    ```json
    {
        "email": "string",
        "nombres": "string",
        "telefono": "string",
        "current_password": "string", 
        "new_password": "string"
    }
    ```

---

## 👥 GESTIÓN DE USUARIOS (ADMIN)
Base Path: `/api/v1/auth`

### LISTAR TODOS LOS USUARIOS
`GET /users`

### AGREGAR UN USUARIO
`POST /user`
- **Payload:**
    ```json
    {
        "username": "string",
        "password": "string",
        "email": "string",
        "nombres": "string",
        "ap_paterno": "string",
        "ap_materno": "string",
        "documento": "string",
        "telefono": "string",
        "rol_id": 1
    }
    ```
    *Roles: 1 (Admin), 2 (Stats), 3 (Viewer)*

### EDITAR USUARIO
`PUT /user/:id`
- **Payload:** Igual al de creación (campos opcionales).

### ELIMINAR USUARIO
`DELETE /user/:type/:value`
- **Ejemplos:**
    - `/api/v1/auth/user/id/1`
    - `/api/v1/auth/user/username/carlos`

---

## 👤 FLUJO DE VALIDACIÓN DE CLIENTES
Base Path: `/api/v1/client`

### 1️⃣ REGISTRO INICIAL (Paso 1)
`POST /`
- **Payload:**
    ```json
    {
        "tipo_documento": "DNI|RUC|CDE",
        "documento": "string",
        "dv": "string",
        "nombres": "string",
        "ap_paterno": "string",
        "ap_materno": "string"
    }
    ```

### 2️⃣ SOLICITAR TOKEN (Paso 2)
`POST /:id/token`
- **Payload:**
    ```json
    {
        "celular": "9XXXXXXXX",
        "operador": "MOVISTAR|CLARO|ENTEL|BITEL",
        "via": "S|W" 
    }
    ```
    *S = SMS, W = WhatsApp*

### 3️⃣ VERIFICAR TOKEN (Paso 3)
`GET /:id/verify/:token`
- **Ejemplo:** `/api/v1/client/uuid-aquí/verify/1234`

### 4️⃣ FINALIZAR REGISTRO (Paso 4)
`POST /:id/finalize`
- **Payload:**
    ```json
    {
        "correo": "string",
        "departamento": "string",
        "provincia": "string",
        "distrito": "string",
        "acepto_terminos": true
    }
    ```

### ⚙️ OTROS ENDPOINTS DE CLIENTE
- `POST /:id/cancel`: Cancela el token pendiente.
- `POST /:id/expire`: Marca el token como expirado.
- `GET /:id/cooldown`: Consulta cuánto tiempo falta para solicitar uno nuevo.
- `GET /:type/:value`: (ADMIN) Busca un cliente por `documento` o `telefono`.

---

## 📊 ESTADÍSTICAS Y REPORTES
Base Path: `/api/v1/stats`

### ESTADÍSTICAS GENERALES (Dashboard)
`GET /dashboard`

### LISTADO DE CLIENTES (Paginado)
`GET /clients?page=1&limit=20&search=carlos&estado=true`

### DETALLE DE CLIENTE (Completo)
`GET /clients/:id`

### VER TOKEN EN TEXTO PLANO (Admin)
`GET /tokens/:tokenId`

---

## 🛠️ MISCELÁNEOS
### ESTADO DEL SISTEMA
`GET /api/v1/status`

---

## 📱 WHATSAPP QR (Solo Admin)

### 1. Obtener y Mostrar el QR
`POST /api/v1/auth/qr/generate`
- **Descripción**: Obtiene el estado de conexión de WhatsApp y el QR actual.
- **Respuesta:**
    ```json
    {
        "status": "connecting",
        "has_qr": true,
        "qr": "data:image/png;base64,iVBORw0KGgoAAAANSU...",
        "message": "Escanee el QR para conectar"
    }
    ```
- **Integración para el Cliente (Frontend)**: La propiedad `"qr"` incluye la imagen en sí misma en formato **Base64** (`data:image/png;base64,...`). Para que tu cliente lo muestre en su interfaz web, solo tiene que inyectar este texto directamente en el atributo `src` de una etiqueta de imagen HTML clásica, sin necesidad de librerías extra:
  ```html
  <img src="response.qr" alt="Código QR de WhatsApp" />
  ```

### 2. Desvincular WhatsApp
`POST /api/v1/auth/qr/invalidate`
- **Descripción**: Invalida la sesión remotamente. Este endpoint debe ser llamado cuando tu cliente quiera desconectar el número actual o cambiar de cuenta de WhatsApp. Esto eliminará las credenciales almacenadas internamente en tu servidor y volverá a generar un código nuevo la próxima vez que el cliente consulte `/api/v1/auth/qr/generate`.

### 3. Vista Directa en Navegador
`GET /api/v1/auth/qr/image`
- **Descripción**: Redirige o sirve el código QR decodificado directamente como imagen PNG al navegador. Útil si aún no tienen frontend y solo quieren escanear abriendo una pestaña.

