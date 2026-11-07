# Ragnar | Migración de datos a un Firebase propio

## 1. Respaldo antes de cambiar de base

La aplicación principal `rpmartinrodriguez/ragnar`, rama `main`, se conecta aún al Firebase original `ragnar-training`.

1. Ingresá a la copia de Ragnar en tu Netlify personal con la cuenta de entrenador existente.
2. Abrí **Configuración → Respaldo para migración**.
3. Elegí **Descargar respaldo completo accesible**. El navegador descarga un JSON local, no lo subas a GitHub.
4. Verificá los conteos y si hay errores de lectura (respaldo PARCIAL).
5. Guardá el JSON sin modificar, en una ubicación privada y protegida.

La exportación depende de los permisos del usuario, incluye solo colecciones conocidas por el código y NO es una instantánea atómica.

## 2. Datos comprendidos

- `clients` y todos los campos embebidos, con los ID originales.
- Subcolecciones `clients/{id}/sessions`, `messages`, `payments`, `trainingLogs`.
- Colecciones `exercises`, `routines`, `trainerNotifications`, `communityFeed`.
- Documento `settings/general`.
- Informe con recuentos, fecha, proyecto, UID del entrenador, errores y advertencias.

No incluye cuentas ni contraseñas de Firebase Authentication, reglas, índices, archivos de Storage ni funciones.

## 3. Crear Firebase nuevo sin cambiar aún el Netlify

Crear un proyecto con el correo personal, habilitar Firestore y Authentication por correo/contraseña. Crear una clave privada de cuenta de servicio SOLO del proyecto nuevo, protegida y fuera del repositorio. No cambiar aún `src/firebase.js`.

## 4. Importación en una base vacía (en la PC)

En el repositorio:

```bash
cd scripts/migration
npm install
node import-backup.mjs --backup="C:/ruta/ragnar-backup-2026-11-07.json" --target="ID_FIREBASE_NUEVO"
```

Este primer comando no escribe nada. Tras verificar los conteos, solo en un proyecto destino vacío:

```bash
node import-backup.mjs --backup="C:/ruta/ragnar-backup-2026-11-07.json" --target="ID_FIREBASE_NUEVO" --service-account="C:/ruta/clave-del-Firebase-nuevo.json" --confirm-target="ID_FIREBASE_NUEVO" --execute
```

El importador rechaza el proyecto de origen, exige un destino vacío, confirma la identidad del proyecto en la cuenta de servicio y preserva ID y tipos de Firestore. Si el respaldo es parcial, solo permite continuar con `--allow-partial` añadido expresamente.

## 5. Reconstruir cuentas y validar

El navegador no puede exportar Firebase Authentication. Con acceso administrativo original se pueden migrar usuarios y hashes según la documentación de Firebase; si no lo hay, hay que dar de alta usuarios en el Firebase nuevo y restablecer contraseñas. Se pueden conservar UID históricos mediante Admin SDK si contamos con los datos necesarios, pero no están incluidos automáticamente.

Después de importar: verificar alumnos, pagos, sesiones, mensajes, rutinas, permisos, índices y acceso de entrenador y alumno. Solo tras eso cambiar la conexión de la app y su despliegue.
