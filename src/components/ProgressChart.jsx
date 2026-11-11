import React,{useEffect,useMemo,useState} from 'react';
import {collection,onSnapshot,getDocs} from 'firebase/firestore';
import {db} from '../firebase';
import {Activity,ArrowUpRight,CalendarCheck,Clock,Dumbbell,Info,TrendingUp,CalendarDays} from 'lucide-react';
import WeeklyRecap from './WeeklyRecap';
import {regionOfExercise,regionLabels,groupProgress,exerciseHistorySeries,
  weeklyInsights,dateKey,isFridayFinalSession} from '../utils/trainingInsights';
import {ymdInArgentina} from '../utils/billingCycle';
import {sessionCompletionFeedback} from '../utils/sessionCompletionFeedback';
import ProgressIntelligencePanel from './ProgressIntelligencePanel';

const REGIONS=['all','upper','lower','core','cardio'];
const formatWeight=x=>Number(x).toLocaleString('es-AR',{maximumFractionDigits:1});

export default function ProgressChart({clientId,coachView=false}){
  const [sessions,setSessions]=useState([]);
  const [libraryRegions,setLibraryRegions]=useState({});
  const [region,setRegion]=useState('all');
  const [selectedExercise,setSelectedExercise]=useState('');
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [showWeeklyRecap,setShowWeeklyRecap]=useState(false);
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

  // Para historiales importados sin categoría, utilizar la clasificación de
  // Biblioteca Global POR NOMBRE cuando la cuenta del alumno pueda leerla.
  // Si las reglas no conceden acceso, se mantienen las inferencias existentes.
  useEffect(()=>{
    if(!clientId)return;
    let active=true;
    getDocs(collection(db,'exercises')).then(snapshot=>{
      if(!active)return;
      const regions={};
      snapshot.docs.forEach(d=>{
        const item=d.data();
        const name=String(item.name||'').trim().toLocaleLowerCase('es');
        if(name&&['upper','lower','core','cardio'].includes(item.trainingRegion)){
          regions[name]=item.trainingRegion;
        }
      });
      setLibraryRegions(regions);
    }).catch(()=>{});
    return()=>{active=false;};
  },[clientId]);
  const categorizedSessions=useMemo(()=>sessions.map(session=>({
    ...session,
    exercises:(session.exercises||[]).map(ex=>{
      if(['upper','lower','core','cardio'].includes(ex.trainingRegion))return ex;
      const fromLibrary=libraryRegions[String(ex.name||'').trim().toLocaleLowerCase('es')];
      return fromLibrary?{...ex,trainingRegion:fromLibrary}:ex;
    })
  })),[sessions,libraryRegions]);
  const progress=useMemo(()=>groupProgress(categorizedSessions,today,region),[categorizedSessions,today,region]);
  const week=progress.insight;
  const lastFriday=useMemo(()=>{
    const ids=categorizedSessions.filter(s=>Array.isArray(s.exercises)&&s.exercises.length)
      .map(dateKey);
    return categorizedSessions.filter(s=>s.isFinalized===true&&isFridayFinalSession(dateKey(s),ids))
      .map(dateKey).sort().at(-1)||null;
  },[categorizedSessions]);
  const lastFridaySummary=useMemo(()=>lastFriday
    ?weeklyInsights(categorizedSessions,lastFriday):null,[categorizedSessions,lastFriday]);
  const options=progress.exerciseNames;
  useEffect(()=>{
    if(!options.includes(selectedExercise))setSelectedExercise(options[0]||'');
  },[options.join('|'),selectedExercise]);
  const chart=useMemo(()=>exerciseHistorySeries(categorizedSessions,selectedExercise),[categorizedSessions,selectedExercise]);
  const max=chart.length?Math.max(...chart.map(x=>x.maxWeight)):0;
  const last=chart.at(-1);
  const previous=chart.length>1?chart.at(-2):null;
  const latestFinalDate=useMemo(()=>sessions.filter(s=>s.isFinalized===true)
    .map(dateKey).filter(Boolean).sort().at(-1)||null,[sessions]);
  const latestFeedback=useMemo(()=>latestFinalDate
    ?sessionCompletionFeedback(sessions,latestFinalDate):null,[sessions,latestFinalDate]);

  return (
    <section className="ragnar-performance-progress space-y-5 animate-in fade-in">
      <div className="ragnar-performance-progress-hero p-5 sm:p-7">
        <div className="flex items-start gap-3">
          <div className="bg-yellow-400/10 text-yellow-400 p-3 rounded-2xl"><TrendingUp size={24}/></div>
          <div className="min-w-0">
            <h2 className="font-black text-white uppercase">MI PROGRESO.</h2>
            <p className="text-zinc-300 text-sm mt-2">Tu esfuerzo deja huella. Cada registro cuenta tu evolución real.</p>
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
              return <div key={metric.label} className="ragnar-performance-stat rounded-2xl border p-4 min-w-0">
                <Icon className="text-yellow-400" size={21}/>
                <p className="text-white text-2xl sm:text-3xl font-black mt-3 break-words">{metric.value}</p>
                <p className="text-zinc-400 text-xs mt-1">{metric.label}</p>
              </div>;
            })}
          </div>

          {region==='all' && (
            <ProgressIntelligencePanel
              sessions={categorizedSessions} today={today}
              region={region} coachView={coachView}/>
          )}

          {region==='all' && latestFeedback && (
            <section className="ragnar-performance-progress-latest" aria-label="Comparación de tu último entrenamiento">
              <div className="flex justify-between items-start gap-3">
                <div>
                  <p className="ragnar-performance-finish-eyebrow">TU ÚLTIMA SESIÓN</p>
                  <h3 className="text-lg font-black mt-1">TU EVOLUCIÓN, CON DATOS REALES.</h3>
                  <p className="text-xs ragnar-performance-finish-muted mt-1">
                    {latestFeedback.date.split('-').reverse().join('/')} · {latestFeedback.completedSets} series completas
                    {latestFeedback.previousSets!==null
                      ? ' · anterior: '+latestFeedback.previousSets+' series' : ' · primera sesión disponible'}
                  </p>
                </div>
                <TrendingUp className="text-yellow-400 shrink-0" size={24}/>
              </div>
              {latestFeedback.comparisons.length>0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
                  {latestFeedback.comparisons.map(item=>(
                    <div key={item.name} className="ragnar-performance-progress-compare">
                      <p className="text-xs font-bold truncate">{item.name}</p>
                      <p className="text-xs mt-1 ragnar-performance-finish-muted">
                        {item.fromLabel} → {item.toLabel}
                      </p>
                      <strong className={item.delta>0?'text-yellow-400':'ragnar-performance-finish-muted'}>
                        {item.delta===0?'Misma carga':item.formattedDelta}
                      </strong>
                    </div>
                  ))}
                </div>
              ):(
                <p className="text-xs ragnar-performance-finish-muted mt-3">
                  No hay cargas anteriores comparables para estos ejercicios.
                </p>
              )}
              <p className="text-[11px] ragnar-performance-finish-muted mt-3">
                Se calcula a partir de las sesiones guardadas. Más o menos carga no determina por sí sola tu progreso.
              </p>
            </section>
          )}

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

          {lastFridaySummary&&(
            <div className="rounded-2xl border border-yellow-400/20 bg-yellow-400/5 p-4 space-y-3">
              <button type="button" onClick={()=>setShowWeeklyRecap(v=>!v)}
                className="w-full text-left flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 font-black uppercase text-yellow-300 text-xs">
                  <CalendarDays size={19}/> {showWeeklyRecap?'Ocultar resumen del viernes':'Ver mi último cierre semanal'}
                </span>
                <span className="text-zinc-400 text-xs">
                  {lastFriday.split('-').reverse().join('/')}
                </span>
              </button>
              {showWeeklyRecap&&<WeeklyRecap summary={lastFridaySummary}
                onClose={()=>setShowWeeklyRecap(false)}/>}
            </div>
          )}

          <div className="rounded-3xl bg-zinc-900 border border-zinc-800 p-4 sm:p-6">
            <p className="font-black uppercase text-white text-lg tracking-tight">EVOLUCIÓN DE FUERZA.</p>
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
