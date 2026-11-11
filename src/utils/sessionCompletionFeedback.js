// Devolución breve posterior a una sesión. Reutiliza los datos históricos
// que también leen las métricas de Progreso; no persiste datos derivados.
import { dateKey, safeNumber } from './trainingInsights.js';

const nameKey = name => String(name || '').trim()
  .toLocaleLowerCase('es').normalize('NFD').replace(/[\u0300-\u036f]/g, '');

function completedSets(exercise) {
  return (Array.isArray(exercise?.actualSets) ? exercise.actualSets : [])
    .filter(set => set?.completed === true);
}

function bestWeight(exercise) {
  const values = completedSets(exercise).map(set => safeNumber(set.weight, 2000))
    .filter(value => value !== null && value > 0);
  return values.length ? Math.max(...values) : null;
}

function positiveBestByName(session) {
  const found = new Map();
  for (const exercise of (Array.isArray(session?.exercises) ? session.exercises : [])) {
    const key = nameKey(exercise.name);
    const weight = bestWeight(exercise);
    if (!key || weight === null) continue;
    const prior = found.get(key);
    if (!prior || weight > prior.weight) {
      found.set(key, { name: exercise.name, weight });
    }
  }
  return found;
}
const niceKg = value => Number(value).toLocaleString('es-AR', { maximumFractionDigits: 2 });

export function sessionCompletionFeedback(allSessions = [], dateYmd) {
  const sessions = (Array.isArray(allSessions) ? allSessions : [])
    .filter(session => session?.isFinalized === true)
    .sort((a, b) => dateKey(a).localeCompare(dateKey(b)));
  const current = sessions.find(session => dateKey(session) === dateYmd);
  if (!current) return null;

  const history = sessions.filter(session => dateKey(session) < dateYmd);
  const priorSession = history.at(-1);
  const exercises = Array.isArray(current.exercises) ? current.exercises : [];
  const currentSets = exercises.reduce((total, exercise) => total + completedSets(exercise).length, 0);
  const previousSets = priorSession
    ? (Array.isArray(priorSession.exercises) ? priorSession.exercises : [])
        .reduce((total, exercise) => total + completedSets(exercise).length, 0)
    : null;
  const currentWeights = positiveBestByName(current);
  const comparisons = [];

  for (const [key, { name, weight }] of currentWeights) {
    // Buscar la última marca de ESE mismo ejercicio, no la de otra región.
    for (let index = history.length - 1; index >= 0; index--) {
      const previous = positiveBestByName(history[index]).get(key);
      if (!previous) continue;
      const delta = Math.round((weight - previous.weight) * 100) / 100;
      comparisons.push({
        name,
        from: previous.weight,
        to: weight,
        delta,
        previousDate: dateKey(history[index])
      });
      break;
    }
  }

  // Priorizar cargas superiores, luego iguales, luego menores sin estigmatizar.
  comparisons.sort((a,b) =>
    (b.delta > 0 ? 1 : b.delta === 0 ? 0 : -1) -
    (a.delta > 0 ? 1 : a.delta === 0 ? 0 : -1) ||
    Math.abs(b.delta) - Math.abs(a.delta)
  );
  const increasedCount = comparisons.filter(item => item.delta > 0).length;
  const stableCount = comparisons.filter(item => item.delta === 0).length;

  return {
    date: dateYmd,
    completedSets: currentSets,
    previousSets,
    previousDate: priorSession ? dateKey(priorSession) : null,
    comparableCount: comparisons.length,
    increasedCount,
    stableCount,
    comparisons: comparisons.slice(0, 2).map(item => ({
      ...item,
      formattedDelta: (item.delta > 0 ? '+' : '') + niceKg(item.delta) + ' kg',
      fromLabel: niceKg(item.from) + ' kg',
      toLabel: niceKg(item.to) + ' kg'
    }))
  };
}
