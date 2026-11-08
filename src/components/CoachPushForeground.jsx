import React,{useEffect,useState} from 'react';
import { Bell, X } from 'lucide-react';
import { listenForegroundPush } from '../utils/ragnarPush';

export default function CoachPushForeground({onOpenNotifications}) {
  const [alert,setAlert]=useState(null);
  useEffect(()=>{
    let disposed=false,unsubscribe=()=>{};
    listenForegroundPush(data=>{
      if(!disposed)setAlert(data);
    }).then(off=>{if(disposed)off();else unsubscribe=off;}).catch(()=>{});
    return ()=>{disposed=true;unsubscribe();};
  },[]);
  if(!alert)return null;
  return (
    <div className="fixed bottom-5 right-4 left-4 sm:left-auto sm:w-96 z-[90]" role="status" aria-live="polite">
      <div className="bg-zinc-900 border border-yellow-400/50 rounded-2xl shadow-2xl p-4 flex items-start gap-3">
        <div className="p-2 bg-yellow-400/10 rounded-xl text-yellow-400"><Bell size={21}/></div>
        <button type="button" className="text-left flex-1 min-w-0" onClick={()=>{
          setAlert(null);
          onOpenNotifications();
        }}>
          <p className="text-white font-black text-sm">{alert.title}</p>
          <p className="text-zinc-300 text-xs mt-1 break-words">{alert.body}</p>
          <p className="text-yellow-400 text-xs font-bold mt-2">Abrir notificaciones</p>
        </button>
        <button type="button" onClick={()=>setAlert(null)} className="text-zinc-400 p-1" aria-label="Cerrar aviso">
          <X size={18}/>
        </button>
      </div>
    </div>
  );
}
