import React,{useMemo,useState} from 'react';
import { CalendarRange, CalendarCheck2, AlertTriangle, Save } from 'lucide-react';
import { doc,runTransaction,serverTimestamp } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import {db} from '../firebase';
import { sessionHasProtectedHistory } from '../utils/sessionSafety';
import { notifyStudentAboutCoachEvent } from '../utils/notifyStudent';

const DAYS=[
  {id:1,name:'Lun'},{id:2,name:'Mar'},{id:3,name:'Mié'},
  {id:4,name:'Jue'},{id:5,name:'Vie'},{id:6,name:'Sáb'},{id:0,name:'Dom'}
];
function dateId(date){
  return [date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),
    String(date.getDate()).padStart(2,'0')].join('-');
}
function safeExercises(routine){
  return (routine?.exercises||[]).map(ex=>{
    const sets=Array.isArray(ex.plannedSets)&&ex.plannedSets.length
      ? ex.plannedSets.map(x=>({...x}))
      : Array.from({length:Math.min(30,Math.max(1,parseInt(ex.sets)||3))},()=>({
        reps:String(ex.reps||'10'),rir:String(ex.rir||'2')
      }));
    return {name:String(ex.name||'Ejercicio'),videoUrl:String(ex.videoUrl||''),trainingRegion:ex.trainingRegion||'unknown',
      coachNote:String(ex.coachNote||'').slice(0,500),
      sets:String(sets.length),reps:String(sets[0]?.reps||'10'),
      rir:String(sets[0]?.rir||'2'),plannedSets:sets,actualSets:[]};
  });
}

