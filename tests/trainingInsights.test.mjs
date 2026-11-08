import test from 'node:test';
import assert from 'node:assert/strict';
import {
  regionOfExercise,getWeekBounds,isFridayFinalSession,weeklyInsights,
  exerciseHistorySeries,groupProgress
} from '../src/utils/trainingInsights.js';

function s(id,exercises,extra={}){
  return {id,date:id,isFinalized:true,exercises,...extra};
}
const upper=(kg,reps=10)=>({
  name:'Press banca',trainingRegion:'upper',
  actualSets:[{weight:String(kg),reps:String(reps),completed:true}]
});
const lower=kg=>({
  name:'Sentadilla',trainingRegion:'lower',
  actualSets:[{weight:String(kg),reps:'10',completed:true}]
});
test('detecta tren superior e inferior y respeta categoría explícita',()=>{
  assert.equal(regionOfExercise({name:'Sentadillas libres'}),'lower');
  assert.equal(regionOfExercise({name:'Press banca plano'}),'upper');
  assert.equal(regionOfExercise({name:'Dominadas'}),'upper');
  assert.equal(regionOfExercise({name:'Hip thrust'}),'lower');
  assert.equal(regionOfExercise({name:'Ejercicio misterioso'}),'unknown');
  assert.equal(regionOfExercise({name:'Press banca',trainingRegion:'lower'}),'lower');
});
test('cierra el resumen solo tras la última rutina del viernes',()=>{
  const b=getWeekBounds('2026-11-13');
  assert.equal(b.start,'2026-11-09');
  assert.equal(b.friday,'2026-11-13');
  assert.equal(b.end,'2026-11-15');
  assert.equal(isFridayFinalSession('2026-11-13',['2026-11-09','2026-11-13']),true);
  assert.equal(isFridayFinalSession('2026-11-13',['2026-11-13','2026-11-14']),false);
  assert.equal(isFridayFinalSession('2026-11-12',['2026-11-12']),false);
});
test('compara SOLO el mismo ejercicio entre semanas, nunca pesos de ejercicios diferentes',()=>{
  const rows=[
    s('2026-11-06',[upper(40),lower(60)],{perceivedEffort:6,workoutDurationMinutes:35}),
    s('2026-11-13',[upper(45),lower(65)],{perceivedEffort:7,workoutDurationMinutes:42})
  ];
  const report=weeklyInsights(rows,'2026-11-13');
  assert.equal(report.sessions,1);
  assert.equal(report.sets,2);
  assert.equal(report.minutes,42);
  assert.equal(report.missingMinutes,0);
  assert.equal(report.effort,7);
  assert.equal(report.previousEffort,6);
  assert.equal(report.prCount,2);
  assert.equal(report.improvements.find(x=>x.name==='press banca').delta,5);
  assert.equal(report.improvements.find(x=>x.name==='sentadilla').delta,5);
  const upperProgress=groupProgress(rows,'2026-11-13','upper');
  const lowerProgress=groupProgress(rows,'2026-11-13','lower');
  assert.equal(upperProgress.completed,2);
  assert.equal(lowerProgress.completed,2);
  assert.equal(upperProgress.sets,2);
  assert.equal(lowerProgress.sets,2);
  assert.ok(upperProgress.volume<lowerProgress.volume);
});
test('no inventa minutos para entrenamientos sin cronómetro',()=>{
  const report=weeklyInsights([s('2026-11-13',[upper(45)],{perceivedEffort:5})],'2026-11-13');
  assert.equal(report.minutes,0);
  assert.equal(report.minutesSessions,0);
  assert.equal(report.missingMinutes,1);
});
test('solo toma series completadas para marcas y evita rutinas sin terminar',()=>{
  const entries=[
    s('2026-11-06',[upper(35)]),
    s('2026-11-13',[{name:'Press banca',actualSets:[
      {weight:'60',reps:'6',completed:false},
      {weight:'42',reps:'8',completed:true}
    ]}]),
    {id:'2026-11-14',isFinalized:false,exercises:[upper(100)]}
  ];
  const chart=exerciseHistorySeries(entries,'Press banca');
  assert.deepEqual(chart.map(x=>x.maxWeight),[35,42]);
  const report=weeklyInsights(entries,'2026-11-13');
  assert.equal(report.improvements[0].delta,7);
});
test('pesos desconocidos no provocan récords ficticios',()=>{
  const rows=[
    s('2026-11-06',[upper(30)]),
    s('2026-11-13',[{name:'Press banca',actualSets:[{weight:'no',reps:'10',completed:true}]}])
  ];
  assert.equal(weeklyInsights(rows,'2026-11-13').prCount,0);
});
