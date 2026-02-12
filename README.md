# 🚀 Proyecto: Validador de Clientes InformaPerú

Este proyecto es una herramienta automática (API) que sirve para registrar a miles de clientes y asegurarse de que sus números de teléfono son reales mediante un código de seguridad de 4 caracteres.

## 🏢 ¿Cómo está organizado el proyecto? (Explicación sencilla)

Para que el sistema no se desordene, lo hemos dividido en "oficinas" o carpetas, cada una con un trabajo específico:

### 1. `database/` (El Almacén de Datos)
*   **¿Qué es?**: Es el lugar donde guardamos los planos de las estanterías de nuestra bodega.
*   **En este proyecto**: Contiene el archivo `schema.sql`, que dice cómo deben ser las tablas (`CLIENTES`, `TOKENS`, etc.) para que quepan 2 millones de registros sin problemas.

### 2. `config/` (La Central Eléctrica)
*   **¿Qué es?**: Son los cables y enchufes que conectan el sistema con la energía (la base de datos).
*   **En este proyecto**: Aquí le decimos al sistema dónde está guardada la información y cómo entrar a ella de forma segura.

### 3. `models/` (Los Archivos de Oficina)
*   **¿Qué es?**: Define qué información lleva cada ficha de cliente.
*   **En este proyecto**: Decidimos que la ficha del cliente debe tener: DNI, celular, correo, etc. Si no existieran los "modelos", el sistema no sabría qué datos guardar ni cómo llamarlos.

### 4. `controllers/` (El Cerebro / Los Empleados)
*   **¿Qué es?**: Son los empleados que hacen el trabajo duro. Ellos reciben órdenes y deciden qué hacer.
*   **En este proyecto**: 
    - Un empleado recibe los datos del cliente y los guarda.
    - Otro genera el código de 4 dígitos.
    - Otro verifica si el código que escribió el cliente es correcto o si ya venció.

### 5. `routes/` (Las Puertas de Entrada)
*   **¿Qué es?**: Son las direcciones o "puertas" por donde el mundo exterior puede hablar con nuestra API.
*   - **Puerta 1 (Registro)**: `POST /v1/api/client` (Para guardar los datos del formulario).
*   - **Puerta 2 (Pedir Token)**: `POST /v1/api/client/:id/token` (Para pedir el código de 4 dígitos).
*   - **Puerta 3 (Validar)**: `GET /v1/api/client/:id/verify/:token` (Para confirmar que el código es correcto).
*   - **Puerta 4 (Salud)**: `GET /v1/api/status` (Para ver si el sistema está "despierto").

### 6. `utils/` (La Caja de Herramientas)
*   **¿Qué es?**: Son pequeñas herramientas que usamos muchas veces.
*   **En este proyecto**: Tenemos una herramienta que "fabrica" códigos al azar de 4 caracteres para que nadie pueda adivinarlos.

---

## 🚦 ¿Cómo sé si el sistema está funcionando bien?

Para ver que el sistema no se "canse" o se caiga mientras el simulador envía miles de datos:

1.  **Vigilancia por Docker**: Si usas Docker, puedes ver cuánta "fuerza" (memoria y procesador) está usando el sistema en tiempo real.
2.  **Logs (Bitácora)**: El sistema escribe cada paso que da. Si hay un error, lo verás inmediatamente en la pantalla negra (la consola).
3.  **Dashboard de Render**: Cuando lo subas a internet, Render te dará gráficas de colores que te avisan si la API está respondiendo rápido o si necesita más poder.

---

## 🛠️ ¿Cómo empezar?
Consulta el archivo `walkthrough.md` para las instrucciones técnicas de instalación.
