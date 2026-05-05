# Beneficiario Local Auth

Paquete completo para que el equipo de frontend implemente el flujo ciudadano con autenticacion local de `API_TJ`.

## Objetivo

Este paquete cubre:

- login local del beneficiario
- refresh token por cookie `httpOnly`
- logout
- activacion local por `tarjeta_numero + curp`
- recuperacion de contrasena
- contratos exactos del API
- manejo de errores, estados y reintentos
- checklist de integracion y QA

## Orden recomendado de lectura

1. [01-resumen-ejecutivo.md](./01-resumen-ejecutivo.md)
2. [02-contratos-api.md](./02-contratos-api.md)
3. [03-flujos-y-sesion.md](./03-flujos-y-sesion.md)
4. [04-ajustes-de-pantallas.md](./04-ajustes-de-pantallas.md)
5. [05-snippets-de-integracion.md](./05-snippets-de-integracion.md)
6. [06-checklist-qa-y-release.md](./06-checklist-qa-y-release.md)
7. [07-autenticacion-beneficiario-local.md](./07-autenticacion-beneficiario-local.md)

## Fuente de verdad

Este paquete fue alineado con la implementacion actual en:

- [src/routes/auth.js](../../src/routes/auth.js)
- [src/controllers/authController.js](../../src/controllers/authController.js)
- [src/controllers/cardholderController.js](../../src/controllers/cardholderController.js)
- [src/controllers/userController.js](../../src/controllers/userController.js)
- [src/services/userSessionService.js](../../src/services/userSessionService.js)

`07-autenticacion-beneficiario-local.md` se conserva como resumen operativo corto y complemento del paquete.

## Decision clave

El frontend ciudadano ya no debe depender de Auth0.

El contrato vigente es:

- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/logout`
- `POST /api/v1/auth/forgot-password`
- `POST /api/v1/auth/reset-password`
- `POST /api/v1/cardholders/verify-activation`
- `POST /api/v1/cardholders/complete-activation`
- `GET /api/v1/me`
- `GET /api/v1/catalog`
- `GET /api/v1/catalog/:id`
