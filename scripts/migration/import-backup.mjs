#!/usr/bin/env node
// Importar respaldos de Ragnar exclusivamente a un Firebase diferente.
// Por defecto muestra un diagnóstico; la escritura requiere --execute y confirmación.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { initializeApp, cert, deleteApp } from 'firebase-admin/app';
import { getFirestore, GeoPoint, Timestamp } from 'firebase-admin/firestore';

const TAG = '__ragnarFirestoreType';
const flags = Object.fromEntries(process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => {
  const i = a.indexOf('=');
  return i < 0 ? [a.slice(2), true] : [a.slice(2, i), a.slice(i + 1)];
}));

function fail(message) {
  console.error('\nERROR:', message);
  process.exit(1);
}
function parseJSON(path) {
  try { return JSON.parse(readFileSync(resolve(path), 'utf8')); }
  catch (error) { fail('No se pudo leer ' + path + ': ' + error.message); }
}
function validatePath(path) {
  if (typeof path !== 'string' || path.includes('//') || path.startsWith('/') || path.endsWith('/')) {
    throw new Error('Ruta de documento no válida: ' + path);
  }
  const parts = path.split('/');
  if (parts.length < 2 || parts.length % 2 !== 0 || parts.some((p) => !p || p === '.' || p === '..')) {
    throw new Error('Ruta Firestore no válida: ' + path);
  }
  const root = parts[0];
  const allowedRoot = new Set(['clients', 'exercises', 'routines', 'trainerNotifications', 'communityFeed', 'settings']);
  if (!allowedRoot.has(root)) throw new Error('Colección no reconocida: ' + root);
  if (root === 'settings' && path !== 'settings/general') throw new Error('Ajuste inesperado: ' + path);
  if (parts.length > 2 && (root !== 'clients' || parts.length !== 4 ||
    !['sessions', 'messages', 'payments', 'trainingLogs'].includes(parts[2]))) {
    throw new Error('Subcolección no reconocida: ' + path);
  }
}
function restore(value, db) {
  if (Array.isArray(value)) return value.map((v) => restore(v, db));
  if (value && typeof value === 'object') {
    if (typeof value[TAG] === 'string') {
      switch (value[TAG]) {
        case 'timestamp': return new Timestamp(value.seconds, value.nanoseconds);
        case 'geopoint': return new GeoPoint(value.latitude, value.longitude);
        case 'bytes': return Buffer.from(value.base64, 'base64');
        case 'reference': {
          validatePath(value.path);
          return db.doc(value.path);
        }
        case 'date': return new Date(value.iso);
        case 'specialNumber': return Number(value.value);
        default: throw new Error('Tipo de campo desconocido: ' + value[TAG]);
      }
    }
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, restore(child, db)]));
  }
  return value;
}

const backupPath = flags.backup;
const serviceAccountPath = flags['service-account'];
const targetProjectId = flags.target;
const execute = Boolean(flags.execute);
if (!backupPath) fail('Falta --backup=RUTA_AL_ARCHIVO.json');
if (!targetProjectId) fail('Falta --target=ID_FIREBASE_NUEVO');

const backup = parseJSON(backupPath);
if (backup.format !== 'ragnar-firestore-client-backup' || backup.version !== 2) {
  fail('El JSON no corresponde a un respaldo Ragnar v2.');
}
if (typeof backup.sourceProjectId !== 'string' || backup.sourceProjectId !== 'ragnar-training') {
  fail('El origen no coincide con el Firebase original de Ragnar.');
}
if (backup.sourceProjectId === targetProjectId) fail('La base de destino no puede ser la base original.');
if (backup.partial && !flags['allow-partial']) {
  fail('El respaldo tiene lecturas fallidas. Revisalo y, solo si aceptás esa limitación, agregá --allow-partial.');
}
if (!Array.isArray(backup.records) || backup.records.length === 0) fail('El respaldo no tiene documentos.');
if (backup.totalDocuments !== backup.records.length) fail('La cantidad declarada no coincide con el archivo.');

const ids = new Set();
for (const item of backup.records) {
  validatePath(item.path);
  if (!item.data || typeof item.data !== 'object' || Array.isArray(item.data)) {
    fail('Un documento tiene datos no válidos: ' + item.path);
  }
  if (ids.has(item.path)) fail('Ruta duplicada: ' + item.path);
  ids.add(item.path);
}
if (backup.records.filter((item) => item.path.split('/').length === 2 && item.path.startsWith('clients/')).length !== backup.expectedClientCount) {
  fail('La cantidad de alumnos no coincide con el manifiesto del respaldo.');
}

const counts = {};
for (const item of backup.records) {
  const name = item.path.split('/').filter((_, i) => i % 2 === 0).join('/');
  counts[name] = (counts[name] || 0) + 1;
}
console.log('Origen: ' + backup.sourceProjectId);
console.log('Destino: ' + targetProjectId);
console.log('Fecha del respaldo: ' + backup.exportedAt);
console.log('Documentos: ' + backup.records.length);
console.log('Grupos:', counts);
console.log('Respaldo parcial: ' + (backup.partial ? 'Sí' : 'No'));
console.log('NOTA: esto importa documentos Firestore, NO usuarios Firebase Auth ni contraseñas.');

if (!execute) {
  console.log('\nMODO SIMULACIÓN: no se conectó a Firebase ni se modificó ningún registro.');
  console.log('Para importar, pasá --execute, --service-account=ARCHIVO.json y --confirm-target=' + targetProjectId);
  process.exit(0);
}
if (flags['confirm-target'] !== targetProjectId) fail('Confirmación de proyecto incorrecta. Falta --confirm-target=' + targetProjectId);
if (!serviceAccountPath) fail('Falta --service-account=RUTA_ARCHIVO_PRIVADO.json');
const credentials = parseJSON(serviceAccountPath);
if (credentials.project_id !== targetProjectId) fail('La cuenta de servicio no corresponde al Firebase nuevo.');
const app = initializeApp({ credential: cert(credentials), projectId: targetProjectId }, 'ragnar-migration');
const db = getFirestore(app);

try {
  const existing = await db.listCollections();
  if (existing.length > 0) {
    fail('El Firestore nuevo NO está vacío. Importación detenida para evitar sobrescribir registros.');
  }
  console.log('Firebase nuevo verificado vacío. Comenzando importación...');
  const writer = db.bulkWriter();
  let failed = false;
  let created = 0;
  writer.onWriteError((error) => {
    // Sin reintentos silenciosos que oculten documentos perdidos.
    console.error('No se pudo escribir:', error.documentRef.path, error.message);
    failed = true;
    return false;
  });
  const pending = [];
  for (const item of backup.records) {
    pending.push(writer.set(db.doc(item.path), restore(item.data, db)).then(() => { created += 1; }));
  }
  await writer.close();
  const outcome = await Promise.allSettled(pending);
  if (failed || outcome.some((r) => r.status === 'rejected')) {
    fail('La importación terminó con errores. Documentos escritos: ' + created + '/' + backup.records.length + '. No usar la nueva app todavía.');
  }
  console.log('IMPORTACIÓN COMPLETADA: ' + created + ' documentos escritos.');
  console.log('FALTA: recrear cuentas de Firebase Authentication, verificar reglas/índices y probar vínculos y pagos.');
} finally {
  await deleteApp(app);
}
