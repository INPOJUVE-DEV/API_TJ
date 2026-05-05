# Checklist QA y Release

## Integracion tecnica

- `FRONTEND_ORIGIN` del entorno apunta al dominio real del frontend ciudadano.
- El frontend envia `credentials: "include"` en `refresh` y `logout`.
- El frontend nunca persiste refresh token.
- El `accessToken` se guarda solo en memoria.
- Existe un mecanismo centralizado para retry despues de `401`.

## Flujos a validar en QA

### Login

- login correcto
- login con password incorrecta
- login con email invalido
- login con usuario inactivo o inexistente

### Sesion

- bootstrap sin sesion
- bootstrap con refresh valido
- access token expirado y `refresh` exitoso
- access token expirado y `refresh` fallido
- logout desde sesion activa

### Activacion

- tarjeta valida y activacion exitosa
- tarjeta/CURP invalidas
- activacion fuera de ventana
- email ya en uso por otra cuenta
- password_confirmation distinta

### Recuperacion

- forgot password con correo existente
- forgot password con correo inexistente
- reset con token valido
- reset con token expirado
- reset con token reutilizado

### Rutas protegidas

- perfil
- catalogo
- detalle de beneficio
- mapa

## Criterios de aceptacion

- no hay referencias operativas a Auth0 en la UI ciudadana
- la UI no usa `localStorage` para refresh token
- todos los `401` protegidos intentan un solo `refresh`
- la UX de recovery no filtra existencia de correo
- el usuario puede activar cuenta y entrar sin login adicional

## Riesgos a revisar antes de release

- dominio frontend y backend distintos sin `credentials: "include"`
- entorno productivo sin cookie `Secure`
- multiples requests paralelos disparando varios `refresh`
- formularios mostrando mensajes distintos que revelen existencia de cuentas
