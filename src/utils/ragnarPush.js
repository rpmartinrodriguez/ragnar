// Cliente de notificaciones push de Ragnar. No recibe credenciales Admin.
import { getAuth } from 'firebase/auth';
import { getMessaging, isSupported, getToken, deleteToken, onMessage } from 'firebase/messaging';
import { app } from '../firebase';

const FCM_SW = '/firebase-messaging-sw.js';

export async function pushRequest(action, payload={}) {
  const user=getAuth().currentUser;
  if(!user) throw new Error('Necesitás iniciar sesión en Ragnar.');
  const token=await user.getIdToken();
  const response=await fetch('/.netlify/functions/ragnar-push',{
    method:'POST',
    headers:{'content-type':'application/json',authorization:'Bearer '+token},
    body:JSON.stringify({action,...payload}),
    cache:'no-store'
  });
  let result;
  try { result=await response.json(); }
  catch { throw new Error('El servidor de notificaciones todavía no está publicado en Netlify.'); }
  if(!response.ok || !result.success) throw new Error(result.error || 'No se pudo procesar la solicitud de push.');
  return result;
}

export async function webPushSupported() {
  if(typeof window==='undefined' || !window.isSecureContext ||
     !('serviceWorker' in navigator) || !('Notification' in window) ||
     !('PushManager' in window)) return false;
  try { return await isSupported(); }
  catch { return false; }
}

export async function enableCoachPush(vapidKey) {
  if(typeof window==='undefined' || !window.isSecureContext ||
     !('serviceWorker' in navigator) || !('Notification' in window) ||
     !('PushManager' in window)) {
    throw new Error('Este navegador no admite push web. En iPhone, instalá Ragnar desde Safari en la pantalla de inicio.');
  }
  if(!vapidKey || !/^[A-Za-z0-9_-]{40,}$/.test(vapidKey.trim())) {
    throw new Error('Primero configurá la clave pública VAPID de Firebase.');
  }
  // La solicitud se realiza de inmediato, en el clic del usuario (exigencia iOS).
  const permission=await Notification.requestPermission();
  if(permission!=='granted') throw new Error('No se concedió permiso de notificaciones. Revisá los permisos del navegador.');
  if(!await webPushSupported()) throw new Error('FCM no está disponible en este navegador o sistema operativo.');
  const reg=await navigator.serviceWorker.register(FCM_SW,{scope:'/'});
  const messaging=getMessaging(app);
  const token=await getToken(messaging,{vapidKey:vapidKey.trim(),serviceWorkerRegistration:reg});
  if(!token) throw new Error('Firebase no devolvió un token push. Revisá la clave pública VAPID.');
  await pushRequest('register',{token});
  return token;
}

export async function disableCoachPush(vapidKey) {
  if(!await webPushSupported()) return;
  const messaging=getMessaging(app);
  const reg=await navigator.serviceWorker.getRegistration('/');
  const token=reg && vapidKey ? await getToken(messaging,{
    vapidKey:vapidKey.trim(),serviceWorkerRegistration:reg
  }) : null;
  if(token) await pushRequest('unregister',{token});
  await deleteToken(messaging);
}

export async function listenForegroundPush(callback) {
  if(!await webPushSupported()) return ()=>{};
  const messaging=getMessaging(app);
  return onMessage(messaging, payload=>{
    const data=payload.data||{};
    callback({
      title:String(data.title||'Ragnar Training'),
      body:String(data.body||'Tenés una notificación.'),
      type:String(data.type||'alert')
    });
  });
}

export async function notifyCoachAboutStudentEvent(type,clientId,sourceId) {
  // Las notificaciones NO deben afectar la escritura de la sesión o mensaje.
  try {
    return await pushRequest('event',{type,clientId,sourceId});
  } catch(error) {
    console.warn('El evento se guardó pero no se pudo enviar push:',error?.message||error);
    return null;
  }
}
