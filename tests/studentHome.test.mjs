import test from 'node:test';
import assert from 'node:assert/strict';
import { nextPlannedWorkout } from '../src/utils/studentHome.js';

test('elige la próxima sesión real después de hoy, aunque lleguen desordenadas',()=>{
  const result=nextPlannedWorkout([
    {id:'2026-11-17',exercises:[{name:'Remo'}]},
    {id:'2026-11-11',exercises:[{name:'Press'}],isFinalized:true},
    {id:'2026-11-12',exercises:[{name:'Sentadilla'},{name:'Prensa'},{name:'Gemelos'}]}
  ],'2026-11-11');
  assert.deepEqual(result,{
    date:'2026-11-12',exerciseCount:3,exerciseNames:['Sentadilla','Prensa']
  });
});

test('no considera rutinas sin ejercicios, terminadas o fechas anteriores',()=>{
  const result=nextPlannedWorkout([
    {id:'2026-11-10',exercises:[{name:'Remo'}]},
    {id:'2026-11-12',exercises:[]},
    {id:'2026-11-13',exercises:[{name:'Press'}],isFinalized:true}
  ],'2026-11-11');
  assert.equal(result,null);
});

test('no inventa nombres ni próxima rutina cuando no existe',()=>{
  assert.equal(nextPlannedWorkout([], '2026-11-11'),null);
  assert.equal(nextPlannedWorkout([{id:'invalid',exercises:[{name:'RDL'}]}], '2026-11-11'),null);
});
