# Ragnar — copiar y rescatar datos

## Repositorio actual

- `main`: 38 archivos idénticos al estado de `martinrodriguez-dotcom/ragnar1.4` consultado el 7 de noviembre de 2026. NO contiene modificaciones de rescate.
- `rescue/exportacion-firebase`: misma aplicación con panel de **Configuración → Rescate de datos**. Incluye configuración de Netlify.

## Alternativa A: exportar de forma local, sin Netlify

```bash
git clone https://github.com/rpmartinrodriguez/ragnar.git
cd ragnar
git checkout rescue/exportacion-firebase
npm ci
npm run dev
```

Abrir la URL indicada por Vite, normalmente http://localhost:5173. Iniciar sesión con la cuenta del ENTRENADOR en Firebase Authentication original y abrir **Configuración → Rescate de datos → Descargar respaldo de Ragnar**. El archivo JSON se descarga al equipo; NO se envía a servidores nuestros.

## Alternativa B: desplegar rama de rescate en tu Netlify nuevo

1. Netlify → Add new project → Import an existing project → GitHub → `rpmartinrodriguez/ragnar`.
2. Seleccionar la rama `rescue/exportacion-firebase` como rama de publicación durante el rescate.
3. Netlify detecta `netlify.toml`: comando `npm run build`, directorio `dist`.
4. Abrir el URL nuevo de Netlify. Si Firebase Auth rechaza el dominio, un administrador del proyecto anterior debe autorizarlo; sin acceso administrativo no se puede modificar esa lista.
5. Iniciar sesión con el usuario de ENTRENADOR de Ragnar y descargar el JSON.

## Qué exporta y qué NO

El respaldo intenta leer documentos de los alumnos asignados al usuario de entrenador con subcolecciones `sessions`, `messages`, `payments` y `trainingLogs` (opcional), además de las colecciones conocidas `exercises`, `routines`, `trainerNotifications`, `communityFeed` y `settings/general`.

Conserva rutas completas e identificadores originales, fechas Firestore y datos anidados. Genera un informe de recuentos y errores; el nombre termina en `-PARCIAL` si hay lecturas fallidas.

**No se puede obtener por esta vía:** usuarios y contraseñas de Firebase Authentication, datos ocultos por reglas de Firestore, archivos de Storage, colecciones desconocidas, índices, reglas ni accesos a Netlify. Un archivo sin errores no garantiza que no falte información ajena a las colecciones conocidas. Los alumnos con cuenta anterior pueden necesitar volver a registrarse o asociarse a un nuevo UID.

**Importantísimo:** no desactivar ni sustituir la app anterior y no apuntar la rama de rescate a Firebase nuevo hasta haber generado y revisado una copia. El archivo es información personal: guardarlo local, protegido, y NO subirlo a GitHub.

## Próximo paso: importar a Firebase propio

La exportación está implementada; **la importación no**. Primero revisar el archivo, comparar cantidades con la app antigua y gestionar el nuevo Authentication y nuevos UIDs. Recién después implementar importación conservando IDs, historial y relaciones.
