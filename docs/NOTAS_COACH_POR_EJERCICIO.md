# RAGNAR — Nota del coach por ejercicio

## Qué se agregó (solo en staging)

- En Rutinas → Plantillas → Agregar ejercicio: campo opcional de indicación del coach (hasta 500 caracteres).
- En cada tarjeta de ejercicio de una plantilla: botón Agregar/Editar nota. El cambio afecta la plantilla y **solo las asignaciones futuras**, no las sesiones históricas.
- En Mis Atletas → Ficha → Planificación → Día → Configurar ejercicio: campo de nota.
- En cada ejercicio ya asignado a un día: botón de nota independiente. La actualización usa transacción de Firestore y conserva pesos, repeticiones y notas previas del alumno.
- Sesiones finalizadas: bloqueadas para edición de planificación/notas.
- En el alumno, al abrir la rutina, el ejercicio con nota muestra botón **ojo rojo · Nota** con pulso discreto hasta que lo abre. La nota se despliega dentro de su tarjeta solo al pulsar y puede cerrarse sin salir del ejercicio. No abre modal ni interrumpe series; respeta preferencia de movimiento reducido.
- El contenido no se publica en comunidad ni se comparte en las tarjetas de Instagram.
- Campo de datos: `coachNote` dentro de cada objeto de `exercises`, tanto en `routines/{id}` como en `clients/{id}/sessions/{date}`. No hay migración obligatoria: la ausencia del campo equivale a no tener nota.
- La nota se conserva al copiar día, copiar rango, asignar plantilla y planificar por bloques.
- El guardado de series del alumno usa transacción que parte de los ejercicios actuales para evitar borrar las notas del coach por escritura de datos desactualizados.

## Verificación de uso

1. Como coach, crear plantilla con un ejercicio y nota. Agregar otro sin nota. Guardar.
2. Asignar la plantilla al día del alumno. Entrar como alumno y verificar que el ojo rojo esté solo en el ejercicio con nota.
3. Verificar que no aparece automáticamente ningún cuadro de diálogo. Pulsar el ojo, leer el texto y cerrarlo. El parpadeo cesa después de la primera apertura en la sesión de la app.
4. Desde el día del alumno, cambiar la nota del ejercicio. Comprobar actualización en tiempo real en la cuenta del alumno.
5. Editar peso y repeticiones mientras la nota está presente. Comprobar que no desaparece.
6. Duplicar una plantilla y copiar días: las indicaciones deben conservarse. Editar una plantilla ya asignada no debe cambiar sesiones existentes.
7. Finalizar una sesión y verificar que el coach no puede modificar sus notas; confirmar que datos históricos, pagos, chat, progreso y push siguen funcionando.
8. Repetir en PWA iPhone y Android.

## Alcance y observaciones

- No se modificó `main`, datos de Firestore existentes ni reglas de seguridad.
- No se envían notificaciones push por una nota, para evitar alertas repetitivas.
- El indicador es informativo y no registra si el alumno leyó la nota en la base de datos; deja de pulsar localmente al abrirla.
- Compilación y tests automáticos son necesarios pero no sustituyen las pruebas manuales del coach/alumno ni la verificación de Netlify.
