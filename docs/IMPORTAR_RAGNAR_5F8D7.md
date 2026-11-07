# Ragnar: importar el respaldo al Firebase nuevo `ragnar-5f8d7`

## Estado y seguridad

- `https://ragnar-entrenamienrto.netlify.app/`: app principal; sigue apuntando a Firebase original `ragnar-training`.
- `https://ragnar-entrenamienrto.netlify.app/importar.html`: importación independiente; apunta exclusivamente a `ragnar-5f8d7`.
- Los usuarios y contraseñas de Authentication **NO** forman parte del JSON.
- La importación solo escribe en el Firebase nuevo; no borra datos.
- NO desconectar el Firebase original antes de validar el historial y la vinculación de los alumnos.

## Antes de importar

1. Desde la app principal, entrar como entrenador → Configuración → Descargar respaldo completo accesible. El archivo debe ser versión 2 y no parcial; confirmar el total de alumnos, mensajes, sesiones, pagos, etc.
2. En Firebase Console, seleccionar `ragnar-5f8d7`, crear Firestore vacío e implementar las reglas de seguridad de Ragnar.
3. Firebase Authentication → Sign-in method: activar Correo electrónico/Contraseña. En Users, crear cuenta para el entrenador.
4. Copiar UID del entrenador recién creado. Firestore Database → Data: crear colección `coaches`; crear documento con ID exactamente igual al UID; campo `enabled` (boolean) = `true`.
5. Dejar vacías las colecciones `clients`, `exercises`, `routines`, `trainerNotifications`, `communityFeed` y el documento `settings/general`.
6. En Netlify publicar la última rama `main` conectada a GitHub, comando `npm ci && npm run build` y carpeta `dist`.

## Pasos

1. Abrir `https://ragnar-entrenamienrto.netlify.app/importar.html`.
2. Iniciar sesión con el correo/contraseña del entrenador del Firebase **nuevo**.
3. Seleccionar en el propio navegador el archivo `ragnar-backup-AAAA-MM-DD.json` descargado previamente.
4. Comprobar que el resumen muestra cantidad correcta de alumnos y documentos, y que no hay errores ni advertencias de respaldo parcial.
5. Confirmar que la base nueva está vacía; escribir exactamente `ragnar-5f8d7` y hacer clic en Importar.
6. Mantener la pestaña abierta hasta el resultado final. Se escriben lotes de 150 documentos y se verifican los recuentos tras la carga.

## Después de importar

- **No** poner Ragnar nuevo en producción inmediatamente. Los alumnos todavía no tienen cuentas de Firebase Authentication nuevo vinculadas.
- Si el entrenador tiene UID nuevo distinto del original, hay que analizar la actualización del campo `trainerId` de sus fichas.
- Para alumnos con `studentUserId` antiguo: recrear cuentas con UID original usando Admin SDK y restablecimiento de contraseña, o establecer un nuevo flujo de vinculación segura con UID nuevo.
- Las reglas seguras del Firebase nuevo no permiten el registro anónimo por el enlace de invitación anterior; adaptar el registro antes de habilitar alumnos.
- Comparar usuarios, sesiones, mensajes, pagos, rutinas y estadísticas con el respaldo. Probar coach y alumnos en un despliegue separado.

## Si aparece un error

- `permission-denied` al verificar: revisar cuenta Auth nueva, reglas y `coaches/{UID}` habilitado.
- Firestore ya contiene documentos: el importador se niega a sobrescribir datos. No borres colecciones a ciegas; evaluar lo que hay.
- Respaldo PARCIAL: no se importa; repetir la descarga y resolver las lecturas denegadas.
- Error a mitad de importación: detener, revisar qué se escribió antes de reintentar. No usar la base parcialmente cargada como producción.
- Si el archivo pesa más de 200 MB, usar el importador de Node en `scripts/migration/import-backup.mjs` en lugar de la página web.

**Privacidad:** el JSON contiene datos personales. No subirlo a GitHub ni adjuntar cuentas de servicio o contraseñas a chats.
