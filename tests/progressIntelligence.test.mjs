import test from 'node:test';
import assert from 'node:assert/strict';
import {progressIntelligence} from '../src/utils/progressIntelligence.js';

const exercise=(name,kg,done=true)=>({
 name,trainingRegion:'upper',actualSets:[{weight:String(kg),reps:'10',completed:done}]
});
const session=(id,exercises,finished=true)=>({id,exercises,isFinalized:finished});

test('calcula adherencia sobre sesiones programadas reales de los últimos 28 días',()=>{
 const result=progressIntelligence([
   session('2026-11-01',[exercise('Press',50)]),
   session('2026-11-05',[exercise('Remo',60)],false),
   session('2026-11-09',[exercise('Press',55)]),
   session('2026-09-01',[exercise('Press',100)])
 ],'2026-11-11');
 assert.equal(result.scheduled,3);
 assert.equal(result.completed,2);
 assert.equal(result.completionRate,67);
 assert.equal(result.seriesCompleted,2);
 assert.equal(result.totalVolume,1050);
 assert.equal(result.comparable[0].delta,5);
});
test('no compara cargas de ejercicios diferentes ni de series incompletas',()=>{
 const result=progressIntelligence([
   session('2026-11-01',[exercise('Press banca',80)]),
   session('2026-11-05',[exercise('Press militar',90)]),
   session('2026-11-09',[exercise('Press banca',100,false)])
 ],'2026-11-11');
 assert.equal(result.comparable.length,0);
});
test('el cálculo no depende de sesiones futuras y no inventa datos cuando falta historial',()=>{
 const result=progressIntelligence([
   session('2026-11-12',[exercise('Sentadilla',100)])
 ],'2026-11-11');
 assert.equal(result.scheduled,0);
 assert.equal(result.completionRate,null);
});
test('separa semanas y mantiene las señales como revisión no prescripción',()=>{
 const result=progressIntelligence([
   session('2026-10-23',[exercise('Press',40)]),
   session('2026-11-09',[exercise('Press',40)])
 ],'2026-11-11');
 assert.equal(result.currentSessions,1);
 assert.equal(result.previousSessions,1);
 assert.equal(result.stable,1);
});
