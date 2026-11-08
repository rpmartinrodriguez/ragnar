// Reglas puras de seguridad al replanificar sesiones de Ragnar.
// No depende de Firebase: permite pruebas automáticas y evita borrados de historial.
export function sessionHasProtectedHistory(data = {}) {
  if (!data || typeof data !== 'object') return false;
  if (data.isFinalized === true || data.completedAt ||
      String(data.studentNote || '').trim() ||
      String(data.missedReason || '').trim()) return true;
  return Array.isArray(data.exercises) && data.exercises.some(ex =>
    Array.isArray(ex?.actualSets) && ex.actualSets.some(set =>
      set && (set.completed === true ||
        String(set.reps ?? '').trim() !== '' ||
        String(set.weight ?? '').trim() !== '')
    )
  );
}
