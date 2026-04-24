# updateAPI.md
# Requerimientos de actualización – API_TJ
## Parche: Tarjetahabiente, staging de beneficiarios, sincronización con Sys_IPJ y activación con Auth0

## 1. Objetivo

Actualizar API_TJ para soportar de forma segura y con bajo mantenimiento los siguientes flujos:

1. recepción del padrón mínimo desde Sys_IPJ,
2. consulta de elegibilidad por CURP desde la Unidad de Informática,
3. almacenamiento temporal de expedientes completos de beneficiarios no encontrados,
4. envío manual posterior de dichos expedientes a Sys_IPJ,
5. activación de cuenta mediante validación `tarjeta_numero + CURP`,
6. vinculación final de cuenta con Auth0,
7. endurecimiento de seguridad en integraciones sistema a sistema.

---

## 2. Resultado funcional esperado

Al finalizar el parche, API_TJ deberá:

- almacenar únicamente datos mínimos sincronizados para validar elegibilidad de beneficiarios,
- permitir búsqueda por CURP **sin persistirla en claro**,
- responder cuando un beneficiario ya exista con el número de tarjeta correspondiente,
- aceptar expedientes completos enviados por la Unidad de Informática y guardarlos en staging temporal cifrado,
- permitir el envío manual de staging a Sys_IPJ,
- delegar correo y contraseña a Auth0,
- validar activación usando `tarjeta_numero + CURP`,
- vincular `auth0_user_id` al usuario local,
- dejar obsoleto el flujo actual de creación de cuenta local con contraseña propia.

---

## 3. Decisiones cerradas

Estas decisiones ya no deben rediscutirse durante la implementación:

- **Sys_IPJ es la fuente de verdad de beneficiarios.**
- **API_TJ no será sistema de alta oficial de beneficiarios.**
- **API_TJ solo almacenará padrón mínimo sincronizado + staging temporal + vínculo de cuenta con Auth0.**
- **La sincronización de padrón será manual.**
- **La consulta por CURP sí entra al API para validación, pero no debe persistirse en claro.**
- **El QR no debe usar CURP ni `tarjeta_numero` en claro.**
- **Auth0 manejará correo y contraseña.**
- **La validación previa al enrolamiento será con `tarjeta_numero + CURP`.**
- **El staging temporal debe incluir todos los campos de Captura Beneficiarios de Sys_IPJ, incluyendo domicilio completo.**
- **La seguridad entre sistemas no se resolverá con tokens estáticos compartidos; se implementará autenticación de integración con JWT firmado y autorización por scopes.**

---

## 4. Alcance

### Incluye
- cambios de esquema de base de datos,
- nuevos endpoints y reemplazo de lógica existente,
- nuevos servicios de hash, cifrado y auditoría,
- integración con Auth0,
- recepción de sync desde Sys_IPJ,
- staging temporal de beneficiarios,
- envío manual a Sys_IPJ,
- endurecimiento de seguridad en integraciones,
- documentación y pruebas mínimas.

### No incluye
- implementación del frontend,
- automatización nocturna,
- rediseño del QR,
- refactor global de módulos no relacionados,
- cambios funcionales internos de Sys_IPJ fuera del contrato de integración.

---

## 5. Flujos que debe soportar el API

## 5.1 Sync de padrón mínimo desde Sys_IPJ
Sys_IPJ envía a API_TJ el padrón mínimo:

- `curp_hash`
- `curp_masked`
- `tarjeta_numero`
- `status`

API_TJ lo almacena en tabla operativa de sincronización.

### Objetivo
Usar este padrón para:
- validar elegibilidad,
- saber si el usuario ya cuenta con tarjeta física,
- responder consultas de la Unidad de Informática.

---

## 5.2 Lookup por CURP para la Unidad de Informática
La Unidad de Informática consulta una CURP en API_TJ.

API_TJ:
- normaliza CURP,
- calcula `curp_hash`,
- busca en el padrón sincronizado,
- no persiste CURP en claro,
- responde si ya existe o no.

### Si existe
Debe responder `200` con:
- mensaje informativo,
- `folio_tarjeta` o `tarjeta_numero`.

Ejemplo:
```json
{
  "registered": true,
  "message": "El usuario ya se encuentra registrado con la tarjeta TJ-00012345",
  "folio_tarjeta": "TJ-00012345"
}
```

