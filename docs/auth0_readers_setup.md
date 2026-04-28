# Configuracion de Auth0 solo para readers

## Objetivo

Configurar Auth0 exclusivamente para el sistema del beneficiario, de modo que:

- los usuarios finales queden como `reader`,
- los `admin` sigan entrando por login local del backend,
- el backend pueda validar el `id_token` de Auth0 en `POST /api/v1/cardholders/complete-activation`.

## Como funciona este repo

En la implementacion actual:

- `POST /api/v1/cardholders/complete-activation` recibe `auth0_id_token`
- el backend valida firma, `issuer` y `audience`
- `audience` debe coincidir con `AUTH0_CLIENT_ID`
- si la vinculacion es correcta, el usuario local queda con rol `reader`

Variables que este backend necesita:

- `AUTH0_DOMAIN`
- `AUTH0_CLIENT_ID`

Observacion importante:

- hoy este backend **no** usa `AUTH0_CLIENT_SECRET` para validar el `id_token`
- si el frontend del beneficiario usa Auth0 como SPA o app movil, el `Client Secret` no debe ir al frontend

## Recomendacion de arquitectura

### Opcion recomendada

Usar Auth0 **solo** para el frontend del beneficiario.

- Beneficiario: Auth0
- Admin: login local por `/api/v1/admin/auth/login`

### Nivel de separacion

Minimo viable:

- un `Application` de Auth0 exclusivo para beneficiarios
- una `Database Connection` exclusiva para beneficiarios
- esa conexion habilitada solo para la app del beneficiario

Mas seguro:

- un tenant de Auth0 separado para beneficiarios por ambiente
- por ejemplo: `dev`, `staging`, `prod`

## Pasos en Auth0

## 1. Crear o elegir el tenant

En Auth0 Dashboard:

1. crea un tenant nuevo o usa uno dedicado a beneficiarios
2. evita mezclar admins con beneficiarios dentro del mismo flujo de login

Si quieres separacion fuerte, usa un tenant exclusivo para el beneficiario. Auth0 documenta que los usuarios de un tenant se comparten entre aplicaciones del mismo tenant, y recomienda tenant adicional para mantener grupos separados.

## 2. Crear la aplicacion del beneficiario

Ve a:

- `Applications > Applications > Create Application`

Elige el tipo segun el frontend real:

- `Single Page Application` si el beneficiario es web/PWA en navegador
- `Native` si el beneficiario es app movil nativa

Nombre sugerido:

- `beneficiario-readers`

Guarda estos datos:

- `Domain`
- `Client ID`

## 3. Configurar URLs de la aplicacion

Ve a la aplicacion creada y configura:

- `Allowed Callback URLs`
- `Allowed Logout URLs`
- `Allowed Web Origins`
- opcionalmente `Application Login URI`

Ejemplo para SPA local + produccion:

```text
Allowed Callback URLs:
http://localhost:5173/callback,https://beneficiario.tudominio.com/callback

Allowed Logout URLs:
http://localhost:5173,https://beneficiario.tudominio.com

Allowed Web Origins:
http://localhost:5173,https://beneficiario.tudominio.com

Application Login URI:
https://beneficiario.tudominio.com/login
```

Notas:

- reemplaza las URLs con las rutas reales de tu frontend
- no uses `localhost` en produccion
- si la app es nativa, Auth0 recomienda URIs HTTPS reclamadas como App Links o Universal Links en vez de esquemas custom

## 4. Crear la base de usuarios de readers

Ve a:

- `Authentication > Database > Create DB Connection`

Nombre sugerido:

- `beneficiarios-readers-db`

Selecciona:

- `Use Auth0 user store`

Recomendacion:

- usa email como identificador principal
- no mezcles esta conexion con otras apps si no hace falta

## 5. Habilitar la conexion solo para la app del beneficiario

En la `Database Connection` creada:

1. abre la pestaña `Applications`
2. habilita solo `beneficiario-readers`
3. deja deshabilitadas otras aplicaciones

Esto ayuda a que la conexion de beneficiarios no quede disponible para otros flujos.

## 6. Activar Universal Login

Ve a:

- `Branding > Universal Login`

Recomendacion:

- usa `Universal Login`
- mantén el flujo de email + password para readers

Esto te permite:

- alta de usuario con Auth0
- login seguro hospedado por Auth0
- reset de password
- verificacion de correo

