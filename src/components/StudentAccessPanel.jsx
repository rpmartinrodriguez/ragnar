import React, { useMemo, useState } from 'react';
import { Check, Copy, KeyRound, Search, ShieldCheck, ShieldAlert, Users, UserPlus, X } from 'lucide-react';
import { activateStudentAccount } from '../utils/activateStudentAccount';
import { getAuth } from 'firebase/auth';

function hasEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export default function StudentAccessPanel({ clients = [], onOpenClients }) {
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(null);
  const [notice, setNotice] = useState(null);
  const [issued, setIssued] = useState(null);
  const [copied, setCopied] = useState(false);
  const [copiedPassword, setCopiedPassword] = useState(false);

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

  const activate = async (client) => {
    if (issued || busy) return;
    if (!window.confirm(
      '¿Crear un acceso NUEVO para ' + (client.name || 'este alumno') +
      '?\n\nSe generará un UID nuevo, pero mantendremos exactamente la misma ficha, sesiones, mensajes y pagos. La contraseña temporal solo se mostrará una vez. Primero probá con un único alumno.'
    )) return;
    setBusy(client.id);
    setNotice(null);
    try {
      const result = await activateStudentAccount(client);
      setIssued({ ...result, name: client.name || 'Alumno' });
      setCopied(false);
      setCopiedPassword(false);
    } catch (error) {
      setNotice({ id: client.id, success: false, text: error?.message || 'No se pudo activar la cuenta.' });
    } finally {
      setBusy(null);
    }
  };

  const resetPassword = async (client) => {
    if (issued || busy) return;
    if (!window.confirm(
      '¿Querés generar otra contraseña temporal para ' + (client.name || 'este alumno') +
      '?\n\nLa contraseña anterior dejará de servir. No se creará otra cuenta ni se alterará su historial.'
    )) return;
    setBusy(client.id);
    setNotice(null);
    try {
      const auth = getAuth();
      if (auth.app.options.projectId !== 'ragnar-5f8d7' || !auth.currentUser) {
        throw new Error('Iniciá sesión en Ragnar de prueba con tu usuario entrenador.');
      }
      const bearer = await auth.currentUser.getIdToken(true);
      const response = await fetch('/.netlify/functions/reset-student-password', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: 'Bearer ' + bearer
        },
        cache: 'no-store',
        body: JSON.stringify({clientId:client.id})
      });
      let result;
      try { result = await response.json(); }
      catch {
        throw new Error('La función de recuperación no respondió correctamente. Revisá el deploy de Netlify.');
      }
      if (!response.ok || !result?.success || !result?.password) {
        throw new Error(result?.error || 'No fue posible generar otra contraseña.');
      }
      setIssued({
        ...result,
        name: client.name || 'Alumno',
        mode: 'reset'
      });
      setCopied(false);
      setCopiedPassword(false);
    } catch (error) {
      setNotice({
        id: client.id,
        success:false,
        text: error?.message || 'No se pudo restablecer la contraseña.'
      });
    } finally {
      setBusy(null);
    }
  };

  const copyPasswordOnly = async () => {
    if (!issued) return;
    try {
      await navigator.clipboard.writeText(issued.password);
      setCopiedPassword(true);
    } catch {
      setNotice({ id: issued.clientId, success: false, text: 'No se pudo copiar automáticamente la contraseña. Seleccioná solo el texto de la clave.' });
    }
  };

  const copyCredentials = async () => {
    if (!issued) return;
    const text = 'RAGNAR TRAINING\n' +
      'Alumno: ' + issued.name + '\n' +
      'Ingresá desde: ' + window.location.origin + '/\n' +
      'Usuario: ' + issued.email + '\n' +
      'Contraseña temporal: ' + issued.password + '\n\n' +
      'Este es el enlace de PRUEBA; no instales todavía la PWA definitiva. ' +
      'No uses la aplicación antigua. Cambiá la clave desde Mi Perfil una vez que entres.';
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch (error) {
      setCopied(false);
      setCopiedPassword(false);
      setNotice({ id: issued.clientId, success: false, text: 'No se pudieron copiar automáticamente las credenciales; copialas manualmente antes de cerrar.' });
    }
  };

  return (
    <section className="max-w-5xl mx-auto space-y-5 pb-20">
      <div>
        <h2 className="text-2xl font-black uppercase text-white flex items-center gap-3"><Users size={25} className="text-yellow-400"/> Accesos de alumnos</h2>
        <p className="text-sm text-zinc-400 mt-2">Activá alumnos en el Firebase nuevo conservando su ficha e historial original.</p>
      </div>

      <div className="border border-yellow-400/30 bg-zinc-900 rounded-2xl p-4 text-sm text-zinc-300 space-y-2">
        <p className="text-yellow-300 font-bold flex gap-2 items-center"><ShieldCheck size={18}/> Activación sin perder entrenamientos</p>
        <p>Para cada alumno creamos un usuario de Authentication nuevo y asociamos su UID a la misma ficha Firestore. <strong>No modificamos el ID de la ficha, las sesiones, los pagos ni los mensajes anteriores.</strong> El UID original se conserva como «UID histórico».</p>
        <p>El correo de acceso puede ser una dirección ficticia válida y única, pero no recibirá emails de recuperación. La contraseña temporal solo se muestra una vez. Si se pierde, necesitaremos la recuperación administrativa segura.</p>
        <p className="text-amber-300 text-xs font-bold flex gap-2 items-start"><ShieldAlert size={16}/> Por ahora activá solamente un alumno de prueba, de quien tengas autorización. No envíes credenciales a todos hasta validar el ingreso y publicar la versión definitiva.</p>
        <button type="button" onClick={onOpenClients} className="text-yellow-300 font-bold hover:underline text-sm">
          Ir a Mis Atletas para editar correos
        </button>
      </div>

      <div className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3">
        <Search size={18} className="text-zinc-500"/>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar alumno por nombre o correo" className="bg-transparent outline-none w-full text-white text-sm"/>
        <span className="text-xs text-zinc-500">{filtered.length}/{clients.length}</span>
      </div>

      <div className="space-y-3">
        {filtered.map(client => {
          const valid = hasEmail(client.email);
          const activated = client.accountAccessStatus === 'activated';
          const oldUid = client.legacyStudentUserId || (!activated ? client.studentUserId : null);
          return (
            <div key={client.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3">
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div className="min-w-0">
                  <p className="text-white font-bold text-base">{client.name || 'Alumno sin nombre'}</p>
                  <p className="text-sm text-zinc-300 break-all">{client.email || 'Sin correo registrado'}</p>
                  {oldUid && <p className="text-xs text-zinc-500 mt-1 break-all">UID histórico: {oldUid}</p>}
                </div>
                <span className={activated
                  ? 'text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 text-xs rounded-full px-3 py-1'
                  : 'text-amber-300 bg-amber-500/10 border border-amber-500/20 text-xs rounded-full px-3 py-1'}>
                  {activated ? 'Activado en Ragnar nuevo' : 'Pendiente de activar'}
                </span>
              </div>

              {!activated && (
                <button disabled={!valid || !!busy || !!issued} type="button" onClick={() => activate(client)}
                  className="inline-flex items-center gap-2 px-4 py-3 bg-yellow-400 text-black rounded-lg text-xs font-black hover:bg-yellow-300 disabled:opacity-40">
                  <UserPlus size={16}/> {busy === client.id ? 'Creando cuenta...' : 'Activar cuenta y generar clave temporal'}
                </button>
              )}
              {!valid && <p className="text-xs text-amber-300">Este alumno necesita una dirección de acceso válida y única. Editala en Mis Atletas.</p>}
              {activated && (
                <div className="space-y-2">
                  <p className="text-xs text-zinc-400">La ficha está vinculada a un UID nuevo, pero eso no garantiza que la última clave copiada sea correcta. Podés generar otra clave temporal sin perder el historial.</p>
                  <button type="button" disabled={!!busy || !!issued} onClick={() => resetPassword(client)}
                    className="inline-flex items-center gap-2 px-4 py-3 rounded-lg border border-yellow-400/30 text-yellow-300 text-xs font-black hover:bg-yellow-400/10 disabled:opacity-40">
                    <KeyRound size={16}/>{busy === client.id ? 'Restableciendo...' : 'Generar otra contraseña temporal'}
                  </button>
                </div>
              )}
              {notice?.id === client.id && <p role="status" className={'text-xs p-3 rounded-lg ' + (notice.success ? 'bg-emerald-500/10 text-emerald-300' : 'bg-red-500/10 text-red-300')}>{notice.text}</p>}
            </div>
          );
        })}
        {filtered.length === 0 && <p className="text-center text-zinc-500 rounded-xl border border-zinc-800 p-8">No se encontraron alumnos con ese filtro.</p>}
      </div>

      {issued && (
        <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4">
          <div role="dialog" aria-modal="true" aria-label="Credenciales de alumno" className="max-w-lg w-full bg-zinc-950 border border-yellow-400/40 shadow-2xl rounded-2xl p-5 sm:p-7 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-xl font-black text-yellow-400">{issued.mode === 'reset' ? '¡Nueva clave generada!' : '¡Alumno activado!'}</h3>
                <p className="text-sm text-zinc-300">{issued.name}</p>
              </div>
              <button type="button" onClick={() => {
                if (window.confirm('La contraseña se perderá al cerrar esta ventana. ¿Ya la copiaste y guardaste en un lugar seguro?')) setIssued(null);
              }} className="p-2 text-zinc-400" title="Cerrar"><X size={20}/></button>
            </div>
            <p className="text-sm text-emerald-300">{issued.mode === 'reset' ? 'La contraseña anterior dejó de funcionar. La ficha y su historial no cambiaron.' : 'La ficha y todo el historial permanecen intactos. La cuenta nueva ya quedó vinculada al alumno.'}</p>
            <div className="space-y-2 text-sm">
              <div className="rounded-xl border border-zinc-800 bg-black p-3">
                <p className="text-xs text-zinc-500">Usuario</p>
                <p className="font-mono select-all break-all text-white">{issued.email}</p>
              </div>
              <div className="rounded-xl border border-zinc-800 bg-black p-3">
                <p className="text-xs text-zinc-500">Contraseña temporal · mostrar una sola vez</p>
                <p className="font-mono select-all break-all text-white text-lg tracking-wider">{issued.password}</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button onClick={copyPasswordOnly} type="button" className="w-full flex justify-center items-center gap-2 rounded-xl py-3 bg-yellow-400 text-black font-black text-sm">
                {copiedPassword ? <Check size={18}/> : <KeyRound size={18}/>}
                {copiedPassword ? 'Clave copiada' : 'Copiar solo contraseña'}
              </button>
              <button onClick={copyCredentials} type="button" className="w-full flex justify-center items-center gap-2 rounded-xl py-3 border border-yellow-400/40 text-yellow-300 font-bold text-xs">
                {copied ? <Check size={18}/> : <Copy size={18}/>}
                {copied ? 'Datos copiados' : 'Copiar todos los datos'}
              </button>
            </div>
            <p className="text-xs text-zinc-400">La contraseña no se almacena en Ragnar ni se puede volver a visualizar. Pasala directamente al alumno y pedile que la cambie desde su perfil. El enlace que se copia corresponde a ESTA versión de prueba; no lo compartas masivamente ni pidas instalar la PWA hasta validar y publicar la versión definitiva.</p>
          </div>
        </div>
      )}
    </section>
  );
}
