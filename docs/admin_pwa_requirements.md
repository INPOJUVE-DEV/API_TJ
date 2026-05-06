# Requerimientos PWA Admin para API_TJ

## 1. Objetivo

Definir un MVP de interfaz administrativa para `API_TJ` que permita operar visualmente el sistema desde una PWA en React, con enfoque en:

- administracion de convenios-beneficios,
- acceso interno con control por rol,
- monitoreo operativo mediante indicadores,
- operacion segura de staging y procesos internos.

Este documento complementa [docs/admin_console_spec.md](./admin_console_spec.md), que ya describe los contratos backend recomendados. Aqui se aterriza la solucion desde producto, UX, frontend y despliegue.

## 2. Propuesta ejecutiva

La opcion mas rapida y sostenible es una **PWA en React con Vite**, separada del backend actual y consumiendo la API bajo `/api/v1` y `/api/v1/admin`.

### Por que esta opcion

- Permite construir rapido un backoffice moderno sin tocar la app del beneficiario.
- Puede desplegarse como SPA/PWA ligera en el mismo dominio o subdominio.
- Facilita login interno, dashboard, tablas CRUD y vistas de auditoria.
- Permite crecer por fases sin rehacer el backend existente.

## 3. Objetivos del MVP

El MVP debe resolver estas necesidades reales desde el primer release:

1. Iniciar sesion como usuario interno con rol `admin` o `reader`.
2. Consultar un dashboard con indicadores operativos.
3. Administrar convenios mediante CRUD grafico.
4. Consultar staging de beneficiarios y ejecutar push manual.
5. Consultar usuarios internos y su estado.
6. Mantener una sesion estable y segura para trabajo administrativo diario.

## 4. Usuarios y roles

### Roles base

| Rol | Acceso | Uso esperado |
|-----|--------|--------------|
| `admin` | Completo | CRUD, configuracion, push manual, usuarios, integraciones |
| `reader` | Solo lectura | Dashboard, consulta de convenios, staging, auditoria |
| `scanner` | Sin acceso a esta PWA | Se mantiene fuera del backoffice |

### Reglas operativas

- Un `reader` nunca puede crear, editar o eliminar informacion.
- Un `admin` puede ejecutar acciones sensibles solo desde pantallas protegidas.
- Los modulos deben ocultar acciones no permitidas, no solo deshabilitarlas visualmente.

## 5. Alcance funcional

## 5.1 Modulo de acceso

### Incluye

- Pantalla `Login`.
- Persistencia de sesion.
- Renovacion de token.
- Cierre de sesion.
- Validacion de permisos al cargar la app.

### Requerimientos

- Formulario con `email` y `password`.
- Mensaje generico ante error.
- Redireccion automatica a `/dashboard` si ya existe sesion valida.
- Cierre de sesion automatico cuando la sesion expire y no pueda renovarse.

## 5.2 Dashboard

### Objetivo

Dar una vista rapida del estado operativo del sistema.

### Widgets MVP

- Convenios activos totales.
- Expedientes staging por estado.
- Ultimo push a `Sys_IPJ`.
- Ultimo sync de `cardholders_sync`.
- Usuarios internos por rol y estado.
- Integraciones fallidas en ultimas 24 horas.

### Interacciones

- Cada tarjeta debe poder llevar al modulo relacionado.
- Los indicadores deben mostrar fecha/hora de ultima actualizacion.

## 5.3 Convenios

Este modulo consume el CRUD actual de `beneficios`, presentado en UI como `Convenios`.

### Pantalla lista

- Busqueda por nombre o descripcion.
- Filtro por categoria.
- Filtro por municipio.
- Paginacion.
- Acciones: ver, editar, eliminar.

### Pantalla alta/edicion

- `nombre`
- `descripcion`
- `categoria`
- `municipio`
- `descuento`
- `direccion`
- `horario`
- `lat`
- `lng`

### Validaciones frontend

- Campos obligatorios claramente marcados.
- Coordenadas opcionales, pero validadas si se capturan.
- Prevencion de doble envio.
- `categoria` y `municipio` deben salir de catalogos administrables, no de texto libre.

## 5.4 Usuarios internos

### Pantalla lista

- Busqueda por nombre o correo.
- Filtro por rol.
- Filtro por estado.
- Fecha de alta.
- Ultimo acceso.

### Pantalla detalle

- Datos personales basicos.
- Rol.
- Estado.
- Municipio.
- Identificadores internos relevantes.

### Acciones admin

- Crear usuario.
- Editar datos basicos.
- Cambiar rol.
- Bloquear o activar.
- Restablecer password.

## 5.5 Beneficiarios staging

### Pantalla lista

- Filtro por estado.
- Busqueda por `external_request_id`.
- Orden por fecha de envio o alta.
- Estado visual claro: `pending`, `accepted`, `rejected`, `error`.

### Pantalla detalle

- Metadatos del expediente.
- Payload con mascaras sobre PII sensible.
- Historial de intentos de push.
- Estado de bloqueo o procesamiento.

### Acciones admin

- Ejecutar push manual a `Sys_IPJ`.
- Consultar resultado del ultimo intento.

