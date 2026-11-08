import React from 'react';
import {Award,CalendarCheck2,Clock,Dumbbell,Flame,TrendingUp,TrendingDown,Info} from 'lucide-react';

function compare(newValue,oldValue,unit=''){
  if(oldValue===null||oldValue===undefined)return 'Sin dato anterior';
  if(newValue===null||newValue===undefined)return 'Sin dato actual';
  const difference=Math.round((newValue-oldValue)*10)/10;
  return (difference>0?'+':'')+difference+unit+' frente a la semana pasada';
}
export default function WeeklyRecap({summary, onClose, onViewProgress, onShare}) {
  if(!summary)return null;
  const start=summary.bounds?.start?.split('-').reverse().join('/')||'';
  const end=summary.bounds?.end?.split('-').reverse().join('/')||'';
  return (
    <section className="bg-zinc-950 border border-yellow-400/40 rounded-3xl p-4 sm:p-6 space-y-4 w-full max-w-xl mx-auto" aria-label="Resumen semanal Ragnar">
      <div className="text-center">
        <div className="w-14 h-14 rounded-2xl bg-yellow-400/15 flex items-center justify-center text-yellow-400 mx-auto"><Award size={28}/></div>
        <h2 className="text-white text-2xl font-black uppercase mt-3 tracking-tight">Tu semana Ragnar</h2>
        <p className="text-zinc-400 text-xs mt-1">Del {start} al {end}</p>
        <p className="text-yellow-300 text-sm mt-2">¡Terminaste tu última rutina del viernes!</p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {[
          {icon:CalendarCheck2,label:'Rutinas completadas',value:summary.sessions+' / '+summary.planned},
          {icon:Dumbbell,label:'Series realizadas',value:String(summary.sets)},
          {icon:Clock,label:'Minutos registrados',value:summary.minutesSessions?summary.minutes+' min':'No registrados'},
          {icon:Flame,label:'Esfuerzo promedio',value:summary.effort!==null?summary.effort+' / 10':'Sin datos'}
        ].map(item=>{
          const Icon=item.icon;
          return <div key={item.label} className="rounded-xl bg-zinc-900 border border-zinc-800 p-3 min-w-0">
            <Icon className="text-yellow-400" size={20}/>
            <p className="text-white font-black text-lg mt-2 break-words">{item.value}</p>
            <p className="text-zinc-400 text-xs mt-1">{item.label}</p>
          </div>;
        })}
      </div>
      {summary.minutesSessions>0&&summary.missingMinutes>0&&
        <p className="text-zinc-500 text-xs">Tiempo disponible para {summary.minutesSessions} de {summary.sessions} entrenamientos; no se estiman los minutos faltantes.</p>}
      {summary.improvements.length>0?(
        <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-2xl">
          <p className="font-black text-emerald-300 uppercase text-xs flex items-center gap-2">
            <TrendingUp size={17}/> {summary.prCount} ejercicio(s) con más carga
          </p>
          <div className="space-y-2 mt-3">
            {summary.improvements.slice(0,3).map(item=>(
              <div key={item.name} className="flex justify-between gap-2 text-sm">
                <span className="text-zinc-200 capitalize truncate">{item.name}</span>
                <span className="font-bold text-emerald-300 whitespace-nowrap">{item.from} → {item.to} kg</span>
              </div>
            ))}
          </div>
          <p className="text-zinc-400 text-xs mt-3">Comparación del mismo ejercicio respecto de la semana anterior, solo con series completadas.</p>
        </div>
      ):(
        <div className="border border-zinc-800 rounded-2xl p-4 text-zinc-300 text-sm">
          {summary.previousSessions===0
            ? '¡Buen punto de partida! Cuando tengas dos semanas registradas, Ragnar podrá mostrar cambios de cargas.'
            : 'Esta semana no se detectaron aumentos de carga comparables. Mantener la técnica y la constancia también es progreso.'}
        </div>
      )}
      {summary.effort!==null&&summary.previousEffort!==null&&
        <p className="text-zinc-400 text-xs border-t border-zinc-800 pt-3">
          Esfuerzo percibido: {summary.effort}/10 · semana anterior {summary.previousEffort}/10.
          Un esfuerzo más alto significa mayor exigencia percibida, no necesariamente mejor rendimiento.
        </p>}
      <div className="flex flex-col sm:flex-row gap-2">
        {onViewProgress&&<button type="button" onClick={onViewProgress}
          className="flex-1 bg-yellow-400 text-black rounded-xl px-4 py-3 font-black text-sm">Ver mi evolución</button>}
        {onShare&&<button type="button" onClick={onShare}
          className="flex-1 rounded-xl border border-yellow-400/40 text-yellow-300 px-4 py-3 font-black text-sm">Compartir mi logro</button>}
        {onClose&&<button type="button" onClick={onClose}
          className="flex-1 rounded-xl border border-zinc-700 text-zinc-300 px-4 py-3 font-bold text-sm">Continuar</button>}
      </div>
      <p className="text-[11px] text-zinc-500 flex items-start gap-1"><Info size={14} className="shrink-0"/> Los resultados usan únicamente datos cargados en tus sesiones. No se inventan tiempos ni cargas de entrenamientos anteriores.</p>
    </section>
  );
}
