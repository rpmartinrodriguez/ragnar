# Ragnar — Semana, Progreso muscular, Salón Ragnar 2.0 e Instagram

**Entorno:** rama `staging/ragnar-5f8d7`; Firebase `ragnar-5f8d7`. No se ha modificado `main` ni el Firebase de producción.

## 1. Resumen de la semana al terminar el viernes

Después de presionar **Finalizar Sesión** en la última rutina planificada del viernes, en la fecha de hoy:

- Se guarda el entrenamiento mediante transacción (si otro dispositivo ya lo terminó, no se generan duplicados).
- Si se desbloqueó una medalla, se muestra primero la celebración y luego el resumen.
- Se presenta **Tu semana Ragnar**, con semana de lunes a domingo y sesiones realizadas.
- Muestra rutinas completadas / planificadas, series terminadas, minutos registrados, esfuerzo percibido (RPE de 1 a 10).
- Compara peso máximo dentro del **mismo ejercicio** frente a la semana anterior. Muestra hasta tres mejores incrementos con peso previo/actual. Nunca compara peso de sentadillas con peso de press.
- Si faltan minutos porque el alumno no inició cronómetro, lo explica y no inventa estimaciones.
- Si el viernes tiene un sábado o domingo programado, no dispara el cierre semanal del viernes porque aún quedan rutinas de esa semana.
- Disponible nuevamente desde **Alumno → Progreso → Ver mi último cierre semanal** si hubo un viernes con rutina completada.

**Prueba manual del disparador:** el botón automático del resumen requiere un viernes real; las pruebas de cálculo están en `tests/trainingInsights.test.mjs`, que simulan correctamente viernes de semanas distintas.

## 2. Cronómetro de entrenamiento real

- Desde **Mi inicio → Comenzar entrenamiento**, se registra automáticamente `workoutStartedAt` en el documento de sesión.
- Si el alumno entra por Agenda, aparece el botón **Iniciar cronómetro del entrenamiento**.
- Al finalizar, se calcula `workoutDurationMinutes` usando fecha de inicio guardada. El cronómetro no se reinicia si el alumno abre dos dispositivos.
- Sesiones antiguas o aquellas sin inicio medido se muestran como **Sin medir**. No se aplica la estimación antigua series × 3.
- Por seguridad, duraciones de más de 12 horas no se presentan como medidas de entrenamiento.

## 3. Progreso por zonas corporales

- **Alumno → Progreso**: General, Tren superior, Tren inferior, Zona media y Cardio.
- En Biblioteca del entrenador cada ejercicio puede clasificarse. La categoría se copia a plantillas y nuevas sesiones.
- Para fichas importadas sin categoría, Ragnar reconoce nombres comunes (press, sentadillas, dominadas, remo, etc.). Otros ejercicios quedan sin clasificar; pueden categorizarse en Biblioteca.
- El volumen registrado usa `kg × repeticiones` exclusivamente de series marcadas como completadas y con ambos valores válidos.
- La evolución por ejercicio muestra carga máxima por sesión; las comparaciones semanales solo consideran el mismo ejercicio.
- RPE más alto significa mayor esfuerzo percibido; no se presenta automáticamente como ganancia de fuerza.

## 4. Salón Ragnar 2.0

- Muro moderno con tarjetas de logros, reacciones claras y estados de guardado/error.
- Filtros **Comunidad / Esta semana / Mis logros**.
- Pulso de los últimos 7 días (indicadores basados únicamente en las últimas 80 publicaciones visibles): rutinas compartidas, atletas que publicaron y apoyos.
- Reto de constancia de **3 rutinas compartidas en la semana**, progreso visual propio.
- Guardianes de la semana: reconocimiento a la cantidad de entrenamientos **publicados**, no a quién levanta más peso.
- Acceso directo a Progreso.
- No se muestra ninguna serie, carga o mensaje privado en el muro.
- En **Mi perfil → Privacidad del Salón** el alumno puede optar por no compartir sus futuras rutinas finalizadas. Mantiene el comportamiento anterior por defecto; al desactivar no borra posts antiguos.
- Se utiliza un ID estable por alumno+fecha en nuevas publicaciones para evitar duplicaciones de feed.

## 5. Tarjeta compacta PNG para Instagram

- Después de finalizar, el alumno ve una tarjeta con el **logo original de `/logo.png`**, día, nombre, duración **real** si existe, RPE, ejercicios, series terminadas y racha.
- El gráfico PNG se genera a partir de los registros de la sesión. Tiene tamaño compacto y esquinas transparentes, ideal para insertarlo como imagen en historias.
- Botón **Compartir tarjeta como imagen**: usa el menú de compartir archivos de iPhone/Android si el navegador lo admite.
- Botón **Guardar PNG**: opción alternativa si no se puede compartir el archivo directamente.
- No se promete publicación directa y automática en Instagram: depende de las opciones que Instagram y el navegador permitan; el alumno puede guardar la tarjeta y usarla como sticker/imagen.
- Se conserva el acceso al Salón después de la tarjeta.

## Pruebas recomendadas antes de main

1. En staging, clasificar un ejercicio como Tren superior o inferior; asignarlo a alumno de prueba. Hacer series con peso y repeticiones.
2. Confirmar que **Alumno → Progreso** muestra el ejercicio en la categoría correcta, mientras General incluye todos.
3. Registrar otra sesión del mismo ejercicio con mayor kg y verificar la variación semanal cuando existan dos semanas comparables.
4. Iniciar entrenamiento desde Inicio, terminarlo y comprobar que duración real aparece en ficha, resumen y tarjeta PNG.
5. Probar **Guardar PNG** en Safari iPhone y, si es compatible, **Compartir** usando la hoja nativa.
6. Consultar el nuevo Salón, filtros, reacciones, reto de constancia, progreso y preferencia de privacidad.
7. El viernes, finalizar la última rutina programada del día y comprobar la aparición del resumen sin duplicar publicaciones ni notificaciones.
8. Verificar historial anterior: ninguna sesión, cuota o alumno fue modificado automáticamente mediante la incorporación de estas vistas.
9. Repetir en PWA instalada en iPhone y en un navegador Android.

**Importante:** compilación de GitHub y pruebas puras no confirman visualización en iPhone, permisos de Firestore o integración nativa de Instagram. La rama de prueba es para validar estas funciones antes de mover `main`.
