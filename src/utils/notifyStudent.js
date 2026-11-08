import { getAuth } from 'firebase/auth';

export async function notifyStudentAboutCoachEvent(type,clientId,sourceId) {
  try{
    const user=getAuth().currentUser;
    if(!user||!clientId||!sourceId)return null;
    const response=await fetch('/.netlify/functions/student-alerts',{
      method:'POST',cache:'no-store',
      headers:{'content-type':'application/json',authorization:'Bearer '+await user.getIdToken()},
      body:JSON.stringify({action:'coach-event',clientId,type,sourceId})
    });
    const data=await response.json();
    if(!response.ok||!data.success)throw new Error(data?.error||'Aviso no enviado');
    return data;
  }catch(error){
    // El guardado de rutina o mensaje ya se completó; no revertirlo por fallar push.
    console.warn('Se guardó el cambio, pero no llegó el aviso externo al alumno:',error?.message||error);
    return null;
  }
}
