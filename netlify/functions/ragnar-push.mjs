// Ragnar staging: registro seguro de dispositivos y envío de notificaciones FCM.
// Firebase Spark + Netlify Functions. Nunca enviar la cuenta de servicio al navegador.
import { createHash } from 'node:crypto';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';

const PROJECT_ID = 'ragnar-5f8d7';
const SECRET = 'RAGNAR_FIREBASE_SERVICE_ACCOUNT';

function reply(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'no-referrer'
    }
  });
}
function reject(error, status=400) { return reply({success:false,error},status); }
function hash(value) { return createHash('sha256').update(value).digest('hex'); }

function admin() {
  const raw = process.env[SECRET];
  if (!raw) return null;
  const key = JSON.parse(raw);
  if (key.project_id !== PROJECT_ID || !key.client_email || !key.private_key) {
    throw new Error('Proyecto de la cuenta de servicio incorrecto');
  }
  return getApps().find(a=>a.name==='ragnar-push-staging') ||
    initializeApp({ credential:cert(key), projectId:PROJECT_ID }, 'ragnar-push-staging');
}

function validToken(s) {
  return typeof s==='string' && s.length>30 && s.length<3000 &&
    /^[A-Za-z0-9_:\-./~+=]+$/.test(s);
}
function validId(s) {
  return typeof s==='string' && s.length<=150 && /^[A-Za-z0-9_-]+$/.test(s);
}
async function isCoach(db,uid) {
  const d=await db.doc('coaches/'+uid).get();
  return d.exists && d.get('enabled')===true;
}
async function coachDevices(db,uid) {
  const result=await db.collection('coaches').doc(uid).collection('pushDevices').limit(30).get();
  return result.docs.filter(d=>validToken(d.get('token'))).map(d=>({id:d.id,token:d.get('token')}));
}
async function notify(app,db,coachUid,title,body,type,clientId) {
  const devices=await coachDevices(db,coachUid);
  if (!devices.length) return {sent:0,subscribed:0};
  const payload={
    tokens:devices.map(d=>d.token),
    data:{
      title:String(title).slice(0,120),
      body:String(body).slice(0,170),
      type:String(type).slice(0,40),
      target:'notifications',
      clientId:clientId||''
    },
    webpush:{headers:{TTL:'3600',Urgency:'normal'}}
  };
  const result=await getMessaging(app).sendEachForMulticast(payload);
  const cleanup=devices.filter((d,i)=>{
    const error=result.responses[i]?.error?.code;
    return error==='messaging/registration-token-not-registered' ||
      error==='messaging/invalid-registration-token';
  });
  await Promise.all(cleanup.map(d=>db.collection('coaches').doc(coachUid).collection('pushDevices').doc(d.id).delete()));
  return {sent:result.successCount,subscribed:devices.length};
}

