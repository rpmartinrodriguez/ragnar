# Ragnar · Primer acceso con clave temporal y pantalla móvil (staging)

Rama: `staging/ragnar-5f8d7`. No modificar `main` ni el Firebase de producción.

## 1. Nuevo primer acceso

- Cuando el coach activa una cuenta, Firestore guarda `passwordChangeRequired: true` en `clients/{id}` y no guarda jamás la clave temporal.
- Cuando el coach restablece la clave, el servidor vuelve a activar `passwordChangeRequired: true`.
- Al ingresar como alumno con Firebase Auth y cargar su perfil, Ragnar abre automáticamente el modal **Protegé tu cuenta**.
- La contraseña temporal aparece oculta y **verificada** (no se copia ni almacena otra vez); el alumno solo escribe **Nueva contraseña** y **Confirmar**.
- El backend `change-student-password` confirma JWT, proyecto nuevo, UID/vinculación del perfil y que el ingreso se realizó en los últimos **10 minutos**. Utiliza Firebase Admin para cambiar la clave y deja `passwordChangeRequired: false`, `passwordChangedAt`.
- Se muestra la confirmación **¡Contraseña actualizada!**, con botón **Entrar a Ragnar**.
- Si una sesión guardada tiene más de 10 minutos, el alumno debe volver a iniciar sesión con la clave temporal. No se pide ni almacena la clave antigua desde el modal.
- Compatibilidad: cuentas activadas previamente que tengan `accountActivatedAt` o `authPasswordResetAt` y carezcan de `passwordChangedAt` también reciben la invitación; si ya cambiaron la clave manualmente antes de esta versión, puede solicitarles cambiarla una vez adicional.
- En caso excepcional de que Firebase cambie la contraseña pero no pueda confirmarse el campo de Firestore, se muestra un mensaje explícito para volver a ingresar **con la clave nueva**. Nunca indicar que use de nuevo la temporal después de una respuesta `passwordUpdated: true`.

## 2. Ajustes para iPhone y pantalla móvil

- Cabecera del coach adaptativa: logo corto en pantallas de menos de 375 px, botones siempre visibles, ancho fluido.
- Contenedores con `height:100dvh`, `min-width:0`, scroll vertical interno y protección contra desbordes horizontales.
- Respeto a las áreas seguras del iPhone, incluso al usar PWA instalada.
- Cabecera del alumno con nombre largo sin desplazar la campanita ni el menú.
- Serie, repeticiones y kilos con cuatro columnas flexibles, inputs sin ancho mínimo rígido.
- Modales con scroll vertical y altura máxima dependiente de la pantalla, incluyendo al mostrar el teclado.
- Tamaño mínimo 16 px en campos de formulario móviles para evitar zoom automático de Safari.
- Modal de compartir victoria reducido para iPhone SE y pantallas de poca altura.
- Se conserva el calendario oscuro y la navegación inferior del alumno.

## 3. Validación sugerida

### Contraseña temporal
1. Desde el coach de staging, activar un alumno de prueba o restablecer su contraseña.
2. Abrir la URL de staging como alumno en otro navegador o ventana privada.
3. Ingresar con usuario y contraseña temporal; el modal debe abrirse automáticamente.
4. Confirmar que NO pide escribir nuevamente la clave temporal.
5. Probar claves de menos de 10 caracteres y confirmación distinta: se bloquea el envío.
6. Ingresar una nueva clave de 10+ caracteres, confirmarla y comprobar el mensaje de éxito.
7. Cerrar sesión e ingresar con la clave nueva; debe entrar sin modal. La antigua debe dejar de funcionar.
8. Reemitir la clave desde el coach y comprobar que reaparece la obligación, sin afectar rutinas ni pagos.

### Safari / PWA iPhone
1. Abrir staging en Safari, en modo vertical y horizontal.
2. Comprobar **Login**, **Inicio alumno**, **Agenda**, **Entrenamiento/series**, **Chat**, **Progreso**, **Perfil**, **Notificaciones**.
3. Como coach, comprobar **Panel Principal**, **Mis Atletas**, **Ficha 360°**, **Planificación**, **Rutinas**, **Cobros**, **Configuraciones**.
4. Probar teclado abierto en los campos de contraseña, kilos, repeticiones y formularios de modales.
5. Confirmar que se puede llegar a todos los botones con scroll y no hay desplazamiento lateral.
6. Repetir en la PWA instalada, teniendo en cuenta que las instalaciones de producción y staging tienen orígenes diferentes.

**Compilación automática correcta no sustituye la prueba en un dispositivo iPhone.**
