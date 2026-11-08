import { createHash } from 'node:crypto';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import { getUpcomingRenewal, ymdInArgentina } from '../../../src/utils/billingCycle.js';

export const RAGNAR_NEW_PROJECT = 'ragnar-5f8d7';
export function validId(value) {
  return typeof value==='string' && value.length>0 && value.length<151 &&
    /^[A-Za-z0-9_-]+$/.test(value);
}
export function validToken(value) {
  return typeof value==='string' && value.length>30 && value.length<3000 &&
    /^[A-Za-z0-9_:\-./~+=]+$/.test(value);
}
export function digest(value){return createHash('sha256').update(value).digest('hex');}
export function getRagnarAdmin() {
  const raw=process.env.RAGNAR_FIREBASE_SERVICE_ACCOUNT;
  if(!raw) throw new Error('RAGNAR_FIREBASE_SERVICE_ACCOUNT no configurada');
  const key=JSON.parse(raw);
  if(key.project_id!==RAGNAR_NEW_PROJECT || !key.private_key || !key.client_email){
    throw new Error('La cuenta de servicio no corresponde al Firebase nuevo.');
  }
  return getApps().find(a=>a.name==='ragnar-student-alerts') ||
    initializeApp({credential:cert(key),projectId:RAGNAR_NEW_PROJECT},'ragnar-student-alerts');
}
export function studentsDB(app){return getFirestore(app);}
export function notificationReference(db,clientId,key){
  return db.collection('clients').doc(clientId).collection('studentNotifications').doc(key);
}
export async function saveAndDeliverStudentAlert(app,db,clientId,key,title,body,type,sourceId='') {
  if(!validId(clientId)||!validId(key)) throw new Error('ID de notificación inválido.');
  const clientRef=db.collection('clients').doc(clientId);
  const snap=await clientRef.get();
  if(!snap.exists || snap.get('active')===false || snap.get('accountAccessStatus')!=='activated'){
    return {success:true,sent:0,skipped:'alumno no habilitado'};
  }
  const notifRef=notificationReference(db,clientId,key);
  try {
    await notifRef.create({
      type,title:String(title).slice(0,110),body:String(body).slice(0,220),
      sourceId:String(sourceId).slice(0,160),
      // Las pruebas confirman entrega pero no deben encender la campanita.
      read:type==='test',createdAt:FieldValue.serverTimestamp()
    });
  } catch(error){
    if(error.code===6 || error.code==='already-exists')return {success:true,sent:0,duplicate:true};
    throw error;
  }
  const deviceSnap=await clientRef.collection('pushDevices').limit(12).get();
  const deviceDocs=deviceSnap.docs.filter(d=>validToken(d.get('token')));
  if(!deviceDocs.length) return {success:true,sent:0,stored:true};
  try{
    const result=await getMessaging(app).sendEachForMulticast({
      tokens:deviceDocs.map(d=>d.get('token')),
      data:{
        title:String(title).slice(0,110),
        body:String(body).slice(0,220),
        type:String(type).slice(0,60),
        target:'student-alerts',
        clientId,
        alertId:key
      },
      webpush:{headers:{TTL:'3600',Urgency:'normal'}}
    });
    const invalid=deviceDocs.filter((d,i)=>[
      'messaging/registration-token-not-registered',
      'messaging/invalid-registration-token'
    ].includes(result.responses[i]?.error?.code));
    await Promise.all(invalid.map(d=>d.ref.delete()));
    await notifRef.update({pushedAt:FieldValue.serverTimestamp(),pushSent:result.successCount})
      .catch(()=>{});
    return {success:true,sent:result.successCount,stored:true};
  }catch(error){
    console.error('Ragnar push alumno:',error?.code||error?.message);
    return {success:true,sent:0,stored:true,pushError:true};
  }
}

export async function sendRenewalReminderIfDue(app,db,client,dayYmd=ymdInArgentina()){
  if(!client?.id || client.active===false || client.accountAccessStatus!=='activated'){
    return {skipped:'sin acceso activo'};
  }
  const due=getUpcomingRenewal(client.startDate,dayYmd);
  if(!due || due.daysUntil!==3) return {skipped:'no corresponde aviso de 3 días'};
  // El registro de pago del período futuro permite evitar avisos innecesarios.
  const payment=await db.doc('clients/'+client.id+'/payments/'+due.periodId).get();
  if(payment.exists && payment.get('status')==='paid')return {skipped:'el período ya está abonado'};
  return saveAndDeliverStudentAlert(app,db,client.id,
    'renewal-'+due.dueYmd,
    'Tu plan de Ragnar se renueva en 3 días',
    'Tu próxima fecha de renovación es el '+due.dueYmd.split('-').reverse().join('/')+
      '. Consultá al entrenador si ya abonaste.',
    'renewal',due.periodId);
}
