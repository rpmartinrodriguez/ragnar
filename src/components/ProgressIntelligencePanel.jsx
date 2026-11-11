import React, {useMemo} from 'react';
import { Activity, ArrowUpRight, CalendarCheck, ChartNoAxesCombined, Dumbbell, Info, TrendingUp } from 'lucide-react';
import {progressIntelligence} from '../utils/progressIntelligence';

const kg=value=>Number(value).toLocaleString('es-AR',{maximumFractionDigits:2});

export default function ProgressIntelligencePanel({sessions=[],today,region='all',coachView=false}) {
  const insight=useMemo(()=>progressIntelligence(sessions,today,region),[sessions,today,region]);
  if(!insight)return null;
  return (
    <section className="ragnar-intelligence-panel" aria-label="RAGNAR Progress Intelligence">
      <div className="flex flex-wrap justify-between items-start gap-3">
        <div>
          <div className="flex gap-2 items-center ragnar-intelligence-eyebrow">
            <ChartNoAxesCombined size={17}/> RAGNAR PROGRESS INTELLIGENCE
          </div>
          <h3 className="ragnar-intelligence-panel-title">EL PROGRESO TIENE CONTEXTO.</h3>
          <p className="text-xs opacity-75 mt-1">
            {coachView?'Datos para revisar la programación del alumno.':
              'Tu evolución registrada, sin comparar con otros atletas.'}
          </p>
        </div>
        <span className="ragnar-intelligence-timeframe">ÚLTIMOS 28 DÍAS</span>
      </div>
      <div className="ragnar-intelligence-stats">
        <div className="ragnar-intelligence-stat">
          <CalendarCheck size={18}/><strong>{insight.completed}/{insight.scheduled}</strong>
          <span>SESIONES FINALIZADAS</span>
        </div>
        <div className="ragnar-intelligence-stat">
          <Activity size={18}/>
          <strong>{insight.completionRate===null?'—':insight.completionRate+'%'}</strong>
          <span>REGISTRO DE ADHERENCIA</span>
        </div>
        <div className="ragnar-intelligence-stat">
          <Dumbbell size={18}/><strong>{insight.seriesCompleted}</strong>
          <span>SERIES COMPLETADAS</span>
        </div>
      </div>
      {insight.comparable.length>0 && (
        <div className="mt-4">
          <h4 className="text-xs font-black uppercase mb-2">Últimas cargas comparables</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {insight.comparable.map(item=>(
              <div key={item.name} className="ragnar-intelligence-compare">
                <strong className="block text-xs truncate">{item.name}</strong>
                <span className="block text-xs opacity-75 mt-1">
                  {kg(item.from)} kg → {kg(item.to)} kg
                </span>
                <span className={'ragnar-intelligence-change '+(item.delta>0?'is-positive':'')}>
                  {item.delta>0?<ArrowUpRight size={14}/>:<TrendingUp size={14}/>}
                  {item.delta===0?'Misma carga':(item.delta>0?'+':'')+kg(item.delta)+' kg'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="ragnar-intelligence-insights">
        <p className="text-xs font-black uppercase mb-2">
          {coachView?'Para revisar con el alumno':'Lo que muestran tus registros'}
        </p>
        {insight.signals.map((signal,index)=><p key={index} className="text-xs flex gap-2 items-start">
          <span className="ragnar-intelligence-dot"/>{signal}
        </p>)}
      </div>
      <p className="text-[11px] opacity-65 leading-relaxed mt-3 flex items-start gap-2">
        <Info size={14} className="shrink-0 mt-0.5"/>
        Las sesiones sin finalizar pueden haber sido realizadas sin registro.
        Más o menos peso no determina por sí solo el progreso ni prescribe cambios en la rutina.
      </p>
    </section>
  );
}
