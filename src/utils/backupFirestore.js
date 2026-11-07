import {
  Bytes,
  DocumentReference,
  GeoPoint,
  Timestamp,
  collection,
  doc,
  documentId,
  getDocFromServer,
  getDocsFromServer,
  limit,
  orderBy,
  query,
  startAfter,
  where,
} from 'firebase/firestore';

// Solo lectura de los datos de Ragnar a los que la sesión tenga acceso.
// Una sesión de Firebase NO concede permisos de administrador ni permite enumerar
// colecciones arbitrarias: se enumeran las utilizadas por la aplicación original.
const ROOT_COLLECTIONS = ['clients', 'exercises', 'routines', 'trainerNotifications', 'communityFeed'];
const CLIENT_SUBCOLLECTIONS = ['sessions', 'messages', 'payments', 'trainingLogs'];
const PAGE_SIZE = 200;
const TYPE = '__ragnarFirestoreType';

function encode(value) {
  if (value instanceof Timestamp) {
    return { [TYPE]: 'timestamp', seconds: value.seconds, nanoseconds: value.nanoseconds };
  }
  if (value instanceof GeoPoint) {
    return { [TYPE]: 'geopoint', latitude: value.latitude, longitude: value.longitude };
  }
  if (value instanceof Bytes) {
    return { [TYPE]: 'bytes', base64: value.toBase64() };
  }
  if (value instanceof DocumentReference) {
    return { [TYPE]: 'reference', path: value.path };
  }
  if (value instanceof Date) {
    return { [TYPE]: 'date', iso: value.toISOString() };
  }
  if (typeof value === 'number' && !Number.isFinite(value)) {
    return { [TYPE]: 'specialNumber', value: String(value) };
  }
  if (Array.isArray(value)) return value.map(encode);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, field]) => [key, encode(field)]));
  }
  return value;
}

function itemFromSnapshot(snapshot) {
  return { path: snapshot.ref.path, data: encode(snapshot.data()) };
}

function reason(error) {
  return String(error?.code || error?.message || 'Error de lectura');
}

