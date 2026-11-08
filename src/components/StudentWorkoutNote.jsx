import React, { useEffect, useRef, useState } from 'react';
import { MessageSquareText, Save, CheckCircle2, AlertCircle } from 'lucide-react';
import { doc, getDocFromServer, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { notifyCoachAboutStudentEvent } from '../utils/ragnarPush';

const MAX_NOTE_LENGTH = 600;

/**
 * Un comentario por sesión. El dato vive en clients/{clientId}/sessions/{dateId}
 * y no reemplaza ejercicios, pesos, series ni mensajes del chat.
 */
export default function StudentWorkoutNote({ clientId, dateId }) {
  const [draft, setDraft] = useState('');
  const [stored, setStored] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState(null);
  const dirtyRef = useRef(false);
  const currentRef = useRef(null);

  useEffect(() => {
    dirtyRef.current = false;
    currentRef.current = dateId;
    setDraft('');
    setStored('');
    setNotice(null);
    setLoading(true);
    const sessionRef = doc(db, 'clients', clientId, 'sessions', dateId);
    const unsubscribe = onSnapshot(sessionRef, snapshot => {
      const content = snapshot.exists() ? String(snapshot.data().studentNote || '') : '';
      setStored(content);
      if (!dirtyRef.current) setDraft(content);
      setLoading(false);
    }, error => {
      setLoading(false);
      setNotice({ error: true, text: 'No se pudieron cargar las observaciones: ' + (error?.code || 'error de conexión') });
    });
    return () => unsubscribe();
  }, [clientId, dateId]);

  const save = async (event) => {
    event.preventDefault();
    if (saving || loading || draft.length > MAX_NOTE_LENGTH) return;
    const text = draft.trim();
    if (text === stored.trim()) return;
    setSaving(true);
    setNotice(null);
    const sessionId = dateId;
    try {
      const sessionRef = doc(db, 'clients', clientId, 'sessions', sessionId);
      // No crear sesiones vacías por error cuando el entrenador cambia de fecha.
      const serverSnapshot = await getDocFromServer(sessionRef);
      if (!serverSnapshot.exists() || !Array.isArray(serverSnapshot.data().exercises) ||
          serverSnapshot.data().exercises.length === 0) {
        throw new Error('Este día ya no tiene una rutina disponible. Actualizá y comprobá la fecha.');
      }
      await setDoc(sessionRef, {
        studentNote: text,
        studentNoteUpdatedAt: serverTimestamp()
      }, { merge: true });
      // Evitar pintar la respuesta de otra fecha si el alumno navegó durante el guardado.
      if (currentRef.current === sessionId) {
        setStored(text);
        setDraft(text);
        dirtyRef.current = false;
        setNotice({error:false, text:'Observación guardada en tu entrenamiento.'});
      }
      if (text) void notifyCoachAboutStudentEvent('student_note', clientId, sessionId);
    } catch (error) {
      if (currentRef.current === sessionId) {
        setNotice({error:true,text: 'No se pudo guardar la observación: ' + (error?.message || 'revisá tu conexión')});
      }
    } finally {
      setSaving(false);
    }
  };

  const changed = draft.trim() !== stored.trim();
  return (
    <form onSubmit={save} className="rounded-2xl border border-yellow-400/20 bg-zinc-900/70 p-4 sm:p-5 space-y-3">
      <div className="flex gap-2 items-start">
        <MessageSquareText className="text-yellow-400 shrink-0" size={20}/>
        <div>
          <h3 className="text-white font-black uppercase text-sm">Mis observaciones</h3>
          <p className="text-xs text-zinc-400 mt-1">Contale a tu entrenador cómo te fue, qué peso te costó o cómo te sentiste. La nota queda guardada en este día.</p>
        </div>
      </div>
      <label htmlFor="ragnar-student-note" className="sr-only">Observaciones del entrenamiento</label>
      <textarea id="ragnar-student-note" rows={3} maxLength={MAX_NOTE_LENGTH}
        disabled={loading || saving} value={draft}
        onChange={e => {dirtyRef.current = true;setDraft(e.target.value);setNotice(null);}}
        placeholder={loading ? 'Cargando observaciones...' : 'Ej.: La última serie me costó bastante. Quiero ajustar la carga.'}
        className="w-full bg-zinc-950 border border-zinc-700 focus:border-yellow-400 rounded-xl p-3 text-sm text-white placeholder:text-zinc-500 outline-none resize-y disabled:opacity-50"
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-zinc-500">{draft.length}/{MAX_NOTE_LENGTH} caracteres</span>
        <button type="submit" disabled={!changed || loading || saving}
          className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-yellow-400 text-black font-black text-xs disabled:opacity-40 disabled:cursor-not-allowed">
          <Save size={16}/>{saving ? 'Guardando...' : 'Guardar observación'}
        </button>
      </div>
      {notice && <p role={notice.error ? 'alert' : 'status'} className={'flex gap-2 text-xs rounded-xl p-3 ' +
        (notice.error ? 'bg-red-500/10 text-red-300' : 'bg-emerald-500/10 text-emerald-300')}>
        {notice.error ? <AlertCircle size={16}/> : <CheckCircle2 size={16}/>} {notice.text}
      </p>}
    </form>
  );
}