### Si no existe
Debe responder `404`.

Ejemplo:
```json
{
  "registered": false,
  "message": "La CURP no se encuentra registrada en la app"
}
```

---

## 5.3 Alta temporal de expediente completo
Si el lookup responde `404`, la Unidad de Informática podrá enviar el expediente completo del beneficiario en JSON para almacenamiento temporal.

Ese expediente debe cubrir todos los campos equivalentes a **Captura Beneficiarios** de Sys_IPJ, incluyendo:

- nombre,
- apellido paterno,
- apellido materno,
- CURP,
- fecha de nacimiento,
- sexo,
- discapacidad,
- id_ine,
- teléfono,
- domicilio completo,
- municipio,
- código postal,
- seccional,
- número de tarjeta si ya existe,
- cualquier otro dato que el contrato de Sys_IPJ requiera.

API_TJ:
- valida estructura,
- calcula `curp_hash`,
- genera `curp_masked`,
- cifra el payload sensible,
- lo guarda en staging temporal,
- no lo registra como beneficiario oficial.

---

## 5.4 Envío manual a Sys_IPJ
Un usuario autorizado del lado de API_TJ podrá tomar un registro staging y enviarlo manualmente a Sys_IPJ.

El resultado del envío debe quedar auditado con:
- fecha,
- actor,
- respuesta HTTP,
- estado final,
- error si aplica.

---

## 5.5 Activación de cuenta con Auth0
Para creación de acceso a la app:

1. el usuario final valida identidad con:
   - `tarjeta_numero`
   - `CURP`

2. si la validación es correcta, el frontend ejecuta el flujo de Auth0 para registrar:
   - correo
   - contraseña

3. API_TJ recibe el resultado y vincula:
   - `auth0_user_id`
   - email
   - `cardholder_sync_id`

API_TJ **no debe** guardar ni procesar contraseñas locales para este flujo.

---

## 6. Seguridad de integración

## 6.1 Cliente de integración por sistema
Separar credenciales entre:

- `sys_ipj`
- `unidad_informatica`

No compartir el mismo mecanismo de autenticación entre ambos.

---

## 6.2 Autenticación requerida
Implementar **JWT firmado** por cliente integrador.

### Recomendación
- algoritmo asimétrico: **RS256**
- clave privada en el sistema emisor,
- clave pública registrada en API_TJ.

### Plan B solo si no es viable RS256
- HS256 con secretos independientes por cliente.

---

## 6.3 Claims requeridos del JWT
Todos los tokens de integración deben incluir:

- `iss`
- `sub`
- `aud`
- `iat`
- `exp`
- `jti`
- `scope`

### Reglas
- `aud` debe corresponder a API_TJ,
- expiración corta,
- `jti` único para prevención de replay.

---

## 6.4 Scopes mínimos
### Sys_IPJ
- `cardholders.sync`

### Unidad de Informática
- `cardholders.lookup`
- `beneficiarios.staging.create`

### Operación administrativa interna de API_TJ
No exponer vía integración externa:
- `beneficiarios.staging.list`
- `beneficiarios.staging.push`

Esos deben quedar reservados a usuarios internos autenticados.

---

## 6.5 Controles adicionales obligatorios
Además del JWT firmado, implementar:

- HTTPS obligatorio,
- expiración corta de tokens,
- protección anti-replay usando `jti`,
- allowlist de IP por integrador si el entorno lo permite,
- rate limit por cliente,
- auditoría completa de llamadas.

---

## 6.6 Middleware de integración
Crear middleware dedicado que haga, en este orden:

1. validar bearer token,
2. validar firma del JWT,
3. validar `exp`, `iat`, `aud`, `iss`,
4. validar `jti` no reutilizado,
5. resolver `service_client`,
6. validar IP permitida si aplica,
7. validar `scope`,
8. registrar auditoría.

### Respuestas
- `401` para token inválido,
- `403` para token válido pero sin permisos.

---

## 7. Cambios de base de datos

## 7.1 Crear tabla `cardholders_sync`
Tabla operativa del padrón mínimo sincronizado.

Campos mínimos:

