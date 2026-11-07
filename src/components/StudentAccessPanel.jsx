import React, { useMemo, useState } from 'react';
import { Check, Copy, KeyRound, Mail, Search, ShieldAlert, Users } from 'lucide-react';
import { getAuth, sendPasswordResetEmail } from 'firebase/auth';

function hasEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export default function StudentAccessPanel({ clients = [], onOpenClients }) {
  const [search, setSearch] = useState('');
  const [sending, setSending] = useState(null);
  const [notice, setNotice] = useState(null);
  const [copied, setCopied] = useState(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const ordered = [...clients].sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'es'));
    if (!q) return ordered;
    return ordered.filter(c =>
      String(c.name || '').toLowerCase().includes(q) ||
      String(c.email || '').toLowerCase().includes(q) ||
      String(c.id || '').toLowerCase().includes(q)
    );
  }, [clients, search]);

  const copyEmail = async (client) => {
    try {
      await navigator.clipboard.writeText(client.email.trim());
      setCopied(client.id);
      setNotice({ id: client.id, success: true, text: 'Correo copiado para compartir información de acceso.' });
    } catch {
      setNotice({ id: client.id, success: false, text: 'No pude copiar automáticamente. Seleccioná el correo para copiarlo.' });
    }
  };

  const requestReset = async (client) => {
    const email = String(client.email || '').trim();
    if (!hasEmail(email)) {
      setNotice({ id: client.id, success: false, text: 'La ficha no tiene un correo válido. Corregilo primero en Mis Atletas.' });
      return;
    }
    if (!window.confirm('¿Solicitar a Firebase un enlace de restablecimiento para ' + client.name + ' (' + email + ')? El correo llegará directamente al alumno, si tiene una cuenta en Authentication del Firebase nuevo.')) return;

    setNotice(null);
    setSending(client.id);
    try {
      const auth = getAuth();
      // Nunca modificar la contraseña del entrenador ni recibir contraseñas del alumno.
      if (auth.app.options.projectId !== 'ragnar-5f8d7') {
        throw new Error('La app no está conectada al Firebase nuevo. Operación cancelada.');
      }
      auth.languageCode = 'es';
      await sendPasswordResetEmail(auth, email);
      setNotice({
        id: client.id, success: true,
        text: 'Firebase procesó la solicitud. Si esta cuenta existe en Authentication, enviará un enlace al correo del alumno. Esto NO verifica que el mensaje se haya recibido.'
      });
    } catch (error) {
      const reason = error?.code === 'auth/too-many-requests'
        ? 'Se alcanzó el límite de solicitudes. Probá más tarde.'
        : error?.code === 'auth/invalid-email'
          ? 'El correo no es válido.'
          : 'No se pudo solicitar el restablecimiento: ' + (error?.code || error?.message || 'error');
      setNotice({ id: client.id, success: false, text: reason });
    } finally {
      setSending(null);
    }
  };

  return (
    <section className="max-w-5xl mx-auto space-y-5 pb-20">
      <div>
        <h2 className="text-2xl font-black uppercase text-white flex items-center gap-3"><Users size={25} className="text-yellow-400"/> Accesos de alumnos</h2>
        <p className="text-sm text-zinc-400 mt-2">Gestioná cómo recuperan su acceso al nuevo Ragnar. No se consultan ni almacenan contraseñas.</p>
      </div>

      <div className="border border-yellow-400/30 bg-zinc-900 rounded-2xl p-4 text-sm text-zinc-300 space-y-2">
        <p className="text-yellow-300 font-bold flex gap-2 items-center"><ShieldAlert size={18}/> Migración de cuentas</p>
        <p>El UID que aparece en la ficha es un dato recuperado de Firestore, <strong>no confirma que la cuenta de Authentication exista en el Firebase nuevo</strong>. Primero hay que recrear o vincular las cuentas de los alumnos.</p>
        <p>Firebase no permite ver contraseñas anteriores. El entrenador puede enviar un correo de restablecimiento; cada alumno define su contraseña de manera privada.</p>
        <button type="button" onClick={onOpenClients} className="text-yellow-300 font-bold hover:underline text-sm">
          Ir a Mis Atletas para editar las fichas
        </button>
        <p className="text-xs text-zinc-500">Editar el correo de una ficha no cambia automáticamente el correo de Firebase Authentication.</p>
      </div>

      <div className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3">
        <Search size={18} className="text-zinc-500"/>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar alumno por nombre o correo" className="bg-transparent outline-none w-full text-white text-sm"/>
        <span className="text-xs text-zinc-500">{filtered.length}/{clients.length}</span>
      </div>

      <div className="space-y-3">
        {filtered.map(client => {
          const valid = hasEmail(client.email);
          const uid = typeof client.studentUserId === 'string' && client.studentUserId.trim() ? client.studentUserId : null;
          return (
            <div key={client.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3">
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div className="min-w-0">
                  <p className="text-white font-bold text-base">{client.name || 'Alumno sin nombre'}</p>
                  <p className="text-sm text-zinc-300 break-all">{client.email || 'Sin correo registrado'}</p>
                  <p className="text-xs text-zinc-500 mt-1">{uid ? 'UID antiguo en ficha: ' + uid : 'Sin UID de alumno en la ficha'}</p>
                </div>
                <span className={uid ? 'text-amber-300 bg-amber-500/10 border border-amber-500/20 text-xs rounded-full px-3 py-1' : 'text-zinc-400 border border-zinc-700 rounded-full text-xs px-3 py-1'}>
                  {uid ? 'Autenticación pendiente de verificar' : 'Vinculación pendiente'}
                </span>
              </div>
              <div className="flex gap-2 flex-wrap">
                <button disabled={!valid || !!sending} type="button" onClick={()=>requestReset(client)} className="inline-flex items-center gap-2 px-3 py-2 bg-yellow-400 text-black rounded-lg text-xs font-bold hover:bg-yellow-300 disabled:opacity-40">
                  <KeyRound size={15}/> {sending === client.id ? 'Solicitando...' : 'Enviar recuperación de contraseña'}
                </button>
                <button disabled={!valid || !!sending} type="button" onClick={()=>copyEmail(client)} className="inline-flex items-center gap-2 rounded-lg border border-zinc-600 text-zinc-200 px-3 py-2 text-xs hover:bg-zinc-800 disabled:opacity-40">
                  {copied === client.id ? <Check size={15}/> : <Copy size={15}/>} Copiar correo
                </button>
              </div>
              {notice?.id === client.id && <p role="status" className={'text-xs p-3 rounded-lg ' + (notice.success ? 'bg-emerald-500/10 text-emerald-300' : 'bg-red-500/10 text-red-300')}>{notice.text}</p>}
            </div>
          );
        })}
        {filtered.length === 0 && <p className="text-center text-zinc-500 rounded-xl border border-zinc-800 p-8">No se encontraron alumnos con ese filtro.</p>}
      </div>
    </section>
  );
}
