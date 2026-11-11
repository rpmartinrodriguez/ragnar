// Entrada y normalización de series en el alumno.
// No convertir a Number durante la escritura: hacerlo rompe estados intermedios
// como '' y '12,' al usar teclados móviles.
export function setFieldString(value) {
  return value === undefined || value === null ? '' : String(value);
}

export function acceptsSetDraft(field, raw) {
  const text = setFieldString(raw);
  if (field === 'reps') return /^\d{0,4}$/.test(text);
  if (field === 'weight') return /^\d{0,4}(?:[.,]\d{0,2})?$/.test(text);
  return false;
}

export function normalizeSetField(field, raw) {
  const text = setFieldString(raw).trim();
  return field === 'weight' ? text.replace(',', '.') : text;
}
