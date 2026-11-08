import React,{useCallback,useEffect,useState} from 'react';
import { Bell, BellOff, CheckCircle2, AlertCircle, RefreshCw, ShieldCheck,
  CalendarClock, MessageSquare, Dumbbell, Send } from 'lucide-react';
import {
  studentAlertRequest,enableStudentPush,disableStudentPush,getStudentPushDeviceStatus
} from '../utils/studentPush';

const iconByType={
  renewal:CalendarClock,coach_message:MessageSquare,routine_updated:Dumbbell,test:Bell
};

export default function StudentAlertsPanel({clientId,vapidKey,onRead,openChat,openCalendar,refreshSignal=0}) {
  const [alerts,setAlerts]=useState([]);
  const [loading,setLoading]=useState(true);
  const [supported,setSupported]=useState(null);
  const [permission,setPermission]=useState('default');
  const [subscribed,setSubscribed]=useState(0);
  const [deviceActive,setDeviceActive]=useState(null);
  const [showHistory,setShowHistory]=useState(false);
  const [busy,setBusy]=useState('');
  const [notice,setNotice]=useState(null);

  const refresh=useCallback(async()=>{
    setLoading(true);
    try{
      const [list,device]=await Promise.all([
        studentAlertRequest('list',clientId),
        getStudentPushDeviceStatus(clientId,vapidKey)
      ]);
      setAlerts(list.notifications||[]);
      setSubscribed(device.subscribed||0);
      setSupported(device.supported);
      setPermission(device.permission);
      setDeviceActive(device.active);
      onRead?.((list.notifications||[]).filter(a=>!a.read).length);
    }catch(error){setNotice({error:true,text:error?.message||'Error al obtener notificaciones'});}
    finally{setLoading(false);}
  },[clientId,vapidKey,onRead]);

  useEffect(()=>{void refresh();},[refresh,refreshSignal]);
  useEffect(()=>{
    const verify=async()=>{
      if(document.hidden)return;
      try{
        const device=await getStudentPushDeviceStatus(clientId,vapidKey);
        setDeviceActive(device.active);
        setSubscribed(device.subscribed);
        setSupported(device.supported);
        setPermission(device.permission);
      }catch{setDeviceActive(false);}
    };
    window.addEventListener('focus',verify);
    document.addEventListener('visibilitychange',verify);
    return ()=>{
      window.removeEventListener('focus',verify);
      document.removeEventListener('visibilitychange',verify);
    };
  },[clientId,vapidKey]);

  const enable=async()=>{
    setBusy('enable');setNotice(null);
    try{
      await enableStudentPush(clientId,vapidKey);
      const device=await getStudentPushDeviceStatus(clientId,vapidKey);
      setDeviceActive(device.active);
      setSubscribed(device.subscribed);
      setPermission(device.permission);
      setNotice({error:!device.active,text:device.active
        ? 'Notificaciones activas en este dispositivo.'
        : 'La suscripción no se pudo verificar. Revisá los permisos e intentá nuevamente.'});
    }catch(error){setNotice({error:true,text:error?.message||'No se pudieron activar las notificaciones'});}
    finally{setBusy('');}
  };
  const disable=async()=>{
    setBusy('disable');setNotice(null);
    try{
      await disableStudentPush(clientId,vapidKey);
      const device=await getStudentPushDeviceStatus(clientId,vapidKey);
      setDeviceActive(false);
      setSubscribed(device.subscribed);
      setPermission(device.permission);
      setNotice({error:false,text:'Notificaciones desactivadas en este dispositivo.'});
    }catch(error){setNotice({error:true,text:error?.message||'No se pudieron desactivar'});}
    finally{setBusy('');}
  };
  const test=async()=>{
    setBusy('test');setNotice(null);
    try{
      const status=await studentAlertRequest('test',clientId);
      setNotice({error:false,text:status.sent>0
        ? 'Se envió una prueba al dispositivo. Revisá la notificación.'
        : 'La prueba se guardó en Ragnar, pero no hay un dispositivo push activo.'});
      await refresh();
    }catch(error){setNotice({error:true,text:error?.message||'No se pudo probar'});}
    finally{setBusy('');}
  };
  const mark=async(alert)=>{
    if(!alert.read){
      try{
        await studentAlertRequest('mark',clientId,{notificationId:alert.id});
        const updated=alerts.map(a=>a.id===alert.id?{...a,read:true}:a);
        setAlerts(updated);
        onRead?.(updated.filter(a=>!a.read).length);
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
        <div role="status" className={'rounded-xl border p-3 flex items-start gap-3 '+
          (deviceActive?'border-emerald-500/30 bg-emerald-500/10 text-emerald-300':
            'border-zinc-700 bg-zinc-950 text-zinc-300')}>
          {deviceActive?<CheckCircle2 size={22} className="shrink-0"/>:
            <BellOff size={22} className="shrink-0"/>}
          <div className="min-w-0">
            <p className="text-sm font-black">
              {deviceActive===null?'Comprobando notificaciones...':
               deviceActive?'Notificaciones activas':'Notificaciones no activadas en este dispositivo'}
            </p>
            <p className="text-xs mt-1 opacity-80">
              {deviceActive
                ? 'Este dispositivo está autorizado y registrado para recibir avisos de Ragnar.'
                : permission==='denied'?'El navegador bloqueó las notificaciones. Permitilas desde los ajustes de Safari o del sistema.'
                  : 'Podés seguir consultando los avisos desde la campanita, aunque las push estén desactivadas.'}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {deviceActive===false && (
            <button type="button" onClick={enable}
              disabled={!!busy||loading||supported===false||permission==='denied'||!vapidKey}
              className="flex gap-2 items-center rounded-xl bg-yellow-400 text-black text-sm font-black px-4 py-3 disabled:opacity-40">
              <Bell size={18}/>{busy==='enable'?'Activando...':'Activar notificaciones'}
            </button>
          )}
          {deviceActive===true && (
            <>
              <button type="button" onClick={test} disabled={!!busy}
                className="flex gap-2 items-center rounded-xl border border-zinc-700 text-zinc-300 text-xs font-bold px-3 py-2 disabled:opacity-40">
                <Send size={15}/>{busy==='test'?'Enviando...':'Probar entrega'}
              </button>
              <button type="button" onClick={disable} disabled={!!busy}
                className="flex gap-2 items-center rounded-xl border border-zinc-700 text-zinc-400 text-xs font-bold px-3 py-2 disabled:opacity-40">
                <BellOff size={15}/> Desactivar en este dispositivo
              </button>
            </>
          )}
        </div>
        {!vapidKey&&<p className="text-amber-300 text-xs">La clave pública de Firebase todavía no está disponible. Avisale al entrenador.</p>}
        <p className="text-zinc-500 text-xs">En iPhone, abrí Ragnar desde la PWA instalada en la pantalla de inicio. Los permisos son independientes en cada dispositivo.</p>
      </div>

      {notice&&<p role={notice.error?'alert':'status'} className={'rounded-xl p-3 text-xs flex gap-2 items-start '+
        (notice.error?'bg-red-500/10 text-red-300':'bg-emerald-500/10 text-emerald-300')}>
        {notice.error?<AlertCircle size={18}/>:<CheckCircle2 size={18}/>} {notice.text}
      </p>}

      <div className="space-y-2">
        <div className="flex flex-wrap justify-between items-center gap-2">
          <p className="text-xs text-zinc-400 font-black uppercase tracking-widest">
            {showHistory?'Historial de avisos':'Pendientes'} · {alerts.filter(a=>!a.read).length} sin leer
          </p>
          <button type="button" onClick={()=>setShowHistory(x=>!x)}
            className="border border-zinc-700 rounded-lg px-3 py-2 text-xs font-bold text-yellow-300">
            {showHistory?'Ver solo pendientes':'Ver historial'}
          </button>
        </div>
        {loading ? <p className="text-zinc-400 text-sm p-4">Cargando avisos...</p> :
         (showHistory?alerts:alerts.filter(a=>!a.read)).length===0
          ? <div className="rounded-2xl border border-dashed border-zinc-700 bg-zinc-900/50 p-8 text-center text-zinc-400 text-sm">
              {showHistory?'Todavía no tenés avisos registrados.':'¡Estás al día! No tenés notificaciones pendientes.'}
            </div> :
         (showHistory?alerts:alerts.filter(a=>!a.read)).map(alert=>{
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
