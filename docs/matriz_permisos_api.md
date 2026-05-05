# Matriz de Permisos API_TJ

Este documento define que identidad puede consumir cada endpoint del API y que frontera de seguridad lo protege.

Objetivo:

- evitar escalamiento de privilegios entre beneficiario, backoffice e integraciones
- dejar explicito que rutas son publicas, cuales son de sesion app, cuales son solo admin y cuales son solo sistema-a-sistema
- reducir errores de integracion en frontend al distinguir rutas publicas de aliases internos

## Identidades

| Identidad | Tipo de token | Uso esperado |
|---|---|---|
| Beneficiario | JWT app con `token_type=user` | app ciudadana |
| Admin | JWT admin con `token_type=admin` | backoffice |
| Reader | JWT admin con `token_type=admin` | backoffice de consulta |
| Scanner | JWT app con `token_type=user` y rol `scanner` | flujo QR |
| Unidad Informatica | JWT RS256 con `scope` | integracion sistema-a-sistema |
| Sys_IPJ | JWT RS256 con `scope` | sync de padron |

## Fronteras de seguridad

| Frontera | Implementacion |
|---|---|
| Sesion beneficiario | `src/middleware/auth.js` valida JWT app con `issuer/audience` publicos y `token_type=user` |
| Sesion admin | `src/middleware/adminAuth.js` valida JWT admin con `issuer/audience` admin y `token_type=admin` |
| Roles app/admin | `src/middleware/authorizeRole.js` revalida rol, estado y `session_version` en DB |
| Integraciones | `src/middleware/integrationAuth.js` exige RS256, `kid`, `iss`, `aud`, `scope` y anti-replay por `jti` |
| Separacion de firmas | `src/config/tokenConfig.js` usa `JWT_SECRET` para app publica y `ADMIN_JWT_SECRET` para admin |

## Matriz por endpoint

### Salud

| Endpoint | Metodo | Acceso permitido | Observaciones |
|---|---|---|---|
| `/health` | `GET` | publico | solo healthcheck |

### Beneficiario

| Endpoint | Metodo | Acceso permitido | Observaciones |
|---|---|---|---|
| `/api/v1/auth/login` | `POST` | publico | crea sesion beneficiario |
| `/api/v1/auth/refresh` | `POST` | cookie refresh beneficiario | no usa token admin |
| `/api/v1/auth/logout` | `POST` | cookie refresh beneficiario | invalida refresh actual |
| `/api/v1/auth/forgot-password` | `POST` | publico | respuesta generica |
| `/api/v1/auth/reset-password` | `POST` | publico con token reset | invalida sesiones previas |
| `/api/v1/me` | `GET` | `admin`, `reader`, `scanner`, `beneficiary` | perfil del sujeto autenticado |
| `/api/v1/catalog` | `GET` | `admin`, `reader`, `beneficiary` | lectura compartida |
| `/api/v1/catalog/:id` | `GET` | `admin`, `reader`, `beneficiary` | lectura compartida |
| `/api/v1/cardholders/verify-activation` | `POST` | publico | valida `tarjeta_numero + curp` |
| `/api/v1/cardholders/complete-activation` | `POST` | publico con ventana valida | crea cuenta beneficiario |

### Admin Backoffice