## 7. Endurecer password policy

Ve a:

- `Authentication > Database > beneficiarios-readers-db > Authentication Methods > Password > Configure`

Configura, al menos:

- `Password Strength Policy`: `Good` o `Excellent`
- `Password History`: habilitado
- `Password Dictionary`: habilitado
- `Personal Data`: habilitado

Esto refuerza que los readers usen passwords fuertes y no reutilicen contrasenas evidentes.

## 8. Verificar correo

Auth0 envia por default enlaces de verificacion cuando el usuario se registra en una conexion de base de datos.

Recomendacion:

- deja activa la verificacion de email
- si tu UX lo necesita, exige correo verificado antes de dar por completado el onboarding funcional

## 9. Activar protecciones contra abuso

Ve a:

- `Security > Attack Protection`

Activa como minimo:

- `Brute-force Protection`
- `Breached Password Detection`
- `Suspicious IP Throttling`
- `Bot Detection`

Esto agrega proteccion por capas contra intentos repetidos, passwords comprometidos y trafico automatizado.

## 10. Activar MFA si el riesgo lo justifica

Ve a:

- `Security > Multi-factor Auth`

Opciones recomendadas:

- `Adaptive MFA` si quieres pedir segundo factor solo cuando Auth0 detecte riesgo
- `Always` solo si tu experiencia de usuario lo tolera

Factor sugerido:

- `OTP` o `WebAuthn`, segun la experiencia objetivo

Para beneficiarios, normalmente `Adaptive MFA` es el mejor punto medio.

## 11. Tomar las credenciales correctas para este backend

De la aplicacion `beneficiario-readers`, copia:

- `Domain`
- `Client ID`

Configuralas en el backend:

```env
AUTH0_DOMAIN=tu-tenant.us.auth0.com
AUTH0_CLIENT_ID=XXXXXXXXXXXXXXXXXXXX
```

Si usas custom domain para autenticar al frontend, conviene usar el mismo dominio tambien en backend para que `issuer` y `JWKS` coincidan con el token emitido.

## 12. No usar Auth0 para admins

Para los admins:

- no crees una app Auth0 de admin si no la vas a usar
- no pongas boton de Auth0 en el frontend admin
- mantén el acceso admin por `/api/v1/admin/auth/login`

Eso deja los dominios separados:

- beneficiarios en Auth0
- admins en autenticacion local controlada por el backend

## Flujo esperado para readers

1. el usuario valida `tarjeta_numero + curp` en `POST /api/v1/cardholders/verify-activation`
2. el frontend lo manda a Auth0 para signup o login
3. Auth0 emite un `id_token`
4. el frontend manda ese token a `POST /api/v1/cardholders/complete-activation`
5. el backend valida el token y vincula el usuario local con rol `reader`

## Importante sobre el rol `reader`

En este repo, el rol `reader` no se configura dentro de Auth0.

Lo asigna el backend local al completar la activacion:

- si crea el usuario, lo crea como `reader`
- si actualiza uno existente, lo deja `active` y vinculado

Entonces, para este proyecto:

- Auth0 autentica identidad
- `API_TJ` decide el rol local

## Checklist rapido

- tenant de Auth0 dedicado
- app `beneficiario-readers`
- database connection `beneficiarios-readers-db`
- conexion habilitada solo para la app del beneficiario
- Universal Login activo
- password policy endurecida
- email verification activa
- Attack Protection activo
- MFA adaptativo evaluado
- `AUTH0_DOMAIN` configurado en backend
- `AUTH0_CLIENT_ID` configurado en backend
- admin fuera de Auth0

## Referencias oficiales

- Application Settings:
  https://auth0.com/docs/get-started/applications/application-settings
- Database Connections:
  https://auth0.com/docs/authenticate/database-connections
- Manage User Access to Applications:
  https://auth0.com/docs/manage-users/user-accounts/manage-user-access-to-applications
- Validate ID Tokens:
  https://auth0.com/docs/secure/tokens/id-tokens/validate-id-tokens
- Verify Emails:
  https://auth0.com/docs/manage-users/user-accounts/verify-emails
- Attack Protection:
  https://auth0.com/docs/secure/attack-protection
- Enable MFA:
  https://auth0.com/docs/secure/multi-factor-authentication/enable-mfa
