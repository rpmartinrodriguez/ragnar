// Ragnar: cambio obligatorio de clave temporal tras iniciar sesión.
// No almacena ni vuelve a enviar al alumno su contraseña temporal.
// La validación del primer acceso se hace con auth_time del token de Firebase.
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const PROJECT_ID='ragnar-5f8d7';
function response(data,status=200){
  return new Response(JSON.stringify(data),{
    status,headers:{
      'content-type':'application/json; charset=utf-8',
      'cache-control':'no-store, max-age=0',
      'x-content-type-options':'nosniff',
      'referrer-policy':'no-referrer'
    }
  });
}
function err(message,status=400){return response({success:false,error:message},status);}
function adminApp(){
  const raw=process.env.RAGNAR_FIREBASE_SERVICE_ACCOUNT;
  if(!raw)throw new Error('Se requiere configurar la cuenta de servicio de Ragnar en Netlify.');
  const key=JSON.parse(raw);
  if(key.project_id!==PROJECT_ID || !key.client_email || !key.private_key){
    throw new Error('Credenciales administrativas del proyecto incorrectas.');
  }
  return getApps().find(app=>app.name==='ragnar-first-password') ||
    initializeApp({credential:cert(key),projectId:PROJECT_ID},'ragnar-first-password');
}
export default async function handler(request){
  if(request.method!=='POST')return err('Método no permitido',405);
  const origin=request.headers.get('origin');
  if(origin && origin!==new URL(request.url).origin)return err('Origen no permitido',403);
  let payload;
  try{
    const raw=await request.text();
    if(raw.length>1300)return err('Solicitud demasiado grande',413);
    payload=JSON.parse(raw);
  }catch{return err('Solicitud inválida');}
  const clientId=payload?.clientId;
  const newPassword=payload?.newPassword;
  if(typeof clientId!=='string'||clientId.length>150||!/^[A-Za-z0-9_-]+$/.test(clientId)){
    return err('Ficha de alumno inválida.');
  }
  if(typeof newPassword!=='string'||newPassword.length<10||newPassword.length>128||
     newPassword.trim()!==newPassword){
    return err('La contraseña debe tener entre 10 y 128 caracteres, sin espacios al principio o al final.');
  }
  let app;
  try{app=adminApp();}
  catch(error){console.error('Ragnar: falta configuración privada de primer acceso',error.message);return err('El servicio de cambio de contraseña no está configurado en Netlify.',503);}
  const bearer=/^Bearer ([A-Za-z0-9_.-]+)$/.exec(request.headers.get('authorization')||'');
  if(!bearer)return err('Volvé a iniciar sesión como alumno.',401);
  const auth=getAuth(app);
  let session;
  try{session=await auth.verifyIdToken(bearer[1],true);}
  catch{return err('Tu sesión no es válida. Volvé a ingresar.',401);}
  // Si pasaron más de 10 minutos desde que ingresó la clave temporal, no
  // aceptamos una sesión de Firebase antigua guardada en el dispositivo.
  const age=Math.floor(Date.now()/1000)-Number(session.auth_time||0);
  if(age<0||age>600){
    return err('Por seguridad, tu ingreso tiene más de 10 minutos. Cerrá sesión y volvé a entrar con tu clave temporal para elegir una nueva.',401);
  }
  const db=getFirestore(app);
  const ref=db.doc('clients/'+clientId);
  const snap=await ref.get();
  if(!snap.exists||snap.get('studentUserId')!==session.uid||snap.get('accountAccessStatus')!=='activated'){
    return err('La cuenta autenticada no corresponde a esta ficha de alumno.',403);
  }
  const user=await auth.getUser(session.uid);
  if(user.disabled)return err('Esta cuenta está deshabilitada.',403);
  // El servidor jamás devuelve la contraseña al navegador ni la guarda en Firestore.
  try{
    await auth.updateUser(user.uid,{password:newPassword});
  }catch(error){
    console.error('Ragnar: no se pudo actualizar contraseña Firebase',error?.code||'error');
    return err('Firebase no permitió cambiar la contraseña. Probá otra clave.',502);
  }
  try{
    await ref.update({
      passwordChangeRequired:false,
      passwordChangedAt:FieldValue.serverTimestamp(),
      passwordChangedBy:user.uid
    });
  }catch(error){
    console.error('Ragnar: contraseña cambiada, no se pudo confirmar bandera del alumno',error?.code||'error');
    return response({
      success:false,passwordUpdated:true,
      error:'Firebase cambió tu contraseña, pero la confirmación del perfil quedó pendiente. Si volvés a iniciar sesión, usá la contraseña NUEVA.'
    },503);
  }
  return response({success:true,message:'¡Contraseña nueva guardada correctamente!'});
}
