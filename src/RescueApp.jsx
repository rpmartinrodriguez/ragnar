import React, { useEffect, useState } from 'react';
import { AlertTriangle, ShieldCheck } from 'lucide-react';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { db } from './firebase';
import DataBackupPanel from './components/DataBackupPanel';

function explainError(error) {
  if (error?.code === 'auth/unauthorized-domain') {
    return 'Firebase no autoriza este dominio. Necesitamos habilitarlo desde la consola del proyecto original.';
  }
  if (error?.code === 'auth/invalid-credential') {
    return 'Credenciales incorrectas. Usá el correo y contraseña con los que ingresás a Ragnar.';
  }
  return (error?.message || 'Falló la conexión') + (error?.code ? ' (' + error.code + ')' : '');
}

export default function RescueApp() {
  const auth = getAuth();
  const [account, setAccount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [problem, setProblem] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => onAuthStateChanged(auth,
    user => { setAccount(user); setLoading(false); },
    error => { setProblem(explainError(error)); setLoading(false); }
  ), [auth]);

  const login = async event => {
    event.preventDefault();
    setProblem('');
    setSubmitting(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      setPassword('');
    } catch (err) {
      setProblem(explainError(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white px-4 py-12">
      <main className="mx-auto max-w-3xl space-y-6">
        <header className="flex items-center gap-4 border-b border-zinc-800 pb-6">
          <img src="/logo.png" alt="Ragnar Training" className="w-16 h-16 object-contain" />
          <div>
            <p className="text-xs uppercase tracking-wider text-yellow-400 font-black">Rescate independiente</p>
            <h1 className="text-2xl font-black uppercase italic">Ragnar Training</h1>
            <p className="text-xs text-zinc-500">Proyecto Firebase: {db.app.options.projectId}</p>
          </div>
        </header>
        <section className="rounded-2xl bg-zinc-950 border border-zinc-800 p-5 space-y-3">
          <p className="flex gap-2 font-bold text-yellow-400"><ShieldCheck size={20}/> Exportación de solo lectura</p>
          <p className="text-sm text-zinc-300">Esta página funciona independientemente del resto de la app. No modifica la base original. Solo puede consultar los documentos que las reglas de Firebase permiten a tu usuario.</p>
          <p className="flex items-start gap-2 text-xs text-amber-300"><AlertTriangle size={16} className="shrink-0"/>El respaldo puede contener información personal de alumnos. Guardalo en forma privada y nunca lo subas a GitHub.</p>
        </section>
        {loading ? (
          <div className="p-6 text-zinc-400">Comprobando sesión de Ragnar...</div>
        ) : !account ? (
          <form onSubmit={login} className="rounded-2xl p-6 border border-zinc-800 bg-zinc-950 space-y-4">
            <h2 className="font-bold text-lg">Iniciar sesión en Ragnar</h2>
            <input className="w-full bg-black rounded-lg border border-zinc-700 p-3 text-white" type="email" required placeholder="Correo del entrenador" value={email} onChange={e => setEmail(e.target.value)}/>
            <input className="w-full bg-black rounded-lg border border-zinc-700 p-3 text-white" type="password" required placeholder="Contraseña de Ragnar" value={password} onChange={e => setPassword(e.target.value)}/>
            <button disabled={submitting} className="px-5 py-3 rounded-lg bg-yellow-400 text-black font-bold disabled:opacity-50" type="submit">{submitting ? 'Ingresando...' : 'Iniciar sesión'}</button>
          </form>
        ) : (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-800 p-4">
              <div>
                <p className="text-xs text-zinc-500">Sesión activa</p>
                <p className="text-sm font-bold">{account.email}</p>
              </div>
              <button className="rounded-lg bg-zinc-800 px-4 py-2 text-sm" type="button" onClick={() => signOut(auth)}>Cerrar sesión</button>
            </div>
            <DataBackupPanel />
          </div>
        )}
        {problem && <p role="alert" className="rounded-xl p-3 border border-red-500/30 bg-red-500/10 text-red-300 text-sm">{problem}</p>}
      </main>
    </div>
  );
}
