# Backend API - Tarjeta Joven

API Node.js + Express + MySQL para Tarjeta Joven. Mantiene autenticacion local para usuarios internos y compatibilidad, y agrega el flujo nuevo de padron minimo sincronizado, staging cifrado de beneficiarios, push manual a Sys_IPJ y activacion con Auth0.

## Caracteristicas clave

- Padron minimo en `cardholders_sync`; los flujos nuevos usan `curp_hash` y no consultan `cardholders.curp`.
- Integraciones sistema-a-sistema con JWT RS256, `kid`, scopes, clientes separados y anti-replay por `jti`.
- Staging temporal de beneficiarios con payload cifrado AES-256-GCM.
- Push manual a Sys_IPJ con `external_request_id` como llave idempotente.
- Activacion de cuenta con Auth0: API_TJ valida el ID token por JWKS y guarda el vinculo local.
- Login local por email, QR, catalogo y roles internos se conservan para compatibilidad.

## Arquitectura rapida

| Componente | Descripcion |
|------------|-------------|
| `src/index.js` | Inicializa Express, CORS y monta rutas bajo `/api/v1`. |
| `src/routes/*` | Routers por dominio: `auth`, `user`, `catalog`, `register`, `cardholders`, `beneficiarios-staging`, `qr`. |
| `src/controllers/*` | Controladores de autenticacion, catalogo, cardholders, staging, QR y usuarios. |
| `src/services/*` | Hash CURP, cifrado, Auth0, auditoria, integracion RS256 y cliente Sys_IPJ. |
| `src/middleware/*` | JWT local, roles, rate limit y autenticacion de integracion. |
| `scripts/seed.js` | Asegura esquema, datos de prueba, clientes de integracion y backfill de `cardholders_sync`. |
| `tests/` | Pruebas Jest + Supertest. |

## Variables de entorno principales

| Variable | Descripcion | Valor sugerido |
|----------|-------------|----------------|
| `PORT` | Puerto del API. | `8080` |
| `FRONTEND_ORIGIN` | Origen permitido en CORS. | `http://localhost:3000` |
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | Credenciales MySQL. | Usa `db` en Docker. |
| `DB_URI` | Conexion MySQL en una sola cadena. | `mysql://user:pass@host:3306/tarjeta_joven` |
| `JWT_SECRET` | Clave para JWT local interno. | Cadena larga y aleatoria. |
| `JWT_EXPIRATION` | Vida del access token local. | `15m` |
| `CURP_HASH_SECRET` | Secreto HMAC-SHA-256 para `curp_hash`. | Cadena larga y aleatoria. |
| `FIELD_ENCRYPTION_KEY` | Llave de cifrado para staging. | 32 bytes base64/hex o cadena larga. |
| `FIELD_ENCRYPTION_ALGORITHM` | Algoritmo de cifrado. | `aes-256-gcm` |
| `INTEGRATION_JWT_AUDIENCE` | `aud` esperado en JWT RS256 de integracion. | `api_tj` |
| `INTEGRATION_RATE_WINDOW_MS` | Ventana de rate limit por cliente integrador y ruta. | `900000` |
| `INTEGRATION_RATE_MAX` | Maximo de llamadas por cliente integrador/ruta dentro de la ventana. | `300` |
| `SYS_IPJ_PUSH_URL` | Endpoint de Sys_IPJ para push manual. | URL de integracion. |
| `SYS_IPJ_JWT_PUBLIC_KEY` | Llave publica de `sys_ipj` para bootstrap automatico. | PEM publico. |
| `SYS_IPJ_JWT_KID` | `kid` activo de `sys_ipj`. | `sys_ipj-current` |
| `SYS_IPJ_ALLOWED_SCOPES` | Scopes permitidos para `sys_ipj`. | `["cardholders.sync"]` |
| `SYS_IPJ_IP_ALLOWLIST` | Allowlist opcional de IPs de `sys_ipj`. | `[]` |
| `INFORMATICA_JWT_PUBLIC_KEY` | Llave publica de `unidad_informatica` para bootstrap automatico. | PEM publico. |
| `INFORMATICA_JWT_KID` | `kid` activo de `unidad_informatica`. | `unidad_informatica-current` |
| `INFORMATICA_ALLOWED_SCOPES` | Scopes permitidos para `unidad_informatica`. | `["cardholders.lookup","beneficiarios.staging.create"]` |
| `INFORMATICA_IP_ALLOWLIST` | Allowlist opcional de IPs de `unidad_informatica`. | `[]` |
| `AUTH0_DOMAIN` | Dominio Auth0 usado como issuer. | `tu-tenant.us.auth0.com` |
| `AUTH0_CLIENT_ID` | Audience esperado del ID token Auth0. | Client ID de la app. |
| `STAGING_TTL_DAYS` | Retencion operativa de staging `pending`/`error`. | `30` |
| `OTP_DEBUG` | Variable legacy; OTP por CURP esta retirado. | `false` |
| `EXPOSE_PII` | Solo aplica a endpoints legacy; flujos nuevos no devuelven CURP completo. | `false` |
| `SEED_ON_START`, `ALLOW_PROD_SEED`, `SEED_*_PASSWORD` | Controlan seed automatico y passwords de datos demo. | Segun entorno. |

