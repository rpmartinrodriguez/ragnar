import test from 'node:test';
import assert from 'node:assert/strict';
import { sessionCompletionFeedback } from '../src/utils/sessionCompletionFeedback.js';

const exercise=(name,weight,reps='10',done=true)=>({
 name, actualSets:[{ weight, reps, completed:done }]
});
const session=(id,exercises,finalized=true)=>({id,exercises,isFinalized:finalized});

test('compara cargas sólo de ejercicios con el mismo nombre y series hechas',()=>{
 const data=[
   session('2026-11-01',[exercise('Sentadilla','50')]),
   session('2026-11-04',[exercise('Press banca','40')]),
   session('2026-11-11',[exercise('Sentadilla','55'),exercise('Curl','12')])
 ];
 const value=sessionCompletionFeedback(data,'2026-11-11');
 assert.equal(value.previousDate,'2026-11-04');
 assert.equal(value.previousSets,1);
 assert.equal(value.completedSets,2);
 assert.equal(value.comparableCount,1);
 assert.equal(value.increasedCount,1);
 assert.equal(value.comparisons[0].formattedDelta,'+5 kg');
 assert.equal(value.comparisons[0].previousDate,'2026-11-01');
});
test('no compara con entrenamientos posteriores ni sesiones sin finalizar',()=>{
 const data=[
   session('2026-11-01',[exercise('Press','45')]),
   session('2026-11-07',[exercise('Press','90')],false),
   session('2026-11-11',[exercise('Press','40')]),
   session('2026-11-12',[exercise('Press','100')])
 ];
 const value=sessionCompletionFeedback(data,'2026-11-11');
 assert.equal(value.comparableCount,1);
 assert.equal(value.comparisons[0].delta,-5);
 assert.equal(value.increasedCount,0);
});
test('sin sesión previa entrega un resultado sobrio y sin progreso inventado',()=>{
 const value=sessionCompletionFeedback([
   session('2026-11-11',[exercise('Remo','20')])
 ],'2026-11-11');
 assert.equal(value.previousDate,null);
 assert.equal(value.comparableCount,0);
 assert.equal(value.completedSets,1);
});
test('ignora cargas sin completar y ausentes, respetando el progreso real',()=>{
 const value=sessionCompletionFeedback([
  session('2026-11-01',[exercise('Peso muerto','80')]),
  session('2026-11-11',[exercise('Peso muerto','100','6',false),exercise('Plancha','', '45')])
 ],'2026-11-11');
 assert.equal(value.comparableCount,0);
 assert.equal(value.completedSets,1);
});
test('normaliza variaciones de mayúsculas y acentos del ejercicio',()=>{
 const value=sessionCompletionFeedback([
  session('2026-11-01',[exercise('Bíceps','12,5')]),
  session('2026-11-11',[exercise('BICEPS','15')])
 ],'2026-11-11');
 assert.equal(value.comparisons[0].delta,2.5);
});
