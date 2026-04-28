# Flujos UX y Permisos

## Mapa de rutas UI

| Ruta | Modulo | Rol minimo |
|------|--------|------------|
| `/login` | Acceso admin | Publica |
| `/dashboard` | Indicadores | `reader` |
| `/convenios` | Lista de convenios | `reader` |
| `/convenios/nuevo` | Alta de convenio | `admin` |
| `/convenios/:id` | Detalle convenio | `reader` |
| `/convenios/:id/editar` | Edicion convenio | `admin` |
| `/usuarios` | Lista de usuarios | `reader` |
| `/usuarios/nuevo` | Alta de usuario | `admin` |
| `/usuarios/:id` | Detalle usuario | `reader` |
| `/usuarios/:id/editar` | Edicion usuario | `admin` |
| `/staging` | Lista de staging | `reader` |
| `/staging/:id` | Detalle staging | `reader` |

## Flujos obligatorios

### 1. Inicio de sesion

1. Usuario captura credenciales.
2. Front llama `POST /api/v1/admin/auth/login`.
3. Guarda `accessToken`.
4. Guarda el objeto de sesion en estado global.
5. Redirige a `/dashboard`.

### 2. Rehidratacion al recargar

1. Si existe token persistido en `sessionStorage`, cargarlo.
2. Llamar `GET /api/v1/admin/session`.
3. Si responde `200`, reconstruir estado.
4. Si responde `401`, limpiar token y mandar a `/login`.

### 3. Logout

1. Usuario confirma logout.
2. Front llama `POST /api/v1/admin/auth/logout`.
3. Limpia token y estado local aun si la API falla.
4. Redirige a `/login`.

### 4. CRUD de convenios

1. Cargar `lookups` antes del formulario.
2. Mostrar errores de validacion del backend si llegan `422`.
3. Al crear o editar, volver a lista o detalle y refrescar cache.

### 5. Operacion de staging

1. Lista con filtros por estado y busqueda por `external_request_id`.
2. Detalle con metadatos y payload solo si el usuario es `admin`.
3. Boton `Push manual` solo visible para `admin`.
4. Tras un push, recargar detalle e intentos.

## Reglas de permisos en UI

### `reader`

- Puede navegar a dashboard, convenios, usuarios y staging.
- No debe ver botones de `Crear`, `Editar`, `Eliminar`, `Reset password` ni `Push manual`.
- En detalle de staging no debe ver payload sensible.

### `admin`

- Puede ver y ejecutar todo lo del MVP.
- Puede ver payload en staging ya enmascarado.

## Estados de error recomendados

- `401`: mostrar aviso breve de sesion expirada y regresar a login.
- `403`: mostrar estado `No tienes permisos para esta accion`.
- `404`: mostrar `Registro no encontrado`.
- `409`: mostrar error de negocio del backend tal como llega.
- `422`: mapear mensajes a formulario.
- `500`: mostrar fallback general y permitir reintento.

## Componentes base sugeridos

- `AppShell`
- `Sidebar`
- `Topbar`
- `ProtectedRoute`
- `RoleGuard`
- `PageHeader`
- `StatsCard`
- `DataTable`
- `StatusBadge`
- `SearchFilters`
- `ConfirmDialog`
- `ErrorState`
- `EmptyState`
