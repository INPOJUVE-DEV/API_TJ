# Backend API - Tarjeta Joven

API Node.js + Express + MySQL para Tarjeta Joven.

Mantiene:

- autenticacion local separada para beneficiarios y backoffice
- integraciones RS256 por cliente y scope
- staging cifrado de beneficiarios
- push manual a Sys_IPJ

## Caracteristicas clave

- Padron minimo en `cardholders_sync`; los flujos nuevos usan `curp_hash`.
- Beneficiarios con autenticacion local propia:
  - `login`
  - `refresh` por cookie `httpOnly`
  - `forgot-password`
  - `reset-password`
  - activacion local por `tarjeta_numero + curp`
- Admin con login tradicional en DB por `/api/v1/admin/auth/login`.
- Integraciones sistema-a-sistema con JWT RS256, `kid`, scopes y anti-replay por `jti`.
- Staging temporal cifrado con `AES-256-GCM`.

## Variables de entorno principales

| Variable | Descripcion | Valor sugerido |
|----------|-------------|----------------|
| `PORT` | Puerto del API. | `8080` |
| `FRONTEND_ORIGIN` | Origen permitido del frontend beneficiario. | `http://localhost:3000` |
| `ADMIN_FRONTEND_ORIGIN` | Origen permitido del frontend admin. | `http://localhost:5173` |
| `DB_URI` | Conexion MySQL. | `mysql://user:pass@host:3306/tarjeta_joven` |
| `JWT_SECRET` | Clave para JWT local. | Cadena larga y aleatoria |
| `ADMIN_JWT_SECRET` | Clave dedicada para tokens de admin. Debe ser distinta de `JWT_SECRET`. | Cadena larga y aleatoria |
| `JWT_EXPIRATION` | Vida del access token publico. | `15m` |
| `ADMIN_JWT_EXPIRATION` | Vida del token admin. | `8h` |
| `REFRESH_TOKEN_TTL_DAYS` | Vigencia del refresh token publico. | `7` |
| `REFRESH_TOKEN_COOKIE_NAME` | Nombre de la cookie refresh. | `tj_refresh_token` |
| `PASSWORD_RESET_TOKEN_TTL_MINUTES` | Vida del token de reset. | `15` |
| `PASSWORD_RESET_URL_BASE` | URL frontend para pantalla de reset. | `https://tu-frontend/reset-password` |
| `CURP_HASH_SECRET` | Secreto HMAC-SHA-256 para `curp_hash`. | Cadena larga y aleatoria |
| `FIELD_ENCRYPTION_KEY` | Llave de cifrado para staging. | 32 bytes base64/hex o cadena larga |
| `FIELD_ENCRYPTION_ALGORITHM` | Algoritmo de cifrado soportado. | `aes-256-gcm` |
| `INTEGRATION_JWT_AUDIENCE` | `aud` esperado en JWT RS256 de integracion. | `api_tj` |
| `SYS_IPJ_JWT_PUBLIC_KEY` | Llave publica de `sys_ipj`. | PEM publico |
| `INFORMATICA_JWT_PUBLIC_KEY` | Llave publica de `unidad_informatica`. | PEM publico |
| `STAGING_TTL_DAYS` | Retencion operativa de staging. | `30` |

## Ejecucion local

```bash
npm install
npm run dev
```

Con Docker:

```bash
docker compose up -d --build
```

## Base de datos y seed

```bash
npm run seed
# o
npm run db:ensure
```

`scripts/seed.js` es idempotente y asegura, entre otras, estas tablas:

- `usuarios`
- `cardholders_sync`
- `refresh_tokens`
- `password_reset_tokens`
- `beneficiario_staging`
- `integration_jti_log`
- `integration_audit_log`

Datos demo principales:

| Alias | Email | Password | Rol |
|-------|-------|----------|-----|
| Ana | `ana.hernandez@example.com` | `Test1234!` | `admin` |
| Carlos | `carlos.lopez@example.com` | `Secret456!` | `beneficiary` |
| Maria | `maria.soto@example.com` | `Password789!` | `reader` |

## Flujos principales

### Beneficiario

- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/logout`
- `POST /api/v1/auth/forgot-password`
- `POST /api/v1/auth/reset-password`
- `GET /api/v1/me`
- `GET /api/v1/catalog`
- `GET /api/v1/catalog/highlights`
- `POST /api/v1/cardholders/verify-activation`
- `POST /api/v1/cardholders/complete-activation`

### Admin

- `POST /api/v1/admin/auth/login`
- `POST /api/v1/admin/auth/logout`
- `GET /api/v1/admin/session`

### Integraciones

- `POST /api/v1/cardholders/sync`
- `POST /api/v1/cardholders/lookup`
- `POST /api/v1/beneficiarios-staging`

## Seguridad y privacidad

- Las contrasenas nuevas se almacenan con `argon2id`.
- En produccion el backoffice debe usar `ADMIN_JWT_SECRET` separado de `JWT_SECRET`.
- Los hashes `bcrypt` existentes siguen funcionando y se rehashean automaticamente en login exitoso.
- El refresh token publico es opaco, se guarda solo como hash SHA-256 y rota en cada `refresh`.
- Las rutas administrativas sensibles aceptan solo token `admin`; un token de beneficiario o de integracion no puede reutilizarse alli.
- Ningun flujo nuevo usa `cardholders.curp` para lookup o activacion.
- `CURP` solo viaja como `curp_hash` o `curp_masked` fuera de validacion puntual.
- El staging sigue cifrado con `AES-256-GCM`.

## Pruebas

```bash
npm test
```

La suite cubre:

- integraciones RS256
- login admin
- flujo local del beneficiario
- activacion local
- refresh rotation y reuse detection
- forgot/reset password

## Documentacion util

- [docs/beneficiario_endpoints_actualizacion.md](./docs/beneficiario_endpoints_actualizacion.md)
- [docs/05-endpoint-beneficios-nuevos.md](./docs/05-endpoint-beneficios-nuevos.md)
- [docs/matriz_permisos_api.md](./docs/matriz_permisos_api.md)
- [Front-req/07-autenticacion-beneficiario-local.md](./Front-req/07-autenticacion-beneficiario-local.md)
- [docs/manual_unidad_informatica_consumo_api.md](./docs/manual_unidad_informatica_consumo_api.md)
- [docs/admin_console_spec.md](./docs/admin_console_spec.md)
