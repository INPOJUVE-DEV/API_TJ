# API_TJ — Codex Context Loader

Este directorio contiene el grafo textual de contexto para `API_TJ`. Su objetivo es reducir tokens, evitar prompts largos y permitir que Codex cargue solo los archivos necesarios según la tarea.

## Reglas de uso

1. No cargar todo el repositorio por defecto.
2. Cargar primero este archivo.
3. Después cargar únicamente los mapas relevantes por módulo.
4. Si una tarea modifica seguridad, autenticación, integración o datos personales, cargar también `07-security-invariants.md`.
5. Si una tarea toca contrato HTTP, cargar `02-route-surface.yaml`.

## Carga por tipo de tarea

### Auth pública

Cargar:

- `01-runtime-map.yaml`
- `02-route-surface.yaml`
- `03-auth-permissions.yaml`
- `07-security-invariants.md`
- `src/routes/auth.js`
- `src/controllers/authController.js`
- `src/middleware/rateLimiters.js`
- `src/middleware/noStore.js`

### Admin / usuarios

Cargar:

- `01-runtime-map.yaml`
- `02-route-surface.yaml`
- `03-auth-permissions.yaml`
- `07-security-invariants.md`
- `src/routes/adminUsers.js`
- `src/controllers/adminUsersController.js`
- `src/middleware/adminAuth.js`
- `src/middleware/authorizeRole.js`

### Integración Sys_IPJ / sistemas externos

Cargar:

- `01-runtime-map.yaml`
- `02-route-surface.yaml`
- `04-integration-surface.yaml`
- `05-domain-entities.yaml`
- `06-data-flow-sys-ipj.yaml`
- `07-security-invariants.md`
- `src/routes/cardholders.js`
- `src/routes/beneficiariosStaging.js`
- `src/middleware/integrationAuth.js`
- `src/middleware/integrationClientRateLimit.js`
- `src/middleware/integrationSurfaceGuard.js`

### Beneficiarios staging

Cargar:

- `02-route-surface.yaml`
- `04-integration-surface.yaml`
- `05-domain-entities.yaml`
- `06-data-flow-sys-ipj.yaml`
- `07-security-invariants.md`
- `src/routes/beneficiariosStaging.js`
- `src/routes/adminBeneficiariosStaging.js`
- `src/controllers/beneficiariosStagingController.js`
- `src/controllers/adminBeneficiariosStagingController.js`

### QR / scanner

Cargar:

- `01-runtime-map.yaml`
- `02-route-surface.yaml`
- `03-auth-permissions.yaml`
- `05-domain-entities.yaml`
- `07-security-invariants.md`
- `src/routes/qr.js`
- controlador/servicio QR correspondiente

### Catálogos / lookups

Cargar:

- `02-route-surface.yaml`
- `05-domain-entities.yaml`
- `src/routes/catalog.js`
- `src/routes/adminLookups.js`
- controladores asociados

## Principio base

`API_TJ` no debe asumir propiedad completa de la base de datos de `Sys_IPJ`. La API debe operar como capa propia de autenticación, activación, tarjeta joven, staging e integración controlada, usando CURP y datos mínimos como vínculo entre sistemas.
