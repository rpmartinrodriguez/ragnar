import test from 'node:test';
import assert from 'node:assert/strict';
import { enrichCoachIntelligence } from '../src/utils/coachIntelligence.js';

const session=(id,checkIn)=>({id,isFinalized:true,
  exercises:[{name:'Press',actualSets:[{weight:'40',reps:'8',completed:true}]}],checkIn});
test('separa alertas voluntarias de bienestar del semáforo de adherencia',()=>{
 const row=enrichCoachIntelligence(
  {client:{name:'Alumno'},status:'onTrack',reason:'Sesión realizada'},
  [session('2026-11-10',{energy:2,sleep:'mal',discomfort:false})],
  '2026-11-11'
 );
 assert.equal(row.status,'onTrack');
 assert.equal(row.needsWellnessReview,true);
 assert.equal(row.wellnessSignals.length,2);
 assert.equal(row.progressSnapshot.completed,1);
});
test('sin check-in no inventa una alerta ni presenta valores faltantes como malos',()=>{
 const row=enrichCoachIntelligence({status:'noData'},
   [session('2026-11-10',null)],'2026-11-11');
 assert.equal(row.checkIn,null);
 assert.equal(row.needsWellnessReview,false);
 assert.equal(row.checkInSummary,null);
});
test('solo considera señales recientes',()=>{
 const row=enrichCoachIntelligence({status:'onTrack'},
  [session('2026-10-20',{energy:1,sleep:'mal',discomfort:true})],
  '2026-11-11');
 assert.equal(row.needsWellnessReview,false);
});
