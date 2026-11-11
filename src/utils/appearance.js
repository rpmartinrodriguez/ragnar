// Preferencia de apariencia local: sin Firebase ni datos de salud o entrenamiento.
export const APPEARANCE_KEY = 'ragnar.appearance.v1';
export const APPEARANCE_MODES = Object.freeze(['system', 'dark', 'light']);

export function normalizeAppearance(value) {
  return APPEARANCE_MODES.includes(value) ? value : 'system';
}
export function resolveAppearance(mode, systemDark) {
  const normalized = normalizeAppearance(mode);
  return normalized === 'system' ? (systemDark ? 'dark' : 'light') : normalized;
}
export function loadAppearance(storage) {
  try { return normalizeAppearance(storage?.getItem(APPEARANCE_KEY)); }
  catch { return 'system'; }
}
