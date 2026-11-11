import React, { useEffect, useRef, useState } from 'react';
import { acceptsSetDraft, normalizeSetField, setFieldString } from '../utils/studentSetValue';

// Entrada independiente: el listener de Firestore puede refrescar la sesión
// mientras el alumno escribe; no debe cambiar el número bajo su cursor.
export default function StudentSetInput({
  field, value, disabled = false, onSave, label, placeholder
}) {
  const [draft, setDraft] = useState(() => setFieldString(value));
  const [state, setState] = useState('idle');
  const [error, setError] = useState('');
  const draftRef = useRef(setFieldString(value));
  const confirmedRef = useRef(setFieldString(value));
  const focusedRef = useRef(false);
  const dirtyRef = useRef(false);
  const submittedRef = useRef(null);
  const timerRef = useRef(null);
  const onSaveRef = useRef(onSave);
  const mountedRef = useRef(true);
  onSaveRef.current = onSave;

  useEffect(() => {
    const incoming = setFieldString(value);
    confirmedRef.current = incoming;
    if (normalizeSetField(field, incoming) === normalizeSetField(field, draftRef.current) &&
        (submittedRef.current === null ||
         submittedRef.current === normalizeSetField(field, draftRef.current))) {
      dirtyRef.current = false;
      submittedRef.current = null;
      if (!focusedRef.current) {
        draftRef.current = incoming;
        setDraft(incoming);
      }
      setError('');
      setState('idle');
    } else if (!dirtyRef.current && !focusedRef.current) {
      draftRef.current = incoming;
      setDraft(incoming);
    }
  }, [value, field]);

  const clearTimer = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
  };

  const saveDraft = () => {
    clearTimer();
    const next = normalizeSetField(field, draftRef.current);
    const saved = normalizeSetField(field, confirmedRef.current);
    if (next === saved && (submittedRef.current === null || submittedRef.current === next)) {
      dirtyRef.current = false;
      if (mountedRef.current) { setError(''); setState('idle'); }
      return;
    }
    if (submittedRef.current === next) return;
    submittedRef.current = next;
    if (mountedRef.current) { setState('saving'); setError(''); }
    Promise.resolve().then(() => onSaveRef.current(next))
      .then(() => {
        if (mountedRef.current && submittedRef.current === next) setState('saved');
      })
      .catch(err => {
        if (submittedRef.current === next) submittedRef.current = null;
        if (mountedRef.current) {
          setState('error');
          setError(err?.message || 'No se pudo guardar. Revisá la conexión.');
        }
      });
  };

  const scheduleSave = () => {
    clearTimer();
    timerRef.current = setTimeout(() => saveDraft(), 850);
  };

  const updateDraft = event => {
    const next = event.target.value;
    if (!acceptsSetDraft(field, next)) return;
    draftRef.current = next;
    setDraft(next);
    const normalized = normalizeSetField(field, next);
    dirtyRef.current = normalized !== normalizeSetField(field, confirmedRef.current) ||
      (submittedRef.current !== null && submittedRef.current !== normalized);
    setError('');
    setState('idle');
    if (dirtyRef.current) scheduleSave();
    else clearTimer();
  };

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
      if (dirtyRef.current) {
        const next = normalizeSetField(field, draftRef.current);
        if ((next !== normalizeSetField(field, confirmedRef.current) ||
             (submittedRef.current !== null && submittedRef.current !== next)) &&
            submittedRef.current !== next) {
          // Cambio de día o navegación: conservar el último valor escrito.
          void Promise.resolve().then(() => onSaveRef.current(next)).catch(console.error);
        }
      }
    };
  }, [field]);

  return (
    <div className="min-w-0">
      <input data-ragnar-series-input type="text" inputMode={field === 'reps' ? 'numeric' : 'decimal'}
        autoComplete="off" spellCheck={false} maxLength={field === 'reps' ? 4 : 7}
        aria-label={label} placeholder={placeholder} value={draft} disabled={disabled}
        onFocus={() => { focusedRef.current = true; }}
        onChange={updateDraft}
        onBlur={() => {
          focusedRef.current = false;
          if (dirtyRef.current) saveDraft();
          else {
            // Si el coach modificó el valor mientras estaba enfocado,
            // mostrar la última versión recibida al salir del campo.
            draftRef.current = confirmedRef.current;
            setDraft(confirmedRef.current);
          }
        }}
        onKeyDown={event => {
          if (event.key === 'Enter') event.currentTarget.blur();
        }}
        className={'w-full min-w-0 max-w-full rounded-lg bg-zinc-800 py-2 px-1 text-center text-base font-bold text-white outline-none focus:ring-1 focus:ring-yellow-400 disabled:opacity-50 ' +
          (state === 'error' ? 'ring-1 ring-red-500' : '')}/>
      {state === 'error' && (
        <button type="button" onClick={saveDraft} title={error}
          className="mt-1 w-full text-[10px] leading-tight text-red-300 underline">
          Reintentar
        </button>
      )}
      <span className="sr-only" role="status" aria-live="polite">
        {state === 'saving' ? 'Guardando ' + label :
          state === 'error' ? error : ''}
      </span>
    </div>
  );
}
