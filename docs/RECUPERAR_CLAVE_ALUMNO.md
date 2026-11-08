# Ragnar | Recuperar contraseña de alumno activado

## Si ya activaste un alumno y no puede entrar

1. **No uses otra vez "Activar cuenta"** ni borres su ficha. Los documentos `clients/{id}`, sesiones, pagos y mensajes permanecen.
2. Abrí Firebase Console → proyecto **`ragnar-5f8d7`** → Authentication → Users. Buscá el correo del alumno. Comprobá si existe y que su UID coincida con el campo `studentUserId` que figura ahora en la ficha Firestore.
3. Confirmá que intentás iniciar sesión en el **enlace de staging**, no en la app principal `ragnar-entrenamienrto.netlify.app` ni en la original de la empresa. El enlace correcto se ve en la pantalla de login como **Entorno de prueba · Firebase ragnar-5f8d7**.
4. Volvé a cargar la pestaña de pruebas. En **Accesos alumnos**, una ficha activada ahora muestra **Generar otra contraseña temporal**, sin duplicar la cuenta. Para funcionar necesita la variable secreta de Netlify configurada como indica el siguiente apartado.

## Configurar restablecimiento desde el coach (una sola vez)

No es una Firebase Cloud Function ni requiere pasar a Firebase Blaze: se utiliza una **Netlify Function** como servidor para Firebase Admin.

1. Entrá en [Firebase Console](https://console.firebase.google.com/), seleccioná `ragnar-5f8d7`.
2. Abrí el engranaje → **Configuración del proyecto → Cuentas de servicio**.
3. Seleccioná **Generar nueva clave privada**. Se descargará un archivo JSON. **Nunca lo subas a GitHub, a ChatGPT ni a la web pública**. Guardalo en un lugar protegido.
4. Abrí el JSON en el Bloc de notas de Windows, seleccioná todo y copiá su contenido.
5. Abrí [Netlify](https://app.netlify.com), elegí el sitio **personal Ragnar** que publica el branch deploy.
6. En **Project configuration → Environment variables**, creá una variable con nombre exacto `RAGNAR_FIREBASE_SERVICE_ACCOUNT` cuyo valor sea **todo el contenido del JSON**, incluidas las llaves `{` y `}`. Marcala como secreta/contains secret values si la interfaz ofrece esa opción.
7. Si Netlify ofrece limitación por contexto de rama, asignala **solo** a `staging/ragnar-5f8d7`; si no, asegurate de restringir el acceso a colaboradores, despliegues y ramas confiables. Nunca uses una variable con prefijo `VITE_` para este secreto.
8. Guardá y **volvé a desplegar la rama staging** para que la función lea la variable en tiempo de ejecución.
9. En el Ragnar de prueba iniciá sesión otra vez como coach (el backend exige autenticación reciente).
10. Abrí **Accesos alumnos → Generar otra contraseña temporal** del alumno ya activado. Una función de servidor comprueba token Auth y `coaches/{uid}.enabled=true`, busca el `studentUserId` de la ficha y actualiza **esa misma cuenta**.
11. Copiá la nueva clave una vez y probá el acceso desde una ventana privada con **la URL de staging** y el correo exacto del alumno.
12. Cuando entre, comprobá que vea sus sesiones y pagos históricos y que pueda cambiar la contraseña en **Mi Perfil**.

## Advertencias importantes

- No se guardan contraseñas nuevas en Firestore. Solo quedan registro de última modificación y coach que la realizó.
- No funciona con email de recuperación cuando el correo `@ragnar.com` no existe realmente.
- El restablecimiento invalida la contraseña anterior. No vuelve a crear la cuenta ni toca sesiones, pagos o mensajes.
- Si faltan variables en Netlify, la app mostrará un error de configuración, **no** modificará la cuenta.
- Si Firestore y Auth no coinciden en UID o correo, la función falla con un mensaje de diagnóstico. No los cambies manualmente sin revisar antes.
- El secreto de Firebase Admin equivale a acceso administrativo al proyecto. No lo compartas y no lo guardes en archivos públicos. Para revocarlo, eliminá la clave en Google Cloud y generá otra.
- Las Netlify Functions y sus variables de entorno deben verificarse con un despliegue real. Una compilación aprobada en GitHub no confirma que la función esté publicada ni configurada.

## Estado del trabajo

Se modificó **solo** la rama `staging/ragnar-5f8d7`, no la rama `main`. Necesitamos configurar la variable privada y validar una cuenta real de prueba antes de usar el restablecimiento masivamente.