- `id`
- `curp_hash` UNIQUE NOT NULL
- `curp_masked` NOT NULL
- `tarjeta_numero` UNIQUE NOT NULL
- `status` ENUM(`active`,`inactive`,`blocked`) DEFAULT `active`
- `sync_source` NULL
- `synced_at` NOT NULL
- `account_user_id` NULL
- `auth0_user_id` NULL UNIQUE
- `created_at`
- `updated_at`

### Regla
No almacenar `curp` en claro en esta tabla.

---

## 7.2 Crear tabla `beneficiario_staging`
Tabla para expedientes completos en almacenamiento temporal.

Campos mínimos:

- `id`
- `external_request_id` UNIQUE NOT NULL
- `curp_hash` NOT NULL
- `curp_masked` NOT NULL
- `payload_ciphertext` NOT NULL
- `payload_iv` NOT NULL
- `payload_tag` NOT NULL
- `status` ENUM(`pending`,`sent`,`accepted`,`rejected`,`error`) DEFAULT `pending`
- `submitted_by_system` NOT NULL
- `submitted_at` NOT NULL
- `sent_at` NULL
- `resolved_at` NULL
- `sys_ipj_response_code` NULL
- `error_message` NULL
- `created_at`
- `updated_at`

### Regla
El payload debe ir cifrado. No desnormalizar el expediente completo en columnas salvo que sea estrictamente necesario.

---

## 7.3 Ajustar tabla `usuarios`
Modificar modelo local de usuario para vinculación con Auth0.

Campos requeridos:

- `id`
- `auth0_user_id` UNIQUE NULL
- `email` UNIQUE NOT NULL
- `cardholder_sync_id` NULL
- `status` ENUM(`pending`,`active`,`blocked`) DEFAULT `active`
- `created_at`
- `updated_at`

### Regla
El nuevo flujo ya no debe usar `password_hash` local para Tarjeta Joven.

---

## 7.4 Crear tabla `sync_audit_log`
Bitácora de sincronizaciones e integraciones críticas.

Campos mínimos:

- `id`
- `direction` ENUM(`SYS_IPJ_TO_API_TJ`,`API_TJ_TO_SYS_IPJ`)
- `executed_by`
- `request_count`
- `inserted_count`
- `updated_count`
- `skipped_count`
- `conflict_count`
- `status` ENUM(`success`,`partial`,`failed`)
- `request_checksum`
- `started_at`
- `finished_at`
- `error_message`

---

## 7.5 Crear tabla `service_clients`
Control de clientes de integración.

Campos mínimos:

- `id`
- `client_code`
- `name`
- `status`
- `public_key` o secreto según implementación
- `allowed_scopes`
- `ip_allowlist`
- `created_at`
- `updated_at`
- `last_used_at`

Clientes iniciales:
- `sys_ipj`
- `unidad_informatica`

---

## 8. Servicios a desarrollar

## 8.1 `curpHashService`
Responsabilidades:
- normalizar CURP,
- calcular `curp_hash`,
- generar `curp_masked`.

### Requisito
Usar HMAC-SHA-256 con secreto compartido entre backends.

---

## 8.2 `fieldEncryptionService`
Responsable de cifrado y descifrado del payload staging.

### Requisito
Usar AES-256-GCM o equivalente con autenticación.

---

## 8.3 `syncAuditService`
Responsable de registrar sync, push manual y errores de integración.

---

## 8.4 `integrationAuthService`
Responsable de:
- validar JWT de integración,
- verificar scopes,
- verificar anti-replay,
- resolver cliente emisor.

---

## 9. Endpoints a implementar o modificar

## 9.1 Reemplazo de lookup
### `POST /api/v1/cardholders/lookup`

#### Entrada
```json
{
  "curp": "CURP_DEL_USUARIO"
}
```

#### Proceso
- normalizar CURP,
- calcular `curp_hash`,
- buscar en `cardholders_sync`,
- no persistir CURP.

#### Respuesta si existe
```json
{
  "registered": true,
  "message": "El usuario ya se encuentra registrado con la tarjeta TJ-00012345",
  "folio_tarjeta": "TJ-00012345"
}
```

#### Respuesta si no existe
```json
{
  "registered": false,
  "message": "La CURP no se encuentra registrada en la app"
}
```

---

## 9.2 Recepción de sync desde Sys_IPJ
### `POST /api/v1/cardholders/sync`

#### Requiere scope
- `cardholders.sync`

