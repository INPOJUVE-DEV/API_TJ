# Checklist de Entrega para Frontend

## Base tecnica

- Proyecto `React + Vite + TypeScript` creado.
- Router configurado.
- Cliente API centralizado.
- Estado de sesion implementado.
- `sessionStorage` cableado para rehidratacion.
- Guardas de rutas por autenticacion y rol.

## Pantallas

- Login funcional.
- Dashboard funcional.
- Lista de convenios funcional.
- Formulario de alta y edicion de convenio funcional.
- Lista de usuarios funcional.
- Detalle de usuario funcional.
- Alta y edicion de usuario funcional.
- Reset de password funcional.
- Lista de staging funcional.
- Detalle de staging funcional.
- Vista de intentos funcional.

## Seguridad y permisos

- Todas las rutas privadas validan sesion.
- `reader` no ve acciones de escritura.
- `admin` si ve acciones de escritura.
- `401` limpia sesion.
- `403` muestra mensaje de permisos.
- No se imprime token en consola.
- No se imprime payload sensible en logs del navegador.

## Integracion API

- Usa `POST /api/v1/admin/auth/login`.
- Usa `GET /api/v1/admin/session`.
- Usa `POST /api/v1/admin/auth/logout`.
- Usa `/api/v1/catalog` para convenios.
- Usa `/api/v1/admin/lookups` para formularios.
- Usa `/api/v1/admin/users*` para usuarios.
- Usa `/api/v1/admin/beneficiarios-staging*` para staging.

## Calidad

- Formularios con validacion cliente basica.
- Errores de backend visibles para usuario.
- Estados loading, empty y error cubiertos.
- Acciones destructivas con confirmacion.
- Navegacion keyboard-friendly.
- Layout usable en desktop y tablet.

## Entregables esperados al cerrar frontend MVP

- App instalable como PWA.
- README del frontend con setup.
- Variables de entorno del frontend documentadas.
- Capturas o demo de login, dashboard, convenios, usuarios y staging.
