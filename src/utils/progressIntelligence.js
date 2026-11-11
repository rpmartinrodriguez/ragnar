// Inteligencia de progreso basada únicamente en sesiones efectivamente finalizadas.
// Las sugerencias son informativas: no se modifican cargas ni rutinas automáticamente.
import {safeNumber, regionOfExercise} from './trainingInsights.js';

function shiftYmd(date, days) {
  const d=new Date(String(date)+'T12:00:00Z');
  if(Number.isNaN(d.getTime())) return '';
  d.setUTCDate(d.getUTCDate()+days);
  return d.toISOString().slice(0,10);
}
const key=name=>String(name||'').trim().toLocaleLowerCase('es')
  .normalize('NFD').replace(/[\u0300-\u036f]/g,'');

function bestExerciseSet(exercise) {
  const sets=Array.isArray(exercise?.actualSets) ? exercise.actualSets : [];
  const finished=sets.filter(set=>set?.completed===true);
  const weights=finished.map(set=>safeNumber(set.weight,2000))
    .filter(weight=>weight!==null && weight>0);
  const volume=finished.reduce((total,set)=>{
    const weight=safeNumber(set.weight,2000),reps=safeNumber(set.reps,500);
    return total+(weight!==null && weight>0 && reps!==null && reps>0
      ? weight*reps:0);
  },0);
  return {best:weights.length?Math.max(...weights):null,
    completed:finished.length, volume:Math.round(volume)};
}

export function progressIntelligence(sessions=[],todayYmd,region='all') {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(String(todayYmd||''))) return null;
  const from=shiftYmd(todayYmd,-27);
  const relevant=(Array.isArray(sessions)?sessions:[])
    .filter(s=>s && /^\d{4}-\d{2}-\d{2}$/.test(String(s.id||'')) &&
      s.id>=from && s.id<=todayYmd &&
      Array.isArray(s.exercises) && s.exercises.length>0)
    .sort((a,b)=>a.id.localeCompare(b.id));
  const scheduled=relevant.length;
  const completed=relevant.filter(s=>s.isFinalized===true);
  const completionRate=scheduled?Math.round(completed.length/scheduled*100):null;
  const last14=shiftYmd(todayYmd,-13);
  const prev14=shiftYmd(todayYmd,-27);
  const currentSessions=completed.filter(s=>s.id>=last14).length;
  const previousSessions=completed.filter(s=>s.id>=prev14 && s.id<last14).length;
  const allSets=completed.flatMap(s=>s.exercises
    .filter(ex=>region==='all'||regionOfExercise(ex)===region)
    .flatMap(ex=>(Array.isArray(ex.actualSets)?ex.actualSets:[])
      .filter(set=>set?.completed===true)));
  const seriesCompleted=allSets.length;
  const totalVolume=Math.round(allSets.reduce((total,set)=>{
    const w=safeNumber(set.weight,2000),r=safeNumber(set.reps,500);
    return total+(w!==null&&w>0&&r!==null&&r>0?w*r:0);
  },0));
  const lastByExercise=new Map();
  const changes=[];
  for(const session of completed){
    for(const ex of session.exercises){
      if(region!=='all' && regionOfExercise(ex)!==region)continue;
      const exKey=key(ex.name);
      const summary=bestExerciseSet(ex);
      if(!exKey || summary.best===null)continue;
      const old=lastByExercise.get(exKey);
      if(old && old.date!==session.id){
        const delta=Math.round((summary.best-old.weight)*100)/100;
        changes.push({name:String(ex.name),date:session.id,previousDate:old.date,
          from:old.weight,to:summary.best,delta});
      }
      lastByExercise.set(exKey,{date:session.id,weight:summary.best});
    }
  }
  const lastComparison=new Map();
  for(const change of changes)lastComparison.set(key(change.name),change);
  const comparable=[...lastComparison.values()].sort((a,b)=>
    Math.abs(b.delta)-Math.abs(a.delta)).slice(0,4);
  const increases=comparable.filter(c=>c.delta>0).length;
  const stable=comparable.filter(c=>c.delta===0).length;
  const signals=[];
  if(!scheduled) {
    signals.push('Sin sesiones programadas en los últimos 28 días.');
  } else {
    signals.push(completed.length+' de '+scheduled+' sesiones programadas finalizadas en 28 días.');
    if(completionRate!==null && completionRate<65) {
      signals.push('Revisar adherencia y confirmar si las sesiones no finalizadas fueron realizadas.');
    }
    if(currentSessions>previousSessions)signals.push('Se registraron más sesiones finalizadas en los últimos 14 días que en los 14 anteriores.');
    if(increases>0)signals.push('Hay ejercicios con una carga registrada superior a su sesión comparable anterior.');
    else if(stable>0)signals.push('Se mantuvieron cargas en algunos ejercicios comparables.');
    if(!comparable.length)signals.push('Todavía faltan registros comparables para analizar cambios de carga.');
  }
  return {rangeDays:28,scheduled,completed:completed.length,completionRate,
    seriesCompleted,totalVolume,currentSessions,previousSessions,
    comparable,increases,stable,signals:signals.slice(0,3)};
}