#### Entrada
```json
{
  "sync_id": "SYNC-2026-04-21-01",
  "items": [
    {
      "curp_hash": "....",
      "curp_masked": "ABCD******12",
      "tarjeta_numero": "TJ-00012345",
      "status": "active"
    }
  ]
}
```

#### Comportamiento
- validar firma,
- validar scope,
- insertar o actualizar por `curp_hash`,
- si cambia `tarjeta_numero`, actualizar y auditar.

#### Respuesta
```json
{
  "processed": 100,
  "inserted": 40,
  "updated": 60,
  "skipped": 0
}
```

---

## 9.3 Crear expediente temporal
### `POST /api/v1/beneficiarios-staging`

#### Requiere scope
- `beneficiarios.staging.create`

#### Entrada
Payload JSON completo del beneficiario.

#### Comportamiento
- validar campos obligatorios,
- calcular `curp_hash`,
- verificar que no exista ya en `cardholders_sync`,
- verificar duplicado en staging,
- cifrar payload,
- guardar con estado `pending`.

#### Respuesta
```json
{
  "created": true,
  "status": "pending",
  "staging_id": 123
}
```

---

## 9.4 Listado interno de staging
### `GET /api/v1/beneficiarios-staging?status=pending`

Solo para administración interna.

Debe listar:
- id,
- external_request_id,
- curp_masked,
- status,
- submitted_at,
- error_message.

No devolver payload sensible descifrado en listados generales.

---

## 9.5 Envío manual a Sys_IPJ
### `POST /api/v1/beneficiarios-staging/{id}/push`

Solo para administración interna.

#### Comportamiento
- obtener staging,
- descifrar payload,
- enviar a Sys_IPJ,
- registrar resultado,
- cambiar estado.

#### Respuesta
```json
{
  "sent": true,
  "message": "Beneficiario enviado a Sys_IPJ",
  "sys_ipj_status": 201
}
```

---

## 9.6 Validación de activación
### `POST /api/v1/cardholders/verify-activation`

#### Entrada
```json
{
  "tarjeta_numero": "TJ-00012345",
  "curp": "CURP_DEL_USUARIO"
}
```

#### Comportamiento
- calcular `curp_hash`,
- buscar por `tarjeta_numero`,
- comparar `curp_hash`,
- validar que no tenga cuenta vinculada,
- validar que el status permita activación.

#### Respuesta
```json
{
  "can_activate": true,
  "message": "Validación correcta"
}
```

---

## 9.7 Finalización de activación con Auth0
### `POST /api/v1/cardholders/complete-activation`

#### Entrada
```json
{
  "tarjeta_numero": "TJ-00012345",
  "auth0_user_id": "auth0|abc123",
  "email": "usuario@correo.com"
}
```

#### Comportamiento
- buscar `cardholder_sync`,
- validar que no exista vínculo previo,
- crear o actualizar usuario local mínimo,
- guardar `auth0_user_id`,
- asociar usuario con cardholder.

#### Respuesta
```json
{
  "activated": true,
  "message": "Cuenta vinculada correctamente"
}
```

---

## 10. Endpoints a deprecar

## 10.1 `POST /cardholders/{curp}/account`
Debe marcarse como deprecated y salir del flujo principal.

### Ya no debe
- recibir password,
- hashear password local,
- crear credenciales locales.

---

## 10.2 Cualquier endpoint de registro que trate a API_TJ como alta oficial
Debe redirigirse al concepto de staging temporal.

---

## 11. Reglas de negocio obligatorias

1. `cardholders_sync` solo se alimenta desde Sys_IPJ.
2. API_TJ no registra oficialmente beneficiarios.
3. CURP no debe persistirse en claro fuera del payload cifrado temporal.
4. `curp_hash` es la única llave de matching por CURP.
5. `tarjeta_numero` debe ser único.
6. Si Sys_IPJ vuelve a sincronizar el mismo `curp_hash` con nueva tarjeta, API_TJ debe actualizarla.
7. No debe permitirse activación si:
   - no existe el hash,
   - no coincide la tarjeta,
   - el status no es `active`,
   - ya existe vínculo de cuenta.
