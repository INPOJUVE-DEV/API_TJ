# Flujos y Sesion

## Flujo 1: Login normal

1. Usuario captura `username` y `password`.
2. Frontend llama `POST /api/v1/auth/login`.
3. Backend responde `accessToken`, `expiresIn`, `user` y setea cookie refresh.
4. Frontend guarda `accessToken` en memoria.
5. Frontend carga `GET /api/v1/me`.
6. Frontend navega a catalogo, perfil y pantallas protegidas.

## Flujo 2: Bootstrap al abrir la app

1. Frontend arranca sin asumir que hay sesion valida.
2. Si hay `accessToken` en memoria, intenta `GET /api/v1/me`.
3. Si responde `401`, llama `POST /api/v1/auth/refresh` con `credentials: "include"`.
4. Si `refresh` responde `200`, reemplaza `accessToken`, repite `GET /me` y continua.
5. Si `refresh` responde `401`, limpia estado y muestra login.

## Flujo 3: Access token expirado durante navegacion

1. Un request protegido devuelve `401`.
2. Frontend intenta `refresh` una sola vez.
3. Si `refresh` responde `200`, repite el request original.
4. Si `refresh` responde `401`, limpia sesion local y redirige al login.

## Flujo 4: Activacion local

1. Pantalla de activacion pide `tarjeta_numero` y `curp`.
2. Llama `verify-activation`.
3. Si responde `200`, muestra formulario de `email`, `password`, `password_confirmation`.
4. Llama `complete-activation`.
5. Si responde `200`, guarda `accessToken` en memoria y entra directo a la app.

## Flujo 5: Forgot password

1. Usuario captura `email`.
2. Frontend llama `forgot-password`.
3. Siempre muestra mensaje de exito generico.
4. No debe mostrar si el correo existe o no.

## Flujo 6: Reset password

1. Frontend abre pantalla con `token` desde query param.
2. Usuario captura `password` y `password_confirmation`.
3. Frontend llama `reset-password`.
4. Si responde `200`, limpia cualquier sesion local y redirige al login con mensaje de exito.

## Politica de almacenamiento

- `accessToken`: solo memoria.
- refresh token: solo cookie `httpOnly`, nunca accesible desde JS.
- perfil de usuario: store en memoria o cache efimera del cliente.

## Politica de errores

- `401` en login: mostrar credenciales invalidas.
- `401` en endpoints protegidos: intentar `refresh` una sola vez.
- `401` en `refresh`: cerrar sesion.
- `403` en activacion: volver al paso de verificar tarjeta.
- `409` en activacion: mostrar mensaje funcional recibido.
- `422` en formularios: mostrar validacion del backend cerca del campo o como alert funcional.
- `500`: mensaje generico y opcion de reintentar.

## Cookie refresh

El backend configura la cookie con:

- `HttpOnly`
- `SameSite=Lax`
- `Path=/api/v1/auth`
- `Secure` en produccion o si `AUTH_COOKIE_SECURE=true`

Implicacion:

- `refresh` y `logout` deben ejecutarse con `credentials: "include"`
- el frontend no puede leer el token ni inspeccionarlo

## Politica de password a reflejar en UI

La UI debe anticipar estas reglas:

- minimo `12` caracteres
- maximo `128`
- `password_confirmation` debe coincidir
- la password no debe coincidir con el email ni con identificadores obvios del usuario

## Politica de rutas protegidas

Rutas que deben exigir sesion:

- perfil
- catalogo
- detalle de beneficio
- mapa

Rutas publicas:

- login
- forgot password
- reset password
- verify activation
- complete activation
