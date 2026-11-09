// La indicación pertenece al ejercicio de una rutina o plantilla (no a la biblioteca global).
export const COACH_NOTE_MAX = 500;

export function normalizeCoachNote(text) {
  return String(text ?? '').replace(/\r\n?/g, '\n').trim();
}

export function validateCoachNote(text) {
  const value = normalizeCoachNote(text);
  if (value.length > COACH_NOTE_MAX) {
    throw new Error('La indicación puede tener hasta ' + COACH_NOTE_MAX + ' caracteres.');
  }
  return value;
}

export function copyExerciseWithNote(exercise) {
  return {
    ...exercise,
    coachNote: validateCoachNote(exercise?.coachNote || '')
  };
}
