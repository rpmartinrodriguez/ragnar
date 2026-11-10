import React, { useState } from 'react';
import { Eye, Save, X } from 'lucide-react';
import { COACH_NOTE_MAX, validateCoachNote } from '../utils/coachExerciseNote';
import { explainCoachSaveError } from '../utils/coachSafeEdits';

export default function CoachExerciseNoteEditor({ exerciseName, initialValue = '', onSave, onClose }) {
  const [text, setText] = useState(initialValue);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const save = async (event) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true); setError('');
    try {
      await onSave(validateCoachNote(text));
      onClose();
    } catch (err) {
      setError(explainCoachSaveError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] bg-black/90 backdrop-blur-sm p-3 flex items-center justify-center">
      <form onSubmit={save} role="dialog" aria-modal="true" aria-label={'Nota del coach para ' + exerciseName}
        className="w-full max-w-lg max-h-[90dvh] overflow-y-auto rounded-3xl bg-zinc-950 border border-zinc-700 p-5 sm:p-7 shadow-2xl space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-xl font-black text-white flex items-center gap-2"><Eye size={20} className="text-red-400" /> Nota para el alumno</h3>
            <p className="text-sm text-zinc-400 mt-2">Ejercicio: <strong className="text-white">{exerciseName}</strong></p>
          </div>
          <button type="button" onClick={onClose} disabled={saving} aria-label="Cerrar editor de nota"
            className="p-2 rounded-xl bg-zinc-800 text-zinc-300 hover:text-white disabled:opacity-50"><X size={19}/></button>
        </div>
        <p className="text-xs text-zinc-400">El alumno verá un ojo rojo junto al ejercicio. La nota solo se desplegará cuando lo toque, sin ventanas emergentes.</p>
        <label className="block text-xs text-zinc-300 font-bold" htmlFor="coach-exercise-note">
          Indicación técnica o recordatorio
        </label>
        <textarea id="coach-exercise-note" rows={5} autoFocus maxLength={COACH_NOTE_MAX}
          placeholder="Ej.: Mantener la espalda neutra y controlar la bajada durante 3 segundos."
          value={text} onChange={event => setText(event.target.value)}
          className="w-full rounded-xl bg-black border border-zinc-700 p-3 text-white text-base outline-none focus:border-yellow-400 resize-y" />
        <div className="flex items-center justify-between text-xs text-zinc-500">
          <span>Dejá vacío y guardá para quitar la nota.</span>
          <span>{text.length}/{COACH_NOTE_MAX}</span>
        </div>
        {error && <p role="alert" className="text-red-300 text-sm">{error}</p>}
        <div className="flex gap-3">
          <button type="button" disabled={saving} onClick={onClose}
            className="flex-1 py-3 rounded-xl bg-zinc-800 text-white font-bold disabled:opacity-50">Cancelar</button>
          <button type="submit" disabled={saving}
            className="flex-1 py-3 rounded-xl bg-yellow-400 text-black font-black flex items-center justify-center gap-2 disabled:opacity-50">
            <Save size={17}/>{saving ? 'Guardando...' : 'Guardar nota'}
          </button>
        </div>
      </form>
    </div>
  );
}
