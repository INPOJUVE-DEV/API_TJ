# Resumen Ejecutivo

## Que cambio

El modulo ciudadano ahora usa autenticacion local propia del backend.

Auth0 sale del flujo.

## Como queda la sesion

- El backend entrega `accessToken` en JSON.
- El refresh token viaja en cookie `httpOnly`.
- El frontend solo guarda el `accessToken` en memoria.
- Cuando un endpoint responde `401`, frontend debe intentar `POST /api/v1/auth/refresh` una sola vez.
- Si `refresh` falla, se cierra sesion y se redirige al login.

## Como queda el alta

1. El usuario valida `tarjeta_numero + curp`.
2. Si es elegible, completa `email + password + password_confirmation`.
3. `complete-activation` crea o reclama la cuenta local.
4. La activacion ya responde con sesion inicial.

## Como queda la recuperacion

1. `forgot-password` recibe `email`.
2. El backend responde siempre un mensaje neutro.
3. El usuario abre la pantalla de reset desde el link recibido por correo.
4. `reset-password` invalida sesiones previas y obliga a relogin.

## Reglas no negociables para frontend

- No guardar refresh token en `localStorage`, `sessionStorage` ni IndexedDB.
- Usar `credentials: "include"` en `refresh` y `logout`.
- Tratar errores de login y recuperacion como genericos.
- No asumir que el beneficiario tiene `nombreCompleto` en la respuesta de activacion.
- No usar ni pedir `auth0_id_token`, `AUTH0_DOMAIN` o `AUTH0_CLIENT_ID`.
