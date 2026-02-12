# Guía de Conexión: pgAdmin 4 a Docker (PostgreSQL)

Para visualizar y gestionar los datos de tu base de datos desde **pgAdmin 4**, sigue estos pasos una vez que tu contenedor esté corriendo.

## 1. Requisitos Previos
Asegúrate de haber iniciado el sistema con:
```powershell
docker-compose up -d
```

## 2. Configuración en pgAdmin 4

1.  Abre pgAdmin 4 y haz clic derecho en **Servers** > **Register** > **Server...**
2.  En la pestaña **General**:
    - **Name**: `InformaPeru_DB` (o el nombre que prefieras).
3.  En la pestaña **Connection**:
    - **Host name/address**: `localhost`
    - **Port**: `5433`
    - **Maintenance database**: `core_validator_db`
    - **Username**: `api_manager`
    - **Password**: `api_secure_vault_2026` (Marca la casilla "Save password").
4.  En la pestaña **Parameters** (o SSL en versiones antiguas):
    - **SSL Mode**: Cámbialo a `Disable` (esto es importante porque Docker local no usa SSL por defecto).
5.  Haz clic en **Save**.

## 3. Solución de Problemas (FAQ)

*   **¿Por qué no conecta?**: Verifica en tu terminal que el contenedor esté arriba con `docker ps`. Si no aparece `informaperu_db`, revisa los logs.
*   **¿Puedo entrar desde afuera de Docker?**: Sí, gracias a que en el archivo `docker-compose.yml` mapeamos el puerto `"5432:5432"`, tu PC ve la base de datos como si estuviera instalada localmente.
*   **¿Cómo veo las tablas?**: Una vez conectado, navega por:
    `Servers` -> `InformaPeru_DB` -> `Databases` -> `informaperu_db` -> `Schemas` -> `public` -> `Tables`.

---
> [!IMPORTANT]
> Los datos de conexión (usuario/clave) son los mismos que definimos en tu archivo `.env` y `docker-compose.yml`. Si cambias uno, debes cambiar el otro.
