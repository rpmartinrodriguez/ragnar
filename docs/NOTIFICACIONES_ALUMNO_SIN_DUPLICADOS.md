# Ragnar · Notificaciones del alumno sin duplicados

**Rama:** `staging/ragnar-5f8d7` — no modificar `main`.

## Cambios incluidos

### Estado push real por dispositivo
- La bandeja verifica **permiso de Notification**, **PushManager**, **Service Worker activo**, suscripción push existente y **FCM token registrado para este dispositivo en Firebase nuevo**.
- **No asume** que las notificaciones de este iPhone funcionan solo porque otro dispositivo del alumno está registrado.
- Cuando los controles verifican suscripción activa: muestra **Notificaciones activas**, con acciones secundarias de comprobar entrega y desactivar.
- Cuando no hay suscripción real: muestra la opción principal **Activar notificaciones**; no envía un nuevo permiso automáticamente.
- Si está bloqueado el permiso en iPhone, pide habilitarlo en ajustes del dispositivo; el historial interno sigue disponible.
- La verificación se renueva al entrar, regresar a la pestaña o retomar la PWA.

### Lectura inteligente de avisos
- **Abrir Chat** confirma como leídos todos los avisos de tipo `coach_message`.
- **Abrir Agenda / Entrenamiento** confirma los avisos de `routine_updated`.
- **Abrir Perfil** confirma los avisos de renovación `renewal`.
- Si llega push mientras la sección correspondiente ya está abierta, Ragnar confirma su lectura automáticamente y no muestra un aviso redundante dentro de la app.
- Se puede seguir leyendo el **Historial**: los documentos no se borran físicamente. El listado por defecto muestra solo **Pendientes** y ofrece **Ver historial**.
- Los avisos de prueba se crean ya como leídos y las pruebas antiguas se limpian al abrir la bandeja.
- La campanita ya no suma dos veces el mismo mensaje por aparecer también en Chat. El chat mantiene su indicador independiente.
- El endpoint `mark-section` verifica el Firebase ID token y que la cuenta pertenece al alumno. Usa consultas de avisos pendientes para evitar consultas costosas al historial completo.

## Pruebas manuales necesarias

1. Alumno con push ya activas en iPhone: abrir campanita. Debe figurar **Notificaciones activas**. No debe aparecer el botón principal de activación.
2. Desactivar push en ese dispositivo y volver a abrir campanita: debe aparecer **Activar notificaciones**. Si la app está instalada en otro dispositivo, eso NO debe activar el indicador de este.
3. Enviar dos mensajes del coach: el alumno ve dos avisos pendientes. Entrar a **Chat** desde uno; volver a campanita: no deben quedar avisos de esos mensajes.
4. Asignar y modificar rutinas: abrir **Agenda** desde una notificación y regresar: no deben quedar pendientes de cambios de rutina ya atendidos.
5. Abrir **Perfil** y revisar renovaciones: los avisos de renovación pasan al historial.
6. Enviar **Probar entrega** varias veces: no deben aumentar el contador de pendientes.
7. Probar push con el alumno mirando Chat: el mensaje se registra en el chat pero no genera una notificación persistente pendiente ni un toast redundante tras procesarse el evento.
8. Confirmar que mensajes y rutinas originales permanecen intactos; el servidor solo cambia `read` y `readAt` en `studentNotifications`.
9. Probar renovación de permisos desde Configuración de iPhone y reabrir PWA, verificando actualización del indicador.
10. Revisar el comportamiento en Safari y PWA instalada; el permiso de push depende del origen de instalación.

## Limitaciones conocidas

- GitHub Actions verifica código y compilación; **no** confirma la entrega de push en iPhone ni el resultado de cada llamada a la API de Netlify. Se debe probar en un dispositivo real.
- Un aviso externo ya mostrado por iOS puede permanecer en el Centro de Notificaciones del teléfono. Lo que se marca como leído automáticamente es **la campanita interna de Ragnar**, no el historial del sistema operativo.
- No se usan notificaciones silenciosas ni suscripciones web automáticas al abrir la app.
