# Especificacion de consola admin para API_TJ

## 1. Objetivo

Definir una consola web de administracion para `API_TJ` que permita operar los procesos internos sin afectar los flujos externos ya existentes.

La consola debe cubrir estos dominios:

1. `Convenios`: en el backend actual la entidad equivalente es `beneficios`.
2. `Usuarios internos`: administradores y lectores del sistema.
3. `Padron sync`: registros de `cardholders_sync`.
4. `Staging de beneficiarios`: expedientes pendientes, enviados, rechazados o con error.
5. `Integraciones`: clientes RS256, llaves activas y auditoria de llamadas.

## 2. Alcance y supuestos

### Incluye

- Login interno para personal administrativo.
- Pantallas para consulta y modificacion de convenios.
- Pantallas para consulta y administracion de usuarios internos.
- Pantallas operativas para sync, staging y auditoria.
- Contratos frontend-backend para una SPA admin.
- Cambios requeridos en API y base de datos para soportar la consola.

### No incluye

- Rediseno de la app movil del beneficiario.
- Reemplazo del flujo Auth0 para usuarios finales.
- Automatizacion total de los procesos manuales con Sys_IPJ.

### Decisiones base

1. El login de la consola admin sera interno y separado del flujo Auth0 del ciudadano.
2. Las rutas de integracion externa actuales no deben romperse.
3. La consola admin debe consumir un namespace nuevo para operaciones internas: `/api/v1/admin/*`.
4. Para no frenar el arranque, `beneficios` se mostrara en UI como `Convenios`.

## 3. Roles y permisos

### MVP recomendado

| Rol actual | Acceso a consola | Uso |
|------------|------------------|-----|
| `admin` | Completo | CRUD, push staging, usuarios, integraciones, auditoria |
| `reader` | Solo lectura | Consulta dashboard, convenios, staging, sync, auditoria |
| `scanner` | No | Se mantiene para flujos QR, no para backoffice |

### Extension recomendada a futuro

Si se requiere mas granularidad, conviene extender `usuarios.role` para soportar:

- `admin`
- `operator`
- `auditor`
- `scanner`

Para el MVP no es obligatorio; con `admin` y `reader` alcanza para arrancar.

## 4. Mapa de interfaz

| Ruta UI | Modulo | Rol minimo | Objetivo principal |
|---------|--------|------------|--------------------|
| `/login` | Acceso | publico | Iniciar sesion admin |
| `/dashboard` | Resumen | `reader` | Ver pendientes, errores y actividad reciente |
| `/convenios` | Convenios | `reader` | Buscar y consultar convenios |
| `/convenios/nuevo` | Convenios | `admin` | Crear convenio |
| `/convenios/:id` | Convenios | `reader` | Ver detalle |
| `/convenios/:id/editar` | Convenios | `admin` | Editar convenio |
| `/usuarios` | Usuarios internos | `reader` | Listar y filtrar usuarios |
| `/usuarios/:id` | Usuarios internos | `reader` | Ver detalle y actividad |
| `/usuarios/nuevo` | Usuarios internos | `admin` | Alta manual |
| `/padron-sync` | Padron | `reader` | Consultar `cardholders_sync` |
| `/staging` | Beneficiarios staging | `reader` | Gestionar cola operativa |
| `/staging/:id` | Beneficiarios staging | `reader` | Ver expediente desencriptado con mascara |
| `/integraciones` | Clientes externos | `admin` | Ver clientes, scopes, llaves y estado |
| `/auditoria` | Auditoria | `reader` | Ver auditoria de sync, staging e integraciones |
| `/catalogos` | Catalogos base | `admin` | Consultar municipios y categorias para formularios |

## 5. Flujo de login y sesion

## 5.1 Login admin interno

Pantalla:

- Campo `email`
- Campo `password`
- Boton `Entrar`
- Mensaje generico ante error: `Credenciales invalidas`

Contrato recomendado:

`POST /api/v1/auth/login`

Request:

```json
{
  "username": "ana.hernandez@example.com",
  "password": "Test1234!"
}
```

Respuesta actual:

```json
{
  "accessToken": "...",
  "refreshToken": "..."
}
```

Respuesta recomendada para la consola:

