import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Database, FileJson, LockKeyhole, Upload } from 'lucide-react';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { db } from './firebase';
import { importRagnarBackup, validateRagnarBackup } from './utils/importRagnarBackup';

const TARGET = 'ragnar-5f8d7';

export default function MigrationApp() {
  const auth = getAuth();
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [signinError, setSigninError] = useState('');
  const [fileName, setFileName] = useState('');
  const [parsed, setParsed] = useState(null);
  const [fileError, setFileError] = useState('');
  const [ack, setAck] = useState(false);
  const [confirmId, setConfirmId] = useState('');
  const [progress, setProgress] = useState('');
  const [importError, setImportError] = useState('');
  const [result, setResult] = useState(null);
  const [running, setRunning] = useState(false);

  useEffect(() => onAuthStateChanged(auth, (current) => {
    setSession(current);
    setLoading(false);
  }, (error) => {
    setSigninError(error.message);
    setLoading(false);
  }), [auth]);

  const signin = async (e) => {
    e.preventDefault();
    setSigninError('');
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      setPassword('');
    } catch (error) {
      setSigninError((error.code || '') + ': ' + error.message);
    }
  };

  const pickFile = async (event) => {
    const file = event.target.files?.[0];
    setParsed(null);
    setFileError('');
    setProgress('');
    setImportError('');
    setResult(null);
    setAck(false);
    setConfirmId('');
    setFileName(file?.name || '');
    if (!file) return;
    if (file.size > 200 * 1024 * 1024) {
      setFileError('El archivo supera 200 MB. Se necesita un procedimiento de importación por lotes desde la PC.');
      return;
    }
    try {
      const text = await file.text();
      setParsed(validateRagnarBackup(text));
    } catch (error) {
      setFileError(error.message || 'No pude leer el archivo.');
    }
  };

  const importedGroups = useMemo(() => {
    if (!parsed) return [];
    const roots = {};
    for (const [path, count] of Object.entries(parsed.counts)) {
      const root = path.split('/').length > 2 ? path.split('/').pop() : path;
      roots[root] = (roots[root] || 0) + count;
    }
    return Object.entries(roots).sort((a, b) => a[0].localeCompare(b[0]));
  }, [parsed]);

  const startImport = async () => {
    if (!session || !parsed || running || confirmId !== TARGET || !ack) return;
    if (!window.confirm('¿Confirmás importar ' + parsed.backup.totalDocuments +
      ' documentos al proyecto ' + TARGET + '? Esta operación escribe datos en el FIREBASE NUEVO.')) return;
    setRunning(true);
    setImportError('');
    setProgress('Comprobando permisos y que Firestore nuevo esté vacío...');
    try {
      const summary = await importRagnarBackup({
        db,
        authUser: session,
        backup: parsed.backup,
        counts: parsed.counts,
        onProgress: setProgress
      });
      setResult(summary);
    } catch (error) {
      setImportError(error.message || 'Falló la importación.');
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-zinc-100 px-4 py-8 md:py-14">
      <main className="max-w-3xl mx-auto space-y-6">
        <header className="flex items-center gap-4 border-b border-zinc-800 pb-6">
          <img src="/logo.png" alt="Ragnar" className="w-16 h-16 object-contain"/>
          <div>
            <p className="text-yellow-400 font-black uppercase tracking-wider text-xs">Migración controlada</p>
            <h1 className="text-2xl md:text-3xl font-black italic">RAGNAR TRAINING</h1>
            <p className="text-sm text-zinc-400">Firebase destino: <strong className="text-yellow-300">{db.app.options.projectId}</strong></p>
          </div>
        </header>

        <section className="p-5 rounded-xl bg-zinc-950 border border-zinc-700 space-y-2">
          <p className="flex gap-2 items-center font-bold"><LockKeyhole size={18} className="text-yellow-400"/> Información importante</p>
          <p className="text-sm text-zinc-300">Esta página solamente escribe en el nuevo Firebase <strong>{TARGET}</strong>. No modifica el proyecto original. El JSON se lee desde tu PC y se envía directamente a tu cuenta Firebase, sin pasar por ningún servidor nuestro.</p>
          <p className="text-sm text-amber-300 flex gap-2 items-start"><AlertTriangle size={18} className="shrink-0"/> No importa cuentas ni contraseñas de Firebase Authentication. Después tendremos que reconstruir los accesos de alumnos conservando sus UID o ajustando sus vinculaciones. No cambies todavía la app que funciona.</p>
        </section>

        {loading ? <p className="p-5">Comprobando sesión...</p> : !session ? (
          <form onSubmit={signin} className="space-y-4 p-6 border border-zinc-800 bg-zinc-950 rounded-xl">
            <h2 className="text-lg font-bold">1. Entrar al Firebase NUEVO</h2>
            <p className="text-sm text-zinc-400">Creá primero tu usuario entrenador en Authentication del proyecto nuevo y el documento <code className="text-yellow-300">coaches/UID</code> con <code className="text-yellow-300">enabled=true</code> en Firestore.</p>
            <input required type="email" autoComplete="username" placeholder="Correo entrenador en nuevo Firebase" value={email} onChange={e=>setEmail(e.target.value)} className="p-3 rounded-lg bg-zinc-900 border border-zinc-700 w-full"/>
            <input required type="password" autoComplete="current-password" placeholder="Contraseña de la cuenta NUEVA" value={password} onChange={e=>setPassword(e.target.value)} className="p-3 rounded-lg bg-zinc-900 border border-zinc-700 w-full"/>
            <button className="rounded-lg bg-yellow-400 hover:bg-yellow-300 text-black font-black px-5 py-3" type="submit">Iniciar sesión</button>
            {signinError && <p role="alert" className="text-sm text-red-300">{signinError}</p>}
          </form>
        ) : (
          <div className="space-y-6">
            <section className="p-5 bg-zinc-950 border border-zinc-800 rounded-xl">
              <div className="flex gap-3 items-center justify-between">
                <div>
                  <p className="font-bold">1. Sesión del entrenador</p>
                  <p className="text-xs text-zinc-400 break-all">{session.email}</p>
                  <p className="text-xs text-zinc-500 break-all">UID: {session.uid}</p>
                </div>
                <button disabled={running} className="p-2 border border-zinc-700 rounded-lg text-xs" onClick={() => signOut(auth)}>Salir</button>
              </div>
            </section>

            <section className="p-5 bg-zinc-950 border border-zinc-800 rounded-xl space-y-4">
              <h2 className="font-bold flex gap-2 items-center"><FileJson size={20} className="text-yellow-400"/> 2. Seleccioná el respaldo JSON</h2>
              <input className="block w-full text-sm file:rounded-lg file:border-0 file:bg-yellow-400 file:text-black file:font-bold file:p-3 file:mr-4" type="file" accept=".json,application/json" onChange={pickFile} disabled={running}/>
              {fileName && <p className="text-xs text-zinc-400">{fileName}</p>}
              {fileError && <p role="alert" className="rounded-lg p-3 bg-red-500/10 border border-red-500/30 text-red-300 text-sm">{fileError}</p>}
              {parsed && (
                <div className="p-4 rounded-lg border border-emerald-500/30 bg-emerald-500/5 space-y-2">
                  <p className="font-bold text-emerald-300 flex gap-2"><CheckCircle2 size={18}/> JSON Ragnar válido y sin errores de lectura declarados</p>
                  <p className="text-sm">Documentos: <b>{parsed.backup.totalDocuments}</b> · Alumnos: <b>{parsed.clientCount}</b></p>
                  <p className="text-xs text-zinc-400">Origen: {parsed.backup.sourceProjectId} · Fecha: {parsed.backup.exportedAt}</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
                    {importedGroups.map(([name,count])=>(
                      <div key={name} className="rounded-md bg-black border border-zinc-800 p-2 text-xs"><b className="block text-white">{name}</b>{count} documentos</div>
                    ))}
                  </div>
                </div>
              )}
            </section>

            <section className="p-5 bg-zinc-950 border border-yellow-400/30 rounded-xl space-y-4">
              <h2 className="font-bold flex gap-2 items-center"><Database size={20} className="text-yellow-400"/> 3. Confirmar importación</h2>
              <p className="text-sm text-zinc-400">El sistema comprobará tus permisos y verificará que las colecciones del Firebase nuevo no tengan registros antes de escribir. Se importarán por lotes de 150 documentos; si alguno falla, se detendrá y mostrará el progreso real.</p>
              <label className="flex gap-3 text-sm items-start cursor-pointer">
                <input type="checkbox" checked={ack} onChange={e=>setAck(e.target.checked)} className="mt-1 accent-yellow-400"/>
                Confirmo que el Firebase nuevo está vacío, que revisé los recuentos y que todavía no utilizaré la nueva aplicación con alumnos.
              </label>
              <label className="block text-xs text-zinc-400 space-y-2">
                Para confirmar, escribí exactamente <b className="text-yellow-300">{TARGET}</b>
                <input type="text" value={confirmId} onChange={e=>setConfirmId(e.target.value.trim())} placeholder={TARGET} className="p-3 rounded-lg border border-zinc-700 bg-black block w-full text-white"/>
              </label>
              <button type="button" disabled={!parsed || !ack || confirmId !== TARGET || running || !!result}
                onClick={startImport}
                className="flex gap-2 items-center justify-center w-full rounded-xl bg-yellow-400 text-black font-black px-5 py-3 disabled:opacity-30">
                <Upload size={18}/>{running ? 'Importando...' : 'IMPORTAR AL FIREBASE NUEVO'}
              </button>
              {progress && <p role="status" className="text-sm text-zinc-300">{progress}</p>}
              {importError && <p role="alert" className="bg-red-500/10 border border-red-500/30 p-3 rounded-lg text-sm text-red-300">{importError}</p>}
              {result && <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 space-y-2">
                <p className="font-bold text-emerald-300">Importación de Firestore completada y verificada</p>
                <p className="text-sm">{result.written} documentos · {result.checkedCollections} colecciones comprobadas.</p>
                <p className="text-sm text-yellow-300">Falta crear/vincular cuentas de Authentication y probar las reglas antes de poner Ragnar en producción.</p>
              </div>}
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
