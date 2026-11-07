import React, { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Database, RefreshCcw, Users } from 'lucide-react';
import { writeBatch, doc } from 'firebase/firestore';
import { db } from '../firebase';

export default function MigrationAuditPanel({ clients = [], coachUid }) {
  const [selectedLegacyUid, setSelectedLegacyUid] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const report = useMemo(() => {
    const linked = clients.filter(c => typeof c.studentUserId === 'string' && c.studentUserId.trim()).length;
    const grouped = new Map();
    for (const c of clients) {
      if (c.trainerId === coachUid) continue;
      const previous = typeof c.trainerId === 'string' && c.trainerId ? c.trainerId : '(sin trainerId)';
      grouped.set(previous, (grouped.get(previous) || 0) + 1);
    }
    return { linked, pending: clients.length - linked, groups: [...grouped].sort((a, b) => b[1] - a[1]) };
  }, [clients, coachUid]);

  const assignTrainer = async () => {
    if (!selectedLegacyUid || confirmation !== 'VINCULAR' || working) return;
    const chosen = clients.filter(c =>
      (c.trainerId || '(sin trainerId)') === selectedLegacyUid &&
      c.trainerId !== coachUid
    );
    if (!chosen.length) return;
    if (!window.confirm('¿Querés asignar estos ' + chosen.length + ' alumnos al entrenador actual? Se conservarán sus ID, pagos y sesiones. Esta acción SOLO modifica trainerId en el Firebase nuevo.')) return;
    setWorking(true);
    setError('');
    setMessage('');
    let done = 0;
    try {
      for (let i = 0; i < chosen.length; i += 150) {
        const batch = writeBatch(db);
        const group = chosen.slice(i, i + 150);
        for (const client of group) {
          const previous = client.trainerId || null;
          batch.update(doc(db, 'clients', client.id), {
            trainerId: coachUid,
            ...(previous && !client.legacyTrainerId ? { legacyTrainerId: previous } : {})
          });
        }
        await batch.commit();
        done += group.length;
        setMessage('Asignados ' + done + '/' + chosen.length + ' alumnos...');
      }
      setMessage('Actualizados ' + done + ' alumnos. Los ID de los alumnos y sus subcolecciones no cambiaron.');
      setConfirmation('');
      setSelectedLegacyUid('');
    } catch (e) {
      setError('Se actualizaron ' + done + ' alumnos. El resto no se pudo procesar: ' + (e.code || e.message) + '. Revisá la lista antes de reintentar.');
    } finally {
      setWorking(false);
    }
  };

  return (
    <section className="rounded-2xl p-5 md:p-6 border border-yellow-400/30 bg-zinc-900 space-y-4">
      <div className="flex items-center gap-3">
        <div className="rounded-xl p-3 bg-yellow-400/10 text-yellow-400"><Database size={24}/></div>
        <div>
          <h3 className="text-white uppercase font-black">Control de migración · Firebase nuevo</h3>
          <p className="text-xs text-zinc-400">Proyecto: {db.app.options.projectId} · Entrenador: {coachUid}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        <div className="rounded-xl bg-black/40 border border-zinc-800 p-3"><p className="text-2xl font-black text-white">{clients.length}</p><p className="text-xs text-zinc-400">Alumnos importados visibles</p></div>
        <div className="rounded-xl bg-black/40 border border-zinc-800 p-3"><p className="text-2xl font-black text-white">{report.linked}</p><p className="text-xs text-zinc-400">Con UID histórico del alumno</p></div>
        <div className="rounded-xl bg-black/40 border border-zinc-800 p-3"><p className="text-2xl font-black text-white">{report.pending}</p><p className="text-xs text-zinc-400">Sin cuenta vinculada aún</p></div>
      </div>
      <div className="text-xs text-zinc-400 leading-relaxed">
        <p>Los UID históricos de los alumnos se conservan en Firestore, pero eso no crea sus usuarios en el Authentication nuevo. Hasta restaurar o vincular las cuentas, sus accesos siguen pendientes.</p>
      </div>
      {clients.length === 0 && <p className="text-amber-300 text-sm flex gap-2 items-center"><AlertTriangle size={18}/> No se ven alumnos. Verificá las reglas y el resultado de la importación antes de continuar.</p>}
      {report.groups.length > 0 ? (
        <div className="rounded-xl bg-black/40 border border-zinc-800 p-4 space-y-3">
          <p className="text-sm font-bold text-yellow-400 flex items-center gap-2"><Users size={17}/> Vincular el nuevo entrenador sin perder historiales</p>
          <p className="text-xs text-zinc-400">Encontré alumnos con un trainerId distinto del UID actual. Podés elegir el grupo del entrenador antiguo, sin tocar otros grupos ni modificar los alumnos que ya corresponden al nuevo UID.</p>
          <select value={selectedLegacyUid} disabled={working} onChange={e => {setSelectedLegacyUid(e.target.value);setConfirmation('');}} className="block w-full bg-zinc-950 rounded-lg border border-zinc-700 text-white p-3 text-xs">
            <option value="">Elegir UID histórico</option>
            {report.groups.map(([uid, count]) => <option value={uid} key={uid}>{uid} · {count} alumnos</option>)}
          </select>
          {selectedLegacyUid && (
            <>
              <p className="text-xs text-zinc-400">Para aplicar, escribí <strong className="text-yellow-400">VINCULAR</strong>.</p>
              <input value={confirmation} onChange={e=>setConfirmation(e.target.value)} placeholder="VINCULAR" className="bg-zinc-950 border border-zinc-700 rounded-lg p-3 text-white w-full text-sm" disabled={working}/>
              <button type="button" disabled={working || confirmation !== 'VINCULAR'} onClick={assignTrainer} className="rounded-lg bg-yellow-400 text-black font-bold px-5 py-3 text-sm disabled:opacity-40 inline-flex items-center gap-2">
                <RefreshCcw size={18}/> {working ? 'Asignando...' : 'Asignar este grupo al entrenador actual'}
              </button>
            </>
          )}
        </div>
      ) : clients.length > 0 ? (
        <p className="text-emerald-300 text-sm inline-flex gap-2 items-center"><CheckCircle2 size={18}/> Todos los alumnos visibles ya tienen el UID del entrenador actual.</p>
      ) : null}
      {message && <p role="status" className="text-emerald-300 text-sm">{message}</p>}
      {error && <p role="alert" className="text-red-300 text-sm">{error}</p>}
      <p className="text-xs text-zinc-500">Esta pantalla no crea usuarios, no borra ni altera sesiones, y no escribe en el Firebase original. La reasignación solo se ejecuta con tu confirmación.</p>
    </section>
  );
}
