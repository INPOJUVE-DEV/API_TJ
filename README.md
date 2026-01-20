# Backend API - Tarjeta Joven

API de referencia para el programa Tarjeta Joven. Expone flujos de autenticacion (password y OTP), consulta de catalogos, registro de ciudadanos sin tarjeta fisica y vinculacion de tarjetas ya emitidas sobre Node.js + Express + MySQL.

## Caracteristicas clave

- Autenticacion basada en JWT con refresh tokens persistidos en `refresh_tokens`.
- Flujo OTP autodocumentado para QA local (el codigo se devuelve en la respuesta) y auditoria en `cardholder_audit_logs`.
- Registro multipart/form-data con validaciones reforzadas de CURP (incluyendo consistencia con la fecha de nacimiento y limite de edad de 29 años cumplidos al momento del tramite), direccion y campos personales. Los documentos adjuntos ya no son obligatorios.
- Catalogo de beneficios filtrable por municipio, categoria y texto libre.
- Script de seed que crea el esquema completo y datos de prueba consistentes.

## Arquitectura rapida

| Componente | Descripcion |
|------------|-------------|
| `src/index.js` | Inicializa Express, CORS y monta las rutas versionadas bajo `/api/v1`. |
| `src/config/db.js` | Pool MySQL (`mysql2/promise`) reutilizado por los controladores. |
| `src/routes/*` | Define routers por dominio (`auth`, `user`, `catalog`, `register`, `cardholders`). |
| `src/controllers/*` | Logica de cada flujo: tokens, OTP, catalogo, registro y cardholders. |
| `src/middleware/auth.js` | Middleware que valida JWT y expone `req.user`. |
| `scripts/seed.js` | Asegura el esquema y siembra municipios, categorias, beneficios, usuarios, cardholders y solicitudes. |
| `uploads/` | Carpeta default para adjuntos del registro (configurable via `UPLOADS_DIR`). |
| `tests/` | Base para pruebas Jest + Supertest. |

## Requisitos previos

- Node.js 22.x y npm 10.x (solo si ejecutaras fuera de Docker).
- Docker Desktop (o Docker Engine + Docker Compose v2) para usar el stack incluido.
- Instancia MySQL 8 si decides no usar el contenedor `db` del compose.

## Configuracion de variables de entorno

1. Copia el archivo de ejemplo: `cp .env.example .env`.
2. Ajusta los valores segun tu entorno (ver tabla). Si usas Docker apunta `DB_HOST=db`.
3. Define `JWT_SECRET` y `JWT_EXPIRATION` acorde a tus politicas.

| Variable | Descripcion | Valor sugerido |
|----------|-------------|----------------|
| `PORT` | Puerto del API. | `8080` |
| `FRONTEND_ORIGIN` | Origen permitido en CORS. | `http://localhost:3000` |
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | Credenciales MySQL. | Usa `db` y las credenciales del compose si estas en Docker. |
| `DB_URI` | Alternativa para definir la conexion en una sola cadena. | `mysql://user:pass@host:3306/tarjeta_joven` |
| `JWT_SECRET` | Clave para firmar tokens. | Cadena aleatoria y larga. |
| `JWT_EXPIRATION` | Tiempo de vida del access token. | `15m` (o lo que prefieras). |
| `UPLOADS_DIR` | Directorio donde se guardan los archivos subidos (multer). | `uploads/` |

## Ejecucion local (sin Docker)

```bash
npm install
npm run dev
```

Necesitas un servidor MySQL accesible y las variables del `.env` apuntando a dicha instancia.

## Deploy en Render (sin Docker)

- El filesystem es efimero: no asumas que `uploads/` persiste entre deploys/restarts.
- Recomendado: usar storage externo (S3 / Cloudflare R2) y guardar solo la URL/metadata en la BD.
- Alternativa: usar Render Disk y apuntar `UPLOADS_DIR` a un path persistente, por ejemplo `UPLOADS_DIR=/data/uploads`.

## Ejecucion con Docker

1. Asegura que `.env` exista en la raiz.
2. Levanta los servicios:

   ```bash
   docker compose up -d --build
   ```

3. Verifica el estado (`docker compose ps`) y sigue logs cuando lo necesites (`docker compose logs -f api`).
4. Para apagar el stack: `docker compose down` (agrega `-v` si quieres borrar el volumen `db_data`).

## Base de datos y datos de ejemplo

