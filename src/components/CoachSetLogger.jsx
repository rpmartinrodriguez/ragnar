import React, { useEffect, useRef, useState } from 'react';
import { Check, Save, Dumbbell, AlertCircle, CheckCircle2 } from 'lucide-react';
import { runTransaction, doc, serverTimestamp } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { db } from '../firebase';
import { explainCoachSaveError } from '../utils/coachSafeEdits';

// El coach puede anotar las series reales sin crear otra ficha ni otra sesión.
// Los registros del alumno y del coach comparten la estructura actualSets.
function setsForExercise(exercise) {
  const planned=Array.isArray(exercise.plannedSets) && exercise.plannedSets.length
    ? exercise.plannedSets.length
    : Math.min(50, Math.max(1, Number.parseInt(exercise.sets, 10) || 1));
  return Array.from({ length:planned }, (_,i) => ({
    reps:String(exercise.actualSets?.[i]?.reps ?? ''),
    weight:String(exercise.actualSets?.[i]?.weight ?? ''),
    completed:exercise.actualSets?.[i]?.completed === true
  }));
}
function signature(exercises) {
  // Sólo la identidad y la estructura: las series reales y notas pueden
  // cambiar en otro dispositivo sin bloquear el registro del entrenador.
  return JSON.stringify(exercises.map(ex => ({
    name: String(ex.name || ''),
    sets: Array.isArray(ex.plannedSets) && ex.plannedSets.length
      ? ex.plannedSets.length : Math.max(1, parseInt(ex.sets, 10) || 1)
  })));
}

