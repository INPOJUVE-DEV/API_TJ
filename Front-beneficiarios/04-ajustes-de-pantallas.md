# Ajustes de Pantallas

## 1. Login beneficiario

Cambios requeridos:

- quitar cualquier boton o dependencia de Auth0
- enviar `username` y `password` a `/api/v1/auth/login`
- guardar `accessToken` en memoria
- cargar perfil al autenticar

Estados UI:

- idle
- loading
- credenciales invalidas
- error generico

## 2. Activacion

### Paso A: Verificar tarjeta

Campos:

- `tarjeta_numero`
- `curp`

Accion:

- llamar `/api/v1/cardholders/verify-activation`

### Paso B: Crear cuenta local

Campos:

- `email`
- `password`
- `password_confirmation`

Accion:

- llamar `/api/v1/cardholders/complete-activation`

Resultado:

- entrar a la app con la sesion recien creada

## 3. Forgot password

Campos:

- `email`

Comportamiento:

- siempre mostrar mensaje de exito generico
- no revelar si el correo existe

## 4. Reset password

Campos:

- `password`
- `password_confirmation`

Entrada esperada:

- `token` tomado desde query param o deep link

Comportamiento:

- al exito, limpiar sesion local y volver a login

## 5. Bootstrap de sesion

Al abrir la app:

- si no hay `accessToken` en memoria, intentar `refresh`
- si `refresh` responde `200`, hidratar sesion y luego pedir `/me`
- si `refresh` responde `401`, quedarse en login

## 6. Layout o provider de autenticacion

El frontend debe tener un punto central para:

- almacenar el `accessToken`
- exponer `login`, `logout`, `refresh`, `loadProfile`
- interceptar `401`
- serializar reintentos para no disparar varios `refresh` en paralelo

## 7. Catalogo y mapa

No cambian de contrato principal, pero deben:

- depender de sesion `beneficiary`
- soportar expiracion de token y retry con `refresh`

## 8. Logout

Comportamiento:

- llamar `/api/v1/auth/logout` con `credentials: "include"`
- limpiar `accessToken`
- limpiar store de usuario
- redirigir a login aunque el backend haya limpiado solo la cookie
