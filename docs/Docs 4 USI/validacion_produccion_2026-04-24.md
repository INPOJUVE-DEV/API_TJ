# Validacion en produccion del 24 de abril de 2026

Documento preparado el 24 de abril de 2026 antes de las 14:30 hrs.

## Contexto

Se validaron llamadas reales contra:

```text
https://apitj-production.up.railway.app
```

Usando JWT RS256 del cliente:

```text
unidad_informatica
```

## Resultado de salud

- `GET /health` -> `200`
- body:

```json
{
  "ok": true
}
```

## Lookups validados

### CURP `FEFA090821MSPLLNA5`

- status: `200`
- respuesta:

```json
{
  "registered": true,
  "message": "El usuario ya se encuentra registrado con la tarjeta 4454",
  "folio_tarjeta": "4454"
}
```

### CURP `HEES090305MSPRLLA0`

- status: `200`
- respuesta:

```json
{
  "registered": true,
  "message": "El usuario ya se encuentra registrado con la tarjeta 9471",
  "folio_tarjeta": "9471"
}
```

### CURP `BAHC090421MSPTRNA4`

- status: `200`
- respuesta:

```json
{
  "registered": true,
  "message": "El usuario ya se encuentra registrado con la tarjeta 4452",
  "folio_tarjeta": "4452"
}
```

### CURP `HEHI090906MNLRRSA2`

- status: `200`
- respuesta:

```json
{
  "registered": true,
  "message": "El usuario ya se encuentra registrado con la tarjeta 4476",
  "folio_tarjeta": "4476"
}
```

## Staging validado

Se hizo una prueba real de staging y el backend respondio:

- status: `202`
- body:

```json
{
  "created": true,
  "status": "pending",
  "staging_id": 1
}
```

## Conclusiones

1. Railway autentica correctamente JWT RS256 de `unidad_informatica`.
2. El scope `cardholders.lookup` funciona en produccion.
3. El scope `beneficiarios.staging.create` funciona en produccion.
4. El contrato de respuesta del lookup no expone CURP en claro.
5. El flujo de Postman para USI queda habilitado con este paquete.