Las variables `BENEFICIARIOS_CACHE_*` quedan como compatibilidad legacy; los flujos nuevos usan staging y `SYS_IPJ_PUSH_URL`.
Si defines las llaves publicas de integracion, la API hace bootstrap automatico de `service_clients` y `service_client_keys` al arrancar, sin depender de `npm run seed`.

## Ejecucion local

```bash
npm install
npm run dev
```

Necesitas MySQL accesible y variables `.env` configuradas. Con Docker:

```bash
docker compose up -d --build
```

## Base de datos y seed

```bash
npm run seed
# o
npm run db:ensure
```

`scripts/seed.js` es idempotente y crea, entre otras, las tablas `cardholders_sync`, `beneficiario_staging`, `sync_audit_log`, `service_clients`, `service_client_keys`, `integration_jti_log` y `staging_push_attempts`. Tambien hace backfill controlado desde los tarjetahabientes de ejemplo hacia `cardholders_sync`.

Para simular inyeccion de padron por integracion:

```bash
npm run fixture:cardholders-sync
npm run inject:cardholders-sync
```

El primer comando transforma `scripts/fixtures/cardholders-sync-source.sample.json` a un payload listo para `/api/v1/cardholders/sync` usando tu `CURP_HASH_SECRET`. El segundo genera un JWT RS256 temporal para `sys_ipj`, registra la llave publica en `service_client_keys` y envia el payload al API local.

Datos demo principales:

| Alias | Email | CURP legacy | Password | Rol |
|-------|-------|-------------|----------|-----|
| Ana | `ana.hernandez@example.com` | `HERL020101MSPNRZ01` | `Test1234!` | `admin` |
| Carlos | `carlos.lopez@example.com` | `LOMC990505HSPLPM02` | `Secret456!` | `reader` |
| Maria | `maria.soto@example.com` | `SOAM010910MSPSGR03` | `Password789!` | `reader` |

Tarjetahabientes sincronizados:

- `MELR000202MSPSRD06`: activo sin cuenta, util para lookup y activacion.
- `HERL020101MSPNRZ01`: activo con cuenta legacy asociada.
- `SAQP950101HSPQRP07`: inactivo.

## Flujos principales

### Autenticacion interna

- `POST /api/v1/auth/login`: login local por email y password.
- `POST /api/v1/auth/logout`: elimina refresh tokens.
- `POST /api/v1/auth/otp/send` y `/otp/verify`: flujo OTP retirado, responde `410 Gone`.

### Perfil

- `GET /api/v1/me`: requiere JWT local. Funciona con usuarios Auth0 porque usa `auth0_user_id` y `cardholder_sync_id`; no depende de CURP ni de `password_hash`.

### Integraciones

