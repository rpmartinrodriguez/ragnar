// Cambios granulares del coach sobre sesiones: no reutilizar arrays de una
// instantánea anterior cuando el alumno puede registrar series en paralelo.

export function hasRecordedSet(exercise) {
  return Array.isArray(exercise?.actualSets) && exercise.actualSets.some(set =>
    set && (set.completed === true ||
      String(set.reps ?? '').trim() !== '' ||
      String(set.weight ?? '').trim() !== '')
  );
}

export function hasRecordedSetAt(exercise, index) {
  const set = exercise?.actualSets?.[index];
  return !!set && (set.completed === true ||
    String(set.reps ?? '').trim() !== '' ||
    String(set.weight ?? '').trim() !== '');
}

export function assertWorkoutNotFinalized(data) {
  if (data?.isFinalized === true || data?.completedAt) {
    throw new Error('Este entrenamiento está finalizado. No se puede modificar su planificación.');
  }
}

function getExerciseAt(exercises, index, expectedName) {
  const existing = exercises[index];
  if (!existing || String(existing.name ?? '') !== String(expectedName ?? '')) {
    throw new Error('El ejercicio cambió en la planificación. Volvé a abrirlo para editar el correcto.');
  }
  return existing;
}

export function mergeCoachExercise(exercises, replacement, index = null, expectedName = null, originalNote = '') {
  const current = Array.isArray(exercises) ? exercises : [];
  if (index === null) {
    return [...current, { ...replacement, actualSets: [] }];
  }
  const existing = getExerciseAt(current, index, expectedName);
  const newSets = Array.isArray(replacement.plannedSets) ? replacement.plannedSets : [];
  if (existing.actualSets?.some((set, i) => i >= newSets.length && hasRecordedSetAt(existing, i))) {
    throw new Error('No se pueden quitar series que ya tienen registros. Conservá esas series o creá otro ejercicio.');
  }
  // Si otro dispositivo actualizó la nota, no revertirla cuando el coach
  // solamente estaba editando peso, repeticiones o series.
  const noteWasEdited = String(replacement.coachNote ?? '') !== String(originalNote ?? '');
  return current.map((exercise, i) => i === index ? {
    ...exercise, ...replacement,
    coachNote: noteWasEdited ? String(replacement.coachNote ?? '') : (exercise.coachNote ?? ''),
    actualSets: Array.isArray(exercise.actualSets) ? exercise.actualSets : []
  } : exercise);
}

export function removeCoachExercise(exercises, index, expectedName) {
  const current = Array.isArray(exercises) ? exercises : [];
  const existing = getExerciseAt(current, index, expectedName);
  if (hasRecordedSet(existing)) {
    throw new Error('Este ejercicio tiene pesos o series registrados y no se puede eliminar. Podés editar su nota.');
  }
  return current.filter((_, i) => i !== index);
}

export function editCoachExerciseNote(exercises, index, expectedName, note) {
  const current = Array.isArray(exercises) ? exercises : [];
  getExerciseAt(current, index, expectedName);
  return current.map((ex, i) =>
    i === index ? { ...ex, coachNote: String(note ?? '') } : ex
  );
}

export function explainCoachSaveError(error) {
  const code = String(error?.code ?? '').toLowerCase();
  if (code.includes('permission-denied')) {
    return 'Firebase rechazó el permiso de escritura. Revisá la cuenta de coach y las reglas de Firestore del proyecto nuevo (ragnar-5f8d7).';
  }
  if (code.includes('unavailable') || code.includes('deadline-exceeded')) {
    return 'No se pudo conectar con Firebase. Revisá Internet e intentá guardar nuevamente, sin cerrar el editor.';
  }
  if (code.includes('failed-precondition')) {
    return 'Firebase no pudo completar la operación. Revisá la conexión y la configuración de Firestore.';
  }
  if (code.includes('aborted')) {
    return 'Hubo cambios simultáneos. Volvé a intentar guardar; los datos existentes se conservaron.';
  }
  if (code.includes('resource-exhausted')) {
    return 'Firebase alcanzó un límite de uso o capacidad. Revisá el proyecto antes de reintentar.';
  }
  return error?.message || 'No se pudieron guardar los cambios. Intentá nuevamente.';
}
