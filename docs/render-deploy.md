# Deploy en Render (sin Docker)

Esta guia describe como desplegar este API Node/Express en Render como **Web Service** (sin Docker) y como usar MySQL:
- Opcion A: MySQL en Render (auto-gestionado con Private Service + Disk).
- Opcion B: MySQL externa.

## 1) Prerrequisitos

- Credenciales de MySQL (idealmente usando `DB_URI`).

Ejemplo de `DB_URI`:

```text
mysql://USER:PASSWORD@HOST:3306/tarjeta_joven
```

## 2) Opcion A: MySQL en Render (Private Service)

Render no ofrece MySQL administrado, pero puedes correr MySQL como **Private Service** con un Disk persistente.

1. En Render: **New** -> **Private Service**.
2. Runtime: **Docker**.
3. Image: `mysql:8.0`.
4. Agrega un Disk y montalo en `/var/lib/mysql`.
5. Variables de entorno del servicio MySQL:

   - `MYSQL_ROOT_PASSWORD`
   - `MYSQL_DATABASE=tarjeta_joven`
   - `MYSQL_USER=usuario`
   - `MYSQL_PASSWORD=password`

6. Guarda el **Internal Hostname** que muestra Render para este servicio (lo usaras como `DB_HOST`).

Notas:
- Usa un plan y region compatible con tu Web Service para que la red privada funcione.
- Este MySQL es auto-gestionado: tu eres responsable de respaldos y mantenimiento.

## 3) Opcion B: MySQL externa

- Asegura que el host acepte conexiones remotas desde Render.
- Si hay firewall/allowlist, agrega los egress IPs de Render o desactiva restricciones por IP.

## 4) Crear el Web Service (Node)

1. En Render: **New** -> **Web Service** y conecta tu repo.
2. Runtime: **Node**.
3. Build Command:

   ```bash
   npm ci
   ```

4. Start Command:

   ```bash
   npm run start:render
   ```

Notas:
- Render inyecta `PORT` automaticamente; el server ya escucha `process.env.PORT`.
- Verificacion rapida: `GET /health` responde `200 { ok: true }`.
- `start:render` ejecuta el seed solo si la BD esta vacia y `SEED_ON_START` lo permite (en produccion el default es `false`).

## 5) Variables de entorno (Environment)

Configura estas variables en Render (Dashboard -> Service -> Environment):

- `DB_URI` (recomendado) o bien `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`.
- `JWT_SECRET` (obligatoria).
- `JWT_EXPIRATION` (opcional, ejemplo `15m`).
- `FRONTEND_ORIGIN` (opcional, para CORS).
- `SEED_ON_START` (opcional, default `false` en produccion). Usa `true` para habilitar el seed automatico.
- `ALLOW_PROD_SEED` (opcional, default `false`). Requiere `true` para ejecutar `scripts/seed.js` en produccion.
- `SEED_*_PASSWORD` (opcional). Passwords para los usuarios/solicitudes del seed.

Uploads (si usas adjuntos en `/register`):

- `UPLOADS_DIR` (opcional, default `uploads/`).

Si usas MySQL en Render (Opcion A):
- `DB_HOST`: Internal Hostname del Private Service MySQL.
- `DB_PORT`: `3306`.
- `DB_USER`, `DB_PASSWORD`, `DB_NAME`: los mismos que configuraste en el servicio MySQL.

## 6) Uploads en Render (sin Docker)

El filesystem por defecto en Render es efimero. Para produccion:

- Recomendado: subir archivos a storage externo (S3 / Cloudflare R2) y guardar URL/metadata en la DB.
- Alternativa: usar **Render Disk** y apuntar `UPLOADS_DIR` a un path persistente.

Ejemplo con Render Disk:

1. Agrega un Disk al servicio montado en `/data`.
2. Define `UPLOADS_DIR=/data/uploads`.

## 7) Ejecutar el seed contra MySQL

El seed crea/actualiza el esquema y carga datos de prueba.
Si usas `start:render`, el seed se ejecuta automaticamente solo cuando no hay datos y `SEED_ON_START=true`.
En produccion tambien necesitas `ALLOW_PROD_SEED=true` y definir `SEED_*_PASSWORD`.

Manual (opcional):

```bash
node scripts/seed.js
```

### Opcion A: Ejecutarlo desde Render (Shell)

1. Despliega el servicio al menos una vez.
2. En Render -> tu servicio -> **Shell**.
3. Ejecuta:

```bash
node scripts/seed.js
```

El script usa las variables de entorno del servicio (incluyendo `DB_URI`/`DB_HOST...`).

### Opcion B: Ejecutarlo desde tu maquina local

Con las mismas variables que usarias en Render:

```bash
DB_URI="mysql://USER:PASSWORD@HOST:3306/tarjeta_joven" node scripts/seed.js
```

En Windows PowerShell:

```powershell
$env:DB_URI="mysql://USER:PASSWORD@HOST:3306/tarjeta_joven"; node scripts/seed.js
```

## 8) Troubleshooting

- Si Render no puede conectar a MySQL: revisa allowlist/firewall, usuario/password y que el host acepte conexiones remotas.
- Si ves problemas con uploads: confirma `UPLOADS_DIR` y permisos del Disk (`/data/uploads`).
