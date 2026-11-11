import React, { useEffect, useState } from 'react';
import { Activity, Check, CheckCircle2, ChevronDown, HeartPulse, Save } from 'lucide-react';
import { doc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { buildCheckIn, normalizeCheckIn, checkInDisplay } from '../utils/ragnarCheckIn';

const sleepChoices=[{value:'bien',label:'Bien'},{value:'regular',label:'Regular'},{value:'mal',label:'Mal'}];

export default function StudentCheckIn({ clientId, dateId, initialValue, finalized }) {
  const saved=normalizeCheckIn(initialValue);
  const [energy,setEnergy]=useState(saved?.energy ?? 3);
  const [sleep,setSleep]=useState(saved?.sleep ?? 'bien');
  const [discomfort,setDiscomfort]=useState(saved?.discomfort ?? false);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState('');
  const [success,setSuccess]=useState(false);

  useEffect(()=>{
    const value=normalizeCheckIn(initialValue);
    setEnergy(value?.energy ?? 3);
    setSleep(value?.sleep ?? 'bien');
    setDiscomfort(value?.discomfort ?? false);
    setSuccess(false);
    setError('');
  },[clientId,dateId,initialValue?.energy,initialValue?.sleep,initialValue?.discomfort]);

  const submit=async event=>{
    event.preventDefault();
    if(saving || finalized) return;
    setSaving(true);setError('');setSuccess(false);
    try {
      const payload=buildCheckIn({energy,sleep,discomfort});
      const ref=doc(db,'clients',clientId,'sessions',dateId);
      await runTransaction(db,async tx=>{
        const snap=await tx.get(ref);
        if(!snap.exists() || snap.data().isFinalized===true) {
          throw new Error('Este día no admite nuevos check-ins. Volvé a consultar tu calendario.');
        }
        if(!Array.isArray(snap.data().exercises) || snap.data().exercises.length===0) {
          throw new Error('No hay ejercicios programados para esta fecha.');
        }
        tx.update(ref,{checkIn:{...payload,updatedAt:serverTimestamp(),source:'student'}});
      });
      setSuccess(true);
    } catch(err) {
      const code=String(err?.code||'');
      setError(code.includes('permission-denied')
        ? 'No tenés permisos para guardar el Check-in. Avisale a tu entrenador.'
        : code.includes('unavailable')
          ? 'Sin conexión a Firebase. Volvé a intentar.'
          : err?.message || 'No pudimos guardar el Check-in.');
    } finally {setSaving(false);}
  };

  return (
    <details className="ragnar-intelligence-checkin">
      <summary className="ragnar-intelligence-checkin-trigger">
        <span className="flex items-center gap-2 min-w-0">
          <HeartPulse size={20} className="text-yellow-400 shrink-0"/>
          <span className="min-w-0">
            <strong className="block text-sm font-black">CHECK-IN · ¿CÓMO LLEGÁS HOY?</strong>
            <small className="block text-[11px] opacity-75 mt-0.5">
              {saved ? 'Registrado · ' + checkInDisplay(saved) : 'Opcional · Contale a tu coach cómo estás'}
            </small>
          </span>
        </span>
        <ChevronDown size={18} className="ragnar-intelligence-checkin-chevron shrink-0"/>
      </summary>
      <form onSubmit={submit} className="p-4 border-t border-zinc-700/35 space-y-4">
        <p className="text-xs opacity-75">Tus respuestas solo acompañan el entrenamiento; no son una evaluación médica.</p>
        <div>
          <p className="font-black text-xs uppercase mb-2">¿Cuánta energía tenés?</p>
          <div className="grid grid-cols-5 gap-2" role="group" aria-label="Energía de 1 a 5">
            {[1,2,3,4,5].map(n=><button type="button" key={n}
              aria-pressed={energy===n} onClick={()=>setEnergy(n)}
              className={'ragnar-intelligence-choice '+(energy===n?'is-selected':'')}>{n}</button>)}
          </div>
          <p className="text-[11px] opacity-65 mt-1">1 = muy poca · 5 = mucha energía</p>
        </div>
        <div>
          <p className="font-black text-xs uppercase mb-2">¿Cómo descansaste?</p>
          <div className="grid grid-cols-3 gap-2" role="group" aria-label="Calidad del descanso">
            {sleepChoices.map(item=><button type="button" key={item.value}
              aria-pressed={sleep===item.value} onClick={()=>setSleep(item.value)}
              className={'ragnar-intelligence-choice '+(sleep===item.value?'is-selected':'')}>
              {item.label}</button>)}
          </div>
        </div>
        <div>
          <p className="font-black text-xs uppercase mb-2">¿Tenés alguna molestia que comunicar?</p>
          <div className="grid grid-cols-2 gap-2" role="group" aria-label="Molestias reportadas">
            <button type="button" onClick={()=>setDiscomfort(false)}
              aria-pressed={!discomfort} className={'ragnar-intelligence-choice '+(!discomfort?'is-selected':'')}>No</button>
            <button type="button" onClick={()=>setDiscomfort(true)}
              aria-pressed={discomfort} className={'ragnar-intelligence-choice '+(discomfort?'is-selected':'')}>Sí, avisar</button>
          </div>
        </div>
        {discomfort && <p className="text-xs text-amber-300">Si sentís dolor o una molestia importante, avisale al coach antes de realizar el ejercicio. No es necesario describir información médica aquí.</p>}
        <p className="text-xs opacity-75">Compartido con tu entrenador, no con el Salón Ragnar. Podés omitirlo y entrenar igual.</p>
        {error && <p role="alert" className="text-red-300 text-xs">{error}</p>}
        {success && <p role="status" className="flex items-center gap-2 text-emerald-400 text-xs"><CheckCircle2 size={16}/> Check-in guardado.</p>}
        <button type="submit" disabled={saving||finalized}
          className="ragnar-intelligence-submit disabled:opacity-50">
          {saving?<Activity size={17} className="animate-pulse"/>:<Save size={17}/>}
          {saving?'GUARDANDO...':saved?'ACTUALIZAR CHECK-IN':'GUARDAR CHECK-IN'}
        </button>
      </form>
    </details>
  );
}