| Endpoint | Metodo | Acceso permitido | Observaciones |
|---|---|---|---|
| `/api/v1/admin/auth/login` | `POST` | publico | crea sesion admin |
| `/api/v1/admin/auth/logout` | `POST` | `admin`, `reader` con token admin | invalida `session_version` |
| `/api/v1/admin/auth/session` | `GET` | `admin`, `reader` con token admin | sesion backoffice |
| `/api/v1/admin/session` | `GET` | `admin`, `reader` con token admin | alias interno de sesion |
| `/api/v1/admin/dashboard` | `GET` | `admin`, `reader` con token admin | tablero |
| `/api/v1/admin/lookups` | `GET` | `admin`, `reader` con token admin | catalogos de apoyo |
| `/api/v1/admin/users` | `GET` | `admin`, `reader` con token admin | listado de usuarios internos |
| `/api/v1/admin/users/:id` | `GET` | `admin`, `reader` con token admin | detalle de usuario interno |
| `/api/v1/admin/users` | `POST` | `admin` con token admin | alta de usuarios internos |
| `/api/v1/admin/users/:id` | `PATCH` | `admin` con token admin | cambio de rol/estado |
| `/api/v1/admin/users/:id/set-password` | `POST` | `admin` con token admin | reset administrativo |
| `/api/v1/admin/beneficiarios-staging` | `GET` | `admin`, `reader` con token admin | bandeja staging |
| `/api/v1/admin/beneficiarios-staging/:id` | `GET` | `admin`, `reader` con token admin | detalle staging |
| `/api/v1/admin/beneficiarios-staging/:id/attempts` | `GET` | `admin`, `reader` con token admin | auditoria de pushes |
| `/api/v1/admin/beneficiarios-staging/:id/push` | `POST` | `admin` con token admin | push manual a Sys_IPJ |

### Integraciones

| Endpoint | Metodo | Acceso permitido | Observaciones |
|---|---|---|---|
| `/api/v1/cardholders/lookup` | `POST` | `unidad_informatica` con `cardholders.lookup` | RS256 + scope |
| `/api/v1/cardholders/sync` | `POST` | `sys_ipj` con `cardholders.sync` | RS256 + scope |
| `/api/v1/beneficiarios-staging` | `POST` | `unidad_informatica` con `beneficiarios.staging.create` | RS256 + scope |

### Operacion interna protegida

| Endpoint | Metodo | Acceso permitido | Observaciones |
|---|---|---|---|
| `/api/v1/beneficiarios-staging` | `GET` | `admin` con token admin | alias interno; preferir ruta `/admin/...` |
| `/api/v1/beneficiarios-staging/expired` | `DELETE` | `admin` con token admin | limpieza operativa |
| `/api/v1/beneficiarios-staging/:id/push` | `POST` | `admin` con token admin | alias interno; preferir ruta `/admin/...` |
| `/api/v1/qr/scan` | `POST` | `scanner` o `admin` | no permitido a beneficiario |

### Legacy retirado

| Endpoint | Metodo | Acceso permitido | Observaciones |
|---|---|---|---|
| `/api/v1/register` | `POST` | ninguno operativo | responde `410` |
| `/api/v1/register/register` | `POST` | ninguno operativo | responde `410` |
| `/api/v1/auth/otp/send` | `POST` | ninguno operativo | responde `410` |
| `/api/v1/auth/otp/verify` | `POST` | ninguno operativo | responde `410` |
| `/api/v1/cardholders/:curp/account` | `POST` | ninguno operativo | responde `410` |

## Reglas que no deben romperse

1. Un token de beneficiario nunca debe abrir una ruta `/api/v1/admin/*`.
2. Un token de integracion nunca debe reutilizarse como sesion humana.
3. Las rutas de escritura administrativa deben exigir `verifyAdminToken` y rol `admin`.
4. Las rutas sistema-a-sistema deben exigir `requireIntegrationScope(...)`; no deben aceptar JWT de app.
5. `ADMIN_JWT_SECRET` debe ser distinto de `JWT_SECRET` en produccion.
6. El frontend beneficiario no debe consumir aliases internos de staging ni rutas `/api/v1/admin/*`.

## Checklist operativo

- Configurar `JWT_SECRET` y `ADMIN_JWT_SECRET` distintos en produccion.
- Configurar `FRONTEND_ORIGIN` y `ADMIN_FRONTEND_ORIGIN` con dominios separados.
- No compartir almacenamiento de tokens entre frontend beneficiario y backoffice.
- Mantener pruebas automatizadas para:
  - beneficiario -> admin `401/403`
  - integracion -> admin `403`
  - beneficiario -> rutas de escritura admin `401/403`
  - reader -> lectura admin `200` y escritura admin `403`
