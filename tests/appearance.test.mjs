import test from 'node:test';
import assert from 'node:assert/strict';
import {
  APPEARANCE_KEY, normalizeAppearance, resolveAppearance, loadAppearance
} from '../src/utils/appearance.js';

test('modo automático responde a la apariencia del sistema', () => {
  assert.equal(resolveAppearance('system', true), 'dark');
  assert.equal(resolveAppearance('system', false), 'light');
});
test('preferencia explícita tiene prioridad sobre el sistema', () => {
  assert.equal(resolveAppearance('dark', false), 'dark');
  assert.equal(resolveAppearance('light', true), 'light');
});
test('modo inválido o sin preferencia usa Automático', () => {
  assert.equal(normalizeAppearance('sepia'), 'system');
  assert.equal(loadAppearance({ getItem: () => null }), 'system');
  assert.equal(loadAppearance({ getItem: () => 'light' }), 'light');
  assert.equal(loadAppearance({ getItem: () => 'dark' }), 'dark');
});
test('si el almacenamiento falla la interfaz conserva modo automático', () => {
  assert.equal(loadAppearance({ getItem: () => { throw new Error('Denied'); } }), 'system');
  assert.equal(APPEARANCE_KEY, 'ragnar.appearance.v1');
});
