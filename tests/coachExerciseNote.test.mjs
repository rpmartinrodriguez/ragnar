import test from 'node:test';
import assert from 'node:assert/strict';
import { COACH_NOTE_MAX, normalizeCoachNote, validateCoachNote, copyExerciseWithNote } from '../src/utils/coachExerciseNote.js';

test('normaliza y conserva la nota del coach por ejercicio', () => {
  assert.equal(normalizeCoachNote('  Ajustar postura\r\nRespirar  '), 'Ajustar postura\nRespirar');
  assert.equal(copyExerciseWithNote({ name: 'Press', plannedSets: [], coachNote: '  Subí lento  ' }).coachNote, 'Subí lento');
});
test('no introduce notas cuando no existen y permite quitarlas', () => {
  assert.equal(copyExerciseWithNote({ name: 'Sentadilla' }).coachNote, '');
  assert.equal(validateCoachNote('   '), '');
});
test('limita la longitud de las notas', () => {
  assert.equal(validateCoachNote('a'.repeat(COACH_NOTE_MAX)).length, COACH_NOTE_MAX);
  assert.throws(() => validateCoachNote('a'.repeat(COACH_NOTE_MAX + 1)), /500/);
});
