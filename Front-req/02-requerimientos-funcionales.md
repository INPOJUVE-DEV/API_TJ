# Requerimientos Funcionales

## Objetivo del MVP

La primera version debe permitir que personal interno opere el sistema sin Postman.

## Modulos obligatorios

### 1. Login admin

- Formulario con `email` o `username`.
- Campo `password`.
- Mensaje unico de error: `Credenciales invalidas`.
- Si ya existe token valido, redirigir a `dashboard`.
- Si la API responde `401`, limpiar sesion y volver a `login`.

### 2. Dashboard

Debe mostrar al menos:

- total de convenios,
- staging por estado,
- ultimo sync,
- usuarios admin y reader,
- usuarios bloqueados,
- integraciones fallidas en 24h,
- ultimo push de staging.

### 3. Convenios

UI de backoffice montada sobre `/api/v1/catalog`.

Funciones:

- listar,
- buscar,
- filtrar por categoria,
- filtrar por municipio,
- crear,
- editar,
- eliminar.

### 4. Usuarios internos

Funciones:

- listar con paginacion,
- buscar por nombre o correo,
- filtrar por rol,
- filtrar por estatus,
- ver detalle,
- crear usuario,
- editar usuario,
- resetear password.

### 5. Beneficiarios staging

Funciones:

- listar con paginacion,
- buscar por `external_request_id`,
- filtrar por estatus,
- ver detalle,
- ver intentos de push,
- ejecutar push manual si el rol es `admin`.

## Modulos fuera del MVP

No se deben construir en esta primera entrega:

- CRUD de clientes de integracion,
- vista de auditoria consolidada,
- padron sincronizado,
- trabajo offline real,
- refresh token,
- flujo Auth0 ciudadano.

## Requisitos UX

- Navegacion principal por sidebar.
- Responsive para desktop y tablet.
- Confirmacion antes de acciones destructivas.
- Estados vacios claros.
- Estados de error legibles para personal operativo.
- Indicador visible de rol del usuario.

## Criterios de aceptacion funcional

- `admin` puede entrar, ver dashboard y operar convenios.
- `reader` puede entrar, pero no debe ver botones de alta, edicion o eliminacion.
- `admin` puede consultar staging y disparar push.
- `reader` puede consultar staging, pero no empujar.
- `admin` puede crear, editar y resetear password de usuarios internos.
