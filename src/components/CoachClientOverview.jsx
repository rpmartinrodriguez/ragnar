import React,{useEffect,useState} from 'react';
import { CalendarCheck2, CreditCard, Dumbbell, MessageSquare, Activity,
  UserRound, CalendarClock, CheckCircle2, AlertCircle, ArrowRight, ShieldCheck } from 'lucide-react';
import { collection,getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { getUpcomingRenewal,ymdInArgentina } from '../utils/billingCycle';

export default function CoachClientOverview({client,onOpenTab}){
  const [summary,setSummary]=useState(null);
  const [error,setError]=useState('');
  const today=ymdInArgentina();
  useEffect(()=>{
    if(!client?.id)return;
    let live=true;
    setError('');
    Promise.all([
      getDocs(collection(db,'clients',client.id,'sessions')),
      getDocs(collection(db,'clients',client.id,'messages')),
      getDocs(collection(db,'clients',client.id,'payments'))
    ]).then(([sessions,messages,payments])=>{
      if(!live)return;
      const work=sessions.docs.map(d=>({id:d.id,...d.data()}));
      const dateBack=new Date(today+'T12:00:00Z');
      dateBack.setUTCDate(dateBack.getUTCDate()-29);
      const minYmd=dateBack.toISOString().slice(0,10);
      const recent=work.filter(d=>d.id>=minYmd && d.id<=today &&
        Array.isArray(d.exercises)&&d.exercises.length);
      const completed=work.filter(d=>d.isFinalized===true)
        .sort((a,b)=>String(b.id).localeCompare(String(a.id)));
      const unpaidMessages=messages.docs.filter(d=>d.get('sender')==='student'&&d.get('read')!==true);
      const paid=payments.docs.filter(d=>d.get('status')==='paid')
        .sort((a,b)=>String(b.id).localeCompare(String(a.id)));
      setSummary({completedMonth:recent.filter(d=>d.isFinalized===true).length,
        plannedMonth:recent.length,lastCompleted:completed[0]?.id,
        unreadMessages:unpaidMessages.length,
        lastPayment:paid[0]?.id||null,
        notes:work.filter(d=>!!String(d.studentNote||'').trim()).length});
    }).catch(err=>{if(live)setError(err?.message||'No se pudo cargar el resumen.');});
    return()=>{live=false;};
  },[client?.id,today]);
  const upcoming=getUpcomingRenewal(client.startDate,today);
  const cards=[
    {label:'Entrenamientos (30 días)',value:summary?summary.completedMonth+'/'+summary.plannedMonth:'…',icon:CalendarCheck2},
    {label:'Último entrenamiento',value:summary?.lastCompleted?.split('-').reverse().join('/')||'—',icon:Dumbbell},
    {label:'Mensajes sin leer',value:summary?.unreadMessages??'…',icon:MessageSquare},
    {label:'Última cuota registrada',value:summary?.lastPayment||'—',icon:CreditCard}
  ];
  return(
    <section className="space-y-4 animate-in fade-in">
      <div className="rounded-3xl border border-yellow-400/25 bg-zinc-900 p-5">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-yellow-400/10 p-3 text-yellow-400"><UserRound size={25}/></div>
          <div className="min-w-0">
            <h3 className="text-xl font-black uppercase text-white">Ficha 360°</h3>
            <p className="text-zinc-400 text-sm mt-1">Un resumen completo del atleta, sin cambiar su historial.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 mt-4">
          <span className="rounded-lg border border-zinc-700 text-zinc-200 px-3 py-1.5 text-xs font-bold">
            {client.trainingMode==='presencial'?'Presencial':'Plan de entrenamiento'}
          </span>
          <span className="rounded-lg border border-zinc-700 text-zinc-200 px-3 py-1.5 text-xs font-bold">
            {client.plan?.name||client.plan||'Sin plan'}
          </span>
          <span className={'rounded-lg px-3 py-1.5 text-xs font-bold border '+
            (client.accountAccessStatus==='activated'?'text-emerald-300 border-emerald-500/30':'text-amber-300 border-amber-500/30')}>
            {client.accountAccessStatus==='activated'?'Acceso habilitado':'Acceso pendiente'}
          </span>
          {client.active===false&&<span className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400">Archivado</span>}
        </div>
        {upcoming&&<p className="text-xs text-zinc-400 mt-4 flex gap-2 items-center">
          <CalendarClock size={16} className="text-yellow-300"/>
          Próxima fecha base de renovación: {upcoming.dueYmd.split('-').reverse().join('/')}
          {upcoming.daysUntil<=3?' (próxima)':''}
        </p>}
      </div>
      {error&&<p role="alert" className="text-red-300 text-sm flex gap-2"><AlertCircle size={16}/>{error}</p>}
      <div className="grid grid-cols-2 gap-3">
        {cards.map(item=>{
          const Icon=item.icon;
          return <div key={item.label} className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
            <Icon className="text-yellow-400" size={20}/>
            <p className="text-white font-black text-xl mt-2">{item.value}</p>
            <p className="text-zinc-400 text-xs mt-1">{item.label}</p>
          </div>;
        })}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          {tab:'planificacion',label:'Planificar rutina',icon:Dumbbell},
          {tab:'progreso',label:'Ver evolución',icon:Activity},
          {tab:'mensajes',label:'Abrir chat',icon:MessageSquare}
        ].map(item=>{
          const Icon=item.icon;
          return <button key={item.tab} type="button" onClick={()=>onOpenTab(item.tab)}
            className="rounded-xl border border-yellow-400/30 bg-yellow-400/5 text-yellow-300 text-xs font-black p-4 flex items-center justify-between gap-2 hover:border-yellow-400">
            <span className="flex items-center gap-2"><Icon size={17}/>{item.label}</span>
            <ArrowRight size={15}/>
          </button>;
        })}
      </div>
      <p className="text-zinc-500 text-xs">Las cuotas se muestran según pagos registrados; el estado financiero definitivo se consulta en Cobros.</p>
    </section>
  );
}
