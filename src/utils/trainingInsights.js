// Métricas de entrenamiento reproducibles a partir de sesiones Firestore.
// No se deben comparar pesos de ejercicios distintos como si fueran mejoras.
// Esfuerzo (RPE) describe percepción, no una mejora automática de fuerza.
const upper=/\b(press|bench|pecho|pectoral|biceps?|triceps?|hombros?|deltoid|elevacion(?:es)?|remo|pull.?up|dominad|jal[oó]n|polea|dorsal|espalda|lat pulldown|curl de brazo|fondos|face pull|push.?up|flexion(?:es)? de brazo)\b/i;
const lower=/\b(sentadill|squat|peso muerto|deadlift|leg press|prensa|cuadriceps|isquio|femoral|glute|gl[uú]te|pantorrill|gemelo|zancad|lunges?|hip thrust|extensi[oó]n de pierna|curl de pierna|abductor|aductor|step.up|good morning)\b/i;
const core=/\b(abdominal|plancha|plank|crunch|core|oblicuo)\b/i;
const cardio=/\b(cinta|bicicleta|trote|running|carrera|correr|el[ií]ptica|cardio|remador)\b/i;

export function regionOfExercise(exercise={}) {
  const explicit=exercise.trainingRegion || exercise.bodyRegion || exercise.region;
  if(['upper','lower','core','cardio'].includes(explicit))return explicit;
  const name=String(exercise.name||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  if(core.test(name))return 'core';
  if(cardio.test(name))return 'cardio';
  if(lower.test(name))return 'lower';
  if(upper.test(name))return 'upper';
  return 'unknown';
}
export const regionLabels={all:'General',upper:'Tren superior',lower:'Tren inferior',core:'Zona media',cardio:'Cardio',unknown:'Sin clasificar'};
export function safeNumber(value,max=100000){
  const x=Number(String(value??'').replace(',','.'));
  return Number.isFinite(x)&&x>=0&&x<=max?x:null;
}
const nameKey=s=>String(s||'').toLocaleLowerCase('es').trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
export function dateKey(doc) {
  return typeof doc?.id==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(doc.id)?doc.id:
    (typeof doc?.date==='string'?doc.date:'');
}
export function getWeekBounds(dateYmd) {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(String(dateYmd)))return null;
  const d=new Date(dateYmd+'T12:00:00Z');
  if(!Number.isFinite(d.valueOf()))return null;
  const day=(d.getUTCDay()+6)%7;
  const monday=new Date(d);
  monday.setUTCDate(d.getUTCDate()-day);
  const sunday=new Date(monday);
  sunday.setUTCDate(sunday.getUTCDate()+6);
  const friday=new Date(monday);
  friday.setUTCDate(friday.getUTCDate()+4);
  const previous=new Date(monday);
  previous.setUTCDate(previous.getUTCDate()-7);
  const iso=x=>x.toISOString().slice(0,10);
  return {start:iso(monday),end:iso(sunday),friday:iso(friday),previousStart:iso(previous),previousEnd:iso(new Date(monday.getTime()-86400000))};
}
export function isFridayFinalSession(dateYmd,scheduledIds=[]) {
  const bounds=getWeekBounds(dateYmd);
  if(!bounds||dateYmd!==bounds.friday)return false;
  return !scheduledIds.some(id=>id>dateYmd && id<=bounds.end);
}
function summarize(sessions=[],region='all'){
  const finalized=sessions.filter(s=>s?.isFinalized===true);
  const bestByExercise=new Map();
  let sets=0,volume=0,volumeSets=0,minutes=0,minutesSessions=0,effort=0,effortSessions=0,exercisesWithRegion=0,unknownExercises=0;
  for(const session of finalized){
    const sessionExercises=Array.isArray(session.exercises)?session.exercises:[];
    let hasRegion=region==='all';
    for(const ex of sessionExercises){
      const exRegion=regionOfExercise(ex);
      if(exRegion==='unknown')unknownExercises++;
      if(region!=='all'&&exRegion!==region)continue;
      hasRegion=true;
      exercisesWithRegion++;
      const key=nameKey(ex.name);
      let best=bestByExercise.get(key)||0;
      for(const set of (Array.isArray(ex.actualSets)?ex.actualSets:[])){
        if(set?.completed!==true)continue;
        sets++;
        const kg=safeNumber(set.weight,2000),reps=safeNumber(set.reps,500);
        if(kg!==null&&kg>0)best=Math.max(best,kg);
        if(kg!==null&&reps!==null&&kg>0&&reps>0){volume+=kg*reps;volumeSets++;}
      }
      if(key&&best>0)bestByExercise.set(key,best);
    }
    if(hasRegion){
      const duration=safeNumber(session.workoutDurationMinutes,720);
      if(duration!==null&&duration>0){minutes+=duration;minutesSessions++;}
      const rpe=safeNumber(session.perceivedEffort,10);
      if(rpe!==null&&rpe>=1){effort+=rpe;effortSessions++;}
    }
  }
  return {sessions:region==='all'?finalized.length:finalized.filter(s=>(s.exercises||[]).some(ex=>regionOfExercise(ex)===region)).length,
    sets,volume:Math.round(volume),volumeSets,minutes,minutesSessions,
    effort:effortSessions?Math.round(effort/effortSessions*10)/10:null,
    effortSessions,exercisesWithRegion,unknownExercises,bestByExercise};
}
export function weeklyInsights(allSessions=[],dateYmd,region='all') {
  const bounds=getWeekBounds(dateYmd);
  if(!bounds)return null;
  const current=allSessions.filter(s=>dateKey(s)>=bounds.start&&dateKey(s)<=bounds.end);
  const before=allSessions.filter(s=>dateKey(s)>=bounds.previousStart&&dateKey(s)<=bounds.previousEnd);
  const curr=summarize(current,region);
  const prev=summarize(before,region);
  const improvements=[];
  for(const [key,weight] of curr.bestByExercise){
    const old=prev.bestByExercise.get(key);
    if(old>0&&weight>old)improvements.push({name:key,from:old,to:weight,delta:Math.round((weight-old)*10)/10});
  }
  improvements.sort((a,b)=>b.delta-a.delta);
  const planned=current.filter(s=>Array.isArray(s.exercises)&&s.exercises.length>0).length;
  return {bounds,...curr,planned,previousSessions:prev.sessions,
    previousSets:prev.sets,previousEffort:prev.effort,
    improvements,prCount:improvements.length,
    missingMinutes:curr.sessions-curr.minutesSessions,
    unknownExercises:curr.unknownExercises};
}
export function exerciseHistorySeries(allSessions=[],exerciseName='') {
  const key=nameKey(exerciseName);
  return allSessions.filter(s=>s.isFinalized===true).sort((a,b)=>dateKey(a).localeCompare(dateKey(b)))
    .flatMap(session=>(session.exercises||[]).filter(ex=>nameKey(ex.name)===key).map(ex=>{
      const weights=(ex.actualSets||[]).filter(set=>set?.completed===true)
        .map(set=>safeNumber(set.weight,2000)).filter(x=>x!==null&&x>0);
      return {date:dateKey(session),maxWeight:weights.length?Math.max(...weights):null};
    })).filter(point=>point.maxWeight!==null);
}
export function groupProgress(allSessions=[],dateYmd,region='all'){
  const insight=weeklyInsights(allSessions,dateYmd,region);
  const completed=(allSessions||[]).filter(s=>s.isFinalized===true);
  const counted=summarize(completed,region);
  const exerciseNames=[...new Set(completed.flatMap(s=>(s.exercises||[])
    .filter(ex=>region==='all'||regionOfExercise(ex)===region).map(ex=>ex.name).filter(Boolean)))].sort((a,b)=>a.localeCompare(b,'es'));
  return {insight,completed:counted.sessions,sets:counted.sets,
    volume:counted.volume,minutes:counted.minutes,minutesSessions:counted.minutesSessions,
    exerciseNames,unknownExercises:counted.unknownExercises};
}
