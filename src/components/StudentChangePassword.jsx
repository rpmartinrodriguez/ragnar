import React, { useState } from 'react';
import { KeyRound, ShieldCheck } from 'lucide-react';
import {
  getAuth, EmailAuthProvider, reauthenticateWithCredential, updatePassword
} from 'firebase/auth';

export default function StudentChangePassword() {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [repeat, setRepeat] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState('');

  const update = async e => {
    e.preventDefault();
    setFeedback('');
    if (next.length < 10) return setFeedback('Elegí una contraseña de al menos 10 caracteres.');
    if (current === next) return setFeedback('La contraseña nueva debe ser distinta de la actual.');
    if (next !== repeat) return setFeedback('Las nuevas contraseñas no coinciden.');
    const user = getAuth().currentUser;
    if (!user?.email) return setFeedback('Volvé a iniciar sesión con tu usuario.');
    setBusy(true);
    try {
      // Pedimos la contraseña actual para autorizar esta acción sensible.
      const credential = EmailAuthProvider.credential(user.email, current);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, next);
      setCurrent('');
      setNext('');
      setRepeat('');
      setFeedback('¡Contraseña actualizada! Guardala en un lugar seguro.');
    } catch (error) {
      setFeedback(error?.code === 'auth/invalid-credential' || error?.code === 'auth/wrong-password'
        ? 'La contraseña actual es incorrecta.'
        : 'No se pudo cambiar la contraseña: ' + (error?.code || error?.message || 'error'));
    } finally { setBusy(false); }
  };

  return (
    <form onSubmit={update} className="bg-zinc-900 rounded-[2rem] p-6 border border-yellow-400/30 shadow-xl space-y-4">
      <h3 className="font-bold uppercase text-white flex items-center gap-2">
        <KeyRound size={20} className="text-yellow-400"/> Mi contraseña
      </h3>
      <p className="text-sm text-zinc-400">Si el entrenador te entregó una clave temporal, cambiala por una privada que solo conozcas vos. No necesitás un correo real.</p>
      <div className="space-y-2">
        <label className="block text-xs text-zinc-400">Contraseña actual o temporal</label>
        <input required autoComplete="current-password" type="password" value={current} onChange={e=>setCurrent(e.target.value)} className="w-full rounded-xl bg-black border border-zinc-700 p-3 text-white" />
      </div>
      <div className="space-y-2">
        <label className="block text-xs text-zinc-400">Contraseña nueva (al menos 10 caracteres)</label>
        <input required autoComplete="new-password" type="password" minLength={10} value={next} onChange={e=>setNext(e.target.value)} className="w-full rounded-xl bg-black border border-zinc-700 p-3 text-white" />
      </div>
      <div className="space-y-2">
        <label className="block text-xs text-zinc-400">Confirmar contraseña nueva</label>
        <input required autoComplete="new-password" type="password" minLength={10} value={repeat} onChange={e=>setRepeat(e.target.value)} className="w-full rounded-xl bg-black border border-zinc-700 p-3 text-white" />
      </div>
      <button disabled={busy} type="submit" className="w-full bg-yellow-400 text-black font-black py-3 rounded-xl disabled:opacity-40 inline-flex items-center justify-center gap-2">
        <ShieldCheck size={19}/> {busy ? 'Guardando...' : 'Cambiar contraseña'}
      </button>
      {feedback && <p role="status" className="text-sm text-zinc-300">{feedback}</p>}
    </form>
  );
}
