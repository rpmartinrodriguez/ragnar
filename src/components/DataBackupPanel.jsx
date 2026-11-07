import React, { useState } from 'react';
import { AlertTriangle, DatabaseBackup, Download, ShieldCheck } from 'lucide-react';
import { getAuth } from 'firebase/auth';
import { db } from '../firebase';
import { exportRagnarData, downloadRagnarBackup } from '../utils/backupFirestore';

export default function DataBackupPanel() {
  const [working, setWorking] = useState(false);
  const [progress, setProgress] = useState('');
  const [summary, setSummary] = useState(null);
  const [problem, setProblem] = useState('');

  const createBackup = async () => {
    setWorking(true);
    setProblem('');
    setSummary(null);
    setProgress('Conectando al Firebase original...');
    try {
      const currentUser = getAuth().currentUser;
      if (!currentUser) throw new Error('Tu sesión de Ragnar expiró. Volvé a iniciar sesión.');
      const backup = await exportRagnarData(db, currentUser, setProgress);
      downloadRagnarBackup(backup);
      setSummary({
        total: backup.totalDocuments,
        partial: backup.partial,
        clients: backup.expectedClientCount,
        counts: backup.counts,
        errors: backup.errors,
        warnings: backup.warnings,
      });
    } catch (error) {
      setProblem(error.message || 'No fue posible leer los datos.');
    } finally {
      setWorking(false);
    }
  };

  return (
    <section className="rounded-2xl border border-yellow-400/30 bg-zinc-900 p-5 md:p-6 space-y-4">
      <div className="flex items-center gap-3">
        <div className="bg-yellow-400/10 text-yellow-400 p-3 rounded-xl"><DatabaseBackup size={24}/></div>
        <div>
          <h3 className="text-white font-black uppercase tracking-wide">Respaldo para migración</h3>
          <p className="text-zinc-400 text-xs mt-1">Lectura desde el Firebase original; no se elimina ni modifica ningún registro.</p>
        </div>
      </div>
      <div className="flex gap-2 items-start text-sm text-zinc-300">
        <ShieldCheck size={18} className="mt-0.5 shrink-0 text-emerald-400"/>
        <p>Se intenta descargar toda la información de Ragnar a la que tu sesión de entrenador tenga acceso: alumnos, sesiones, chat, cobros, rutinas, ejercicios y actividad. El archivo conserva los ID originales y tipos de fecha.</p>
      </div>
      <div className="flex gap-2 items-start text-sm text-amber-300">
        <AlertTriangle size={18} className="mt-0.5 shrink-0"/>
        <p>El archivo incluye datos personales de tus alumnos. Guardalo en una carpeta privada y no lo publiques ni compartas por enlaces. No contiene las contraseñas de Firebase Authentication.</p>
      </div>
      <button type="button" disabled={working} onClick={createBackup}
        className="inline-flex gap-2 items-center justify-center rounded-xl px-5 py-3 bg-yellow-400 text-black font-black text-sm hover:bg-yellow-300 disabled:opacity-50">
        <Download size={18}/> {working ? 'Preparando respaldo...' : 'Descargar respaldo completo accesible'}
      </button>
      {progress && <p role="status" className="text-xs text-zinc-400 break-words">{progress}</p>}
      {problem && <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{problem}</p>}
      {summary && (
        <div className="rounded-xl bg-zinc-950 border border-zinc-700 p-4 space-y-3">
          <p className="text-sm font-bold text-white">
            {summary.total} documentos · {summary.clients} alumnos
          </p>
          {summary.partial ? (
            <p className="text-sm text-red-300">RESPALDO PARCIAL: hubo colecciones que no pudieron leerse. No borres ni desconectes la base original.</p>
          ) : (
            <p className="text-sm text-emerald-300">Archivo generado sin errores de lectura detectados. Aún falta revisar las cantidades antes de migrar.</p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {Object.entries(summary.counts).map(([path, count]) => (
              <div className="text-xs text-zinc-300 border-b border-zinc-800 py-1" key={path}>
                <strong>{path}</strong>: {count}
              </div>
            ))}
          </div>
          {summary.errors.map(({path, reason}) => (
            <p key={path} className="text-xs text-red-300">{path}: {reason}</p>
          ))}
          <p className="text-xs text-zinc-500">{summary.warnings.join(' ')}</p>
        </div>
      )}
    </section>
  );
}