## 5.6 Integraciones

Este modulo puede entrar como fase 2 o 3, pero conviene dejarlo contemplado desde el diseño.

### Vista minima recomendada

- Lista de clientes de integracion.
- Estado.
- Scopes.
- `kid` activo.
- Ultimo uso.

### Acciones futuras

- Alta o bloqueo de cliente.
- Rotacion de llave.
- Consulta de auditoria por cliente.

## 5.7 Auditoria e indicadores

### Vista unificada

- Ultimos intentos de staging.
- Ultimas llamadas de integracion.
- Ultimos eventos de sincronizacion.

### Filtros

- Rango de fechas.
- Tipo de evento.
- Estatus.
- Actor.

## 6. Alcance tecnico frontend

## 6.1 Stack recomendado

- `React 18`
- `Vite`
- `TypeScript`
- `React Router`
- `TanStack Query`
- `React Hook Form`
- `Zod`
- `Workbox` o plugin PWA de Vite
- `MUI`, `Ant Design` o `shadcn/ui` segun preferencia del equipo

### Recomendacion concreta para arrancar rapido

Para velocidad de entrega, recomiendo:

- `React + Vite + TypeScript`
- `React Router`
- `TanStack Query`
- `React Hook Form + Zod`
- `MUI`
- `vite-plugin-pwa`

Esta combinacion reduce tiempo en tablas, formularios, modales, layout responsivo y accesibilidad base.

## 6.2 Estructura sugerida

```text
admin-app/
  src/
    app/
    components/
    features/
      auth/
      dashboard/
      convenios/
      users/
      staging/
      integrations/
      audit/
    hooks/
    lib/
    routes/
    services/
    types/
```

## 6.3 Rutas sugeridas

| Ruta | Modulo | Proteccion |
|------|--------|------------|
| `/login` | Acceso | Publica |
| `/dashboard` | Indicadores | `reader` |
| `/convenios` | CRUD convenios | `reader` |
| `/convenios/nuevo` | Alta convenio | `admin` |
| `/convenios/:id` | Detalle convenio | `reader` |
| `/convenios/:id/editar` | Edicion convenio | `admin` |
| `/usuarios` | Usuarios internos | `reader` |
| `/usuarios/nuevo` | Alta usuario | `admin` |
| `/usuarios/:id` | Detalle usuario | `reader` |
| `/staging` | Lista staging | `reader` |
| `/staging/:id` | Detalle staging | `reader` |
| `/integraciones` | Clientes externos | `admin` |
| `/auditoria` | Eventos operativos | `reader` |
| `/ajustes` | Configuracion simple | `admin` |

## 6.4 Layout recomendado

### Estructura

- Sidebar fija en desktop.
- Navbar superior con usuario, rol, entorno y logout.
- Contenido principal con breadcrumbs.
- Vista responsive con menu colapsable en tablet y movil.

### Componentes base

- `AppShell`
- `ProtectedRoute`
- `RoleGuard`
- `StatsCard`
- `DataTable`
- `StatusBadge`
- `ConfirmDialog`
- `EmptyState`
- `ErrorState`

## 6.5 Requerimientos PWA

La app debe instalarse como PWA, pero en el MVP su prioridad no es operar offline completo.

### MVP PWA

- `manifest.json`
- iconos
- instalable en escritorio o movil
- cache de assets estaticos
- fallback amistoso ante perdida de red

### No requerido en MVP

- edicion offline
- colas offline
- sincronizacion diferida

## 7. Requerimientos de seguridad

## 7.1 Autenticacion

- El login admin debe ser independiente del flujo ciudadano con Auth0.
- El frontend no debe confiar en el rol guardado localmente; debe validarlo contra API.
- La sesion debe reconstruirse desde un endpoint tipo `/api/v1/admin/session`.

## 7.2 Manejo de tokens

### Recomendacion ideal

- `accessToken` corto en memoria.
- `refreshToken` en cookie `httpOnly`, `Secure`, `SameSite=Lax` o `Strict` segun despliegue.

### Si se mantiene el contrato actual temporalmente

- guardar `accessToken` y `refreshToken` con el menor tiempo posible,
- encapsular su uso en una capa `authService`,
- planear la migracion a cookie segura antes de produccion publica.

## 7.3 Datos sensibles

- No mostrar CURP completa.
- No mostrar telefonos completos salvo caso justificado y solo para `admin`.
- En staging, aplicar mascaras en detalle.
- No loguear payloads sensibles en consola del navegador.

## 7.4 Control de permisos

- Proteccion por ruta.
- Proteccion por accion.
- Revalidacion en cada respuesta `401` o `403`.

## 8. Contratos API requeridos

## 8.1 Ya disponibles y aprovechables

