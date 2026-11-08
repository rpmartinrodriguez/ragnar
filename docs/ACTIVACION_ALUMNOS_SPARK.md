# Ragnar · Activación de alumnos sin plan Blaze

## Por qué funciona con Firebase Spark

El historial de cada alumno vive en el documento `clients/{clientId}` y sus subcolecciones `sessions`, `messages`, `payments`; el valor `studentUserId` identifica qué cuenta Auth puede acceder a esa ficha. Para preservar historial no es necesario conservar el viejo UID de Authentication.

## Activación desde Accesos alumnos en la rama de prueba

1. El entrenador inicia sesión en Firebase nuevo `ragnar-5f8d7` y abre `Accesos alumnos`.
2. Elegí una ficha de un alumno de prueba y confirmá **Activar cuenta y generar clave temporal**.
3. Ragnar verifica permisos del coach consultando la base (protegida por reglas Firestore).
4. Abre una instancia **secundaria** de Firebase Auth con persistencia en memoria y crea la cuenta del alumno con su email de la ficha y una clave criptográficamente aleatoria.
5. Sin modificar la sesión del coach, actualiza `clients/{clientId}.studentUserId` al UID nuevo mediante una transacción. Guarda el UID viejo en `legacyStudentUserId` y marca `accountAccessStatus: activated`.
6. Si el vínculo a Firestore falla, intenta borrar la cuenta Auth recién creada para no dejar una cuenta huérfana.
7. La clave se muestra solo en el modal del coach, sin guardar en Firestore. El coach copia las credenciales y luego cierra el modal.
8. El alumno abre el **enlace de la rama de prueba** únicamente para validar su acceso; cuando se publique `main`, utilizará el dominio Netlify personal definitivo.
9. El alumno puede cambiar su contraseña desde `Mi Perfil → Mi contraseña`, verificando la clave anterior.

## Limitaciones y seguridad

- Esto **no** crea Firebase Cloud Functions y funciona con Authentication Email/Password del plan Spark, sujeto a cuotas normales.
- La cuenta nueva tiene UID nuevo. Las relaciones históricas permanecen porque mantienen su `clientId`.
- El correo debe ser **único y válido** para Firebase Auth. Puede funcionar como identificador aunque la casilla real no exista; en ese caso la recuperación por email **no funciona**.
- El entrenador **no** puede consultar la contraseña privada actual de un alumno.
- Si se pierde la clave de una cuenta con email ficticio, la recuperación debe resolverse con un servicio administrativo seguro (por ejemplo, una Netlify Function con Firebase Admin y comprobación del rol del entrenador), **todavía no implementado**.
- La interfaz marca como activados solamente los perfiles creados mediante este proceso; los UID anteriores importados no demuestran que las cuentas Auth existan en el Firebase nuevo.
- No activar todos los alumnos ni distribuir masivamente contraseñas antes de validar el primer caso con consentimiento del alumno.
- No usar la rama de prueba como PWA definitiva. La app del dominio viejo requerirá volver a instalarse en el dominio nuevo.
- Si ya tienen instalada la PWA del dominio Netlify personal definitivo y el dominio no cambia, normalmente podrán recibir nuevas versiones sin reinstalar.

## Primer control

Comprobar que la ficha del alumno de prueba tenga el mismo `clientId`, sesiones y pagos, y que el entrenador siga autenticado después de activar su cuenta. Probar ingreso del alumno y cambio de contraseña. Si Firestore responde permission-denied o Firebase Auth responde email-already-in-use, detener y revisar, sin borrar datos.
