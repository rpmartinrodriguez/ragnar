// Ragnar: API autorizada para inbox del alumno, push y eventos del coach.
import { getAuth } from 'firebase-admin/auth';
import { FieldValue } from 'firebase-admin/firestore';
import {
  getRagnarAdmin, studentsDB, digest, validId, validToken,
  saveAndDeliverStudentAlert, sendRenewalReminderIfDue
} from './lib/studentAlerts.mjs';

function respond(data,status=200){
  return new Response(JSON.stringify(data),{status,headers:{
    'content-type':'application/json; charset=utf-8','cache-control':'no-store',
    'x-content-type-options':'nosniff','referrer-policy':'no-referrer'
  }});
}
function reject(message,status=400){return respond({success:false,error:message},status);}
async function coachAllowed(db,uid,client){
  const snap=await db.doc('coaches/'+uid).get();
  if(!snap.exists||snap.get('enabled')!==true)return false;
  if(client.trainerId===uid)return true;
  // Migración: fichas importadas pueden tener un UID de coach histórico.
  const active=await db.collection('coaches').where('enabled','==',true).limit(2).get();
  return active.size===1 && active.docs[0].id===uid;
}

export default async function handler(request){
  if(request.method!=='POST')return reject('Método no permitido',405);
  const origin=request.headers.get('origin');
  if(origin&&origin!==new URL(request.url).origin)return reject('Origen no permitido',403);
  let data;
  try{
    const raw=await request.text();
    if(raw.length>4000)return reject('Solicitud demasiado grande',413);
    data=JSON.parse(raw);
  }catch{return reject('Solicitud inválida');}
  const actions=['register','unregister','status','test','list','mark','mark-section','check-renewal','coach-event'];
  if(!actions.includes(data?.action))return reject('Acción no admitida');
  if(!validId(data.clientId))return reject('ID del alumno inválido');
  let app;
  try{app=getRagnarAdmin();}catch(error){
    console.error('Configuración privada de Ragnar:',error?.message);
    return reject('Servidor de avisos sin configurar en Netlify',503);
  }
  const bearer=/^Bearer ([A-Za-z0-9_.-]+)$/.exec(request.headers.get('authorization')||'');
  if(!bearer)return reject('Iniciá sesión para recibir avisos',401);
  const adminAuth=getAuth(app);
  let user;
  try{user=await adminAuth.verifyIdToken(bearer[1],true);}
  catch{return reject('La sesión venció. Ingresá nuevamente',401);}
  const db=studentsDB(app);
  const clientRef=db.doc('clients/'+data.clientId);
  const snap=await clientRef.get();
  if(!snap.exists)return reject('No existe el alumno seleccionado',404);
  const client={id:snap.id,...snap.data()};
  const isCoachEvent=data.action==='coach-event';
  if(isCoachEvent){
    if(!await coachAllowed(db,user.uid,client))return reject('Solo el coach responsable puede notificar cambios',403);
    if(!['coach_message','routine_updated'].includes(data.type) || !validId(data.sourceId)){
      return reject('Evento de coach inválido');
    }
    let alertTitle,alertBody,key,type=data.type;
    if(type==='coach_message'){
      const message=await clientRef.collection('messages').doc(data.sourceId).get();
      const createdAt=message.get('createdAt')?.toMillis?.();
      if(!message.exists||message.get('sender')!=='trainer'||
         !message.get('text')?.trim()||!createdAt||
         Math.abs(Date.now()-createdAt)>15*60000){
        return reject('El mensaje del coach no existe o ya no es reciente',409);
      }
      key='coachmsg-'+digest(data.sourceId).slice(0,40);
      alertTitle='Nuevo mensaje de tu entrenador';
      alertBody='Tu entrenador te escribió en el chat de Ragnar.';
    }else{
      const session=await clientRef.collection('sessions').doc(data.sourceId).get();
      const changed=session.get('coachPlanningUpdatedAt')?.toMillis?.();
      if(!session.exists||session.get('coachPlanningUpdatedBy')!==user.uid ||
         !Array.isArray(session.get('exercises'))||!changed ||
         Math.abs(Date.now()-changed)>15*60000){
        return reject('No se confirmó un cambio de rutina reciente hecho por este entrenador',409);
      }
      // Agrupar cambios consecutivos del mismo día en ventanas de 10 minutos.
      // Evita un push por cada ejercicio al planificar un bloque.
      key='routine-'+digest(data.sourceId+':'+Math.floor(changed/600000)).slice(0,40);
      const first=session.get('coachPlanningKind')==='assigned';
      alertTitle=first?'Tu entrenador agregó una rutina':'Tu entrenador modificó una rutina';
      alertBody='Revisá tu planificación de Ragnar para el día '+
        data.sourceId.split('-').reverse().join('/')+'.';
    }
    return respond(await saveAndDeliverStudentAlert(app,db,data.clientId,key,
      alertTitle,alertBody,type,data.sourceId));
  }
  if(client.studentUserId!==user.uid || client.accountAccessStatus!=='activated') {
    return reject('Esta cuenta no corresponde a la ficha del alumno',403);
  }
  const devices=clientRef.collection('pushDevices');
  if(data.action==='status'){
    // Estado por dispositivo: tener otros teléfonos registrados NO implica
    // que las push estén activas en el iPhone/navegador actual.
    const list=await devices.limit(12).get();
    const tokenValid=typeof data.token==='string'&&validToken(data.token);
    const registered=tokenValid?list.docs.some(d=>d.id===digest(data.token)):false;
    return respond({success:true,subscribed:list.size,registered});
  }
  if(data.action==='register'){
    if(!validToken(data.token))return reject('Token de notificaciones inválido');
    const existing=await devices.limit(12).get();
    if(existing.size>=12&&!existing.docs.some(d=>d.id===digest(data.token))){
      return reject('Límite de dispositivos registrados alcanzado',429);
    }
    await devices.doc(digest(data.token)).set({
      token:data.token,
      userAgent:String(request.headers.get('user-agent')||'').slice(0,160),
      updatedAt:FieldValue.serverTimestamp()
    },{merge:true});
    return respond({success:true,subscribed:existing.size+Number(!existing.docs.some(d=>d.id===digest(data.token)))});
  }
  if(data.action==='unregister'){
    if(!validToken(data.token))return reject('Token inválido');
    await devices.doc(digest(data.token)).delete();
    return respond({success:true});
  }
  if(data.action==='list'){
    const query=await clientRef.collection('studentNotifications')
      .orderBy('createdAt','desc').limit(40).get();
    const notifications=query.docs.map(d=>({
      id:d.id,title:d.get('title')||'',body:d.get('body')||'',
      type:d.get('type')||'',sourceId:d.get('sourceId')||'',
      read:d.get('read')===true,
      createdAt:d.get('createdAt')?.toDate?.()?.toISOString?.()||''
    }));
    return respond({success:true,notifications});
  }
  if(data.action==='mark'){
    if(!validId(data.notificationId))return reject('Aviso inválido');
    const notification=clientRef.collection('studentNotifications').doc(data.notificationId);
    const exists=await notification.get();
    if(!exists.exists)return reject('Aviso no encontrado',404);
    if(!exists.get('read'))await notification.update({
      read:true,readAt:FieldValue.serverTimestamp()
    });
    return respond({success:true});
  }
  if(data.action==='mark-section'){
    // Solo el alumno autenticado puede confirmar que abrió la sección.
    // No eliminar avisos: conservar historial, excluirlos del contador.
    const types={
      chat:['coach_message'],
      calendar:['routine_updated'],
      profile:['renewal'],
      test:['test']
    }[data.section];
    if(!types)return reject('Sección inválida');
    const notifications=clientRef.collection('studentNotifications');
    let cursor=null,updated=0;
    // Paginar sin índices compuestos, procesando únicamente avisos de la sección.
    for(let page=0;page<12;page++){
      let q=notifications.orderBy('createdAt','desc').limit(100);
      if(cursor)q=q.startAfter(cursor);
      const snapshot=await q.get();
      if(snapshot.empty)break;
      const toMark=snapshot.docs.filter(d=>
        types.includes(d.get('type'))&&d.get('read')!==true
      );
      if(toMark.length){
        const batch=db.batch();
        for(const notification of toMark){
          batch.update(notification.ref,{
            read:true,readAt:FieldValue.serverTimestamp()
          });
        }
        await batch.commit();
        updated+=toMark.length;
      }
      if(snapshot.size<100)break;
      cursor=snapshot.docs[snapshot.docs.length-1];
    }
    return respond({success:true,updated});
  }
  if(data.action==='check-renewal'){
    const result=await sendRenewalReminderIfDue(app,db,client);
    return respond({success:true,...result});
  }
  if(data.action==='test'){
    const key='test-'+Date.now().toString(36);
    return respond(await saveAndDeliverStudentAlert(app,db,data.clientId,key,
      'Ragnar • notificaciones activas',
      'Tu dispositivo ya puede recibir avisos del entrenador.',
      'test',''));
  }
  return reject('Acción no disponible',400);
}