- `POST /api/v1/cardholders/sync`: requiere cliente `sys_ipj` con scope `cardholders.sync`. Hace upsert por `curp_hash`.
- `POST /api/v1/cardholders/lookup`: requiere cliente `unidad_informatica` con scope `cardholders.lookup`. Recibe CURP, calcula hash y responde solo `registered`, `message`, `folio_tarjeta`.
- `POST /api/v1/beneficiarios-staging`: requiere scope `beneficiarios.staging.create`. Valida expediente, cifra payload y crea staging `pending`.

Los JWT de integracion deben usar RS256, `kid`, `iss`, `sub`, `aud`, `iat`, `exp`, `jti` y `scope`. El `iss` debe coincidir con `service_clients.client_code`; `kid` debe existir en `service_client_keys`. Las llamadas autorizadas se auditan en `integration_audit_log` sin guardar cuerpos ni CURP.

### Administracion interna

- `GET /api/v1/beneficiarios-staging?status=pending`: requiere JWT local y rol `admin`; no devuelve payload sensible.
- `POST /api/v1/beneficiarios-staging/{id}/push`: requiere JWT local y rol `admin`; bloquea el registro, descifra payload, envia a Sys_IPJ y audita.
- `DELETE /api/v1/beneficiarios-staging/expired?dryRun=true`: requiere JWT local y rol `admin`; elimina solo `pending/error` expirados, sin lock y fuera de proceso.

### Activacion Auth0

- `POST /api/v1/cardholders/verify-activation`: valida `tarjeta_numero + curp` contra `cardholders_sync`.
- `POST /api/v1/cardholders/complete-activation`: recibe `tarjeta_numero` y `auth0_id_token`; exige una verificacion reciente de `tarjeta_numero + curp`, valida firma, issuer, audience `AUTH0_CLIENT_ID` y subject, y vincula `auth0_user_id`.
- `POST /api/v1/cardholders/{curp}/account`: flujo legacy retirado, responde `410 Gone`.
- `POST /api/v1/register`: flujo legacy retirado, responde `410 Gone`; el alta nueva debe entrar por staging.

## Seguridad y privacidad

- Ningun flujo nuevo debe usar `cardholders.curp` para lookup, matching o activacion.
- Lookup nunca devuelve nombres, domicilio, CURP completo ni `curp_masked`.
- Los logs nuevos pasan por sanitizacion para evitar CURP completo.
- `pending` y `error` pueden limpiarse por TTL solo si no estan bloqueados ni en proceso; `accepted` y `rejected` se conservan para auditoria.

## Pruebas

```bash
npm test
```

La suite cubre carga basica de API, endpoint legacy `410`, servicios de hash/cifrado/sanitizacion y validacion RS256 con `kid`, scope y `jti`.

## Deploy en Railway con MySQL

- El repo incluye `.env.example` para importar variables sugeridas y `railway.toml` para fijar `healthcheck`, `start` y `preDeploy`.
- El servicio escucha `process.env.PORT` y expone `GET /health`, que Railway usa para healthchecks.
- Para preparar esquema antes de levantar la API, Railway ejecuta `npm run railway:predeploy`.
- Si defines `INFORMATICA_JWT_PUBLIC_KEY` y/o `SYS_IPJ_JWT_PUBLIC_KEY`, el arranque hace upsert automatico de esos clientes de integracion en la base.
- La configuracion de base de datos soporta `DB_URI`, las variables nativas de Railway MySQL (`MYSQL_URL`, `MYSQLHOST`, `MYSQLPORT`, `MYSQLUSER`, `MYSQLPASSWORD`, `MYSQLDATABASE`) y tambien variables separadas `DB_*` / `TIDB_*`.
- Si usas Railway MySQL, puedes conectar el servicio y definir `DB_URI=${{MySQL.MYSQL_URL}}` o simplemente dejar disponible `MYSQL_URL`.
- Si el host parece de TiDB Cloud o si defines `TIDB_ENABLE_SSL=true`, el cliente activa TLS para `mysql2`.
- `CURP_HASH_SECRET` y `FIELD_ENCRYPTION_KEY` son obligatorios al arranque; define esos valores antes del primer deploy productivo y no los cambies despues.

Consulta `readme_postman.md` para ejemplos de payloads.
Para la Unidad de Informatica, revisa tambien `docs/manual_unidad_informatica_consumo_api.md`.
