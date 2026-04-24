# ajustes_plan_API_TJ.md
## Ajustes obligatorios al plan de implementación

## 1. Bloqueo definitivo de `cardholders.curp`
`cardholders.curp` queda fuera del flujo nuevo.

Reglas:
- No se puede usar para lookup.
- No se puede usar para matching.
- No se puede usar para activación.
- Solo se usará `curp_hash` en `cardholders_sync`.

Cualquier uso nuevo de `cardholders.curp` se considera bug.

---

## 2. Contrato completo de `service_clients`

Debe incluir:

Campos:
- `client_code` UNIQUE
- `status`
- `public_key`
- `allowed_scopes`
- `key_id_current`
- `last_used_at`

Reglas:
- Cada cliente usa JWT RS256.
- El `kid` debe mapear a la clave pública.
- Debe permitir rotación de llaves sin downtime.

---

## 3. Prohibición de CURP en logs

Regla obligatoria:

Ningún endpoint puede registrar CURP en:
- logs de aplicación
- logs de acceso
- errores
- métricas

Solo se permite:
- `curp_masked`
- `curp_hash`

---

## 4. Validación real de Auth0

`complete-activation` debe validar backend:

- No confiar en `auth0_user_id` enviado por frontend.
- Validar token emitido por Auth0.

Nuevo payload:

```json
{
  "tarjeta_numero": "TJ-00012345",
  "auth0_id_token": "jwt_auth0"
}
```

Debe validarse:
- firma
- issuer
- audience
- subject

---

## 5. Idempotencia en push a Sys_IPJ

Reglas:

- Usar `external_request_id` como identificador idempotente.
- Evitar doble envío.
- Implementar lock por registro staging.

---

## 6. Endpoint `/me` obligatorio

Debe soportar usuarios Auth0:

- No depender de CURP.
- No depender de password local.

Debe resolver:
- `auth0_user_id`
- `cardholder_sync_id`

---

## 7. Política de staging

Definir:

- `pending` y `error` → eliminables por TTL
- `accepted` y `rejected` → conservar para auditoría
- No eliminar registros en proceso

---

## 8. Restricción de datos en lookup

`lookup` solo puede devolver:

- `registered`
- `message`
- `folio_tarjeta`

No devolver:
- nombres
- CURP masked
- domicilio

---

## 9. Endpoint legacy

`POST /cardholders/:curp/account`

Debe:
- devolver `410 Gone` o `403`
- no crear cuentas nuevas

---

## 10. Pruebas obligatorias

Validar:

- CURP no se guarda en claro
- CURP no aparece en logs
- staging cifrado correctamente
- endpoints no exponen PII

---

## Conclusión

Sin estos ajustes:
- hay riesgo de fuga de datos
- hay riesgo de duplicidad
- hay riesgo de bypass en autenticación

Con estos ajustes:
- el sistema queda consistente
- el modelo de seguridad se cumple
- la implementación es controlable