```json
{
  "accessToken": "...",
  "refreshToken": "...",
  "user": {
    "id": 1,
    "email": "ana.hernandez@example.com",
    "role": "admin",
    "status": "active",
    "nombreCompleto": "Ana Hernandez Ruiz"
  }
}
```

## 5.2 Sesion vigente

Contrato recomendado:

`GET /api/v1/admin/session`

Respuesta:

```json
{
  "authenticated": true,
  "user": {
    "id": 1,
    "email": "ana.hernandez@example.com",
    "role": "admin",
    "status": "active",
    "permissions": [
      "dashboard.read",
      "convenios.write",
      "users.write",
      "staging.push",
      "integrations.write"
    ]
  }
}
```

Nota: hoy existe `GET /api/v1/me`, pero no devuelve `role`, `status` ni permisos de backoffice. Para la consola hace falta ampliar ese contrato o crear `/admin/session`.

## 5.3 Refresh de sesion

Contrato nuevo recomendado:

`POST /api/v1/auth/refresh`

Request:

```json
{
  "refreshToken": "..."
}
```

Respuesta:

```json
{
  "accessToken": "...",
  "refreshToken": "..."
}
```

Sin este endpoint, la consola tendra sesiones fragiles porque hoy solo existe login y logout.

## 5.4 Logout

Se reutiliza:

`POST /api/v1/auth/logout`

## 6. Modulos de la consola

## 6.1 Dashboard

Widgets recomendados:

1. Expedientes staging por estado: `pending`, `accepted`, `rejected`, `error`.
2. Ultimos pushes a Sys_IPJ.
3. Ultimos syncs desde `sys_ipj`.
4. Total de convenios activos.
5. Total de usuarios internos por rol.
6. Ultimas llamadas de integracion fallidas.

Contrato nuevo recomendado:

`GET /api/v1/admin/dashboard`

Respuesta:

```json
{
  "staging": {
    "pending": 8,
    "accepted": 102,
    "rejected": 5,
    "error": 2
  },
  "sync": {
    "lastRunAt": "2026-04-26T19:20:00.000Z",
    "lastStatus": "success",
    "processed": 120
  },
  "catalog": {
    "benefits": 42
  },
  "users": {
    "admins": 2,
    "readers": 4,
    "blocked": 1
  },
  "cardholders": {
    "total": 120,
    "withAccount": 48
  },
  "integration": {
    "failedCallsLast24h": 3
  }
}
```

## 6.2 Convenios

En backend actual ya existe CRUD de `beneficios`; solo hay que mapearlo a una UI de backoffice.

Pantalla lista:

- Busqueda por nombre
- Filtros por categoria y municipio
- Paginacion
- Acciones: ver, editar, eliminar

Pantalla formulario:

- `nombre`
- `descripcion`
- `categoriaId` o `categoria`
- `municipioId` o `municipio`
- `descuento`
- `direccion`
- `horario`
- `lat`
- `lng`

Contratos disponibles ya:

- `GET /api/v1/catalog`
- `GET /api/v1/catalog/:id`
- `POST /api/v1/catalog`
- `PUT /api/v1/catalog/:id`
- `DELETE /api/v1/catalog/:id`

Cambio recomendado:

- Agregar `GET /api/v1/admin/lookups?include=municipios,categorias` para poblar combos sin hardcode.

Catalogos base ya administrables:

- `GET /api/v1/admin/lookups`
- `GET /api/v1/admin/lookups/:lookup`
- `GET /api/v1/admin/lookups/:lookup/:id`
- `POST /api/v1/admin/lookups/:lookup`
- `PATCH /api/v1/admin/lookups/:lookup/:id`
- `DELETE /api/v1/admin/lookups/:lookup/:id`

Donde `:lookup` puede ser:

- `categorias`
- `municipios`

Payload de alta y edicion:

```json
{
  "nombre": "Restaurantes"
}
```

## 6.3 Usuarios internos

La consola necesita administrar la tabla `usuarios`, pero hoy el API solo expone `GET /me`.

Pantalla lista:

- Filtros por `email`, `role`, `status`
- Ver fecha de alta
- Acciones: ver, editar, bloquear, activar, resetear password

