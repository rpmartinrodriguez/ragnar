import React,{useEffect,useMemo,useState} from 'react';
import {Flame,HandMetal,Clock,ShieldCheck,Trophy,Users,CalendarCheck,TrendingUp,
  CheckCircle2,MessageCircle,Filter,ArrowRight,AlertCircle} from 'lucide-react';
import {collection,query,orderBy,limit,onSnapshot,doc,updateDoc,arrayUnion,arrayRemove} from 'firebase/firestore';
import {db} from '../firebase';
import {getWeekBounds} from '../utils/trainingInsights';
import {ymdInArgentina} from '../utils/billingCycle';

function postTimestamp(post){
  const raw=post.createdAt;
  if(raw?.toDate)return raw.toDate();
  const result=raw instanceof Date?raw:new Date(raw||0);
  return Number.isFinite(result.getTime())?result:new Date(0);
}
function timeLabel(post){
  const date=postTimestamp(post);
  if(date.getTime()===0)return 'Fecha pendiente';
  return date.toLocaleDateString('es-AR',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
}
const initials=name=>String(name||'R').trim().charAt(0).toUpperCase()||'R';

export default function CommunityView({currentUserId,userName,onOpenProgress}){
  const [posts,setPosts]=useState([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [busyReaction,setBusyReaction]=useState('');
  const [filter,setFilter]=useState('all');
  const thisWeek=getWeekBounds(ymdInArgentina());

  useEffect(()=>{
    const q=query(collection(db,'communityFeed'),orderBy('createdAt','desc'),limit(80));
    return onSnapshot(q,snapshot=>{
      setPosts(snapshot.docs.map(d=>({id:d.id,...d.data()})));
      setLoading(false);setError('');
    },error=>{
      setLoading(false);
      setError('No se pudo cargar el Salón: '+(error?.code||'revisá tu conexión'));
    });
  },[]);

  const weekly=useMemo(()=>posts.filter(p=>{
    const date=postTimestamp(p);
    const id=date.toISOString().slice(0,10);
    return !!thisWeek && id>=thisWeek.start&&id<=thisWeek.end;
  }),[posts,thisWeek?.start,thisWeek?.end]);
  const weeklyWorkouts=weekly.filter(p=>p.type==='workout_completed');
  const personal=weeklyWorkouts.filter(p=>p.userId===currentUserId);
  const athletes=new Set(weeklyWorkouts.map(p=>p.userId).filter(Boolean));
  const acknowledgements=weekly.reduce((count,p)=>count+
    (p.reactions?.fire||[]).length+(p.reactions?.power||[]).length,0);

  const leaders=useMemo(()=>{
    const byUser=new Map();
    for(const p of weeklyWorkouts){
      if(!p.userId)continue;
      const value=byUser.get(p.userId)||{id:p.userId,name:p.userName||'Atleta Ragnar',count:0};
      value.count++;byUser.set(p.userId,value);
    }
    return [...byUser.values()].sort((a,b)=>b.count-a.count||
      a.name.localeCompare(b.name,'es')).slice(0,3);
  },[weeklyWorkouts]);
  const filtered=useMemo(()=>filter==='mine'
      ? posts.filter(p=>p.userId===currentUserId)
      : filter==='week'?weekly:posts,
    [posts,weekly,filter,currentUserId]);

  const handleReaction=async(post,type)=>{
    if(!currentUserId||busyReaction)return;
    const key='reactions.'+type;
    const already=(post.reactions?.[type]||[]).includes(currentUserId);
    setBusyReaction(post.id);setError('');
    try{
      await updateDoc(doc(db,'communityFeed',post.id),{
        [key]:already?arrayRemove(currentUserId):arrayUnion(currentUserId)
      });
    }catch(error){setError('No se pudo guardar tu reacción: '+(error?.message||'error de conexión'));}
    finally{setBusyReaction('');}
  };

  return (
    <section className="max-w-3xl mx-auto animate-in fade-in pb-20 space-y-5" aria-label="El Gran Salón Ragnar">
      <div className="bg-zinc-900 border border-yellow-400/30 rounded-3xl p-5 sm:p-7 relative overflow-hidden">
        <div className="absolute -right-16 -top-16 w-44 h-44 bg-yellow-400/10 blur-3xl rounded-full pointer-events-none"/>
        <div className="relative">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="Ragnar" className="w-14 h-14 object-contain"/>
            <div className="min-w-0">
              <h2 className="text-2xl sm:text-3xl font-black text-white uppercase tracking-tight">El Gran Salón</h2>
              <p className="text-yellow-400 text-xs font-black uppercase tracking-wider">El lugar donde celebramos la constancia</p>
            </div>
          </div>
          <p className="text-zinc-300 text-sm leading-relaxed mt-4">
            Cada entrenamiento compartido es un paso adelante. Celebrá el esfuerzo,
            acompañá a tus compañeros y descubrí los hitos de la comunidad.
          </p>
          <div className="grid grid-cols-3 gap-2 mt-5">
            {[
              {icon:CalendarCheck,value:weeklyWorkouts.length,label:'Rutinas compartidas'},
              {icon:Users,value:athletes.size,label:'Atletas activos'},
              {icon:Flame,value:acknowledgements,label:'Apoyos esta semana'}
            ].map(item=>{
              const Icon=item.icon;
              return <div key={item.label} className="min-w-0 bg-black/40 border border-zinc-800 rounded-xl p-3">
                <Icon size={18} className="text-yellow-400"/>
                <p className="text-xl sm:text-2xl font-black text-white mt-2">{item.value}</p>
                <p className="text-zinc-400 text-[11px] leading-snug mt-1">{item.label}</p>
              </div>;
            })}
          </div>
          <p className="text-zinc-500 text-[11px] mt-3">Indicadores calculados entre las 80 últimas publicaciones visibles del Salón; no son estadísticas privadas ni totales históricos.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-5">
          <div className="flex items-center gap-2 text-yellow-400">
            <Trophy size={19}/>
            <h3 className="text-sm font-black uppercase">Reto de constancia</h3>
          </div>
          <p className="text-white font-black text-2xl mt-3">{Math.min(personal.length,3)} / 3</p>
          <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden mt-3">
            <div className="h-full bg-yellow-400 rounded-full transition-all"
              style={{width:Math.min(100,(personal.length/3)*100)+'%'}}/>
          </div>
          <p className="text-xs text-zinc-400 mt-3">
            {personal.length>=3?'¡Conseguiste el reto semanal!':
              'Completá y compartí '+(3-personal.length)+' entrenamiento(s) más para llegar a la meta.'}
          </p>
          <p className="text-[11px] text-zinc-500 mt-2">Basado en tus entrenamientos publicados esta semana.</p>
        </div>
        <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-5">
          <div className="flex items-center gap-2 text-yellow-400">
            <ShieldCheck size={19}/>
            <h3 className="text-sm font-black uppercase">Guardianes de la semana</h3>
          </div>
          {leaders.length?leaders.map((athlete,i)=>(
            <div key={athlete.id} className="flex gap-3 items-center mt-3">
              <span className="text-yellow-400 font-black text-sm w-6">{i+1}.</span>
              <span className="min-w-0 text-zinc-200 truncate flex-1 text-xs font-bold">{athlete.name}</span>
              <span className="text-xs text-zinc-400">{athlete.count} rutinas</span>
            </div>
          )):<p className="text-zinc-500 text-xs mt-5">Todavía no se publicaron rutinas esta semana.</p>}
          <p className="text-[11px] text-zinc-500 mt-3">Reconocimiento por participación, no por levantar más peso.</p>
        </div>
      </div>

      {onOpenProgress&&<button type="button" onClick={onOpenProgress}
        className="w-full rounded-xl border border-yellow-400/40 bg-yellow-400/5 text-yellow-300 py-3 px-4 font-black text-xs flex items-center justify-between">
        <span className="flex items-center gap-2"><TrendingUp size={19}/> Ver mi progreso personal</span>
        <ArrowRight size={17}/>
      </button>}

      <div className="flex items-center justify-between gap-2">
        <h3 className="text-white text-lg font-black uppercase">Muro de conquistas</h3>
        <span className="text-zinc-500 text-xs">{filtered.length} publicaciones</span>
      </div>
      <div className="flex gap-2 flex-wrap" role="group" aria-label="Filtrar publicaciones del salón">
        {[
          {value:'all',text:'Comunidad'},
          {value:'week',text:'Esta semana'},
          {value:'mine',text:'Mis logros'}
        ].map(item=><button type="button" key={item.value} onClick={()=>setFilter(item.value)}
          aria-pressed={filter===item.value}
          className={'px-4 py-2.5 min-h-11 rounded-xl border text-xs font-black '+
            (filter===item.value?'bg-yellow-400 border-yellow-400 text-black':
              'bg-zinc-900 border-zinc-700 text-zinc-300')}>
          {item.text}
        </button>)}
      </div>

      {error&&<p role="alert" className="rounded-xl p-3 text-red-300 bg-red-500/10 border border-red-500/20 flex gap-2 text-sm"><AlertCircle size={19}/>{error}</p>}
      {loading&&<p className="text-zinc-400 py-12 text-center text-sm">Cargando las conquistas del Salón...</p>}
      {!loading&&filtered.length===0&&
        <div className="text-center bg-zinc-900/40 border border-dashed border-zinc-700 rounded-3xl py-12 px-4">
          <Trophy className="mx-auto text-zinc-600 mb-3" size={42}/>
          <p className="text-white font-black uppercase text-sm">Todavía no hay publicaciones en esta vista</p>
          <p className="text-zinc-400 text-xs mt-2">Los entrenamientos finalizados que se comparten en el Salón aparecen acá.</p>
        </div>}

      <div className="space-y-3">
        {filtered.map(post=>{
          const fire=post.reactions?.fire||[],power=post.reactions?.power||[];
          const own=post.userId===currentUserId;
          return <article key={post.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden hover:border-zinc-700 transition-colors">
            <div className="p-4 sm:p-5">
              <div className="flex items-start gap-3">
                <div className={'w-11 h-11 shrink-0 rounded-2xl flex items-center justify-center font-black text-xl '+
                  (own?'bg-yellow-400 text-black':'bg-zinc-800 text-yellow-300 border border-yellow-400/20')}>
                  {initials(post.userName)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap gap-2 items-center">
                    <p className="font-black text-white text-sm uppercase truncate max-w-full">{post.userName||'Atleta Ragnar'}</p>
                    {own&&<span className="text-[10px] text-yellow-400 font-black">VOS</span>}
                  </div>
                  <p className="text-zinc-500 text-xs flex items-center gap-1 mt-1"><Clock size={12}/>{timeLabel(post)}</p>
                </div>
              </div>
              <div className="mt-4 rounded-xl bg-black/30 border border-zinc-800 p-4">
                <div className="flex items-center gap-2">
                  {post.type==='workout_completed'
                    ? <CheckCircle2 className="text-emerald-400" size={21}/>
                    : <Trophy className="text-yellow-400" size={21}/>}
                  <span className="text-xs font-black uppercase text-yellow-300">
                    {post.type==='workout_completed'?'Entrenamiento finalizado':'Logro Ragnar'}
                  </span>
                </div>
                <p className="text-zinc-200 text-sm leading-relaxed mt-2">
                  {post.type==='workout_completed'
                    ? 'Completó su rutina de '+String(post.workoutName||'entrenamiento')+'. ¡Otro día de constancia!'
                    : 'Alcanzó un nuevo hito en su recorrido de entrenamiento. ¡A celebrarlo!'}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 mt-4">
                {[
                  {type:'fire',icon:Flame,count:fire.length,active:fire.includes(currentUserId),label:'Aplaudir esfuerzo'},
                  {type:'power',icon:HandMetal,count:power.length,active:power.includes(currentUserId),label:'Enviar fuerza'}
                ].map(action=>{
                  const Icon=action.icon;
                  return <button type="button" key={action.type}
                    aria-pressed={action.active}
                    aria-label={action.label}
                    disabled={!!busyReaction}
                    onClick={()=>handleReaction(post,action.type)}
                    className={'flex items-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-black disabled:opacity-40 '+
                      (action.active?'border-yellow-400/60 bg-yellow-400/10 text-yellow-300':
                        'border-zinc-700 bg-zinc-950 text-zinc-400 hover:text-white')}>
                    <Icon size={18}/>{action.count}
                  </button>;
                })}
                <span className="text-zinc-500 text-xs ml-auto">{fire.length+power.length} apoyos</span>
              </div>
            </div>
            <div className="h-1 bg-gradient-to-r from-transparent via-yellow-400/25 to-transparent"/>
          </article>;
        })}
      </div>
      <p className="text-center text-zinc-500 text-xs pb-6">El Salón celebra entrenamientos compartidos. No muestra pesos privados, observaciones ni mensajes personales.</p>
    </section>
  );
}
