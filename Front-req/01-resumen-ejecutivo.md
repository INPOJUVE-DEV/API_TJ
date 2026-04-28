# Resumen Ejecutivo

## Que se va a construir

Una **PWA administrativa en React** para operar el backoffice de `API_TJ`.

El frontend se conectara a una API backend ya preparada para:

- login admin interno,
- dashboard de indicadores,
- CRUD de convenios,
- consulta y gestion de usuarios internos,
- consulta y operacion de staging de beneficiarios.

## Lo que ya existe en backend

Ya estan implementados estos bloques:

- autenticacion admin con JWT propio,
- validacion de rol y estado,
- sesion enriquecida con permisos,
- dashboard admin,
- lookups de `municipios` y `categorias`,
- CRUD admin de usuarios internos,
- lista, detalle, intentos y push manual de staging,
- compatibilidad de token admin con `/api/v1/catalog`.

## Lo que frontend no tiene que resolver

- No debe construir refresh token.
- No debe inferir permisos desde el rol manualmente si puede leerlos desde sesion.
- No debe exponer PII completa.
- No debe consumir rutas legacy de auth para la consola admin.

## Decision de integracion

Frontend debe usar como contratos canonicos:

- `POST /api/v1/admin/auth/login`
- `GET /api/v1/admin/session`
- `POST /api/v1/admin/auth/logout`

El alias `GET /api/v1/admin/auth/session` existe, pero frontend debe preferir `GET /api/v1/admin/session`.

## Roles del MVP

| Rol | Acceso |
|-----|--------|
| `admin` | Escritura total en convenios, usuarios y push de staging |
| `reader` | Solo lectura en dashboard, convenios, usuarios y staging |
| `scanner` | Sin acceso a la consola |

## Recomendacion de stack

- `React`
- `Vite`
- `TypeScript`
- `React Router`
- `TanStack Query`
- `React Hook Form`
- `Zod`
- `MUI`
- `vite-plugin-pwa`
