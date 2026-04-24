# 🛡️ Reporte de Auditoría Rígida - ISO/IEC 27001:2022

## 1. Resumen Ejecutivo
Se realizó una auditoría rígida del código base y la infraestructura declarada en la API_TJ para evaluar su alineación con el estándar **ISO/IEC 27001:2022** orientado a SGSI (Sistema de Gestión de Seguridad de la Información). 

Se detectaron deficiencias significativas en los **Controles Organizacionales (A.5)** y los **Controles Tecnológicos (A.8)**, especialmente en la inyección de secretos, la encriptación de datos en tránsito interno y la ausencia de políticas documentadas.

---

## 2. Normas que se rompen o no existen (Hallazgos Críticos)

> [!WARNING]
> **Riesgo Alto:** Las siguientes violaciones representan las principales vulnerabilidades que comprometen el cumplimiento de los controles ISO 27001 en la aplicación.

### ❌ Controles Organizacionales (Anexo A.5)
- **A.5.1 Políticas para la seguridad de la información:** 
  - **Fallo:** No existen documentos ni políticas bajo el directorio `docs/` que dicten normas de gestión de usuarios, clasificación de datos o respuesta a incidentes.
- **A.5.15 Control de acceso lógico y físico:** 
  - **Fallo:** Aunque existe RBAC (ej. rol `admin`, `reader`, `scanner`), no hay un proceso formal documentado para la revocación de accesos ni rotación de claves en caso de despido o vulnerabilidad.

### ❌ Controles Tecnológicos (Anexo A.8)
- **A.8.9 Gestión de la configuración:** 
  - **Fallo:** En `docker-compose.yml` se declaran variables de acceso a la base de datos con contraseñas quemadas (hardcoded) como `MYSQL_ROOT_PASSWORD: example`.
- **A.8.12 Prevención de fuga de datos (DLP):**
  - **Fallo:** Variables como `EXPOSE_PII=true` y `OTP_DEBUG=true` en `.env` permiten exponer PII (CURP, Teléfono, OTP), lo cual conlleva el riesgo crítico de fuga de la confidencialidad de datos de ciudadanos si se usa incontroladamente o por error humano en producción.
- **A.8.16 Actividades de Monitoreo (Logs):** 
  - **Fallo:** La API usa `console.log` sin persistencia ni estandarización de logs estructurados. No hay control para auditar si un administrador manipuló indebidamente los beneficios del catálogo.
- **A.8.24 Uso de criptografía (Datos en Tránsito y Reposo):**
  - **Fallo (Tránsito):** El pool de conexión de `src/config/db.js` no exige configuración TLS (`ssl: { rejectUnauthorized: true }`). La comunicación entre la API y MySQL es en texto claro.
  - **Fallo (Hardcoding):** `JWT_SECRET: supersecreto` está expuesto en el `docker-compose.yml`.

---

## 3. Checklist Priorizado de Brechas y Remediación

> [!IMPORTANT]
> El enfoque está basado en riesgo. Las tareas prioritarias deben abordarse de inmediato para asegurar los entornos productivos.

- [ ] **P1 (Crítica) - Eliminar secretos hardcodeados:** Quitar de `docker-compose.yml` todos los secretos (ej. `MYSQL_ROOT_PASSWORD`, `JWT_SECRET`) y obligar a leerlos mediante la inyección segura un archivo `.env` restringido.
- [ ] **P1 (Crítica) - Desplegar TLS para base de datos:** Ajustar `src/config/db.js` para exigir la bandera TLS/SSL a MySQL, cubriendo el control de criptografía de canales A.8.24.
- [ ] **P1 (Crítica) - Candados a banderas Debug:** Asegurar de forma inmutable mediante el código (o validaciones de entorno) que `OTP_DEBUG=true` o `EXPOSE_PII=true` no puedan ser activados en producción.
- [ ] **P2 (Alta) - Implementación de Registro (Logging):** Incorporar librerías como `Winston` o `Pino` para enviar logs de seguridad a una salida estructurada centralizada que no pueda alterarse fálcimente (Cumplimiento de A.8.16).
- [ ] **P2 (Alta) - Documentación ISO base:** Crear la documentación `docs/policies/ACCESS_CONTROL.md` y `docs/policies/INCIDENT_RESPONSE.md` formalizando los flujos de gestión de crisis.
- [ ] **P3 (Media) - Auditoría de dependencias (A.8.8):** Sistematizar comprobaciones mediante `npm audit` o herramientas de SAST (ej. Github Advanced Security, SonarQube) en el `package.json` para escáneres de seguridad automatizados en CI/CD.

---

## 4. Roadmap de Corrección con Estimación de Tiempos

A continuación, la ruta de planeación estratégica para mitigar todas las brechas detectadas (1 semana de duración aproximada):

| Fase | Tareas a Ejecutar | Tiempo Estimado | Responsable |
|------|-------------------|-----------------|-------------|
| **Fase 1: Remediación Crítica (Día 1-2)** | - Remover Hardcoding de passwords en Compose.<br>- Obligar inyección vía variables de entorno estrictas (.env).<br>- Restringir variables DEBUG (`EXPOSE_PII`, `OTP_DEBUG`) en entorno prod.<br>- Configurar soporte TLS/SSL de base de datos (`db.js`). | 12 - 16 hrs | DevSecOps / Lead Developer |
| **Fase 2: Monitoreo Activo (Día 3)** | - Instalar y configurar `winston`/`pino`.<br>- Configurar rotación de logs y estructura JSON de salida para recolector tipo CloudWatch, ELK o similar. | 6 - 8 hrs | Backend Engineer |
| **Fase 3: Refuerzo Defensivo (Día 4)** | - Revisión del paquete `express-rate-limit` verificando cuotas seguras y umbrales.<br>- Limpiar middleware `helmet` asegurando CSP óptimo. | 4 - 6 hrs | SecOps |
| **Fase 4: Gobernanza y Documentación (Día 5)** | - Redactar la Política de Seguridad de la Información (A.5.1).<br>- Redactar la Política de Control de Acceso y Respuesta de Incidentes en directorio `docs/policies/`. | 4 - 8 hrs | Security / CISO |

> [!TIP]
> Una vez completado este roadmap, se recomienda volver a ejecutar la auditoría *ISO27001 Gap Analyzer* para evidenciar y avalar el cierre sistemático de vulnerabilidades hacia un informe SoA (Statement of Applicability) confiable.
