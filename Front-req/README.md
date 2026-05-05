# Front-req

Paquete de documentacion para entregar al equipo de frontend del backoffice admin de `API_TJ`.

## Objetivo

Dar al equipo de frontend todo lo necesario para construir la PWA admin sin tener que recorrer el backend completo:

- alcance funcional,
- contratos API reales ya implementados,
- reglas de sesion y seguridad,
- mapa de rutas y permisos,
- checklist de entrega.

## Orden recomendado de lectura

1. [01-resumen-ejecutivo.md](./01-resumen-ejecutivo.md)
2. [02-requerimientos-funcionales.md](./02-requerimientos-funcionales.md)
3. [03-contratos-api-admin.md](./03-contratos-api-admin.md)
4. [04-flujos-ux-y-permisos.md](./04-flujos-ux-y-permisos.md)
5. [05-arquitectura-frontend-sugerida.md](./05-arquitectura-frontend-sugerida.md)
6. [06-checklist-entrega.md](./06-checklist-entrega.md)

## Fuente de verdad

Los documentos `01` a `06` reflejan el backend admin implementado.

La documentacion del flujo ciudadano/beneficiarios ya no vive aqui.
Ahora esta separada en:

- [Front-beneficiarios](../Front-beneficiarios/README.md)

Referencias internas utiles:

- [docs/admin_pwa_requirements.md](../docs/admin_pwa_requirements.md)
- [docs/admin_console_spec.md](../docs/admin_console_spec.md)
- [src/routes/adminAuth.js](../src/routes/adminAuth.js)
- [src/routes/adminSession.js](../src/routes/adminSession.js)
- [src/routes/adminDashboard.js](../src/routes/adminDashboard.js)
- [src/routes/adminUsers.js](../src/routes/adminUsers.js)
- [src/routes/adminBeneficiariosStaging.js](../src/routes/adminBeneficiariosStaging.js)

## Nota importante

La documentacion vieja proponia refresh token para la consola admin. El backend actual **no usa refresh token** para admin.

El contrato vigente es:

- login por `POST /api/v1/admin/auth/login`
- sesion por `GET /api/v1/admin/session`
- logout por `POST /api/v1/admin/auth/logout`
- token unico `Bearer` con expiracion de `8h`
