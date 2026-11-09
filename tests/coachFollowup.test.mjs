import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeCoachFollowup, shiftYmd, sortCoachFollowup } from '../src/utils/coachFollowup.js';

const today = '2026-11-09';
const client = { id: 'abc', name: 'Lucía' };
const session = (id, done = false) => ({ id, exercises: [{ name: 'Sentadilla' }], isFinalized: done });

test('fechas: cruza mes y año sin alterar el día de Argentina', () => {
  assert.equal(shiftYmd('2026-01-01', -1), '2025-12-31');
  assert.equal(shiftYmd('2026-11-09', -27), '2026-10-13');
});

test('al día: sesiones finalizadas, no pendiente por rutina de hoy', () => {
  const row = analyzeCoachFollowup(client, [session('2026-11-05', true), session(today)], today);
  assert.equal(row.status, 'onTrack');
  assert.equal(row.unfinishedPast14, 0);
  assert.equal(row.completed14, 1);
});

test('revisar: una sesión anterior sin finalizar, no asumir ausencia', () => {
  const row = analyzeCoachFollowup(client, [session('2026-11-06')], today);
  assert.equal(row.status, 'review');
  assert.match(row.reason, /sin finalizar/);
});

test('contactar: tres sesiones anteriores sin finalizar', () => {
  const row = analyzeCoachFollowup(client, [
    session('2026-11-03'), session('2026-11-05'), session('2026-11-07')
  ], today);
  assert.equal(row.status, 'contact');
  assert.equal(row.unfinishedPast14, 3);
});

test('sin datos: no hay rutinas, sesiones viejas o solo entrenamientos futuros', () => {
  assert.equal(analyzeCoachFollowup(client, [], today).status, 'noData');
  assert.equal(analyzeCoachFollowup(client, [session('2026-10-01')], today).status, 'noData');
  assert.equal(analyzeCoachFollowup(client, [session('2026-11-12')], today).status, 'noData');
});

test('no confundir documentos sin ejercicios con sesiones programadas', () => {
  const row = analyzeCoachFollowup(client, [{ id: '2026-11-07', isFinalized: false }], today);
  assert.equal(row.status, 'noData');
});

test('orden: contactar, revisar, al día y sin datos', () => {
  const input = ['noData', 'review', 'onTrack', 'contact'].map(status =>
    ({ status, client: { name: status } }));
  assert.deepEqual(sortCoachFollowup(input).map(x => x.status),
    ['contact', 'review', 'onTrack', 'noData']);
});
