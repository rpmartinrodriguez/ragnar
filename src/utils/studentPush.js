import { getAuth } from 'firebase/auth';
import { getMessaging,getToken,deleteToken,isSupported,onMessage } from 'firebase/messaging';
import { app } from '../firebase';

export async function studentAlertRequest(action,clientId,extra={}) {
  const user=getAuth().currentUser;
  if(!user)throw new Error('Ingresá nuevamente con tu cuenta de alumno.');
  const response=await fetch('/.netlify/functions/student-alerts',{
    method:'POST',cache:'no-store',
    headers:{'content-type':'application/json',authorization:'Bearer '+await user.getIdToken()},
    body:JSON.stringify({action,clientId,...extra})
  });
  let data;
  try{data=await response.json();}
  catch{throw new Error('El servicio de notificaciones del alumno no está disponible.');}
  if(!response.ok||!data.success)throw new Error(data.error||'No se pudo procesar el aviso.');
  return data;
}
export async function supportsStudentPush(){
  if(typeof window==='undefined'||!window.isSecureContext||
     !('serviceWorker' in navigator)||!('Notification' in window)||
     !('PushManager' in window))return false;
  try{return await isSupported();}catch{return false;}
}
async function getLiveRegistration(){
  const reg=await navigator.serviceWorker.register('/firebase-messaging-sw.js',{scope:'/'});
  if(reg.active)return reg;
  const ready=await navigator.serviceWorker.ready;
  if(!ready.active)throw new Error('El componente de notificaciones todavía no está activo. Actualizá Ragnar.');
  return ready;
}
// Comprobación silenciosa de ESTE dispositivo. No solicita permisos ni crea
// nuevas suscripciones: solo identifica una suscripción push ya existente.
export async function getStudentPushDeviceStatus(clientId,vapidKey) {
  const compatible=await supportsStudentPush();
  const permission=typeof Notification==='undefined'?'unsupported':Notification.permission;
  let subscribed=0;
  if(!compatible || permission!=='granted' || !vapidKey){
    const status=await studentAlertRequest('status',clientId);
    return {supported:compatible,permission,active:false,
      subscribed:status.subscribed||0};
  }
  const registration=await navigator.serviceWorker.getRegistration('/');
  const subscription=registration?.active
    ? await registration.pushManager.getSubscription() : null;
  if(!subscription) {
    const status=await studentAlertRequest('status',clientId);
    return {supported:compatible,permission,active:false,
      subscribed:status.subscribed||0};
  }
  try{
    const token=await getToken(getMessaging(app),{
      vapidKey:String(vapidKey).trim(),serviceWorkerRegistration:registration
    });
    const status=await studentAlertRequest('status',clientId,{token});
    return {supported:compatible,permission,
      active:Boolean(token&&status.registered),subscribed:status.subscribed||0};
  }catch(error){
    // No afirmar que están activadas cuando hay un problema de token.
    const status=await studentAlertRequest('status',clientId);
    return {supported:compatible,permission,active:false,
      subscribed:status.subscribed||0,error:error?.message||'Error de FCM'};
  }
}

export async function enableStudentPush(clientId,vapidKey){
  if(!window.isSecureContext||!('serviceWorker' in navigator)||
     !('Notification' in window)||!('PushManager' in window))
    throw new Error('Este dispositivo no admite push web. En iPhone, instalá Ragnar en la pantalla de inicio.');
  if(!/^[A-Za-z0-9_-]{40,}$/.test(String(vapidKey||'').trim()))
    throw new Error('El entrenador aún debe configurar la clave pública de notificaciones.');
  // Pedido de permiso disparado directamente por el clic del alumno.
  const permission=await Notification.requestPermission();
  if(permission!=='granted')throw new Error('No se concedió permiso. Revisá los ajustes de notificaciones del navegador.');
  if(!await supportsStudentPush())throw new Error('Firebase Push no es compatible con este dispositivo.');
  const registration=await getLiveRegistration();
  const token=await getToken(getMessaging(app),{
    vapidKey:String(vapidKey).trim(),
    serviceWorkerRegistration:registration
  });
  if(!token)throw new Error('Firebase no devolvió un token de notificaciones.');
  await studentAlertRequest('register',clientId,{token});
  return token;
}
export async function disableStudentPush(clientId,vapidKey){
  if(!await supportsStudentPush())return;
  const registration=await getLiveRegistration();
  const messaging=getMessaging(app);
  const token=vapidKey?await getToken(messaging,{
    vapidKey:String(vapidKey).trim(),serviceWorkerRegistration:registration
  }):null;
  if(token)await studentAlertRequest('unregister',clientId,{token});
  await deleteToken(messaging);
}
export async function studentForegroundListener(callback){
  if(!await supportsStudentPush())return ()=>{};
  return onMessage(getMessaging(app),message=>{
    const data=message.data||{};
    if(data.target==='student-alerts')callback({
      title:data.title||'Nuevo aviso en Ragnar',
      body:data.body||'Tenés una notificación nueva.',
      type:data.type||'',
      alertId:data.alertId||''
    });
  });
}