export default async function handler(request) {
  if (request.method!=='POST') return reject('Método no permitido',405);
  const origin=request.headers.get('origin');
  if (origin && origin!==new URL(request.url).origin) return reject('Origen no permitido',403);
  let body;
  try {
    const raw=await request.text();
    if(raw.length>5000) return reject('Solicitud demasiado grande',413);
    body=JSON.parse(raw);
  } catch { return reject('Solicitud inválida'); }
  if (!['register','unregister','status','test','event','preferences','update-preferences'].includes(body?.action)) return reject('Acción inválida');
  let app;
  try { app=admin(); }
  catch { return reject('Configuración privada de Firebase incorrecta en Netlify',503); }
  if(!app) return reject('Falta RAGNAR_FIREBASE_SERVICE_ACCOUNT en Netlify',503);
  const bearer=/^Bearer ([A-Za-z0-9_.-]+)$/.exec(request.headers.get('authorization')||'');
  if (!bearer) return reject('Iniciá sesión para continuar',401);
  let user;
  try {
    user=await getAuth(app).verifyIdToken(bearer[1],true);
  } catch { return reject('Sesión inválida. Ingresá nuevamente',401); }
  const db=getFirestore(app);
  const uid=user.uid;

  if(body.action!=='event') {
    if(!await isCoach(db,uid)) return reject('Solo entrenadores autorizados pueden activar push',403);
    const devices=db.collection('coaches').doc(uid).collection('pushDevices');
    if(body.action==='status') {
      const list=await coachDevices(db,uid);
      return reply({success:true,subscribed:list.length});
    }
    if(body.action==='preferences'){
      const docSnap=await db.doc('coaches/'+uid).get();
      return reply({success:true,preferences:docSnap.get('pushPreferences')||{}});
    }
    if(body.action==='update-preferences'){
      const keys=['workout_completed','student_message','missed_workout','student_note'];
      const incoming=body.preferences||{};
      if(!incoming||typeof incoming!=='object'||Array.isArray(incoming)||
         Object.keys(incoming).some(key=>!keys.includes(key))||
         Object.values(incoming).some(value=>typeof value!=='boolean')){
        return reject('Preferencias de avisos inválidas',400);
      }
      const preferences=Object.fromEntries(keys.map(key=>[key,incoming[key]!==false]));
      await db.doc('coaches/'+uid).update({pushPreferences:preferences});
      return reply({success:true,preferences});
    }
    if(body.action==='register') {
      const token=body.token;
      if(!validToken(token)) return reject('Token push inválido');
      // Evitar inscripciones masivas o tokens arbitrarios por cuenta.
      const current=await devices.limit(30).get();
      if(current.size>=30 && !current.docs.some(d=>d.id===hash(token))) {
        return reject('Límite de dispositivos del entrenador alcanzado',429);
      }
      await devices.doc(hash(token)).set({
        token,
        origin:origin||'',
        userAgent:String(request.headers.get('user-agent')||'').slice(0,200),
        updatedAt:FieldValue.serverTimestamp()
      },{merge:true});
      return reply({success:true,subscribed:current.size+Number(!current.docs.some(d=>d.id===hash(token)))});
    }
    if(body.action==='unregister') {
      if(!validToken(body.token)) return reject('Token push inválido');
      await devices.doc(hash(body.token)).delete();
      return reply({success:true});
    }
    if(body.action==='test') {
      const authAge=Math.floor(Date.now()/1000)-Number(user.auth_time||0);
      if(authAge>3600||authAge<0) return reject('Por seguridad, iniciá sesión nuevamente para la prueba',401);
      const result=await notify(app,db,uid,'Ragnar • prueba push','Tu dispositivo ya puede recibir notificaciones del entrenador.','test','');
      return reply({success:true,...result});
    }
  }

  // Eventos del alumno: nunca confiar en nombre, contenido o receptor dados por el navegador.
  if(body.action==='event') {
    const {type,clientId,sourceId}=body;
    if(!['workout_completed','student_message','missed_workout','student_note'].includes(type) ||
       !validId(clientId)||!validId(sourceId)) return reject('Evento inválido');
    const clientSnap=await db.doc('clients/'+clientId).get();
    if(!clientSnap.exists || clientSnap.get('studentUserId')!==uid) {
      return reject('El evento no corresponde a la cuenta autenticada',403);
    }

    let title,bodyText;
    if(type==='student_message'){
      const msg=await db.doc('clients/'+clientId+'/messages/'+sourceId).get();
      if(!msg.exists || msg.get('sender')!=='student' || typeof msg.get('text')!=='string' || !msg.get('text').trim()) {
        return reject('No se encontró un mensaje nuevo válido',409);
      }
      const when=msg.get('createdAt');
      if(!when?.toMillis || Math.abs(Date.now()-when.toMillis())>15*60*1000) return reject('El mensaje ya no es reciente',409);
      title='Nuevo mensaje en Ragnar';
      bodyText=(clientSnap.get('name')||'Un alumno')+' te envió un mensaje';
    }else{
      const session=await db.doc('clients/'+clientId+'/sessions/'+sourceId).get();
      if(!session.exists) return reject('No se encontró esa sesión',409);
      if(type==='workout_completed'&&session.get('isFinalized')!==true) return reject('La rutina todavía no figura finalizada',409);
      if(type==='missed_workout'&&typeof session.get('missedReason')!=='string') return reject('No existe la justificación',409);
      if(type==='student_note'&&
         (typeof session.get('studentNote')!=='string'||!session.get('studentNote').trim())) {
        return reject('No existe una observación del alumno en esta sesión',409);
      }
      const eventDate=type==='workout_completed'?session.get('completedAt'):
        type==='missed_workout'?session.get('missedReasonAt'):session.get('studentNoteUpdatedAt');
      const eventTime=eventDate?.toMillis?.();
      if(!eventTime || Math.abs(Date.now()-eventTime)>15*60*1000) {
        return reject('La notificación corresponde a una actividad anterior; no reenviar',409);
      }
      title=type==='workout_completed'?'Entrenamiento finalizado':
        type==='student_note'?'Observación de entrenamiento':'Ausencia justificada';
      bodyText=(clientSnap.get('name')||'Un alumno')+
        (type==='workout_completed'?' terminó su rutina':
          type==='student_note'?' dejó una nota sobre su entrenamiento':' informó un motivo de ausencia');
    }

    // Encontrar entrenador: UID correcto en ficha o, en migración, único coach habilitado.
    let coachUid=clientSnap.get('trainerId')||'';
    if(!coachUid||!await isCoach(db,coachUid)) {
      const coaches=await db.collection('coaches').where('enabled','==',true).limit(2).get();
      if(coaches.size!==1) return reject('Falta asignar un entrenador autorizado a esta ficha',409);
      coachUid=coaches.docs[0].id;
    }
    const coachSnap=await db.doc('coaches/'+coachUid).get();
    const preferences=coachSnap.get('pushPreferences')||{};
    if(preferences[type]===false){
      return reply({success:true,sent:0,muted:true,reason:'El entrenador desactivó este aviso push'});
    }
    const devices=await coachDevices(db,coachUid);
    if(!devices.length) return reply({success:true,sent:0,reason:'Entrenador sin dispositivos push registrados'});

    // Idempotencia por documento de origen. Reintentos no generan avisos duplicados.
    const eventId=hash(type+':'+clientId+':'+sourceId);
    const log=db.collection('ragnarPushDispatch').doc(eventId);
    try {
      await log.create({
        type,clientId,sourceId,coachUid,createdAt:FieldValue.serverTimestamp()
      });
    } catch(err) {
      if(err.code===6||err.code==='already-exists') return reply({success:true,sent:0,duplicate:true});
      throw err;
    }
    try {
      const result=await notify(app,db,coachUid,title,bodyText,type,clientId);
      await log.update({sent:result.sent,subscribed:result.subscribed});
      return reply({success:true,...result});
    }catch(error) {
      // No se reenvía automáticamente para evitar duplicaciones no comprobables.
      await log.update({error:true}).catch(()=>{});
      console.error('Ragnar push: no se pudo enviar un evento validado',error?.code||error?.message);
      return reject('El evento se guardó, pero falló el envío push. Revisá el panel de notificaciones',502);
    }
  }
}
