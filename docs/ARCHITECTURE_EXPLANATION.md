# Arquitectura y Seguridad del Proyecto

El siguiente documento proporciona un análisis de la arquitectura técnica y operativa del sistema, con un enfoque particular en las consideraciones de diseño y mitigación de riesgos implementadas a nivel backend.

## 1. Cumplimiento y Seguridad de la Información (Bases ISO 27001)

El sistema Tarjeta Joven procesa Información Personal Identificable (PII), tal como Claves Únicas de Registro de Población (CURP), fechas de nacimiento, nombres y locaciones geográficas. Por consiguiente, la arquitectura técnica integra controles alineados a estándares internacionales de gestión de seguridad de la información como la norma ISO 27001, con prioridad en salvaguardar la confidencialidad, integridad y disponibilidad del servicio:

- **Control de Peticiones y Limitadores de Tráfico (Rate Limiters):** Se integraron módulos para mitigar ataques de denegación de servicio o enumeración de identidades. En los procesos de validación de estatus, el sistema implementa una restricción de bloque temporal tras superar el parámetro máximo de transacciones fallidas permitidas (ej. 5 intentos de búsqueda en 15 minutos), previniendo sustracciones masivas y repetitivas de información ciudadana.
- **Enmascaramiento de Información Sensible:** Como salvaguarda para mitigar la potencial fuga de datos personales a canales de visualización externos, se configuró una política condicional donde identificadores sensibles (CURP, teléfonos, etc.) se remiten ofuscados o trunados (`***4567`) desde el origen en el backend hasta los navegadores por defecto.
- **Expiración Temprana y Rotación por JWT (TTL Corto):** El otorgamiento de derechos mediante JSON Web Tokens se limita intencionalmente a ventanas temporales de corta duración (15 minutos). Esto restringe de forma radical el periodo crítico de vulnerabilidad ante un potencial escenario de secuestro de identificadores de sesión. La renovación perpetua estipula un paso de verificación continua por medio de Refresh Tokens.
- **Códigos Reversibles Temporalmente (OTP):** Los métodos de validación exentos de constraseñas dinámicas proceden mediante el despliegue de códigos de validación única asimétricos con periodo estricto de validez temporal.

## 2. Flujos de Autorizaciones e Identidad

El mecanismo de asimilación de estatus y validación del ciudadano exige procesos críticos disociados por un control asíncrono temporal:

1. **La Verificación Controlada (`POST /cardholders/lookup`):** Examina la autenticidad y el estatus técnico de un titular disminuyendo la exposición lateral de datos en las respuestas. Al avalar un recurso, este punto origina un estado transitorio y genera un identificador que autoriza una ventana de oportunidad de solo 15 minutos continuos (`pending_account_until`).
2. **El Procesamiento Exclusivo (`POST /cardholders/:curp/account`):** Durante la interacción en este endpoint, el sistema evalúa retrospectivamente la autorización condicional obtenida en la primera fase. Si la validación de tiempo superó su horizonte estipulado o si el origen carece de bandera temporal, se declina el registro sin contemplaciones.

Este punto particular secciona el cómputo y separa las etapas del alta de credenciales frente a posibles cuellos de botella de conectividad derivados del cliente.

## 3. Disposición Técnica de la Lógica de Software

El proyecto descansa sobre el principio de responsabilidad única de dependencias, lo cual facilita análisis periciales y auditorías futuras de código:

- **`src/routes/`**: Componentes abstractos cuya única responsabilidad es dirigir el protocolo HTTP derivando peticiones seguras hacia el middleware o rechazando envíos perjudiciales de la forma más rápida y menos computacional posible.
- **`src/controllers/`**: Manejador central que asimila y formatea la estructura de cuerpos HTTP y coordina el estado general de las tablas internas del subsistema de datos o de los directorios en disco correspondientes.
- **`src/middleware/`**: Fronteras inmutables que encapsulan normativas tales como requerimientos de control de roles (`RBAC`), topes o bloqueos de IPs (`Rate Límit`), y blindaje contra injerencia externa de cabeceras en exploradores Web (`Helmet`, No Cache headers).
- **`src/config/db.js`**: Controlador de conexiones asíncrono estructurado por el motor de transacciones (`mysql2/promise`) a favor de minimizar la obstrucción y encolamiento por Entrada/Salida a nivel del Event Loop primario y mantener la concurrencia intacta.