Pantalla detalle:

- Datos basicos
- Rol
- Estado
- Vinculo con `cardholder_sync_id` si existe
- Ultimo acceso

Contratos nuevos requeridos:

- `GET /api/v1/admin/users?page=1&pageSize=20&q=ana&role=admin&status=active`
- `POST /api/v1/admin/users`
- `GET /api/v1/admin/users/:id`
- `PATCH /api/v1/admin/users/:id`
- `POST /api/v1/admin/users/:id/set-password`

Payload recomendado de alta:

```json
{
  "nombre": "Ana",
  "apellidos": "Hernandez Ruiz",
  "email": "ana.hernandez@example.com",
  "telefono": "4441234567",
  "municipioId": 1,
  "role": "admin",
  "status": "active",
  "password": "Test1234!"
}
```

Payload recomendado de edicion:

```json
{
  "nombre": "Ana",
  "apellidos": "Hernandez Ruiz",
  "telefono": "4441234567",
  "municipioId": 1,
  "role": "reader",
  "status": "blocked"
}
```

## 6.4 Padron sync

La consola no debe crear ciudadanos manualmente en el padron sincronizado; ese padron sigue viniendo de Sys_IPJ. Pero si conviene tener consulta operativa.

Pantalla lista:

- Busqueda por `tarjeta_numero`
- Filtro por `status`
- Filtro por `sync_source`
- Ver si tiene cuenta vinculada

Pantalla detalle:

- `curp_masked`
- `tarjeta_numero`
- `status`
- `synced_at`
- `account_user_id`
- `auth0_user_id`

Contratos nuevos requeridos:

- `GET /api/v1/admin/cardholders-sync?page=1&pageSize=20&status=active&q=TJ-0001`
- `GET /api/v1/admin/cardholders-sync/:id`

Contrato opcional si se requiere correccion manual:

- `PATCH /api/v1/admin/cardholders-sync/:id/status`

Recomendacion: si se habilita ese `PATCH`, debe quedar fuertemente auditado y limitado a `admin`.

## 6.5 Beneficiarios staging

Ya existe operacion base, pero falta detalle y mejor filtrado para backoffice.

Contratos disponibles ya:

- `GET /api/v1/beneficiarios-staging?status=pending`
- `POST /api/v1/beneficiarios-staging/:id/push`
- `DELETE /api/v1/beneficiarios-staging/expired?dryRun=true`

Contratos nuevos requeridos:

- `GET /api/v1/admin/beneficiarios-staging?page=1&pageSize=20&status=pending&q=REQ-2026-001`
- `GET /api/v1/admin/beneficiarios-staging/:id`
- `GET /api/v1/admin/beneficiarios-staging/:id/attempts`

Respuesta recomendada de detalle:

```json
{
  "id": 14,
  "external_request_id": "REQ-2026-001",
  "status": "pending",
  "curp_masked": "HE***01",
  "submitted_by_system": "unidad_informatica",
  "submitted_at": "2026-04-26T18:00:00.000Z",
  "sent_at": null,
  "resolved_at": null,
  "error_message": null,
  "payload": {
    "nombre": "Ana",
    "apellido_paterno": "Hernandez",
    "apellido_materno": "Ruiz",
    "fecha_nacimiento": "2002-01-01",
    "sexo": "M",
    "discapacidad": false,
    "id_ine": "*****1234",
    "telefono": "***4567",
    "domicilio": {
      "calle": "Av. Reforma",
      "numero_ext": "120",
      "numero_int": null,
      "colonia": "Centro",
      "municipio_id": 1,
      "codigo_postal": "78000",
      "seccional": "0012"
    }
  }
}
```

Regla: la UI solo debe mostrar el payload desencriptado a `admin` y con mascaras sobre PII sensible.

## 6.6 Integraciones

Hoy existen tablas y validacion runtime para `service_clients`, `service_client_keys` e `integration_audit_log`, pero no hay CRUD admin.

Pantalla lista:

- Cliente
- Estado
- Scopes permitidos
- `key_id_current`
- Ultimo uso

Pantalla detalle:

- Llaves activas e inactivas
- Vigencia
- IP allowlist
- Historial de llamadas