export default function CoachPlanningBlocks({clientId,routines=[],baseDate=new Date(),onApplied}){
  const [routineId,setRoutineId]=useState('');
  const [weeks,setWeeks]=useState(4);
  const [weekDays,setWeekDays]=useState([1,3,5]);
  const [start,setStart]=useState(dateId(baseDate));
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [success,setSuccess]=useState('');

  const picked=useMemo(()=>routines.find(r=>r.id===routineId),[routines,routineId]);
  const dates=useMemo(()=>{
    if(!/^\d{4}-\d{2}-\d{2}$/.test(start))return [];
    const first=new Date(start+'T12:00:00');
    if(!Number.isFinite(first.valueOf()))return [];
    const result=[];
    for(let i=0;i<weeks*7;i++){
      const day=new Date(first);
      day.setDate(day.getDate()+i);
      if(weekDays.includes(day.getDay()))result.push(dateId(day));
    }
    return result;
  },[start,weeks,weekDays]);

  const apply=async()=>{
    if(busy)return;
    if(!picked||!picked.exercises?.length){
      setError('Seleccioná una plantilla que tenga ejercicios.');return;
    }
    if(dates.length===0 || dates.length>56){
      setError('Elegí al menos un día de entrenamiento para planificar.');return;
    }
    if(!window.confirm('¿Programar '+dates.length+' días del plan «'+picked.name+
      '» para '+weeks+' semanas? Las sesiones con registros, notas o finalización se protegerán.'))return;
    const coachUid=getAuth().currentUser?.uid;
    if(!coachUid){setError('Ingresá como entrenador nuevamente.');return;}
    setBusy(true);setError('');setSuccess('');
    try{
      const sessions=dates.map(id=>({
        id,ref:doc(db,'clients',clientId,'sessions',id)
      }));
      await runTransaction(db,async tx=>{
        const snapshots=[];
        for(const item of sessions)snapshots.push(await tx.get(item.ref));
        snapshots.forEach((snap,index)=>{
          if(snap.exists()&&sessionHasProtectedHistory(snap.data())){
            throw new Error('El día '+sessions[index].id+
              ' tiene pesos, notas o un entrenamiento realizado. No se reemplazó ningún día.');
          }
        });
        sessions.forEach((item,index)=>{
          const previous=snapshots[index].exists() &&
            (snapshots[index].data().exercises||[]).length>0;
          tx.set(item.ref,{
            date:item.id,
            exercises:safeExercises(picked),
            isFinalized:false,
            coachPlanningUpdatedBy:coachUid,
            coachPlanningUpdatedAt:serverTimestamp(),
            coachPlanningKind:previous?'updated':'assigned'
          },{merge:true});
        });
      });
      onApplied?.(dates);
      // Una sola notificación por bloque. El alumno podrá ver todos los días.
      void notifyStudentAboutCoachEvent('routine_updated',clientId,dates[0]);
      setSuccess('Planificación guardada: '+dates.length+' días en '+weeks+
        ' semanas. Las sesiones históricas no se modificaron.');
    }catch(error){setError(error?.message||'No se pudo guardar la planificación');}
    finally{setBusy(false);}
  };

  return (
    <section className="rounded-xl border border-yellow-400/20 bg-black/30 p-3 space-y-3">
      <h4 className="text-white font-black uppercase text-sm flex items-center gap-2">
        <CalendarRange size={19} className="text-yellow-400"/> Planificar por bloques
      </h4>
      <p className="text-zinc-400 text-xs">Repetí una plantilla durante 4, 6 u 8 semanas en los días que elijas. Las sesiones registradas no se sobrescriben.</p>
      <label className="block text-zinc-300 text-xs font-bold">
        Plantilla
        <select value={routineId} onChange={e=>setRoutineId(e.target.value)}
          className="block mt-1.5 w-full rounded-xl p-3 text-white bg-zinc-950 border border-zinc-700 focus:border-yellow-400 outline-none">
          <option value="">Seleccionar plantilla...</option>
          {routines.map(r=><option key={r.id} value={r.id}>{r.name} · {(r.exercises||[]).length} ejercicios</option>)}
        </select>
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-zinc-300 text-xs font-bold">
          Desde el día
          <input type="date" value={start} onChange={e=>setStart(e.target.value)}
            className="block mt-1.5 w-full min-w-0 rounded-xl p-3 text-white bg-zinc-950 border border-zinc-700 focus:border-yellow-400 outline-none"/>
        </label>
        <label className="text-zinc-300 text-xs font-bold">
          Duración
          <select value={weeks} onChange={e=>setWeeks(Number(e.target.value))}
            className="block mt-1.5 w-full min-w-0 rounded-xl p-3 text-white bg-zinc-950 border border-zinc-700 focus:border-yellow-400 outline-none">
            <option value={4}>4 semanas</option><option value={6}>6 semanas</option><option value={8}>8 semanas</option>
          </select>
        </label>
      </div>
      <div>
        <p className="text-zinc-300 text-xs font-bold mb-2">Días por semana</p>
        <div className="grid grid-cols-7 gap-1.5">
          {DAYS.map(day=><button type="button" key={day.id}
            aria-pressed={weekDays.includes(day.id)}
            onClick={()=>setWeekDays(prev=>prev.includes(day.id)?
              prev.filter(x=>x!==day.id):[...prev,day.id])}
            className={'min-h-11 rounded-lg border text-[11px] font-black '+
              (weekDays.includes(day.id)?'bg-yellow-400 text-black border-yellow-400':
                'bg-zinc-950 text-zinc-400 border-zinc-700')}>
            {day.name}
          </button>)}
        </div>
      </div>
      <p className="text-yellow-300 text-xs font-bold flex items-center gap-2">
        <CalendarCheck2 size={16}/>{dates.length} días de entrenamiento previstos
      </p>
      {error&&<p role="alert" className="flex gap-2 text-xs text-red-300"><AlertTriangle size={17}/>{error}</p>}
      {success&&<p role="status" className="text-emerald-300 text-xs">{success}</p>}
      <button type="button" onClick={apply} disabled={busy||!picked||!weekDays.length||!dates.length}
        className="w-full rounded-xl bg-yellow-400 text-black p-3.5 font-black text-sm flex items-center justify-center gap-2 disabled:opacity-40">
        <Save size={17}/>{busy?'Guardando bloque...':'Programar semanas'}
      </button>
    </section>
  );
}
