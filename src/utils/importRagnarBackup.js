import {
  Bytes, GeoPoint, Timestamp,
  collection, doc, getDocFromServer, getDocsFromServer,
  limit, query, writeBatch
} from 'firebase/firestore';

const FORMAT = 'ragnar-firestore-client-backup';
const ORIGINAL_PROJECT = 'ragnar-training';
const TARGET_PROJECT = 'ragnar-5f8d7';
const ROOTS = ['clients', 'exercises', 'routines', 'trainerNotifications', 'communityFeed'];
const SUBCOLLECTIONS = ['sessions', 'messages', 'payments', 'trainingLogs'];
const TYPE = '__ragnarFirestoreType';
const BATCH_SIZE = 150;

function validatePath(path) {
  if (typeof path !== 'string' || path.length > 1500 || path.startsWith('/') ||
      path.endsWith('/') || path.includes('//')) throw new Error('Ruta inválida: ' + path);
  const p = path.split('/');
  if (p.some(x => !x || x === '.' || x === '..') || p.length % 2 !== 0) {
    throw new Error('Documento fuera del esquema: ' + path);
  }
  if (p[0] === 'settings' && p.length === 2 && p[1] === 'general') return;
  if (ROOTS.includes(p[0]) && p.length === 2) return;
  if (p[0] === 'clients' && p.length === 4 && SUBCOLLECTIONS.includes(p[2])) return;
  throw new Error('Colección no reconocida: ' + path);
}

function decode(value, db) {
  if (Array.isArray(value)) return value.map(v => decode(v, db));
  if (value && typeof value === 'object') {
    if (typeof value[TYPE] === 'string') {
      switch (value[TYPE]) {
        case 'timestamp': return new Timestamp(value.seconds, value.nanoseconds);
        case 'geopoint': return new GeoPoint(value.latitude, value.longitude);
        case 'bytes': return Bytes.fromBase64String(value.base64);
        case 'reference': validatePath(value.path); return doc(db, value.path);
        case 'date': return new Date(value.iso);
        case 'specialNumber': return Number(value.value);
        default: throw new Error('Tipo Firestore no reconocido: ' + value[TYPE]);
      }
    }
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, decode(v, db)]));
  }
  return value;
}

function collectionPath(documentPath) {
  const parts = documentPath.split('/');
  return parts.slice(0, -1).join('/');
}

export function validateRagnarBackup(text) {
  let backup;
  try { backup = JSON.parse(text); }
  catch { throw new Error('El archivo seleccionado no es un JSON válido.'); }
  if (backup?.format !== FORMAT || backup?.version !== 2 ||
      backup?.sourceProjectId !== ORIGINAL_PROJECT) {
    throw new Error('El archivo no es un respaldo v2 del Firebase original ragnar-training.');
  }
  if (backup.partial || (Array.isArray(backup.errors) && backup.errors.length)) {
    throw new Error('El respaldo es PARCIAL. Primero hay que resolver los errores de lectura en la base original.');
  }
  if (!Array.isArray(backup.records) || !backup.records.length ||
      backup.totalDocuments !== backup.records.length) {
    throw new Error('El respaldo no tiene documentos o el total declarado no coincide.');
  }
  const paths = new Set();
  const counts = {};
  for (const item of backup.records) {
    validatePath(item.path);
    if (!item.data || typeof item.data !== 'object' || Array.isArray(item.data)) {
      throw new Error('Datos de documento inválidos: ' + item.path);
    }
    if (paths.has(item.path)) throw new Error('Documento duplicado: ' + item.path);
    paths.add(item.path);
    const name = collectionPath(item.path);
    counts[name] = (counts[name] || 0) + 1;
  }
  const clientCount = backup.records.filter(item => item.path.startsWith('clients/') && item.path.split('/').length === 2).length;
  if (!clientCount || clientCount !== backup.expectedClientCount) {
    throw new Error('La cantidad de alumnos del respaldo no coincide o es cero.');
  }
  if (backup.collectionReport?.some(x => x.ok === false)) {
    throw new Error('El archivo indica colecciones sin leer. No es seguro importarlo.');
  }
  return { backup, counts, clientCount };
}

async function countCollectionFromServer(db, path) {
  const items = await getDocsFromServer(collection(db, path));
  return items.size;
}

async function ensureEmptyAndAuthorized(db, authUser) {
  if (db.app.options.projectId !== TARGET_PROJECT) {
    throw new Error('Bloqueado: el proyecto Firebase no es ' + TARGET_PROJECT);
  }
  if (!authUser?.uid) throw new Error('Ingresá como entrenador en el Firebase nuevo.');
  // La regla isCoach requiere que el UID exista en coaches/{uid}, enabled=true.
  // Una consulta global sin filtro a clients está denegada para alumnos.
  for (const root of ROOTS) {
    let snapshot;
    try {
      snapshot = await getDocsFromServer(query(collection(db, root), limit(1)));
    } catch (error) {
      throw new Error('Sin permiso de entrenador para consultar ' + root +
        '. Verificá Authentication y coaches/{UID} enabled=true. Detalle: ' +
        (error.code || error.message));
    }
    if (!snapshot.empty) {
      throw new Error('Ya existen registros en "' + root + '". Por seguridad, la importación solo se permite sobre un Firestore nuevo y vacío.');
    }
  }
  const settings = await getDocFromServer(doc(db, 'settings', 'general'));
  if (settings.exists()) {
    throw new Error('Ya existe settings/general. La importación exige una base de datos vacía.');
  }
}

export async function importRagnarBackup({ db, authUser, backup, counts, onProgress }) {
  await ensureEmptyAndAuthorized(db, authUser);
  const report = typeof onProgress === 'function' ? onProgress : () => {};
  report('Verificación correcta. Comenzando escritura...');
  const records = [...backup.records].sort((a, b) => {
    const aDepth = a.path.split('/').length;
    const bDepth = b.path.split('/').length;
    return aDepth - bDepth || a.path.localeCompare(b.path);
  });
  let written = 0;
  let batchNumber = 0;
  // Cualquier error detiene los siguientes lotes, sin hacer borrados.
  // Se informa si hubo una escritura parcial; no se usa automáticamente como producción.
  for (let offset = 0; offset < records.length; offset += BATCH_SIZE) {
    const batch = writeBatch(db);
    const chunk = records.slice(offset, offset + BATCH_SIZE);
    for (const item of chunk) {
      validatePath(item.path);
      batch.set(doc(db, item.path), decode(item.data, db));
    }
    try {
      await batch.commit();
    } catch (error) {
      throw new Error('Importación detenida en lote ' + (batchNumber + 1) +
        '. Se escribieron ' + written + ' de ' + records.length +
        ' documentos. No uses esta base todavía. Error: ' +
        (error.code || error.message));
    }
    written += chunk.length;
    batchNumber++;
    report('Importados ' + written + '/' + records.length + ' documentos...');
  }

  report('Verificando recuentos en Firebase nuevo...');
  const mismatches = [];
  for (const [path, expected] of Object.entries(counts)) {
    const found = await countCollectionFromServer(db, path);
    if (found !== expected) mismatches.push({ path, expected, found });
  }
  if (mismatches.length) {
    throw new Error('Los datos se escribieron, pero la comprobación detectó diferencias: ' +
      mismatches.map(x => x.path + ' (' + x.found + '/' + x.expected + ')').join(', ') +
      '. No utilices todavía el Firebase nuevo.');
  }
  report('Verificados ' + written + ' documentos, sin diferencias en las colecciones importadas.');
  return { written, batches: batchNumber, checkedCollections: Object.keys(counts).length, mismatches };
}
