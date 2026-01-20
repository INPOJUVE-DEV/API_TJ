# Deploy en Render (sin Docker)

Esta guía describe cómo desplegar este API Node/Express en Render como **Web Service** (sin Docker) y cómo ejecutar el seed contra una base **MySQL externa**.

## 1) Prerrequisitos

- Una base MySQL accesible desde Internet (Render no provee MySQL administrado).
- Credenciales de MySQL (idealmente usando `DB_URI`).

Ejemplo de `DB_URI`:

```text
mysql://USER:PASSWORD@HOST:3306/tarjeta_joven
```

## 2) Crear el Web Service (Node)

1. En Render: **New** → **Web Service** → conecta tu repo.
2. Runtime: **Node**.
3. Build Command:

   ```bash
   npm ci
   ```

4. Start Command:

   ```bash
   npm start
   ```

Notas:
- Render inyecta `PORT` automáticamente; el server ya escucha `process.env.PORT`.
- Verificación rápida: `GET /health` responde `200 { ok: true }`.

## 3) Variables de entorno (Environment)

Configura estas variables en Render (Dashboard → Service → Environment):

- `DB_URI` (recomendado) o bien `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`.
- `JWT_SECRET` (obligatoria).
- `JWT_EXPIRATION` (opcional, ejemplo `15m`).
- `FRONTEND_ORIGIN` (opcional, para CORS).

Uploads (si usas adjuntos en `/register`):

- `UPLOADS_DIR` (opcional, default `uploads/`).

## 4) Uploads en Render (sin Docker)

El filesystem por defecto en Render es efímero. Para producción:

- Recomendado: subir archivos a storage externo (S3 / Cloudflare R2) y guardar URL/metadata en la DB.
- Alternativa: usar **Render Disk** y apuntar `UPLOADS_DIR` a un path persistente.

Ejemplo con Render Disk:

1. Agrega un Disk al servicio montado en `/data`.
2. Define `UPLOADS_DIR=/data/uploads`.

## 5) Ejecutar el seed contra MySQL externa

El seed crea/actualiza el esquema y carga datos de prueba:

```bash
node scripts/seed.js
```

### Opción A: Ejecutarlo desde Render (Shell)

1. Despliega el servicio al menos una vez.
2. En Render → tu servicio → **Shell**.
3. Ejecuta:

```bash
node scripts/seed.js
```

El script usa las variables de entorno del servicio (incluyendo `DB_URI`/`DB_HOST...`).

### Opción B: Ejecutarlo desde tu máquina local

Con las mismas variables que usarías en Render:

```bash
DB_URI="mysql://USER:PASSWORD@HOST:3306/tarjeta_joven" node scripts/seed.js
```

En Windows PowerShell:

```powershell
$env:DB_URI="mysql://USER:PASSWORD@HOST:3306/tarjeta_joven"; node scripts/seed.js
```

## 6) Troubleshooting

- Si Render no puede conectar a MySQL: revisa allowlist/firewall, usuario/password y que el host acepte conexiones remotas.
- Si ves problemas con uploads: confirma `UPLOADS_DIR` y permisos del Disk (`/data/uploads`).

