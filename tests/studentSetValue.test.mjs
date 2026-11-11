import test from 'node:test';
import assert from 'node:assert/strict';
import { acceptsSetDraft, normalizeSetField, setFieldString } from '../src/utils/studentSetValue.js';

test('las repeticiones permiten borrar y escribir números de varias cifras', () => {
  for (const s of ['', '1', '12', '120', '1234']) assert.equal(acceptsSetDraft('reps', s), true);
  for (const s of ['-1', '1.2', 'abc', '12345']) assert.equal(acceptsSetDraft('reps', s), false);
});
test('el peso acepta intermedios y separador decimal argentino', () => {
  for (const s of ['', '12', '12,', '12,5', '12.5', '0,25']) assert.equal(acceptsSetDraft('weight', s), true);
  assert.equal(normalizeSetField('weight', '12,5'), '12.5');
  assert.equal(normalizeSetField('weight', ''), '');
  assert.equal(acceptsSetDraft('weight', '-3'), false);
});
test('no fuerza NaN ni convierte el cero a vacío mientras se escribe', () => {
  assert.equal(setFieldString(null), '');
  assert.equal(setFieldString(0), '0');
  assert.equal(normalizeSetField('reps', '00'), '00');
});
