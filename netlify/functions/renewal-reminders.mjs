// Netlify Scheduled Function. En Staging se prueba con "Run now" desde
// Netlify → Functions. Cron automático únicamente en el deploy publicado.
import { getRagnarAdmin, studentsDB, sendRenewalReminderIfDue } from './lib/studentAlerts.mjs';
import { ymdInArgentina } from '../../src/utils/billingCycle.js';

export const config = { schedule: '0 12 * * *' }; // 09:00 en Argentina (UTC-3).

export default async function scheduledRenewals(){
  const app=getRagnarAdmin();
  const db=studentsDB(app);
  const today=ymdInArgentina();
  // Solo alumnos que tienen cuenta habilitada en el Firebase nuevo.
  const active=await db.collection('clients')
    .where('accountAccessStatus','==','activated').get();
  let eligible=0,sent=0,errors=0,skipped=0;
  const docs=active.docs;
  for(let i=0;i<docs.length;i+=8){
    const batch=docs.slice(i,i+8);
    await Promise.all(batch.map(async d=>{
      try{
        const result=await sendRenewalReminderIfDue(app,db,{id:d.id,...d.data()},today);
        if(result.skipped) skipped++;
        else{eligible++;sent+=result.sent||0;}
      }catch(error){
        errors++;
        console.error('Aviso de renovación no enviado al alumno '+d.id,error?.code||error?.message);
      }
    }));
  }
  console.log(JSON.stringify({task:'Ragnar renovación a 3 días',today,checked:docs.length,eligible,sent,errors,skipped}));
  return new Response(null,{status:errors?207:204});
}
