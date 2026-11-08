// Netlify Function: exclusivamente para el Firebase nuevo de Ragnar.
// No se publica la clave privada en el navegador. Requiere variable secreta
// RAGNAR_FIREBASE_SERVICE_ACCOUNT configurada en Netlify (NO en git).
import { randomInt } from 'node:crypto';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const PROJECT_ID = 'ragnar-5f8d7';
const SECRET_NAME = 'RAGNAR_FIREBASE_SERVICE_ACCOUNT';

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store, max-age=0',
      'pragma': 'no-cache',
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'no-referrer'
    }
  });
}

function adminApp() {
  const secret = process.env[SECRET_NAME];
  if (!secret) return null;
  let serviceAccount;
  try { serviceAccount = JSON.parse(secret); }
  catch { throw new Error('El secreto de Firebase Admin no es JSON válido.'); }
  if (serviceAccount.project_id !== PROJECT_ID || !serviceAccount.private_key || !serviceAccount.client_email) {
    throw new Error('La cuenta de servicio no pertenece al Firebase nuevo o está incompleta.');
  }
  return getApps().find(app => app.name === 'ragnar-nuevo-admin') ||
    initializeApp({
      credential: cert(serviceAccount),
      projectId: PROJECT_ID
    }, 'ragnar-nuevo-admin');
}

function newPassword() {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghjkmnpqrstuvwxyz';
  const digits = '23456789';
  const special = '!';
  const all = upper + lower + digits + special;
  const chars = [
    upper[randomInt(upper.length)],
    lower[randomInt(lower.length)],
    digits[randomInt(digits.length)],
    special
  ];
  for (let i = chars.length; i < 18; i++) chars.push(all[randomInt(all.length)]);
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

export default async function handler(request) {
  if (request.method !== 'POST') return json({ error: 'method-not-allowed' }, 405);
  // Same-site requests only; Bearer auth below is the actual authorization boundary.
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) {
    return json({ error: 'Origen no permitido.' }, 403);
  }

  let app;
  try { app = adminApp(); }
  catch {
    return json({ error: 'La configuración administrativa de Firebase nuevo es inválida. Revisá Netlify.' }, 503);
  }
  if (!app) {
    return json({
      error: 'La recuperación de contraseñas todavía no está habilitada. Falta configurar la clave privada del Firebase nuevo en Netlify.'
    }, 503);
  }

  const match = /^Bearer ([A-Za-z0-9_.-]+)$/.exec(request.headers.get('authorization') || '');
  if (!match) return json({ error: 'Iniciá sesión como entrenador para continuar.' }, 401);

  const auth = getAuth(app);
  let coach;
  try {
    coach = await auth.verifyIdToken(match[1], true);
    const authAge = Math.floor(Date.now() / 1000) - Number(coach.auth_time || 0);
    if (authAge > 60 * 60 || authAge < 0) {
      return json({ error: 'Por seguridad, cerrá sesión y volvé a entrar como entrenador antes de restablecer contraseñas.' }, 401);
    }
  } catch {
    return json({ error: 'Sesión de entrenador inválida o caducada.' }, 401);
  }

  const db = getFirestore(app);
  const coachSnap = await db.doc('coaches/' + coach.uid).get();
  if (!coachSnap.exists || coachSnap.get('enabled') !== true) {
    return json({ error: 'Tu usuario no está autorizado como entrenador.' }, 403);
  }

  let body;
  try {
    const raw = await request.text();
    if (raw.length > 1000) return json({ error: 'Solicitud demasiado grande.' }, 400);
    body = JSON.parse(raw);
  } catch { return json({ error: 'Solicitud inválida.' }, 400); }
  const id = body?.clientId;
  if (typeof id !== 'string' || id.length > 150 || !/^[A-Za-z0-9_-]+$/.test(id)) {
    return json({ error: 'Identificador de alumno inválido.' }, 400);
  }

  const clientRef = db.doc('clients/' + id);
  const snap = await clientRef.get();
  if (!snap.exists) return json({ error: 'La ficha ya no existe.' }, 404);
  const data = snap.data() || {};
  if (data.accountAccessStatus !== 'activated' ||
      typeof data.studentUserId !== 'string' || !data.studentUserId ||
      typeof data.email !== 'string') {
    return json({ error: 'Esta ficha aún no tiene un acceso nuevo confirmado. No se modificó nada.' }, 409);
  }
  if (data.studentUserId === coach.uid) {
    return json({ error: 'No es posible cambiar la contraseña del entrenador desde este panel.' }, 403);
  }

  let student;
  try {
    student = await auth.getUser(data.studentUserId);
  } catch (err) {
    if (err.code === 'auth/user-not-found') {
      return json({ error: 'No existe el UID de alumno en Authentication nuevo. No se modificó nada.' }, 409);
    }
    return json({ error: 'No se pudo comprobar la cuenta en Firebase.' }, 502);
  }
  if (!student.email || student.email.toLowerCase() !== data.email.trim().toLowerCase()) {
    return json({ error: 'El correo de la ficha no coincide con Authentication. Revisalo antes de cambiar la contraseña.' }, 409);
  }
  if (student.disabled) return json({ error: 'La cuenta está deshabilitada. Revisala en Firebase.' }, 409);

  // Evita solicitudes repetidas accidentales a la misma cuenta.
  const previous = data.authPasswordResetAt?.toMillis?.() || 0;
  if (previous && Date.now() - previous < 90 * 1000) {
    return json({ error: 'Este alumno recibió una clave hace menos de 90 segundos. Verificá el acceso antes de pedir otra.' }, 429);
  }

  const password = newPassword();
  try {
    await auth.updateUser(student.uid, { password });
  } catch {
    return json({ error: 'Firebase no permitió actualizar la contraseña. No se modificó la ficha.' }, 502);
  }

  try {
    await clientRef.update({
      authPasswordResetAt: FieldValue.serverTimestamp(),
      authPasswordResetBy: coach.uid
    });
  } catch {
    // El cambio de contraseña ya tuvo éxito; devolvemos la nueva clave aunque
    // falle la escritura de auditoría para no perderla.
    console.error('Ragnar: falló el registro de auditoría de cambio de contraseña');
  }

  return json({
    success: true,
    email: student.email,
    password,
    clientId: id,
    message: 'Contraseña temporal actualizada. Se muestra una sola vez; entregala directamente al alumno.'
  });
}
