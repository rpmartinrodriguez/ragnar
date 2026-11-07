#!/usr/bin/env node
// Recupera cuentas Firebase Authentication de ALUMNOS a partir del backup Ragnar v2.
// SOLO en ragnar-5f8d7. Conserva UID antiguos para mantener todos los vínculos.
// SIMULACION por defecto; requiere --execute + --confirm-target + service account.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomBytes } from 'node:crypto';
import { initializeApp, cert, deleteApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const SOURCE = 'ragnar-training';
const DEST = 'ragnar-5f8d7';
const FMT = 'ragnar-firestore-client-backup';

const args = Object.fromEntries(process.argv.slice(2).filter(a => a.startsWith('--')).map(a => {
  const sep = a.indexOf('=');
  return sep === -1 ? [a.slice(2), true] : [a.slice(2, sep), a.slice(sep + 1)];
}));

function abort(reason) { console.error('ERROR:', reason); process.exit(1); }
function loadJSON(file) {
  try { return JSON.parse(readFileSync(resolve(file), 'utf8')); }
  catch (error) { abort('No pude leer el archivo: ' + error.message); }
}
function usableEmail(value) {
  return typeof value === 'string' && value.length <= 254 && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value.trim());
}
if (!args.backup) abort('Falta --backup=RUTA_DEL_JSON');
if (!args.target || args.target !== DEST) abort('El único destino permitido es --target=' + DEST);
const backup = loadJSON(args.backup);
if (backup.format !== FMT || backup.version !== 2 || backup.sourceProjectId !== SOURCE) {
  abort('Se requiere respaldo Ragnar v2 del Firebase original.');
}
if (backup.partial || !Array.isArray(backup.records) || backup.errors?.length ||
    backup.totalDocuments !== backup.records.length || !backup.records.length) {
  abort('El respaldo es parcial, inválido o vacío.');
}

const clients = backup.records.filter(item => /^clients\/[^/]+$/.test(item.path));
if (!clients.length || clients.length !== backup.expectedClientCount) abort('Recuento de alumnos inválido.');
const eligible = [], noLegacyUid = [], invalidEmail = [], collisions = [], usedUids = new Set(), usedEmails = new Set();
for (const {path, data} of clients) {
  const id = path.split('/')[1];
  const uid = data?.studentUserId;
  const email = typeof data?.email === 'string' ? data.email.trim().toLowerCase() : '';
  if (typeof uid !== 'string' || !uid.trim()) { noLegacyUid.push(id); continue; }
  if (uid.length > 128 || !/^[A-Za-z0-9_-]+$/.test(uid)) { collisions.push({id, reason:'UID inválido'}); continue; }
  if (!usableEmail(email)) { invalidEmail.push(id); continue; }
  if (usedUids.has(uid) || usedEmails.has(email)) {
    collisions.push({id, reason:'UID o email duplicado en respaldo'}); continue;
  }
  usedUids.add(uid);
  usedEmails.add(email);
  eligible.push({id, uid, email, displayName:String(data.name || '').slice(0, 100)});
}

console.log('Base original:', SOURCE);
console.log('Base nueva:', DEST);
console.log('Alumnos Firestore:', clients.length);
console.log('Cuentas con UID + email válidos:', eligible.length);
console.log('Alumnos sin UID previo (pendientes de registro):', noLegacyUid.length);
console.log('Alumnos con correo ausente/inválido:', invalidEmail.length);
console.log('Duplicados o UID inválidos:', collisions.length);
if (invalidEmail.length || collisions.length) {
  console.log('Se requiere revisar y resolver alumnos con correo/UID problemáticos antes de migrarlos.');
}
if (!args.execute) {
  console.log('\nMODO SIMULACIÓN: no se conectó ni escribió en Firebase.');
  console.log('Tras verificar: --execute --service-account=ARCHIVO.json --confirm-target=' + DEST);
  process.exit(0);
}
if (args['confirm-target'] !== DEST) abort('Falta --confirm-target=' + DEST);
if (!args['service-account']) abort('Falta --service-account=ARCHIVO_PRIVADO.json');
const sa = loadJSON(args['service-account']);
if (sa.project_id !== DEST) abort('La cuenta de servicio no pertenece al Firebase destino ' + DEST);

const app = initializeApp({credential: cert(sa), projectId: DEST}, 'ragnar-migration-auth');
const auth = getAuth(app);
let created = 0, alreadyCorrect = 0, failed = 0;
try {
  for (let i = 0; i < eligible.length; i++) {
    const student = eligible[i];
    try {
      // Si el UID existe, jamás cambiar datos ni contraseñas sin comprobar la identidad.
      try {
        const existing = await auth.getUser(student.uid);
        if ((existing.email || '').toLowerCase() === student.email) {
          alreadyCorrect++;
          continue;
        }
        throw new Error('UID ocupado por otra identidad');
      } catch (err) {
        if (err.code !== 'auth/user-not-found') throw err;
      }
      // También impedir que la dirección de correo apunte a otro UID.
      try {
        const byEmail = await auth.getUserByEmail(student.email);
        if (byEmail.uid !== student.uid) {
          throw new Error('El correo ya está vinculado a otro UID');
        }
      } catch (err) {
        if (err.code !== 'auth/user-not-found') throw err;
      }
      await auth.createUser({
        uid: student.uid,
        email: student.email,
        displayName: student.displayName || undefined,
        emailVerified: false,
        password: randomBytes(48).toString('base64url')
      });
      created++;
    } catch (error) {
      failed++;
      // No imprimir contraseñas ni claves. El operador tiene datos locales.
      console.error('Falló la cuenta del perfil ' + student.id + ': ' + error.message);
    }
    if ((i + 1) % 20 === 0) console.log('Revisadas ' + (i + 1) + '/' + eligible.length);
  }
  console.log('CREADAS:', created, 'YA EXISTÍAN CON UID CORRECTO:', alreadyCorrect, 'ERROR:', failed);
  console.log('NO SE MANDARON CORREOS AUTOMÁTICOS. Los alumnos deben usar "Recuperar contraseña" con su email.');
  console.log('NO SE MODIFICARON FICHAS ni documentos de Firestore. Los UID se conservaron.');
  if (failed > 0) process.exitCode = 1;
} finally {
  await deleteApp(app);
}
