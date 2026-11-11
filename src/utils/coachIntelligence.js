// Coach Intelligence: enriquecer el Seguimiento existente con señales voluntarias
// de Check-in y métricas reales. No asigna diagnósticos ni modifica la rutina.
import {latestCheckIn, checkInDisplay} from './ragnarCheckIn.js';
import {progressIntelligence} from './progressIntelligence.js';

export function enrichCoachIntelligence(followup, sessions, todayYmd) {
  const checkIn = latestCheckIn(sessions,todayYmd);
  const progress = progressIntelligence(sessions,todayYmd);
  const wellnessSignals=checkIn?.signals || [];
  return {
    ...followup,
    checkIn,
    checkInSummary:checkIn ? checkInDisplay(checkIn) : null,
    wellnessSignals,
    needsWellnessReview:wellnessSignals.length>0,
    progressSnapshot:progress?{
      scheduled:progress.scheduled,
      completed:progress.completed,
      completionRate:progress.completionRate,
      recentCompared:progress.comparable.length,
      increased:progress.increases
    }:null
  };
}
