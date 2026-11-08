import React,{useEffect,useState} from 'react';
import { WifiOff, Wifi } from 'lucide-react';

// Indicador de red: no promete sincronización cuando Firestore todavía no confirmó.
export default function ConnectionBanner(){
  const [online,setOnline]=useState(()=>{
    return typeof navigator==='undefined'?true:navigator.onLine;
  });
  const [restored,setRestored]=useState(false);
  useEffect(()=>{
    let timer;
    const sync=()=>{
      const next=navigator.onLine;
      setOnline(prev=>{
        if(!prev && next){
          setRestored(true);
          clearTimeout(timer);
          timer=setTimeout(()=>setRestored(false),3500);
        }
        return next;
      });
    };
    window.addEventListener('online',sync);
    window.addEventListener('offline',sync);
    return ()=>{
      window.removeEventListener('online',sync);
      window.removeEventListener('offline',sync);
      clearTimeout(timer);
    };
  },[]);
  if(online&&!restored)return null;
  return <div role="status" aria-live="polite"
    className={'fixed top-2 left-2 right-2 sm:left-auto sm:right-4 sm:max-w-md z-[400] flex items-start gap-3 rounded-xl border p-3 shadow-xl text-xs font-bold '+
      (online?'bg-zinc-900 text-emerald-300 border-emerald-600/40':'bg-zinc-900 text-amber-300 border-amber-500/50')}>
    {online?<Wifi size={18}/>:<WifiOff size={18}/>}
    {online?'Conexión restablecida. Revisá que tus cambios se hayan guardado.':
      'Sin conexión a internet. No cierres la aplicación ni finalices una rutina hasta recuperar la red.'}
  </div>;
}
