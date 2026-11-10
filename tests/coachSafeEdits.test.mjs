import test from 'node:test';
import assert from 'node:assert/strict';
import {
  hasRecordedSet, mergeCoachExercise, removeCoachExercise,
  editCoachExerciseNote, assertWorkoutNotFinalized, explainCoachSaveError
} from '../src/utils/coachSafeEdits.js';

const ex = {name:'Press banca',coachNote:'Nota inicial', plannedSets:[{reps:'10'},{reps:'8'}],
  actualSets:[{reps:'10',weight:'50',completed:true},{reps:'',weight:'',completed:false}],
  trainingRegion:'upper', extra:'conservar'};

test('editar nota conserva las series y otros campos ya registrados',()=>{
  const before=[ex,{name:'Sentadilla',actualSets:[{weight:'70'}]}];
  const after=editCoachExerciseNote(before,0,'Press banca','Nuevo consejo');
  assert.equal(after[0].coachNote,'Nuevo consejo');
  assert.deepEqual(after[0].actualSets,ex.actualSets);
  assert.deepEqual(after[1],before[1]);
  assert.equal(before[0].coachNote,'Nota inicial');
});

test('editar repeticiones no borra pesos ni una nota actualizada por el coach desde otro dispositivo',()=>{
  const edit={name:'Press banca',coachNote:'Nota inicial',plannedSets:[{reps:'12'},{reps:'8'}]};
  const now={...ex,coachNote:'Nota más nueva',actualSets:[{reps:'11',weight:'55',completed:true}]};
  const [after]=mergeCoachExercise([now],edit,0,'Press banca','Nota inicial');
  assert.deepEqual(after.actualSets,now.actualSets);
  assert.equal(after.coachNote,'Nota más nueva');
  assert.equal(after.plannedSets[0].reps,'12');
  assert.equal(after.extra,'conservar');
});

test('editar explícitamente la nota sí guarda el texto nuevo',()=>{
  const [after]=mergeCoachExercise([ex],{name:'Press banca',plannedSets:ex.plannedSets,coachNote:'Nueva nota'},0,'Press banca','Nota inicial');
  assert.equal(after.coachNote,'Nueva nota');
});

test('agregar un ejercicio no reemplaza los registros anteriores',()=>{
  const result=mergeCoachExercise([ex],{name:'Remo',plannedSets:[{reps:'10'}]});
  assert.equal(result.length,2);
  assert.deepEqual(result[0],ex);
  assert.deepEqual(result[1].actualSets,[]);
});

test('permite eliminar ejercicios sin registros aunque otra serie del día tenga pesos',()=>{
  const result=removeCoachExercise([ex,{name:'Remo',actualSets:[]}],1,'Remo');
  assert.equal(result.length,1);
  assert.deepEqual(result[0],ex);
});

test('protege series con registros de eliminación y reducción accidental',()=>{
  assert.equal(hasRecordedSet(ex),true);
  assert.throws(()=>removeCoachExercise([ex],0,'Press banca'),/registrados/);
  assert.throws(()=>mergeCoachExercise([ex],{name:'Press banca',plannedSets:[]},0,'Press banca','Nota inicial'),/No se pueden quitar series/);
  assert.throws(()=>editCoachExerciseNote([ex],0,'Otro ejercicio','x'),/cambió/);
});

test('sesión finalizada protege la planificación, sin confundirla con nota del alumno',()=>{
  assert.doesNotThrow(()=>assertWorkoutNotFinalized({studentNote:'Me costó'}));
  assert.throws(()=>assertWorkoutNotFinalized({isFinalized:true}),/finalizado/);
});

test('distingue permisos y conexión de Firebase en lugar de ocultar el motivo',()=>{
  assert.match(explainCoachSaveError({code:'permission-denied'}),/permisos|permiso/i);
  assert.match(explainCoachSaveError({code:'unavailable'}),/conectar/);
  assert.match(explainCoachSaveError({code:'aborted'}),/simultáneos/);
});
