import React,{useCallback,useEffect,useState} from 'react';
import { Bell, BellOff, CheckCircle2, AlertCircle, RefreshCw, ShieldCheck,
  CalendarClock, MessageSquare, Dumbbell, Send } from 'lucide-react';
import {
  studentAlertRequest,enableStudentPush,disableStudentPush,supportsStudentPush
} from '../utils/studentPush';

const iconByType={
  renewal:CalendarClock,coach_message:MessageSquare,routine_updated:Dumbbell,test:Bell
};

export default function StudentAlertsPanel({clientId,vapidKey,onRead,openChat,openCalendar}) {
  const [alerts,setAlerts]=useState([]);
  const [loading,setLoading]=useState(true);
  const [supported,setSupported]=useState(null);
  const [permission,setPermission]=useState('default');
  const [subscribed,setSubscribed]=useState(0);
  const [busy,setBusy]=useState('');
  const [notice,setNotice]=useState(null);

  const refresh=useCallback(async()=>{
    setLoading(true);
    try{
      const [list,status,compatible]=await Promise.all([
        studentAlertRequest('list',clientId),
        studentAlertRequest('status',clientId),
        supportsStudentPush()
      ]);
      setAlerts(list.notifications||[]);
      setSubscribed(status.subscribed||0);
      setSupported(compatible);
      setPermission(typeof Notification==='undefined'?'unsupported':Notification.permission);
      onRead?.((list.notifications||[]).filter(a=>!a.read).length);
    }catch(error){setNotice({error:true,text:error?.message||'Error al obtener notificaciones'});}
    finally{setLoading(false);}
  },[clientId,onRead]);

  useEffect(()=>{void refresh();},[refresh]);

  const enable=async()=>{
    setBusy('enable');setNotice(null);
    try{
      await enableStudentPush(clientId,vapidKey);
      const status=await studentAlertRequest('status',clientId);
      setSubscribed(status.subscribed);
      setPermission(Notification.permission);
      setNotice({error:false,text:'Push habilitadas en este dispositivo. Vas a recibir mensajes, cambios de rutina y recordatorios.'});
    }catch(error){setNotice({error:true,text:error?.message||'No se pudieron activar las notificaciones'});}
    finally{setBusy('');}
  };
  const disable=async()=>{
    setBusy('disable');setNotice(null);
    try{
      await disableStudentPush(clientId,vapidKey);
      const status=await studentAlertRequest('status',clientId);
      setSubscribed(status.subscribed);
      setNotice({error:false,text:'Notificaciones desactivadas en este dispositivo.'});
    }catch(error){setNotice({error:true,text:error?.message||'No se pudieron desactivar'});}
    finally{setBusy('');}
  };
  const test=async()=>{
    setBusy('test');setNotice(null);
    try{
      const status=await studentAlertRequest('test',clientId);
      setNotice({error:false,text:status.sent>0
        ? 'Firebase aceptó el aviso de prueba. Revisá las notificaciones del dispositivo.'
        : 'Aviso registrado en Ragnar. Para recibir push tenés que activar este dispositivo.'});
      await refresh();
    }catch(error){setNotice({error:true,text:error?.message||'No se pudo probar'});}
    finally{setBusy('');}
  };
  const mark=async(alert)=>{
    if(!alert.read){
      try{
        await studentAlertRequest('mark',clientId,{notificationId:alert.id});
        setAlerts(prev=>{
          const next=prev.map(a=>a.id===alert.id?{...a,read:true}:a);
          onRead?.(next.filter(a=>!a.read).length);
          return next;
        });
      }catch(error){setNotice({error:true,text:error?.message||'No se pudo marcar como leído'});}
    }
    if(alert.type==='coach_message')openChat?.();
    else if(alert.type==='routine_updated')openCalendar?.(alert.sourceId);
  };

  return(
    <section className="space-y-4 animate-in fade-in" aria-label="Notificaciones del alumno">
      <div className="rounded-3xl bg-zinc-900 border border-zinc-800 p-5 space-y-4">
        <div className="flex justify-between items-start gap-3">
          <div className="flex gap-2 items-center">
            <Bell size={23} className="text-yellow-400"/>
            <div>
              <h2 className="text-white font-black uppercase text-lg">Mis notificaciones</h2>
              <p className="text-zinc-400 text-xs mt-1">Mensajes, rutinas nuevas y renovaciones de tu plan.</p>
            </div>
          </div>
          <button type="button" onClick={refresh} disabled={loading||!!busy}
            className="p-3 text-zinc-300 hover:text-yellow-400 border border-zinc-700 rounded-xl disabled:opacity-40"
            aria-label="Actualizar notificaciones"><RefreshCw size={19}/></button>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="rounded-lg px-3 py-2 bg-black border border-zinc-800 text-zinc-300">
            Dispositivos: <strong className="text-white">{subscribed}</strong>
          </span>
          <span className="rounded-lg px-3 py-2 bg-black border border-zinc-800 text-zinc-300">
            Permiso: <strong className="text-white">{permission==='granted'?'Permitido':permission==='denied'?'Bloqueado':'Pendiente'}</strong>
          </span>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button type="button" onClick={enable} disabled={!!busy||supported===false||permission==='denied'||!vapidKey}
            className="flex gap-2 items-center rounded-xl bg-yellow-400 text-black text-xs font-black px-4 py-3 disabled:opacity-40">
            <Bell size={17}/>{busy==='enable'?'Activando...':'Activar push'}
          </button>
          <button type="button" onClick={test} disabled={!!busy}
            className="flex gap-2 items-center rounded-xl border border-yellow-400/30 text-yellow-300 text-xs font-bold px-4 py-3 disabled:opacity-40">
            <Send size={16}/> Enviar prueba
          </button>
          <button type="button" onClick={disable} disabled={!!busy||supported===false||permission!=='granted'}
            className="flex gap-2 items-center rounded-xl border border-zinc-700 text-zinc-400 text-xs font-bold px-4 py-3 disabled:opacity-40">
            <BellOff size={16}/> Desactivar aquí
          </button>
        </div>
        {!vapidKey&&<p className="text-amber-300 text-xs">La clave pública de Firebase todavía no está disponible. Avisale al entrenador.</p>}
        <p className="text-zinc-500 text-xs">En iPhone, abrí Ragnar desde la PWA instalada en la pantalla de inicio. Los permisos son independientes en cada dispositivo.</p>
      </div>

      {notice&&<p role={notice.error?'alert':'status'} className={'rounded-xl p-3 text-xs flex gap-2 items-start '+
        (notice.error?'bg-red-500/10 text-red-300':'bg-emerald-500/10 text-emerald-300')}>
        {notice.error?<AlertCircle size={18}/>:<CheckCircle2 size={18}/>} {notice.text}
      </p>}

      <div className="space-y-2">
        <p className="text-xs text-zinc-500 font-black uppercase tracking-widest">
          Historial de avisos · {alerts.filter(a=>!a.read).length} pendientes
        </p>
        {loading ? <p className="text-zinc-400 text-sm p-4">Cargando avisos...</p> :
         alerts.length===0 ? <div className="rounded-2xl border border-dashed border-zinc-700 bg-zinc-900/50 p-8 text-center text-zinc-400 text-sm">Todavía no tenés avisos. Los nuevos mensajes y cambios de rutina aparecerán acá.</div> :
         alerts.map(alert=>{
          const Icon=iconByType[alert.type]||Bell;
          return (
            <button key={alert.id} type="button" onClick={()=>mark(alert)}
              className={'w-full flex items-start gap-3 text-left p-4 rounded-2xl border transition-colors '+
                (alert.read?'bg-zinc-900/50 border-zinc-800':'bg-yellow-400/5 border-yellow-400/30 hover:border-yellow-400')}>
              <Icon size={20} className="text-yellow-400 shrink-0"/>
              <span className="min-w-0 flex-1">
                <span className="block text-sm text-white font-black">{alert.title}</span>
                <span className="block text-zinc-300 text-xs mt-1 leading-relaxed">{alert.body}</span>
                <span className="block text-zinc-500 text-[11px] mt-2">
                  {alert.createdAt?new Date(alert.createdAt).toLocaleString('es-AR'):'Fecha pendiente'}
                </span>
              </span>
              {!alert.read&&<span className="w-2.5 h-2.5 rounded-full bg-yellow-400 shrink-0 mt-1" aria-label="Sin leer"/>}
            </button>
          );
        })}
      </div>
    </section>
  );
}
