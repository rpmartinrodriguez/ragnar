# Ragnar | Validación después de importar a Firebase ragnar-5f8d7

## Estado actual

- Rama `main`: la aplicación estable de tu Netlify personal sigue conectada a Firebase antiguo `ragnar-training`.
- Rama `staging/ragnar-5f8d7`: copia conectada a `ragnar-5f8d7` para comprobar migración, sin afectar `main`.
- Los documentos Firestore importados mantienen ID de clientes, sesiones, mensajes y pagos.
- Aún falta restaurar las cuentas de Firebase Authentication de los alumnos y comprobar permisos.

## Primero: probar al entrenador

1. En Netlify crear un SEGUNDO sitio desde GitHub `rpmartinrodriguez/ragnar`, con branch `staging/ragnar-5f8d7`, build `npm ci && npm run build` y publish `dist`.
2. En Firebase nuevo, `Authentication → Users`, comprobar que tu usuario de entrenador exista.
3. En Firestore nuevo, colección `coaches`, crear documento con ID igual al UID de esa cuenta; campo `enabled` (boolean) = true.
4. Publicar las reglas de Firestore que habilitan `coaches/{UID}` sin otorgar permisos a cualquier usuario autenticado.
5. Entrar con tu cuenta NUEVA en el Netlify de staging. En Mis Atletas, comprobar cantidad y nombres sin editar todavía.
6. En Configuración → Control de migración: comprobar cantidad de fichas, perfiles con UID antiguo y sin UID. Si aparece un grupo con UID de entrenador anterior, seleccionarlo y usar 'Asignar este grupo al entrenador actual' solo tras verificar que sea el mismo entrenador.
7. Comparar en forma manual una selección de fichas: fechas y rutinas, sesiones históricas, pagos y mensajes.

## Segundo: cuentas de alumnos sin perder el vínculo

Los datos históricos contienen `studentUserId` del Firebase original. Firebase Authentication nuevo NO trae esas cuentas al importar Firestore. Podemos restaurar el mismo UID usando el Admin SDK (documentación oficial Firebase), de modo que el vínculo con `clients/{id}` siga funcionando.

En la computadora (NO subir respaldo ni clave privada a GitHub):

```bash
git clone https://github.com/rpmartinrodriguez/ragnar.git
cd ragnar
git checkout staging/ragnar-5f8d7
cd scripts/migration
npm install
node create-student-auth.mjs --backup="C:/ruta/ragnar-backup-AAAA-MM-DD.json" --target=ragnar-5f8d7
```

El último comando es una SIMULACIÓN: informa cantidades de cuentas recuperables, sin conectarse a Firebase. Se requiere JSON original versión 2, completo y sin errores.

Después de revisar el resultado, solo si todas las condiciones se cumplen, generar una cuenta de servicio privada del PROYECTO NUEVO (Firebase Console → Project settings → Service accounts → Generate new private key), guardarla fuera del repo y ejecutar:

```bash
node create-student-auth.mjs --backup="C:/ruta/ragnar-backup-AAAA-MM-DD.json" --target=ragnar-5f8d7 --service-account="C:/ruta/clave-del-firebase-nuevo.json" --confirm-target=ragnar-5f8d7 --execute
```

El script crea cuentas de Authentication con el UID que aparece en el perfil importado. Asigna una contraseña fuerte aleatoria no mostrada ni almacenada por el script y NO envía correos automáticamente. Los alumnos deben pedir recuperación con '¿Olvidaste tu contraseña?' en la pantalla de inicio de sesión de Ragnar staging, usando su email asociado.

Advertencia: los alumnos sin email válido o sin UID anterior no pueden recuperarse automáticamente. Necesitarán una vinculación individual y segura; el enlace de invitación anterior está temporalmente deshabilitado en staging porque exponía el perfil antes de autenticar.

## Tercero: pruebas antes del cambio de base

- Verificar 1 cuenta de coach y al menos 2 cuentas de alumnos reales con autorización de sus titulares.
- Comprobar sesiones, mensajes, pagos, calendario, comunidad y guardado de un entrenamiento de prueba en el Firebase nuevo.
- Si aparece `permission-denied`, comprobar reglas, `coaches/{UID}`, vínculos de alumno y consultas de grupo.
- Si aparece `failed-precondition`, seguir el enlace de Firebase para crear el índice que falta.
- No mover el dominio ni enviar alumnos a la nueva versión hasta terminar estas pruebas.

**IMPORTANTE:** el script Authentication NO se ha ejecutado. Requiere autorización y los archivos locales privados, que nunca se deben adjuntar en un chat.

## Gestión de accesos desde el panel del coach (staging)

- En la rama `staging/ragnar-5f8d7` se agregó un menú **Accesos alumnos** en escritorio y teléfono.
- El coach puede buscar por nombre/correo, copiar el correo y solicitar directamente a Firebase un email de restablecimiento de contraseña para la cuenta del alumno, si existe en Authentication del Firebase nuevo.
- NO es posible ver la contraseña actual de un alumno. Este panel no la guarda ni la comparte.
- El UID de alumno guardado en Firestore NO confirma que la cuenta de Firebase Authentication ya haya sido creada. La solicitud de restablecimiento puede procesarse sin que exista destinatario; se deben crear/verificar las cuentas previamente.
- La edición de nombre, plan y datos personales sigue disponible en Mis Atletas. Cambiar el correo de una ficha de Firestore NO modifica por sí mismo el correo de Firebase Authentication.
- Para que el coach pueda establecer directamente una contraseña temporal se necesita además una función administrativa de servidor con Firebase Admin SDK y verificación estricta de permisos; nunca habilitar desde el navegador el SDK de administración.

**Visibilidad de ramas:** GitHub > repositorio `rpmartinrodriguez/ragnar` > selector `main` (sobre la lista de archivos) > escribir `staging/ragnar-5f8d7`. Netlify no publica automáticamente todas las ramas. Crear un segundo sitio desde el mismo repositorio seleccionando esta rama o habilitar Branch deploys. No reorientar el sitio principal a la rama staging hasta validar la migración.
