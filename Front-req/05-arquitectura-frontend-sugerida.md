# Arquitectura Frontend Sugerida

## Stack

- `React`
- `Vite`
- `TypeScript`
- `React Router`
- `TanStack Query`
- `React Hook Form`
- `Zod`
- `MUI`
- `vite-plugin-pwa`

## Estructura sugerida

```text
admin-app/
  src/
    app/
      router.tsx
      providers.tsx
      store.ts
    components/
      layout/
      data-display/
      feedback/
      forms/
    features/
      auth/
      dashboard/
      convenios/
      users/
      staging/
    lib/
      api-client.ts
      auth-storage.ts
      permissions.ts
      formatters.ts
    types/
      auth.ts
      dashboard.ts
      convenios.ts
      users.ts
      staging.ts
```

## Estrategia de sesion recomendada

Como no hay refresh token en backend admin:

- guardar el token en memoria como fuente principal,
- duplicarlo en `sessionStorage` para sobrevivir a un reload,
- validar siempre con `GET /api/v1/admin/session` al iniciar la app,
- borrar token inmediatamente ante `401`.

No guardar token en `localStorage` como default.

## API client recomendado

El cliente HTTP debe:

- inyectar `Authorization: Bearer <token>`,
- centralizar manejo de `401` y `403`,
- exponer funciones por modulo,
- evitar duplicar URLs hardcodeadas en componentes.

## Capa de datos sugerida

### Queries

- `session`
- `dashboard`
- `lookups`
- `convenios-list`
- `convenio-detail`
- `users-list`
- `user-detail`
- `staging-list`
- `staging-detail`
- `staging-attempts`

### Mutations

- `login`
- `logout`
- `create-convenio`
- `update-convenio`
- `delete-convenio`
- `create-user`
- `update-user`
- `set-user-password`
- `push-staging`

## PWA minima

El MVP solo necesita:

- `manifest.json`
- iconos
- instalacion basica
- cache de assets
- fallback de red para shell

No implementar trabajo offline de datos ni colas.

## Recomendaciones visuales

- Diseñar para desktop primero.
- Sidebar estable con iconos y secciones claras.
- Colores de estado consistentes:
  - `pending`: amarillo
  - `accepted`: verde
  - `rejected`: rojo
  - `error`: naranja o rojo oscuro
  - `blocked`: gris o rojo suave
- Tipografia sobria y espaciado operativo, no estilo app de consumo.
