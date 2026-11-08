# Ragnar — Push del entrenador y primera revisión profesional (rama staging)

## Estado

Esta implementación vive exclusivamente en `staging/ragnar-5f8d7`. La rama `main` y el Firebase antiguo siguen sin modificar.

**Lo que está implementado:**

- Avisos push FCM para el coach por finalización de entrenamiento, mensaje del alumno y ausencia justificada.
- Registro de dispositivos con verificación real de `coaches/{uid}.enabled=true` desde Netlify Functions, nunca desde el cliente.
- Verificación del UID del alumno y del documento de sesión/mensaje antes de autorizar el envío; protección frente a reintentos duplicados mediante `ragnarPushDispatch`.
- Entrega de avisos en segundo plano mediante `firebase-messaging-sw.js` y aviso dentro de Ragnar cuando está abierto.
- Configuración, activación, desactivación y prueba push en **Configuraciones → Notificaciones push del entrenador**.
- Arreglos en la sección Notificaciones: evitar escuchas anidadas duplicadas, corregir lectura de pagos, ordenar con seguridad, mejorar marcado masivo como leídas.
- Evitar doble finalización de una misma sesión mediante bloqueo de botón mientras guarda.

## Configuración necesaria en Firebase (una sola vez)

1. Entrá a [Firebase Console](https://console.firebase.google.com/), elegí **ragnar-5f8d7**.
2. Abrí **Configuración del proyecto → Cloud Messaging**.
3. En **Configuración web → Certificados push web** buscá **Generar par de claves** (Web Push certificates). Si ya existe un par, usá la clave pública existente.
4. Copiá **solo la clave pública VAPID** (cadena larga de letras y números). **No copies la clave privada ni el JSON de cuenta de servicio en Ragnar**.
5. Si Firebase solicita habilitar la API Firebase Cloud Messaging, completá ese requisito en Google Cloud para el mismo proyecto.
6. Abrí Ragnar en la rama de pruebas: `https://staging-ragnar-5f8d7--ragnar-entrenamienrto.netlify.app/`.
7. Iniciá sesión como entrenador y elegí **Configuraciones → Notificaciones push del entrenador**.
8. Pegá la clave pública VAPID y seleccioná **Guardar clave pública**. Se almacena en `settings/general.webPushVapidPublicKey`, visible para los coaches autorizados y reutilizable en sus dispositivos. Es una clave pública y no sustituye la privada de administración ya configurada en Netlify.
9. Presioná **Activar push**, aceptá el permiso del navegador, y luego **Enviar prueba**. Abrí otra pestaña o poné la aplicación en segundo plano para comprobar la notificación.
10. Probá con un alumno de prueba que envíe un mensaje o finalice una sesión. El evento se valida del lado del servidor y el entrenador debe recibir un aviso si está suscripto.

## Qué plataforma usar primero

Recomendado: Chrome en Windows/Android, con HTTPS y permisos concedidos.
En iPhone, Apple exige **iOS 16.4 o superior**, instalar la aplicación en la pantalla de inicio y conceder permiso desde esa aplicación. El soporte de FCM depende además del navegador y del SDK; si Ragnar dice que no es compatible, no se puede garantizar push en ese dispositivo sin implementar otra modalidad de Web Push.

La instalación PWA y el permiso push son **específicos de cada dominio**. Los tokens de staging no se trasladan automáticamente al dominio definitivo.

## Seguridad y limitaciones

- Para funciones push de servidor se usa la variable `RAGNAR_FIREBASE_SERVICE_ACCOUNT` que ya se configuró en Netlify para recuperar contraseñas; no se descarga ni expone en el código.
- **Firebase Cloud Messaging es un servicio gratuito en Spark**, pero Netlify Functions depende de sus propios límites de consumo.
- **La entrega push no está garantizada**: depende del dispositivo, permisos, navegador, batería, conectividad y servicio de push.
- El llamado del alumno a Netlify ocurre después de guardar el documento Firestore. Si el alumno cierra la app o pierde conexión inmediatamente, el push puede no dispararse; la notificación interna guardada en Firestore sigue disponible.
- Los eventos solo se envían a coaches habilitados, con búsqueda de UID de entrenador específico o, durante migración, si existe un solo coach habilitado.
- La clave VAPID pública puede configurarse desde el panel. **Nunca** pegar en él claves privadas, contraseñas ni archivos JSON.
- No compartir el link de staging como PWA definitiva ni mover `main` hasta terminar pruebas con cuentas de coach y alumno.

## Plan de mejoras por secciones

1. **Alumnos y accesos:** ingreso y clave temporal comprobados; seguir con recuperación del coach, verificación de cuentas sin correo real y ficha editable con estados claros.
2. **Notificaciones:** completar la prueba push en dispositivo del entrenador y diagnosticar navegador e iOS si hiciera falta.
3. **Rutinas y planificación:** agregar notas de alumno, mejorar copia de días, validación de ejercicios y calendario.
4. **UX/UI global:** optimizar navegación móvil, controles grandes, feedback al guardar, jerarquía visual, carga y errores.
5. **Estadísticas y cobros:** auditar cálculos, filtros y exportaciones sin romper relaciones existentes.

Documentación: https://firebase.google.com/docs/cloud-messaging/web/get-started