export default function CoachSetLogger({ clientId, dateId, exercises = [], finalized = false }) {
  const [draft,setDraft]=useState([]);
  const [saving,setSaving]=useState(false);
  const [notice,setNotice]=useState(null);
  const dirtyRef=useRef(false);
  const initialRef=useRef('');
  const changedFieldsRef=useRef({});
  const activeRef=useRef(dateId);

  useEffect(() => {
    dirtyRef.current=false;
    changedFieldsRef.current={};
    initialRef.current='';
    activeRef.current=dateId;
    setNotice(null);
  },[clientId,dateId]);

  useEffect(()=>{
    if(dirtyRef.current)return;
    setDraft(exercises.map(setsForExercise));
    initialRef.current=signature(exercises);
  },[exercises,clientId,dateId]);

  const update=(exerciseIndex,setIndex,field,value)=>{
    if(finalized||saving)return;
    dirtyRef.current=true;
    changedFieldsRef.current[exerciseIndex+':'+setIndex+':'+field] = { exerciseIndex, setIndex, field, value };
    setNotice(null);
    setDraft(prev=>prev.map((sets,i)=>i===exerciseIndex
      ? sets.map((set,j)=>j===setIndex?{...set,[field]:value}:set)
      : sets));
  };

  const save=async()=>{
    if(saving||finalized||!dirtyRef.current)return;
    const user=getAuth().currentUser;
    if(!user?.uid)return setNotice({error:true,text:'Ingresá nuevamente como entrenador.'});
    const dateAtSave=dateId;
    const edits=Object.values(changedFieldsRef.current);
    if(edits.length===0)return;
    setSaving(true);setNotice(null);
    try {
      for(const sets of draft){
        for(const set of sets){
          for(const [field,value,max] of [['reps',set.reps,500],['weight',set.weight,1500]]){
            const normalized=String(value||'').replace(',','.').trim();
            if(normalized && (!Number.isFinite(Number(normalized)) || Number(normalized)<0 || Number(normalized)>max)){
              throw new Error('Revisá las '+(field==='reps'?'repeticiones':'cargas en kg')+
                ': los valores deben ser números positivos razonables.');
            }
            if(field==='reps'&&normalized&&!Number.isInteger(Number(normalized))){
              throw new Error('Las repeticiones deben ser números enteros.');
            }
          }
        }
      }
      const clientRef=doc(db,'clients',clientId);
      const sessionRef=doc(db,'clients',clientId,'sessions',dateAtSave);
      let nextSignature='';
      await runTransaction(db,async tx=>{
        const clientSnap=await tx.get(clientRef);
        const sessionSnap=await tx.get(sessionRef);
        if(!clientSnap.exists() || clientSnap.data().trainingMode!=='presencial'){
          throw new Error('Este alumno ya no está configurado como presencial. Revisá su modalidad.');
        }
        if(!sessionSnap.exists())throw new Error('El entrenamiento ya no existe en la fecha seleccionada.');
        const current=sessionSnap.data();
        if(current.isFinalized)throw new Error('La sesión está finalizada y no admite modificaciones.');
        if(!Array.isArray(current.exercises) || current.exercises.length!==draft.length ||
           signature(current.exercises)!==initialRef.current){
          throw new Error('El alumno u otro entrenador modificó las series mientras editabas. Actualizá la vista para no sobrescribir cambios.');
        }
        const updated=current.exercises.map(ex => ({
          ...ex,
          actualSets:Array.isArray(ex.actualSets)
            ? ex.actualSets.map(set => ({...set})) : []
        }));
        for(const {exerciseIndex,setIndex,field,value} of edits) {
          const ex=updated[exerciseIndex];
          if(!ex || !Number.isInteger(setIndex) || setIndex<0 || setIndex>=draft[exerciseIndex].length) {
            throw new Error('El orden de las series cambió. Abrí nuevamente la rutina.');
          }
          const actualSets=ex.actualSets;
          actualSets[setIndex] = { reps:'', weight:'', completed:false, ...(actualSets[setIndex] || {}) };
          actualSets[setIndex][field] = field==='completed'
            ? value===true : String(value||'').replace(',','.');
        }
        nextSignature=signature(updated);
        tx.update(sessionRef,{
          exercises:updated,
          coachLoggedAt:serverTimestamp(),
          coachLoggedBy:user.uid
        });
      });
      if(activeRef.current===dateAtSave){
        initialRef.current=nextSignature;
        dirtyRef.current=false;
        changedFieldsRef.current={};
        setNotice({error:false,text:'Series y pesos registrados correctamente en la ficha del alumno.'});
      }
    }catch(error){
      if(activeRef.current===dateAtSave)setNotice({error:true,text:explainCoachSaveError(error)});
    }finally{setSaving(false);}
  };

  if(!Array.isArray(exercises)||exercises.length===0)return null;
  return (
    <section className="mt-5 rounded-2xl border border-blue-400/25 bg-blue-400/5 p-4 sm:p-5 space-y-4" aria-label="Registro presencial del entrenador">
      <div className="flex items-start gap-2">
        <Dumbbell size={20} className="text-blue-300 shrink-0"/>
        <div>
          <h4 className="text-white uppercase font-black text-sm">Registro presencial del coach</h4>
          <p className="text-xs text-zinc-400 mt-1">Anotá las repeticiones y pesos realizados. El alumno también puede registrarlos desde su teléfono; evitá editar simultáneamente la misma sesión.</p>
        </div>
      </div>

      {exercises.map((ex,i)=>(
        <div key={i} className="border border-zinc-800 rounded-xl p-3 bg-black/40 space-y-3">
          <p className="text-zinc-100 font-bold text-sm break-words">{i+1}. {ex.name||'Ejercicio'}</p>
          {(draft[i]||[]).map((set,j)=>(
            <div key={j} className="grid grid-cols-[36px_minmax(0,1fr)_minmax(0,1fr)_62px] gap-2 items-end">
              <span className="text-zinc-400 text-xs font-bold pb-3">{j+1}.</span>
              <label className="min-w-0">
                <span className="block text-[10px] text-zinc-500 mb-1">Reps</span>
                <input aria-label={'Repeticiones '+ex.name+' serie '+(j+1)}
                  type="text" inputMode="numeric" maxLength={4} autoComplete="off" value={set.reps}
                  disabled={finalized||saving} onChange={e=>{if(/^\d{0,4}$/.test(e.target.value))update(i,j,'reps',e.target.value);}}
                  className="w-full min-w-0 bg-zinc-900 border border-zinc-700 rounded-lg text-white text-sm p-2.5 outline-none focus:border-yellow-400 disabled:opacity-50"/>
              </label>
              <label className="min-w-0">
                <span className="block text-[10px] text-zinc-500 mb-1">Kg</span>
                <input aria-label={'Peso '+ex.name+' serie '+(j+1)}
                  type="text" inputMode="decimal" maxLength={7} autoComplete="off" value={set.weight}
                  disabled={finalized||saving} onChange={e=>{if(/^\d{0,4}(?:[.,]\d{0,2})?$/.test(e.target.value))update(i,j,'weight',e.target.value);}}
                  className="w-full min-w-0 bg-zinc-900 border border-zinc-700 rounded-lg text-white text-sm p-2.5 outline-none focus:border-yellow-400 disabled:opacity-50"/>
              </label>
              <button type="button" onClick={()=>update(i,j,'completed',!set.completed)}
                disabled={finalized||saving} aria-pressed={set.completed}
                className={'min-h-11 rounded-lg border flex flex-col items-center justify-center gap-0.5 text-[10px] font-bold disabled:opacity-50 '+
                  (set.completed?'bg-emerald-500 text-black border-emerald-500':'bg-zinc-900 text-zinc-400 border-zinc-700')}
                aria-label={'Marcar serie '+(j+1)+' como '+(set.completed?'pendiente':'realizada')}>
                <Check size={16}/>{set.completed?'Hecha':'Pend.'}
              </button>
            </div>
          ))}
        </div>
      ))}
      <button type="button" onClick={save}
        disabled={finalized||saving||!dirtyRef.current}
        className="w-full sm:w-auto px-5 py-3 rounded-xl bg-blue-400 text-black font-black text-sm inline-flex items-center justify-center gap-2 disabled:opacity-40">
        <Save size={17}/>{saving?'Guardando series...':'Guardar series y pesos'}
      </button>
      {finalized&&<p className="text-xs text-zinc-400">Sesión finalizada: el registro queda disponible para consulta.</p>}
      {notice&&<p role={notice.error?'alert':'status'} className={'rounded-xl p-3 text-xs flex gap-2 items-center '+
        (notice.error?'bg-red-500/10 text-red-300':'bg-emerald-500/10 text-emerald-300')}>
        {notice.error?<AlertCircle size={17}/>:<CheckCircle2 size={17}/>}
        {notice.text}
      </p>}
    </section>
  );
}
