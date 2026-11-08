import React,{useEffect,useMemo,useState} from 'react';
import {collection,onSnapshot} from 'firebase/firestore';
import {db} from '../firebase';
import {Activity,ArrowUpRight,CalendarCheck,Clock,Dumbbell,Info,TrendingUp} from 'lucide-react';
import {regionOfExercise,regionLabels,groupProgress,exerciseHistorySeries,
  weeklyInsights,dateKey} from '../utils/trainingInsights';
import {ymdInArgentina} from '../utils/billingCycle';

const REGIONS=['all','upper','lower','core','cardio'];
const formatWeight=x=>Number(x).toLocaleString('es-AR',{maximumFractionDigits:1});

export default function ProgressChart({clientId}){
  const [sessions,setSessions]=useState([]);
  const [region,setRegion]=useState('all');
  const [selectedExercise,setSelectedExercise]=useState('');
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const today=ymdInArgentina();

  useEffect(()=>{
    if(!clientId)return;
    setLoading(true);
    return onSnapshot(collection(db,'clients',clientId,'sessions'),snapshot=>{
      setSessions(snapshot.docs.map(d=>({id:d.id,...d.data()})));
      setLoading(false);setError('');
    },error=>{
      setLoading(false);setError('No se pudo leer el progreso: '+(error?.code||'revisá tu conexión'));
    });
  },[clientId]);

  const progress=useMemo(()=>groupProgress(sessions,today,region),[sessions,today,region]);
  const week=progress.insight;
  const options=progress.exerciseNames;
  useEffect(()=>{
    if(!options.includes(selectedExercise))setSelectedExercise(options[0]||'');
  },[options.join('|'),selectedExercise]);
  const chart=useMemo(()=>exerciseHistorySeries(sessions,selectedExercise),[sessions,selectedExercise]);
  const max=chart.length?Math.max(...chart.map(x=>x.maxWeight)):0;
  const last=chart.at(-1);
  const previous=chart.length>1?chart.at(-2):null;

  return (
    <section className="space-y-5 animate-in fade-in">
      <div className="rounded-3xl bg-zinc-900 border border-zinc-800 p-4 sm:p-6">
        <div className="flex items-start gap-3">
          <div className="bg-yellow-400/10 text-yellow-400 p-3 rounded-2xl"><TrendingUp size={24}/></div>
          <div className="min-w-0">
            <h2 className="font-black text-white text-xl uppercase">Mi evolución Ragnar</h2>
            <p className="text-zinc-400 text-sm mt-1">Compará tu esfuerzo y tus marcas por zona de entrenamiento.</p>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-5">
          {REGIONS.map(item=>(
            <button type="button" key={item} onClick={()=>{setRegion(item);setSelectedExercise('');}}
              aria-pressed={region===item}
              className={'text-xs font-black rounded-xl border px-2.5 py-3 min-h-11 transition-colors '+
                (region===item?'border-yellow-400 bg-yellow-400 text-black':'border-zinc-700 bg-zinc-950 text-zinc-300 hover:border-yellow-400/40')}>
              {regionLabels[item]}
            </button>
          ))}
        </div>
      </div>
      {error&&<p role="alert" className="p-3 bg-red-500/10 rounded-xl text-red-300 text-sm">{error}</p>}
      {loading?<div className="text-zinc-400 text-sm p-8 text-center">Preparando tus registros de entrenamiento...</div>:(
        <>
          <div className="grid grid-cols-2 gap-2 sm:gap-3">
            {[
              {icon:CalendarCheck,label:'Sesiones terminadas',value:progress.completed},
              {icon:Dumbbell,label:'Series completadas',value:progress.sets},
              {icon:Activity,label:'Volumen registrado',value:progress.volume>0?formatWeight(progress.volume)+' kg':'Sin cargas'},
              {icon:Clock,label:'Minutos medidos',value:progress.minutesSessions?progress.minutes+' min':'Sin medición'}
            ].map(metric=>{
              const Icon=metric.icon;
              return <div key={metric.label} className="bg-zinc-900 rounded-2xl border border-zinc-800 p-4 min-w-0">
                <Icon className="text-yellow-400" size={21}/>
                <p className="text-white text-2xl font-black mt-3 break-words">{metric.value}</p>
                <p className="text-zinc-400 text-xs mt-1">{metric.label}</p>
              </div>;
            })}
          </div>

          {week&&<div className="rounded-3xl bg-zinc-900 border border-yellow-400/20 p-5 space-y-3">
            <p className="text-white font-black uppercase text-sm">Esta semana · {regionLabels[region]}</p>
            <p className="text-zinc-400 text-sm">{week.sessions} sesiones realizadas · {week.sets} series completadas</p>
            <p className="text-xs text-zinc-400">
              {week.previousSessions>0
                ? 'Semana anterior: '+week.previousSessions+' sesiones y '+week.previousSets+' series.'
                : 'Todavía no hay una semana anterior registrada para comparar.'}
            </p>
            {week.improvements.length>0?(
              <div className="border-t border-zinc-800 pt-3">
                <p className="text-emerald-300 text-xs font-black flex gap-2 items-center">
                  <ArrowUpRight size={17}/>{week.improvements.length} ejercicio(s) con aumento de carga
                </p>
                {week.improvements.slice(0,4).map(item=>(
                  <p key={item.name} className="text-zinc-200 text-xs mt-2 flex flex-wrap justify-between gap-2">
                    <span className="capitalize">{item.name}</span>
                    <strong className="text-emerald-300">+{formatWeight(item.delta)} kg</strong>
                  </p>
                ))}
              </div>
            ):<p className="text-zinc-500 text-xs">Las mejoras de carga aparecen cuando hay series comparables con la semana anterior.</p>}
          </div>}

          <div className="rounded-3xl bg-zinc-900 border border-zinc-800 p-4 sm:p-6">
            <p className="font-black uppercase text-white text-sm">Mi fuerza por ejercicio</p>
            <p className="text-zinc-500 text-xs mt-1 mb-4">Carga máxima realizada en una serie completada (kg).</p>
            <select aria-label="Elegí un ejercicio" value={selectedExercise}
              onChange={e=>setSelectedExercise(e.target.value)}
              className="block w-full rounded-xl bg-zinc-950 border border-zinc-700 p-3.5 text-base sm:text-sm text-white outline-none focus:border-yellow-400">
              {!options.length&&<option value="">Todavía no hay ejercicios registrados</option>}
              {options.map(ex=><option key={ex} value={ex}>{ex}</option>)}
            </select>
            {last&&(
              <div className="grid grid-cols-2 gap-2 my-4">
                <div className="rounded-xl bg-black/40 p-3 border border-zinc-800">
                  <p className="text-zinc-500 text-xs">Última carga</p>
                  <p className="text-white font-black text-lg">{formatWeight(last.maxWeight)} kg</p>
                </div>
                <div className="rounded-xl bg-black/40 p-3 border border-zinc-800">
                  <p className="text-zinc-500 text-xs">Sesión anterior</p>
                  <p className="text-white font-black text-lg">{previous?formatWeight(previous.maxWeight)+' kg':'Sin registro'}</p>
                </div>
              </div>
            )}
            <div className="h-52 bg-zinc-950/80 rounded-2xl border border-zinc-800 p-3 flex items-end gap-2 overflow-x-auto">
              {chart.length?chart.slice(-16).map((point,i)=>(
                <div key={point.date+'-'+i} className="flex-none w-12 h-full flex flex-col items-center justify-end gap-2">
                  <span className="text-[10px] text-white font-bold">{formatWeight(point.maxWeight)}</span>
                  <div className="w-full rounded-t-md bg-yellow-400"
                    style={{height:Math.max(8,(point.maxWeight/max)*125)+'px'}} aria-label={point.maxWeight+' kilos'}/>
                  <span className="text-zinc-500 text-[10px] whitespace-nowrap">{point.date.slice(8)}/{point.date.slice(5,7)}</span>
                </div>
              )):<div className="h-full w-full flex flex-col gap-2 items-center justify-center text-zinc-500">
                <Activity size={30}/>
                <p className="text-sm text-center">Elegí un ejercicio y registrá cargas para visualizar tu avance.</p>
              </div>}
            </div>
          </div>

          {region==='all'&&(
            <div className="border border-zinc-800 rounded-2xl bg-zinc-900/70 p-4 text-zinc-400 text-xs flex gap-2 items-start">
              <Info size={18} className="text-yellow-400 shrink-0"/>
              Los totales de volumen utilizan únicamente series terminadas con repeticiones y kilos válidos. El peso se compara dentro del mismo ejercicio.
            </div>
          )}
          {['upper','lower','core','cardio'].includes(region)&&!options.length&&(
            <p className="border border-amber-400/20 rounded-xl text-amber-200 text-xs p-3">
              No hay ejercicios identificados en esta zona. El entrenador puede clasificarlos desde Biblioteca Global. Los ejercicios antiguos se reconocen por nombre cuando es posible.
            </p>
          )}
        </>
      )}
    </section>
  );
}
