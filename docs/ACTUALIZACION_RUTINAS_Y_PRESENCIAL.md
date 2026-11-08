# Ragnar — Actualización Rutinas, Planificación y modalidad Presencial

**Rama:** `staging/ragnar-5f8d7`  
**Firebase de pruebas:** `ragnar-5f8d7`  
**Producción:** `main` continúa sin cambios.

## Mejoras entregadas en código

### 1. Observaciones del alumno por entrenamiento

En el día con una rutina asignada, el alumno puede abrir **Mis observaciones** y guardar hasta 600 caracteres. Se guardan en el documento existente `clients/{clientId}/sessions/{dateId}`:

- `studentNote`: observación
- `studentNoteUpdatedAt`: fecha del servidor

El coach la ve automáticamente en **Mis Atletas → Alumno → Planificación → Fecha**. La primera observación registrada en ese día puede generar un push tipo `student_note`; el servidor verifica el UID del alumno, la sesión real y la fecha reciente antes de enviar el aviso. No reemplaza el chat, ejercicios ni pagos.

### 2. Plantillas de rutinas

- Buscador por nombre, orden alfabético.
- Duplicación de una plantilla como una copia independiente.
- Errores de guardado visibles, validaciones de series y botón con estado `Guardando`.
- Mejor adaptación móvil y corrección de claves variables de la lista de ejercicios.
- Eliminar plantilla no elimina entrenamientos ya asignados.

### 3. Protección del historial

Al **copiar un día, pegar bloques o asignar plantillas**, Ragnar revisa si las fechas de destino tienen actividad registrada. Si tienen sesión finalizada, peso, repeticiones, series realizadas, comentarios o una ausencia justificada, la operación se rechaza.

Para bloques de varios días, se comprueban todos los destinos antes de guardar, evitando copiar parcialmente el bloque. Se aceptan hasta 90 jornadas con ejercicios por bloque.

El código reutiliza `src/utils/sessionSafety.js` y ejecuta pruebas con `node --test tests/sessionSafety.test.mjs` durante la compilación staging.

### 4. Modalidad por alumno: Presencial / Plan

En **Mis Atletas → Editar atleta → Modalidad de entrenamiento**:

- `Plan de entrenamiento`: comportamiento existente. El alumno registra sus series desde su aplicación.
- `Presencial`: se agrega en **Planificación → Registro presencial del coach** un panel con repeticiones, pesos, marca de serie realizada y botón **Guardar series y pesos**.

Las dos modalidades comparten exactamente la misma ficha y los mismos documentos de sesiones. Cambiar modalidad no migra ni modifica automáticamente los datos previos; los alumnos existentes sin campo `trainingMode` continúan como `plan`.

El registro presencial utiliza una transacción de Firestore y comprueba si otra persona cambió las series mientras el entrenador editaba. En ese caso muestra error en vez de reemplazar los registros.

El alumno **sigue pudiendo registrar sus series** desde su cuenta. Para evitar conflictos de edición, conviene no modificar simultáneamente una misma sesión en dos dispositivos.

**Pendiente:** permitir al coach finalizar una sesión presencial por el alumno y aplicar la misma lógica de rachas/medallas del lado del servidor. Por ahora la finalización continúa desde la cuenta del alumno, tal como antes.

### 5. UX y rendimiento

- Menos consultas a Firestore al cambiar de día en el calendario.
- Indicadores de guardado y errores claros al añadir ejercicios.
- Protección adicional de edición en sesiones ya finalizadas.
- Vista de detalle de alumno sincronizada con su ficha actual.

## Pruebas recomendadas

1. En el Ragnar de **staging**, duplicar una plantilla y comprobar que la original siga igual.
2. Abrir un alumno de prueba con una rutina y escribir una observación desde su sesión. Comprobar que el coach la vea en el día correspondiente y que el push llegue.
3. En el coach, editar ese alumno para elegir **Presencial**; abrir una sesión **sin finalizar**.
4. Registrar una serie con repeticiones, kg y marca de completada; guardar. Comprobar desde la cuenta del alumno que los valores estén en la misma rutina.
5. Intentar pegar una plantilla sobre una sesión **ya finalizada**. Debe impedir el cambio con un aviso y preservar el historial.
6. Confirmar que mensajes, pagos, estadísticas y acceso del coach sigan presentes.

## Observaciones importantes

- No se cambió `main`, ni la configuración de Firebase antigua.
- No se ejecutaron migraciones masivas ni se borraron documentos existentes.
- Las compilaciones y pruebas de código no equivalen a pruebas de negocio con las cuentas reales; seguir usando un alumno de prueba antes del lanzamiento.
- El proyecto permanece en Firebase Spark. Las funciones administrativas y push usan Netlify Functions.