export async function exportRagnarData(db, user, onProgress = () => {}) {
  if (!user?.uid) throw new Error('Primero iniciá sesión con tu cuenta de entrenador.');
  const projectId = db.app.options.projectId;
  if (projectId !== 'ragnar-training') {
    throw new Error('Esta copia está conectada a "' + projectId + '", no al Firebase original de Ragnar. No descargamos para evitar confundir respaldos.');
  }

  const records = [];
  const seen = new Set();
  const counts = {};
  const collectionReport = [];
  const errors = [];
  const warnings = [];
  const progress = (message) => onProgress(message);

  async function readCollection(path) {
    progress('Leyendo ' + path + '... (' + records.length + ' documentos)');
    const ref = collection(db, path);
    let obtained = 0;
    let lastDoc = null;
    const batch = [];

    try {
      while (true) {
        // El SDK obtiene los datos del servidor, no de una caché local incompleta.
        const q = lastDoc
          ? query(ref, orderBy(documentId()), startAfter(lastDoc), limit(PAGE_SIZE))
          : query(ref, orderBy(documentId()), limit(PAGE_SIZE));
        const snapshot = await getDocsFromServer(q);
        for (const item of snapshot.docs) batch.push(itemFromSnapshot(item));
        obtained += snapshot.size;
        progress('Leyendo ' + path + ': ' + obtained + ' registros...');
        if (snapshot.size < PAGE_SIZE) break;
        lastDoc = snapshot.docs[snapshot.docs.length - 1];
      }
      for (const item of batch) {
        if (seen.has(item.path)) continue;
        seen.add(item.path);
        records.push(item);
      }
      counts[path] = obtained;
      collectionReport.push({ path, count: obtained, ok: true });
      return batch;
    } catch (error) {
      const report = { path, count: 0, ok: false, error: reason(error) };
      collectionReport.push(report);
      errors.push({ path, reason: reason(error) });
      // Nunca etiquetamos como completo un listado incompleto. Si una página
      // falla descartamos toda esa colección para no duplicar/no mezclar.
      return null;
    }
  }

  progress('Verificando identidad del entrenador...');
  // Ragnar asigna trainerId a los alumnos cuando el coach los crea.
  // Esta validación evita ofrecer una exportación masiva a un alumno o cuenta
  // que la app antigua clasificaría como "trainer" por defecto.
  let trainerAuthorized = false;
  try {
    const own = await getDocsFromServer(query(collection(db, 'clients'), where('trainerId', '==', user.uid), limit(1)));
    trainerAuthorized = !own.empty;
  } catch {
    // La regla antigua puede no permitir la consulta filtrada; se probará
    // también la autorización explícita documentada en /trainers.
  }
  if (!trainerAuthorized) {
    try {
      const trainerDoc = await getDocFromServer(doc(db, 'trainers', user.uid));
      trainerAuthorized = trainerDoc.exists() && trainerDoc.data()?.active === true;
    } catch {
      // /trainers puede no existir en el proyecto original.
    }
  }
  if (!trainerAuthorized) {
    throw new Error('La sesión funciona en Ragnar, pero no pude verificar que este usuario sea un entrenador propietario de alumnos. No se inicia una exportación masiva. Comprobá que los clientes estén asignados al UID del entrenador o que tenga un rol administrativo validado.');
  }

  const clients = await readCollection('clients');
  if (!clients || clients.length === 0) {
    throw new Error('No pude leer la colección de alumnos desde el servidor. Se canceló la descarga para evitar generar un respaldo vacío.');
  }
  const clientIds = clients.map((item) => item.path.split('/')[1]);

  for (const id of clientIds) {
    for (const subcollection of CLIENT_SUBCOLLECTIONS) {
      await readCollection('clients/' + id + '/' + subcollection);
    }
  }

  for (const root of ROOT_COLLECTIONS.filter((name) => name !== 'clients')) {
    await readCollection(root);
  }

  progress('Leyendo configuración...');
  try {
    const setting = await getDocFromServer(doc(db, 'settings', 'general'));
    if (setting.exists()) {
      if (!seen.has(setting.ref.path)) {
        seen.add(setting.ref.path);
        records.push(itemFromSnapshot(setting));
      }
      counts['settings/general'] = 1;
      collectionReport.push({ path: 'settings/general', count: 1, ok: true });
    } else {
      counts['settings/general'] = 0;
      collectionReport.push({ path: 'settings/general', count: 0, ok: true });
    }
  } catch (error) {
    errors.push({ path: 'settings/general', reason: reason(error) });
    collectionReport.push({ path: 'settings/general', count: 0, ok: false, error: reason(error) });
  }

  warnings.push('Exportación NO atómica: si los datos cambian mientras se realiza, puede haber diferencias entre colecciones.');
  warnings.push('Solo incluye colecciones conocidas de Ragnar y accesibles con esta sesión; no puede descubrir otras colecciones.');
  warnings.push('No incluye cuentas ni contraseñas de Firebase Authentication, reglas, índices, claves, funciones ni archivos de Cloud Storage.');
  if (errors.length) warnings.push('Hay colecciones con errores: este respaldo es PARCIAL.');

  const backup = {
    format: 'ragnar-firestore-client-backup',
    version: 2,
    exportedAt: new Date().toISOString(),
    sourceProjectId: projectId,
    sourceTrainerUid: user.uid,
    sourceTrainerEmail: user.email || null,
    totalDocuments: records.length,
    expectedClientCount: clients.length,
    records,
    counts,
    collectionReport,
    errors,
    warnings,
    partial: errors.length > 0,
  };
  progress('Respaldo finalizado: ' + records.length + ' documentos' + (backup.partial ? ' (PARCIAL)' : '') + '.');
  return backup;
}

export function downloadRagnarBackup(backup) {
  const content = JSON.stringify(backup, null, 2);
  const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'ragnar-backup-' + new Date().toISOString().slice(0, 10) +
    (backup.partial ? '-PARCIAL' : '') + '.json';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30000);
}
