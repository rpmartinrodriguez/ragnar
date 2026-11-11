// Próxima rutina del alumno a partir de las sesiones que ya utiliza el calendario.
// No solicita datos nuevos ni inventa el tipo de entrenamiento.
export function nextPlannedWorkout(sessions = [], fromYmd) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(fromYmd))) return null;
  const found = (Array.isArray(sessions) ? sessions : [])
    .filter(s =>
      s && /^\d{4}-\d{2}-\d{2}$/.test(String(s.id || '')) &&
      s.id > fromYmd &&
      s.isFinalized !== true &&
      Array.isArray(s.exercises) &&
      s.exercises.length > 0
    )
    .sort((a,b) => a.id.localeCompare(b.id))[0];
  if (!found) return null;
  return {
    date: found.id,
    exerciseCount: found.exercises.length,
    exerciseNames: found.exercises.map(ex => String(ex?.name || '').trim())
      .filter(Boolean).slice(0, 2)
  };
}
