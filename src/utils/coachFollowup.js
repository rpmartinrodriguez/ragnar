// Indicadores de seguimiento del coach: sólo datos reales de sesiones y sin escrituras.
export const FOLLOWUP_DAYS = 14;
export const FOLLOWUP_READ_DAYS = 28;
export const FOLLOWUP_NEXT_DAYS = 7;

export function shiftYmd(ymd, deltaDays) {
  if (typeof ymd !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) {
    throw new Error('Fecha inválida en seguimiento');
  }
  const d = new Date(ymd + 'T12:00:00Z');
  if (Number.isNaN(d.valueOf()) || d.toISOString().slice(0, 10) !== ymd) {
    throw new Error('Fecha inválida en seguimiento');
  }
  d.setUTCDate(d.getUTCDate() + deltaDays);
  return d.toISOString().slice(0, 10);
}

export function analyzeCoachFollowup(client, sessions, todayYmd) {
  const from14 = shiftYmd(todayYmd, -(FOLLOWUP_DAYS - 1));
  const valid = (Array.isArray(sessions) ? sessions : [])
    .filter(s => s && /^\d{4}-\d{2}-\d{2}$/.test(String(s.id || '')) &&
      Array.isArray(s.exercises) && s.exercises.length > 0)
    .sort((a, b) => String(a.id).localeCompare(String(b.id)));

  const past14 = valid.filter(s => s.id >= from14 && s.id <= todayYmd);
  const completed = past14.filter(s => s.isFinalized === true);
  const unfinishedPast = past14.filter(s => s.id < todayYmd && s.isFinalized !== true);
  const lastFinished = valid.filter(s => s.id <= todayYmd && s.isFinalized === true).at(-1)?.id ?? null;
  const upcoming = valid.find(s => s.id > todayYmd)?.id ?? null;

  let status = 'noData';
  let reason = 'No hay rutinas con ejercicios registradas en los últimos 14 días.';
  if (unfinishedPast.length >= 3) {
    status = 'contact';
    reason = `${unfinishedPast.length} rutinas programadas sin finalizar en los últimos 14 días.`;
  } else if (unfinishedPast.length > 0) {
    status = 'review';
    reason = `${unfinishedPast.length} rutina${unfinishedPast.length === 1 ? '' : 's'} programada${unfinishedPast.length === 1 ? '' : 's'} sin finalizar. Revisar con el alumno.`;
  } else if (completed.length > 0) {
    status = 'onTrack';
    reason = `${completed.length} rutina${completed.length === 1 ? '' : 's'} finalizada${completed.length === 1 ? '' : 's'} en el período, sin fechas pasadas pendientes.`;
  } else if (past14.length > 0 || upcoming) {
    reason = 'Hay entrenamiento programado, pero todavía no hay actividad suficiente para evaluar.';
  }

  return {
    client, status, reason,
    completed14: completed.length,
    planned14: past14.length,
    unfinishedPast14: unfinishedPast.length,
    lastFinished, upcoming
  };
}

export const FOLLOWUP_ORDER = ['contact', 'review', 'onTrack', 'noData', 'error'];

export function sortCoachFollowup(rows) {
  return [...rows].sort((a, b) =>
    FOLLOWUP_ORDER.indexOf(a.status) - FOLLOWUP_ORDER.indexOf(b.status) ||
    (b.unfinishedPast14 || 0) - (a.unfinishedPast14 || 0) ||
    String(a.client?.name || '').localeCompare(String(b.client?.name || ''), 'es')
  );
}
