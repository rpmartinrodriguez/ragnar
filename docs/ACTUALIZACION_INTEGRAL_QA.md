# Ragnar · Actualización integral UX, Entrenador, Alumno y Push

## Alcance

Rama exclusiva: `staging/ragnar-5f8d7` (Firebase `ragnar-5f8d7`). Se mantiene **sin cambios `main`** y el Firebase original.

## Cambios incorporados al código

### Calendarios en modo oscuro
- Forzados colores zinc/negro/amarillo para React Calendar en agenda, vista de alumno y ficha del entrenador.
- Ajustados contraste, días fuera de mes, rango, fecha de hoy y fecha seleccionada; sin fondos blancos.

### Entrenador / administrador
- Panel «Hoy en Ragnar»: entrenamientos del día, terminados, mensajes sin leer y próximas fechas de renovación.
- Ficha 360°: modalidad, plan, acceso, actividades de últimos 30 días, última sesión finalizada, mensajes y último pago registrado.
- Planificación por bloques de 4, 6 u 8 semanas, con días elegibles, desde la vista del alumno. Protegida por transacciones para no reemplazar actividades finalizadas, series realizadas, notas ni pesos.
- Preferencias de push por evento en Configuraciones: finalización, mensajes, notas, ausencias.
- Se conservan las funciones previas: calendario individual/global, copiar día/rango, plantillas, rutinas, chat, pagos y medallas.

### Alumno
- Nueva vista Inicio con acceso directo a la sesión de hoy, estado, último registro, calendario, chat y estadísticas.
- Bandeja de avisos con historial, activar/desactivar push por dispositivo, prueba, avisos leídos y acceso a chat/planificación.
- Mensajes push por nota de entrenador, rutina asignada/modificada, renovación mensual próxima.
- Recordatorio en pantalla los últimos 3 días de renovación, cuando esa cuota todavía no figura pagada.
- Aviso en vivo cuando el coach registra el pago y recuperación de acceso sin reinstalar la aplicación.
- Escala de esfuerzo percibido (1–10) al finalizar sesión, visible también para el coach.
- Aviso de ausencia de conexión en el entrenador y alumno. **No hay modo offline de guardado garantizado**.

## Modelo de aviso de renovación (importante)

**startDate** en la ficha representa el **día base de cobro / renovación mensual**, NO necesariamente un contrato con fecha fija de expiración. El recordatorio usa ese día y busca el documento `clients/{id}/payments/{YYYY-MM}`:

1. Calcula la próxima renovación según `startDate`, clampa el día 29/30/31 al último válido de cada mes y usa hora argentina.
2. Exactamente 3 días antes, si el período de renovación ya figura `paid`, **no envía aviso**.
3. Si no está abonado, crea una notificación persistente `studentNotifications/renewal-YYYY-MM-DD` y envía FCM a dispositivos registrados.
4. El ID fijo impide avisos duplicados del mismo período.
5. El alumno ve el recordatorio al entrar a Ragnar ese día si no recibió push.
6. `renewal-reminders.mjs` ejecuta la revisión a las **09:00 Argentina** (`0 12 * * *` UTC) cuando hay un **deploy publicado**.
7. **En el Branch Deploy staging, Netlify NO ejecuta el cron automáticamente**. Para probarlo, ir a Netlify → Functions → renewal-reminders → Run now. Los avisos por mensajes/rutinas sí se disparan desde staging porque utilizan funciones HTTP normales.
8. La tarea programada se activará en el despliegue principal cuando se publique la migración; hasta entonces no prometer avisos diarios automáticos con Ragnar cerrado.

Documentación Netlify: https://docs.netlify.com/build/functions/scheduled-functions/

## Lista de pruebas funcionales obligatorias

### 1. Calendarios
- Agenda general, ficha del coach, calendario del alumno, selección de día y rango: **ningún fondo blanco**.
- Comprobar legibilidad en PC, Android y PWA iPhone.

### 2. Entrenador
- Panel: cifras de actividad del día coinciden con las sesiones Firestore; dar clic en tarjeta de alumno.
- Ficha 360°: actividad y último pago coinciden con datos del alumno.
- Planificar bloque de 4 semanas en alumno de prueba; comprobar cada fecha.
- Intentar reemplazar una sesión completada: la transacción debe **bloquear el pegado completo**.
- Activar/desactivar tipo de push y confirmar que solo afecta los avisos externos, no los registros internos.

### 3. Alumno
- Abrir Ragnar y revisar Inicio, calendario, chat, progreso, Perfil y bandeja de avisos.
- Desde Avisos, presionar Activar push y Enviar prueba. Requiere consentimiento explícito y navegador compatible. En iPhone usar la PWA instalada.
- Desde el coach, enviar un mensaje. Confirmar push, bandeja y navegación a Chat.
- Desde el coach, asignar/modificar una rutina. Confirmar push, bandeja y que la fecha se muestre en el calendario.
- Finalizar sesión con esfuerzo elegido; comprobar la calificación en vista entrenador.
- Marcar una cuota como pagada; la advertencia debe desaparecer y el alumno recuperar acceso si correspondía.

### 4. Renovación a tres días
- Usar alumno de prueba con fecha base de cobro dentro de 3 días, sin pagar el período venidero.
- Abrir Inicio y comprobar alerta; entrar a bandeja y comprobar aviso.
- Probar Netlify → Functions → renewal-reminders → Run now (no será automático en Branch Deploy).
- Registrar ese período como pagado y ejecutar de nuevo: **no debe enviar un aviso nuevo**.
- Revisar meses cortos y día base 31 (tests de `billingCycle.test.mjs`).

## Seguridad

- El JSON privado de Firebase Admin sigue en Netlify (`RAGNAR_FIREBASE_SERVICE_ACCOUNT`). Nunca exponerlo en React ni en el repositorio.
- El servidor de avisos verifica JWT, tipo de usuario, vinculación UID/ficha y documento real.
- Los avisos persisten sin volcar texto completo de mensajes en el push.
- La app conserva el mismo `clientId`, todas las subcolecciones y los UIDs históricos.
- Los tests automáticos verifican sintaxis y reglas puras, NO sustituyen tests de integración reales de Firestore/Netlify ni la auditoría final de reglas por rol.

## Funcionalidades que requieren una etapa aparte antes de confirmar «todas terminadas»

- Modo offline con cola robusta de series y resolución de conflictos, más prueba de PWA iOS.
- Roles multi-entrenador y permisos administrativos granulares (requieren auditoría de Security Rules y migración controlada).
- Superseries complejas, ajustes automáticos de progresión y editor avanzado con todos sus casos límite.
- Auditoría y pruebas exhaustivas de estadísticas/cobros de períodos históricos y exportación.
- Accesibilidad integral con pruebas manuales de teclado, lectores de pantalla y dispositivos reales.

**No promocionar a `main` antes de las pruebas de arriba.**