8. El staging debe poder reenviarse manualmente si falló.
9. El staging no debe insertarse directamente a `cardholders_sync`.
10. Los listados no deben exponer CURP completa ni payload sensible.
11. La Unidad de Informática no podrá disparar el push manual a Sys_IPJ vía integración externa.
12. Sys_IPJ no tendrá permiso para crear staging.
13. Los tokens de integración deben ser de vida corta.
14. Debe existir prevención de replay por `jti`.

---

## 12. Variables de entorno nuevas

Agregar como mínimo:

- `CURP_HASH_SECRET`
- `FIELD_ENCRYPTION_KEY`
- `FIELD_ENCRYPTION_ALGORITHM`
- `SYS_IPJ_PUSH_URL`
- `SYS_IPJ_JWT_PUBLIC_KEY`
- `INFORMATICA_JWT_PUBLIC_KEY`
- `AUTH0_DOMAIN`
- `AUTH0_AUDIENCE`
- `AUTH0_CLIENT_ID`
- `AUTH0_CLIENT_SECRET` si aplica flujo backend
- `STAGING_TTL_DAYS`

---

## 13. Fases sugeridas de implementación

## Fase 1 – Seguridad base y esquema
- migraciones de tablas nuevas,
- `service_clients`,
- `curpHashService`,
- `fieldEncryptionService`,
- middleware de integración,
- `syncAuditService`.

## Fase 2 – Sync de padrón mínimo
- endpoint `/cardholders/sync`,
- inserción/actualización en `cardholders_sync`,
- auditoría.

## Fase 3 – Nuevo lookup
- reemplazo completo del lookup actual,
- eliminación de dependencia de CURP en claro.

## Fase 4 – Staging temporal
- endpoint `/beneficiarios-staging`,
- validación de expediente completo,
- cifrado y persistencia.

## Fase 5 – Push manual a Sys_IPJ
- endpoint `/beneficiarios-staging/{id}/push`,
- manejo de estados y errores,
- auditoría.

## Fase 6 – Activación con Auth0
- `/cardholders/verify-activation`,
- `/cardholders/complete-activation`,
- deprecación de `createAccount` legado.

## Fase 7 – Documentación y pruebas
- README,
- Postman,
- pruebas unitarias e integración mínima.

---

## 14. Criterios de aceptación

1. Un CURP sincronizado desde Sys_IPJ responde `200` en lookup y devuelve tarjeta.
2. Un CURP no sincronizado responde `404`.
3. Ningún CURP queda almacenado en claro en `cardholders_sync`.
4. Un expediente completo de beneficiario se almacena cifrado en staging.
5. Un staging puede enviarse manualmente a Sys_IPJ.
6. El resultado del push queda auditado.
7. La activación con `tarjeta_numero + CURP` funciona solo si la coincidencia es real.
8. `complete-activation` vincula correctamente `auth0_user_id`.
9. La Unidad de Informática no puede ejecutar operaciones fuera de su scope.
10. Sys_IPJ no puede invocar endpoints fuera de su scope.
11. El endpoint viejo de creación de cuenta deja de ser parte del flujo nuevo.
12. Todas las operaciones críticas dejan traza auditable.

---

## 15. Riesgos que deben evitarse

- reutilizar la tabla actual sin migración clara al nuevo modelo,
- guardar CURP en logs,
- exponer datos personales innecesarios en lookup,
- mezclar staging con padrón sincronizado,
- mantener password local en el flujo nuevo,
- usar `tarjeta_numero` como valor público del QR,
- usar token estático compartido como único mecanismo de autenticación,
- permitir replay de requests firmadas.

---

## 16. Entregables esperados del equipo

1. migraciones SQL,
2. controladores nuevos o modificados,
3. middleware de integración,
4. servicios de hash, cifrado y auditoría,
5. documentación de variables de entorno,
6. README actualizado,
7. colección Postman actualizada,
8. pruebas unitarias mínimas,
9. pruebas de integración mínimas para:
   - sync,
   - lookup,
   - staging,
   - push manual,
   - activación,
   - vinculación Auth0.

---

## 17. Nota final para el equipo

No implementar este cambio como un ajuste menor sobre `lookup + createAccount` existentes.

Esto debe tratarse como un **refactor funcional del módulo de tarjetahabiente y registro**, con separación clara entre:

- padrón sincronizado,
- staging temporal,
- activación con Auth0,
- y seguridad de integración.
