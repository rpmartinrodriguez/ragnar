import test from 'node:test';
import assert from 'node:assert/strict';
import { sessionHasProtectedHistory as protectedHistory } from '../src/utils/sessionSafety.js';

test('una rutina planificada, sin ejecución, puede sustituirse', () => {
  assert.equal(protectedHistory({
    exercises:[{name:'Sentadilla',plannedSets:[{reps:'10',rir:'2'}],actualSets:[]}]
  }),false);
});
test('una sesión finalizada no se puede sobrescribir',()=>{
  assert.equal(protectedHistory({isFinalized:true,exercises:[]}),true);
  assert.equal(protectedHistory({completedAt:new Date(),exercises:[]}),true);
});
test('el comentario del alumno protege el entrenamiento',()=>{
  assert.equal(protectedHistory({studentNote:'Me costó la última serie'}),true);
  assert.equal(protectedHistory({studentNote:'   '}),false);
});
test('las ausencias justificadas se conservan',()=>{
  assert.equal(protectedHistory({missedReason:'Enfermedad'}),true);
});
test('los pesos o repeticiones ya anotados no se reemplazan',()=>{
  assert.equal(protectedHistory({exercises:[{actualSets:[{weight:'50',reps:''}]}]}),true);
  assert.equal(protectedHistory({exercises:[{actualSets:[{weight:'',reps:'12'}]}]}),true);
  assert.equal(protectedHistory({exercises:[{actualSets:[{completed:true}]}]}),true);
});
test('una carga iniciada en blanco sigue siendo editable',()=>{
  assert.equal(protectedHistory({exercises:[{actualSets:[{weight:'',reps:'',completed:false}]}]}),false);
});
test('maneja sesiones faltantes o mal formadas sin romper la app',()=>{
  assert.equal(protectedHistory(null),false);
  assert.equal(protectedHistory({exercises:null}),false);
});
