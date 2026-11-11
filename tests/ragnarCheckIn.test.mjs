import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeCheckIn, buildCheckIn, checkInSignal, latestCheckIn
} from '../src/utils/ragnarCheckIn.js';

test('registra check-in válido sin textos clínicos o información adicional',()=>{
  assert.deepEqual(buildCheckIn({energy:4,sleep:'bien',discomfort:false}),
    {energy:4,sleep:'bien',discomfort:false});
  assert.equal(normalizeCheckIn({energy:0,sleep:'bien',discomfort:false}),null);
  assert.equal(normalizeCheckIn({energy:3,sleep:'excelente',discomfort:false}),null);
});
test('una molestia o energía baja son señales para revisar y no diagnósticos',()=>{
  assert.deepEqual(checkInSignal({energy:5,sleep:'bien',discomfort:false}),[]);
  const signals=checkInSignal({energy:2,sleep:'mal',discomfort:true});
  assert.equal(signals.length,3);
  assert.match(signals[0],/molestia/);
});
test('toma el último check-in en siete días y nunca fechas futuras',()=>{
  const sessions=[
    {id:'2026-11-01',checkIn:{energy:1,sleep:'mal',discomfort:true}},
    {id:'2026-11-10',checkIn:{energy:4,sleep:'regular',discomfort:false}},
    {id:'2026-11-12',checkIn:{energy:1,sleep:'mal',discomfort:true}}
  ];
  assert.deepEqual(latestCheckIn(sessions,'2026-11-11')?.date,'2026-11-10');
  assert.equal(latestCheckIn([{id:'2026-11-01',checkIn:sessions[0].checkIn}],'2026-11-11'),null);
});
