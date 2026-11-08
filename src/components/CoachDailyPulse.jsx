import React,{useEffect,useMemo,useState} from 'react';
import { CalendarCheck, CalendarClock, CheckCircle2, Clock, Dumbbell, MessageSquare,
  Users, ArrowRight, RefreshCw, AlertTriangle } from 'lucide-react';
import {collectionGroup,doc,getDoc,getDocs,query,where} from 'firebase/firestore';
import { db } from '../firebase';
import {getUpcomingRenewal,ymdInArgentina} from '../utils/billingCycle';

export default function CoachDailyPulse({clients=[],navigateTo}){
  const [activity,setActivity]=useState([]);
  const [unreadMessages,setUnreadMessages]=useState(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [refreshIndex,setRefreshIndex]=useState(0);
  const today=ymdInArgentina();
  const active=useMemo(()=>clients.filter(c=>c.active!==false&&c.id),[clients]);
  const upcoming=useMemo(()=>active.map(client=>({
    client,due:getUpcomingRenewal(client.startDate,today)
  })).filter(item=>item.due&&item.due.daysUntil>=0&&item.due.daysUntil<=3)
    .sort((a,b)=>a.due.daysUntil-b.due.daysUntil),[active,today]);

  useEffect(()=>{
    let alive=true;
    (async()=>{
      setLoading(true);setError('');
      try{
        // Consultas pequeñas e independientes, en paralelo por lotes, no historial completo.
        const list=[];
        for(let i=0;i<active.length;i+=20){
          const batch=active.slice(i,i+20);
          const results=await Promise.allSettled(batch.map(async client=>{
            const snapshot=await getDoc(doc(db,'clients',client.id,'sessions',today));
            const data=snapshot.exists()?snapshot.data():null;
            if(!data||!Array.isArray(data.exercises)||!data.exercises.length)return null;
            return {client,finalized:data.isFinalized===true,
              exercises:data.exercises.length,hasNote:!!String(data.studentNote||'').trim()};
          }));
          list.push(...results.filter(r=>r.status==='fulfilled'&&r.value).map(r=>r.value));
          if(results.some(r=>r.status==='rejected')&&alive){
            setError('No se pudieron comprobar algunas sesiones. Revisá los permisos.');
          }
          if(!alive)return;
        }
        if(alive)setActivity(list.sort((a,b)=>Number(a.finalized)-Number(b.finalized)||
          String(a.client.name||'').localeCompare(String(b.client.name||''),'es')));
      }catch(error){if(alive)setError('No se pudieron obtener entrenamientos de hoy.');}
      finally{if(alive)setLoading(false);}
    })();
    const unreadQuery=query(collectionGroup(db,'messages'),
      where('sender','==','student'),where('read','==',false));
    getDocs(unreadQuery).then(snapshot=>{if(alive)setUnreadMessages(snapshot.size);})
      .catch(()=>{if(alive)setUnreadMessages(null);});
    return ()=>{alive=false;};
  },[active,today,refreshIndex]);

  const completed=activity.filter(x=>x.finalized).length;
  const stat=[
    {name:'Entrenamientos hoy',value:loading?'…':activity.length,icon:Dumbbell},
    {name:'Sesiones finalizadas',value:loading?'…':completed,icon:CheckCircle2},
    {name:'Mensajes pendientes',value:unreadMessages??'—',icon:MessageSquare},
    {name:'Renovaciones en 3 días',value:upcoming.length,icon:CalendarClock}
  ];
  return(
    <section className="space-y-4 mb-8" aria-label="Pulso diario del entrenador">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-white text-xl font-black uppercase">Hoy en Ragnar</h3>
          <p className="text-zinc-400 text-xs mt-1">
            {new Date(today+'T12:00:00').toLocaleDateString('es-AR',{
              weekday:'long',day:'numeric',month:'long'})}
          </p>
        </div>
        <button type="button" onClick={()=>setRefreshIndex(x=>x+1)} disabled={loading}
          className="rounded-xl border border-zinc-700 p-3 text-zinc-300 hover:text-yellow-400 disabled:opacity-40"
          aria-label="Actualizar panel"><RefreshCw size={19}/></button>
      </div>
      {error&&<p role="alert" className="text-amber-300 text-xs flex items-center gap-2"><AlertTriangle size={15}/>{error}</p>}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        {stat.map(item=>{
          const Icon=item.icon;
          return <div key={item.name} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
            <Icon className="text-yellow-400" size={20}/>
            <p className="text-white font-black text-3xl mt-2 tabular-nums">{item.value}</p>
            <p className="text-zinc-400 text-xs mt-1">{item.name}</p>
          </div>;
        })}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-4">
          <h4 className="text-white font-black uppercase text-sm flex items-center gap-2">
            <CalendarCheck className="text-yellow-400" size={19}/> Actividad del día
          </h4>
          <div className="mt-3 space-y-2 max-h-64 overflow-y-auto">
            {!loading&&activity.length===0&&
              <p className="text-zinc-500 text-sm p-3">No se encontraron sesiones programadas para hoy.</p>}
            {activity.slice(0,12).map(item=>(
              <button type="button" key={item.client.id}
                onClick={()=>navigateTo('client-detail',item.client)}
                className="w-full flex items-center gap-3 rounded-xl bg-black/40 border border-zinc-800 px-3 py-3 text-left hover:border-yellow-400/30">
                <span className={'shrink-0 '+(item.finalized?'text-emerald-400':'text-amber-400')}>
                  {item.finalized?<CheckCircle2 size={20}/>:<Clock size={20}/>}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-white font-bold text-sm truncate">{item.client.name}</span>
                  <span className="block text-zinc-400 text-xs">{item.exercises} ejercicios · {item.finalized?'Finalizado':'Pendiente'}{item.hasNote?' · Nota':''}</span>
                </span>
                <ArrowRight className="text-zinc-500" size={17}/>
              </button>
            ))}
          </div>
          {activity.length>12&&<button onClick={()=>navigateTo('calendar')}
            className="text-yellow-400 text-xs font-bold mt-3">Ver agenda completa</button>}
        </div>
        <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-4">
          <h4 className="text-white font-black uppercase text-sm flex items-center gap-2">
            <CalendarClock className="text-yellow-400" size={19}/> Próximas renovaciones
          </h4>
          <p className="text-zinc-500 text-xs mt-2">Fechas base del plan. La confirmación de pago se verifica en Cobros.</p>
          <div className="mt-3 max-h-64 overflow-y-auto space-y-2">
            {upcoming.length===0&&
              <p className="text-zinc-500 text-sm p-3">Sin renovaciones en los próximos tres días.</p>}
            {upcoming.slice(0,12).map(({client,due})=>(
              <button key={client.id} type="button" onClick={()=>navigateTo('client-detail',client)}
                className="w-full flex items-center gap-3 rounded-xl bg-black/40 border border-zinc-800 px-3 py-3 text-left hover:border-yellow-400/30">
                <CalendarClock className="text-amber-300" size={20}/>
                <span className="min-w-0 flex-1">
                  <span className="block text-white font-bold text-sm truncate">{client.name}</span>
                  <span className="block text-zinc-400 text-xs">{due.dueYmd.split('-').reverse().join('/')} · en {due.daysUntil} días</span>
                </span>
                <ArrowRight size={17} className="text-zinc-500"/>
              </button>
            ))}
          </div>
          <button type="button" onClick={()=>navigateTo('payments')}
            className="text-yellow-400 text-xs font-black mt-3">Abrir Cobros</button>
        </div>
      </div>
    </section>
  );
}