Contratos nuevos requeridos:

- `GET /api/v1/admin/service-clients`
- `POST /api/v1/admin/service-clients`
- `GET /api/v1/admin/service-clients/:id`
- `PATCH /api/v1/admin/service-clients/:id`
- `GET /api/v1/admin/service-clients/:id/keys`
- `POST /api/v1/admin/service-clients/:id/keys`
- `PATCH /api/v1/admin/service-client-keys/:keyId`
- `GET /api/v1/admin/integration-audit`

Payload recomendado para crear cliente:

```json
{
  "client_code": "unidad_informatica",
  "name": "Unidad de Informatica",
  "status": "active",
  "allowed_scopes": [
    "cardholders.lookup",
    "beneficiarios.staging.create"
  ],
  "ip_allowlist": [
    "187.210.10.20"
  ],
  "key_id_current": "unidad_informatica-current"
}
```

Payload recomendado para alta de llave:

```json
{
  "kid": "unidad_informatica-2026-05",
  "public_key": "-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----",
  "status": "active",
  "valid_from": "2026-05-01T00:00:00.000Z",
  "valid_until": null
}
```

## 6.7 Auditoria

La consola debe unificar tres vistas:

1. `sync_audit_log`
2. `integration_audit_log`
3. `staging_push_attempts`

Contratos nuevos requeridos:

- `GET /api/v1/admin/sync-audit`
- `GET /api/v1/admin/integration-audit`
- `GET /api/v1/admin/staging-push-attempts`

## 7. Contratos ya reutilizables

| Metodo | Endpoint | Uso en consola |
|--------|----------|----------------|
| `POST` | `/api/v1/auth/login` | Login interno |
| `POST` | `/api/v1/auth/logout` | Cierre de sesion |
| `GET` | `/api/v1/me` | Perfil basico del usuario actual |
| `GET` | `/api/v1/catalog` | Lista de convenios |
| `GET` | `/api/v1/catalog/:id` | Detalle de convenio |
| `POST` | `/api/v1/catalog` | Alta de convenio |
| `PUT` | `/api/v1/catalog/:id` | Edicion de convenio |
| `DELETE` | `/api/v1/catalog/:id` | Baja de convenio |
| `GET` | `/api/v1/beneficiarios-staging` | Lista de staging por estado |
| `POST` | `/api/v1/beneficiarios-staging/:id/push` | Envio manual a Sys_IPJ |
| `DELETE` | `/api/v1/beneficiarios-staging/expired` | Limpieza operativa |

## 8. Contratos nuevos requeridos en API

| Metodo | Endpoint | Motivo |
|--------|----------|--------|
| `POST` | `/api/v1/auth/refresh` | Renovar sesion admin |
| `GET` | `/api/v1/admin/session` | Obtener rol, estado y permisos |
| `GET` | `/api/v1/admin/dashboard` | Resumen operativo |
| `GET` | `/api/v1/admin/lookups` | Catalogos base para formularios |
| `GET` | `/api/v1/admin/lookups/:lookup` | Lista un catalogo base |
| `GET` | `/api/v1/admin/lookups/:lookup/:id` | Detalle de item de catalogo |
| `POST` | `/api/v1/admin/lookups/:lookup` | Alta de item de catalogo |
| `PATCH` | `/api/v1/admin/lookups/:lookup/:id` | Edicion de item de catalogo |
| `DELETE` | `/api/v1/admin/lookups/:lookup/:id` | Baja de item de catalogo |
| `GET` | `/api/v1/admin/users` | Administrar usuarios internos |
| `POST` | `/api/v1/admin/users` | Alta de usuarios internos |
| `GET` | `/api/v1/admin/users/:id` | Detalle de usuario |
| `PATCH` | `/api/v1/admin/users/:id` | Edicion y bloqueo |
| `POST` | `/api/v1/admin/users/:id/set-password` | Reset de password |
| `GET` | `/api/v1/admin/cardholders-sync` | Consulta de padron |
| `GET` | `/api/v1/admin/cardholders-sync/:id` | Detalle de registro sync |
| `GET` | `/api/v1/admin/beneficiarios-staging/:id` | Ver payload desencriptado |
| `GET` | `/api/v1/admin/beneficiarios-staging/:id/attempts` | Ver reintentos de push |
| `GET` | `/api/v1/admin/service-clients` | Gestion de clientes externos |
| `POST` | `/api/v1/admin/service-clients` | Alta de cliente externo |
| `PATCH` | `/api/v1/admin/service-clients/:id` | Cambios de status, scopes e IPs |
| `GET` | `/api/v1/admin/service-clients/:id/keys` | Ver llaves registradas |
| `POST` | `/api/v1/admin/service-clients/:id/keys` | Rotacion de llave |
| `PATCH` | `/api/v1/admin/service-client-keys/:keyId` | Revocar o inactivar llave |
| `GET` | `/api/v1/admin/sync-audit` | Historial de sync |
| `GET` | `/api/v1/admin/integration-audit` | Historial de llamadas externas |
| `GET` | `/api/v1/admin/staging-push-attempts` | Historial de pushes manuales |

