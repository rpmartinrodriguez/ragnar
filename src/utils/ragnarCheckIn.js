// RAGNAR Check-in: registro voluntario del alumno previo a su sesión.
// Se guarda dentro de la sesión que ya existe, sin crear perfiles de salud
// ni enviar estos datos al Salón Ragnar.
export const CHECKIN_SLEEP = Object.freeze(['bien', 'regular', 'mal']);
export const CHECKIN_DAYS = 7;

export function normalizeCheckIn(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const energy = Number(raw.energy);
  if (!Number.isInteger(energy) || energy < 1 || energy > 5 ||
      !CHECKIN_SLEEP.includes(raw.sleep) || typeof raw.discomfort !== 'boolean') return null;
  return { energy, sleep: raw.sleep, discomfort: raw.discomfort };
}

export function buildCheckIn({ energy, sleep, discomfort }) {
  const result = normalizeCheckIn({energy, sleep, discomfort});
  if (!result) throw new Error('Elegí un nivel de energía, cómo dormiste y si tenés alguna molestia.');
  return result;
}

export function checkInSignal(checkIn) {
  const data = normalizeCheckIn(checkIn);
  if (!data) return null;
  const reasons = [];
  if (data.discomfort) reasons.push('Informó una molestia');
  if (data.energy <= 2) reasons.push('Energía baja (' + data.energy + '/5)');
  if (data.sleep === 'mal') reasons.push('Descanso insuficiente según el alumno');
  return reasons.length ? reasons : [];
}

function shiftYmd(ymd, days) {
  const d = new Date(ymd + 'T12:00:00Z');
  if (Number.isNaN(d.getTime())) return '';
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0,10);
}

export function latestCheckIn(sessions, todayYmd, days = CHECKIN_DAYS) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(todayYmd)) return null;
  const start = shiftYmd(todayYmd, -(days - 1));
  const found = (Array.isArray(sessions) ? sessions : [])
    .filter(s => s && /^\d{4}-\d{2}-\d{2}$/.test(String(s.id || '')) &&
      s.id <= todayYmd && s.id >= start && normalizeCheckIn(s.checkIn))
    .sort((a,b) => b.id.localeCompare(a.id))[0];
  if (!found) return null;
  return { date: found.id, ...normalizeCheckIn(found.checkIn),
    signals: checkInSignal(found.checkIn) };
}

export function checkInDisplay(checkIn) {
  const normalized = normalizeCheckIn(checkIn);
  if (!normalized) return 'Sin check-in registrado';
  return 'Energía ' + normalized.energy + '/5 · Descanso ' + normalized.sleep +
    (normalized.discomfort ? ' · Informó molestia' : ' · Sin molestias informadas');
}
