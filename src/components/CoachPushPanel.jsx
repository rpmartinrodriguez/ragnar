import React,{useEffect,useState} from 'react';
import { Bell, BellOff, CheckCircle, Copy, KeyRound, Send, ShieldCheck, Smartphone, AlertCircle } from 'lucide-react';
import { doc,getDoc,setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { pushRequest,enableCoachPush,disableCoachPush,webPushSupported } from '../utils/ragnarPush';

export default function CoachPushPanel(){
  const [key,setKey]=useState('');
  const [draft,setDraft]=useState('');
  const [subscribed,setSubscribed]=useState(null);
  const [supported,setSupported]=useState(null);
  const [permission,setPermission]=useState('default');
  const [busy,setBusy]=useState('');
  const [feedback,setFeedback]=useState('');
  const [error,setError]=useState('');
  const [ready,setReady]=useState(false);

  useEffect(()=>{
    let alive=true;
    (async()=>{
      try{
        const snap=await getDoc(doc(db,'settings','general'));
        const stored=String(snap.data()?.webPushVapidPublicKey||'');
        const isAvailable=await webPushSupported();
        const status=await pushRequest('status');
        if(!alive)return;
        setKey(stored);setDraft(stored);
        setSupported(isAvailable);
        setPermission(typeof Notification==='undefined'?'unsupported':Notification.permission);
        setSubscribed(status.subscribed);
      }catch(e){
        if(alive)setError('No pude comprobar la configuración push: '+(e.message||String(e)));
      }finally {if(alive)setReady(true);}
    })();
    return ()=>{alive=false;};
  },[]);

  const saveKey=async()=>{
    const next=draft.trim();
    if(!/^[A-Za-z0-9_-]{40,}$/.test(next)){
      setError('La clave pública VAPID no parece válida. Copiá la clave completa de Firebase.');
      return;
    }
    setBusy('save');setError('');setFeedback('');
    try{
      await setDoc(doc(db,'settings','general'),{webPushVapidPublicKey:next},{merge:true});
      setKey(next);setFeedback('Clave pública guardada. Podés activar los avisos en este dispositivo.');
    }catch(e){setError('No se pudo guardar la clave: '+(e.code||e.message));}
    finally{setBusy('');}
  };

  const enable=async()=>{
    setBusy('enable');setFeedback('');setError('');
    try {
      await enableCoachPush(key);
      const result=await pushRequest('status');
      setSubscribed(result.subscribed);
      setPermission(Notification.permission);
      setFeedback('Dispositivo registrado. Ahora usá «Enviar prueba» para verificar que llegue una notificación.');
    }catch(e){setError(e?.message||'No se pudo activar push');}
    finally{setBusy('');}
  };

  const test=async()=>{
    setBusy('test');setFeedback('');setError('');
    try{
      const result=await pushRequest('test');
      setFeedback(result.sent>0
        ? 'Firebase aceptó el envío a '+result.sent+' dispositivo(s). Comprobá el aviso con Ragnar en segundo plano.'
        : 'No se enviaron avisos: todavía no hay dispositivos registrados o sus tokens vencieron.');
    }catch(e){setError(e?.message||'No se pudo enviar la prueba');}
    finally{setBusy('');}
  };

  const disable=async()=>{
    if(!window.confirm('¿Desactivar avisos push de Ragnar en ESTE dispositivo?'))return;
    setBusy('disable');setFeedback('');setError('');
    try{
      await disableCoachPush(key);
      const result=await pushRequest('status');
      setSubscribed(result.subscribed);
      setFeedback('Avisos desactivados en este dispositivo.');
    }catch(e){setError(e?.message||'No se pudo desactivar el dispositivo');}
    finally{setBusy('');}
  };

  return(
    <section className="bg-zinc-900 border border-yellow-400/30 rounded-3xl p-5 sm:p-7 space-y-5">
      <div className="flex items-start gap-3">
        <div className="bg-yellow-400/10 text-yellow-400 p-3 rounded-xl"><Bell size={24}/></div>
        <div>
          <h3 className="text-white text-xl font-black uppercase tracking-tight">Notificaciones push del entrenador</h3>
          <p className="text-zinc-400 text-sm mt-1">Avisos en tu celular o computadora al recibir un mensaje, una ausencia o una rutina terminada.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        <div className="rounded-xl border border-zinc-800 bg-black/30 p-3">
          <div className="text-xs text-zinc-500">Dispositivos registrados</div>
          <p className="text-2xl font-black text-white">{subscribed===null?'—':subscribed}</p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-black/30 p-3">
          <div className="text-xs text-zinc-500">Compatibilidad</div>
          <p className={'text-sm font-bold mt-1 '+(supported?'text-emerald-400':'text-amber-400')}>{supported===null?'Comprobando':supported?'Disponible':'No disponible'}</p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-black/30 p-3 col-span-2 sm:col-span-1">
          <div className="text-xs text-zinc-500">Permisos del navegador</div>
          <p className="text-sm text-white font-bold mt-1">{permission==='granted'?'Permitidos':permission==='denied'?'Bloqueados':permission==='default'?'Pendientes':'No disponible'}</p>
        </div>
      </div>

      <div className="rounded-2xl bg-black/40 border border-zinc-800 p-4 space-y-3">
        <p className="text-white text-sm font-bold flex gap-2 items-center"><KeyRound size={16} className="text-yellow-400"/> 1. Clave pública VAPID (se configura una sola vez)</p>
        <p className="text-zinc-400 text-xs">
          Firebase Console → Configuración del proyecto → Cloud Messaging → Configuración web → Certificados push web → Generar par de claves. Pegá solo la <strong>clave pública</strong> aquí; nunca la clave privada de Firebase.
        </p>
        <input type="text" autoCapitalize="off" spellCheck="false" autoComplete="off"
          value={draft} onChange={e=>setDraft(e.target.value)}
          placeholder="Pegá la clave pública VAPID que muestra Firebase"
          className="block w-full min-w-0 bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-3 text-white text-xs font-mono outline-none focus:border-yellow-400"
        />
        <button type="button" onClick={saveKey} disabled={!ready||!!busy||draft.trim()===key}
          className="bg-zinc-700 hover:bg-zinc-600 disabled:opacity-40 text-white text-sm font-bold px-4 py-3 rounded-xl inline-flex gap-2 items-center">
          <ShieldCheck size={17}/> {busy==='save'?'Guardando...':'Guardar clave pública'}
        </button>
      </div>

      <div className="space-y-3">
        <p className="text-white text-sm font-bold flex gap-2 items-center"><Smartphone size={17} className="text-yellow-400"/> 2. Activar avisos en este dispositivo</p>
        <div className="flex gap-2 flex-wrap">
          <button type="button" onClick={enable} disabled={!ready||!!busy||!key||!supported||permission==='denied'}
            className="inline-flex items-center gap-2 bg-yellow-400 text-black font-black text-sm rounded-xl px-5 py-3 disabled:opacity-40">
            <Bell size={18}/> {busy==='enable'?'Activando...':'Activar push'}
          </button>
          <button type="button" onClick={test} disabled={!ready||!!busy||!subscribed}
            className="inline-flex items-center gap-2 border border-emerald-400/40 text-emerald-300 rounded-xl px-4 py-3 font-bold text-sm disabled:opacity-40">
            <Send size={17}/> {busy==='test'?'Enviando...':'Enviar prueba'}
          </button>
          <button type="button" onClick={disable} disabled={!ready||!!busy||!key||!supported||permission!=='granted'}
            className="inline-flex items-center gap-2 border border-zinc-700 text-zinc-400 rounded-xl px-4 py-3 font-bold text-sm disabled:opacity-40">
            <BellOff size={17}/> Desactivar este dispositivo
          </button>
        </div>
        <p className="text-xs text-zinc-500">En iPhone necesitás iOS 16.4 o posterior y abrir Ragnar como aplicación agregada a la pantalla de inicio. En Android y computadoras modernas, depende del navegador y sus permisos.</p>
      </div>
      {feedback&&<p role="status" className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-sm p-3 flex gap-2 items-start"><CheckCircle size={18}/>{feedback}</p>}
      {error&&<p role="alert" className="rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm p-3 flex gap-2 items-start"><AlertCircle size={18}/>{error}</p>}
      <p className="text-xs text-zinc-500">La clave VAPID es pública y se comparte entre dispositivos del mismo Firebase. El permiso push es individual para cada navegador, instalación y dominio. La publicación en el dominio definitivo requerirá activarlo nuevamente.</p>
    </section>
  );
}