`scripts/seed.js` crea todas las tablas (`usuarios`, `cardholders`, `solicitudes_registro`, `beneficios`, `otp_codes`, etc.) y carga catalogos + casos de prueba.

```bash
npm run seed
# o si el stack Docker ya esta corriendo
docker compose exec api node scripts/seed.js
```

El script es idempotente y usa las credenciales del `.env`. Cuentas y recursos precargados:

| Alias | Email | CURP | Password | Municipio | Telefono |
|-------|-------|------|----------|-----------|----------|
| Ana | `ana.hernandez@example.com` | `HERL020101MBCNRZ01` | `Test1234!` | Tijuana | 6641234567 |
| Carlos | `carlos.lopez@example.com` | `LOMC990505HBCLPM02` | `Secret456!` | Mexicali | 6869876543 |
| Maria | `maria.soto@example.com` | `SOAM010910MBCSGR03` | `Password789!` | Ensenada | 6465551122 |

Tarjetahabientes relevantes:

- `MELR000202MBCSRD06`: activo sin cuenta (usa este para probar `lookup` + `account`).
- `HERL020101MBCNRZ01`: activo con cuenta (responde `409` en lookup).
- `SAQP950101HBCQRP07`: tarjeta inactiva (responde `404`).

Solicitudes iniciales (`solicitudes_registro`): `SAQF030415MBCSLQ04` (pending) y `CATL021102HBCCMT05` (approved).

## Flujos expuestos y forma de invocarlos

Todos los endpoints estan versionados bajo `/api/v1`. A continuacion un resumen; revisa `readme_postman.md` para los payloads completos y scripts de pruebas.

### Autenticacion estandar

- `POST /auth/login` recibe `{ "username": "<email o curp>", "password": "<password>" }` y regresa `accessToken` + `refreshToken`.
- `POST /auth/logout` (Bearer token) elimina los refresh tokens asociados.

```bash
curl -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"ana.hernandez@example.com","password":"Test1234!"}'
```

### Autenticacion con OTP

- `POST /auth/otp/send` genera un codigo de 6 digitos valido por 5 minutos y lo devuelve en la respuesta.
- `POST /auth/otp/verify` valida `curp` + `otp` y emite tokens nuevos.

### Perfil de usuario

- `GET /me` requiere `Authorization: Bearer <accessToken>` y devuelve nombre, apellidos, CURP, email, municipio y telefono.

### Catalogo de beneficios

- `GET /catalog` admite filtros `municipio`, `categoria`, `q` y paginacion (`page`, `pageSize`). Responde con `{ items, total, totalPages }`.

### Vinculacion de tarjeta fisica

- `POST /cardholders/lookup`: valida CURP, aplica rate limit (5 intentos en 15 minutos) y abre una ventana de 15 minutos para crear cuenta (`pending_account_until`).
- `POST /cardholders/{curp}/account`: crea un usuario usando los datos del cardholder si la ventana sigue vigente y el username cumple el regex (`^[A-Za-z0-9._-]{4,50}$`).

### Registro de ciudadanos sin tarjeta

- `POST /register` (alias `POST /register/register`) recibe multipart/form-data con los campos personales. Los archivos `ine`, `comprobante` y `curpDoc` son ahora opcionales y no se requieren para crear la solicitud; si se envian, se siguen eliminando cuando ocurre un error de validacion.

## Probar el API con Postman

Consulta `readme_postman.md` para la guia paso a paso: configuracion de entorno, scripts de tests y dataset de referencia que coincide con `scripts/seed.js`.

## Scripts utiles

- `npm run dev`: modo desarrollo con recarga automatica (`nodemon`).
- `npm start`: arranque en modo produccion (el comando usado por el contenedor `api`).
- `npm test`: ejecuta Jest con la base mockeada.
- `npm run seed`: crea/actualiza las tablas minimas y datos de ejemplo.

## Endpoints principales

Todos los endpoints estan versionados bajo `/api/v1`:

- `POST /auth/login`
- `POST /auth/logout`
- `POST /auth/otp/send`
- `POST /auth/otp/verify`
- `GET /me`
- `GET /catalog`
- `POST /register`
- `POST /cardholders/lookup`
- `POST /cardholders/{curp}/account`

> Mantener `readme_postman.md` junto a tu coleccion exportada ayuda a documentar respuestas, variables y datos de prueba compartidos con el equipo.