| Metodo | Endpoint | Uso |
|--------|----------|-----|
| `POST` | `/api/v1/auth/login` | Login interno |
| `POST` | `/api/v1/auth/logout` | Logout |
| `GET` | `/api/v1/me` | Perfil basico |
| `GET` | `/api/v1/catalog` | Listado de convenios |
| `GET` | `/api/v1/catalog/:id` | Detalle de convenio |
| `POST` | `/api/v1/catalog` | Alta de convenio |
| `PUT` | `/api/v1/catalog/:id` | Edicion de convenio |
| `DELETE` | `/api/v1/catalog/:id` | Baja de convenio |
| `GET` | `/api/v1/beneficiarios-staging` | Lista operativa |
| `POST` | `/api/v1/beneficiarios-staging/:id/push` | Push manual |

## 8.2 Faltantes para el MVP admin

| Metodo | Endpoint | Motivo |
|--------|----------|--------|
| `POST` | `/api/v1/auth/refresh` | Renovar sesion |
| `GET` | `/api/v1/admin/session` | Perfil admin con rol y permisos |
| `GET` | `/api/v1/admin/dashboard` | Indicadores del tablero |
| `GET` | `/api/v1/admin/lookups` | Catalogos para formularios |
| `GET` | `/api/v1/admin/lookups/:lookup` | Lista un catalogo |
| `GET` | `/api/v1/admin/lookups/:lookup/:id` | Detalle de item de catalogo |
| `POST` | `/api/v1/admin/lookups/:lookup` | Alta de item de catalogo |
| `PATCH` | `/api/v1/admin/lookups/:lookup/:id` | Edicion de item de catalogo |
| `DELETE` | `/api/v1/admin/lookups/:lookup/:id` | Baja de item de catalogo |
| `GET` | `/api/v1/admin/users` | Lista de usuarios internos |
| `POST` | `/api/v1/admin/users` | Alta de usuario interno |
| `GET` | `/api/v1/admin/users/:id` | Detalle de usuario |
| `PATCH` | `/api/v1/admin/users/:id` | Edicion de usuario |
| `POST` | `/api/v1/admin/users/:id/set-password` | Reset de password |
| `GET` | `/api/v1/admin/beneficiarios-staging/:id` | Detalle seguro de staging |
| `GET` | `/api/v1/admin/beneficiarios-staging/:id/attempts` | Historial de intentos |

## 8.3 Faltantes fase 2

| Metodo | Endpoint | Motivo |
|--------|----------|--------|
| `GET` | `/api/v1/admin/cardholders-sync` | Consulta de padron sincronizado |
| `GET` | `/api/v1/admin/cardholders-sync/:id` | Detalle de padron |
| `GET` | `/api/v1/admin/service-clients` | Lista de integraciones |
| `PATCH` | `/api/v1/admin/service-clients/:id` | Cambios de estado o scopes |
| `GET` | `/api/v1/admin/integration-audit` | Auditoria de integraciones |
| `GET` | `/api/v1/admin/sync-audit` | Auditoria de sincronizacion |

## 9. Requerimientos no funcionales

## 9.1 Rendimiento

- Tiempo de carga inicial menor a 3 segundos en red corporativa normal.
- Tablas paginadas desde backend.
- Filtros con debounce.

## 9.2 Usabilidad

- Interfaz clara y operable por personal no tecnico.
- Estados visibles y consistentes.
- Acciones destructivas siempre confirmadas.

## 9.3 Accesibilidad

- Navegacion por teclado.
- Contraste suficiente.
- Etiquetas correctas en formularios.

## 9.4 Observabilidad

- Manejo uniforme de errores.
- Trazabilidad de acciones sensibles.
- Identificacion visible de entorno: local, staging, produccion.

## 10. Flujo sugerido de implementacion

## Fase 1. Base operativa

1. Scaffold `admin-app` con React PWA.
2. Login, manejo de sesion y guards por rol.
3. Layout base y navegacion.
4. CRUD de convenios usando endpoints existentes.
5. Dashboard con datos mock o endpoint real si ya existe.
6. Lista de staging y push manual.

## Fase 2. Backoffice completo

1. CRUD de usuarios internos.
2. Lookups centralizados.
3. Detalle de staging con intentos.
4. Vista de auditoria.

## Fase 3. Operacion avanzada

1. Padron sincronizado.
2. Clientes de integracion.
3. Rotacion de llaves.
4. Actividad administrativa consolidada.

## 11. Criterios de aceptacion del MVP

El MVP se considera listo cuando:

1. Un `admin` puede iniciar sesion y cerrar sesion sin usar Postman.
2. Un `reader` puede entrar al dashboard y consultar convenios sin ver acciones prohibidas.
3. Un `admin` puede crear, editar y eliminar convenios desde UI.
4. Un `admin` puede consultar staging y lanzar un push manual.
5. La app funciona como SPA y es instalable como PWA.
6. Los errores de API se muestran de forma entendible para operacion.

## 12. Recomendacion final

Si la meta es avanzar rapido con bajo riesgo, el camino mas corto es:

1. **crear la PWA admin en un proyecto separado `admin-app/`**,
2. **reutilizar de inmediato el CRUD de convenios y el listado-push de staging ya existentes**,
3. **agregar primero los endpoints de sesion y dashboard**, porque desbloquean el resto del backoffice,
4. **dejar usuarios, integraciones y auditoria como segunda ola**.

Con ese enfoque, la primera version util puede salir sin esperar a que todo el backend admin este completo.