## 9. Cambios requeridos en backend

## 9.1 Nuevos routers y controladores

Agregar al menos:

- `src/routes/adminAuth.js` o ampliacion de `auth.js`
- `src/routes/adminUsers.js`
- `src/routes/adminDashboard.js`
- `src/routes/adminLookups.js`
- `src/routes/adminServiceClients.js`
- `src/routes/adminAudit.js`
- `src/routes/adminCardholdersSync.js`

## 9.2 Cambios de autenticacion

Requeridos:

1. Endpoint de refresh.
2. Sesion enriquecida con `role`, `status` y permisos.
3. Validacion explicita de `usuarios.status = active` antes de emitir token.

Recomendacion de seguridad:

- Mantener `accessToken` corto.
- Mover `refreshToken` a cookie `httpOnly` si la consola va a operar en produccion publica.

## 9.3 Cambios de datos

Cambios minimos recomendados:

- Agregar `last_login_at` a `usuarios`.
- Agregar `created_by` y `updated_by` a `beneficios`.
- Agregar tabla `admin_activity_log` para trazabilidad de cambios internos.

DDL sugerido:

```sql
ALTER TABLE usuarios
  ADD COLUMN last_login_at DATETIME NULL;

ALTER TABLE beneficios
  ADD COLUMN created_by INT NULL,
  ADD COLUMN updated_by INT NULL;

CREATE TABLE admin_activity_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  actor_user_id INT NOT NULL,
  entity_type VARCHAR(80) NOT NULL,
  entity_id VARCHAR(80) NOT NULL,
  action VARCHAR(80) NOT NULL,
  payload JSON NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (actor_user_id) REFERENCES usuarios(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

## 9.4 Cambios de permisos

El middleware `authorizeRole` actual funciona para `admin` y `reader`, pero la consola necesita estandarizar permisos por modulo.

Opciones:

1. Corto plazo: seguir con roles simples y proteger rutas por rol.
2. Mediano plazo: agregar un mapa de permisos por rol en codigo o en base.

## 9.5 Cambios de observabilidad

Agregar trazabilidad para:

- login exitoso y fallido de admin,
- cambios en convenios,
- altas, bloqueos y reseteos de usuarios,
- cambios en clientes de integracion y rotacion de llaves,
- cambios manuales sobre `cardholders_sync`.

## 10. Orden sugerido de implementacion

### Fase 1: consola operativa minima

1. Login, logout y refresh.
2. Dashboard.
3. Convenios.
4. Lista y detalle de staging.
5. Push manual y vista de intentos.

### Fase 2: administracion interna

1. CRUD de usuarios.
2. Lookups de municipios y categorias.
3. Consulta de padron sync.

### Fase 3: seguridad y soporte

1. CRUD de clientes de integracion.
2. Rotacion de llaves.
3. Auditoria unificada.
4. `admin_activity_log`.

## 11. Resultado esperado

Con este alcance, la consola admin queda separada del flujo ciudadano y permite:

- administrar convenios desde UI,
- operar el staging de forma segura,
- consultar el padron sincronizado,
- manejar usuarios internos,
- controlar clientes de integracion y auditoria,
- crecer sin romper los endpoints externos ya documentados para USI y Sys_IPJ.
