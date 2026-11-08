// Registra una cuenta nueva EN AUTH usando una segunda instancia de Firebase.
// El coach no pierde su sesión y el alumno conserva su documento clients/{clientId}
// con todas las sesiones, mensajes y pagos ya importados.
// Exclusivo del Firebase nuevo de la rama staging.
import { initializeApp, deleteApp } from 'firebase/app';
import {
  getAuth, setPersistence, inMemoryPersistence,
  createUserWithEmailAndPassword, signOut, deleteUser,
  reauthenticateWithCredential, EmailAuthProvider
} from 'firebase/auth';
import {
  collection, doc, getDocFromServer, getDocsFromServer, limit,
  query, runTransaction, serverTimestamp
} from 'firebase/firestore';
import { db, firebaseConfig } from '../firebase';

function securePassword() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#%';
  const random = new Uint32Array(18);
  crypto.getRandomValues(random);
  return Array.from(random, n => alphabet[n % alphabet.length]).join('');
}

function validEmail(email) {
  return typeof email === 'string' &&
    email.trim().length <= 254 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export async function activateStudentAccount(client) {
  if (db.app.options.projectId !== 'ragnar-5f8d7') {
    throw new Error('Operación bloqueada: esta función solo puede usarse con Firebase nuevo.');
  }

  const coachAuth = getAuth();
  if (!coachAuth.currentUser?.uid) {
    throw new Error('Ingresá con la cuenta de entrenador antes de activar un alumno.');
  }
  if (!client?.id || typeof client.id !== 'string' || client.id.includes('/')) {
    throw new Error('La ficha de alumno no tiene un identificador válido.');
  }

  // La consulta general está autorizada por las reglas Firestore solo para coaches.
  // No confundimos tener sesión en Authentication con ser entrenador.
  try {
    await getDocsFromServer(query(collection(db, 'clients'), limit(1)));
  } catch {
    throw new Error('La cuenta actual no tiene permisos de entrenador en Firestore.');
  }

  const clientRef = doc(db, 'clients', client.id);
  const currentSnapshot = await getDocFromServer(clientRef);
  if (!currentSnapshot.exists()) throw new Error('La ficha del alumno no existe.');
  const current = currentSnapshot.data();
  if (current.accountAccessStatus === 'activated') {
    throw new Error('Esta ficha ya fue activada. No se creará otra cuenta.');
  }
  if (!validEmail(current.email)) {
    throw new Error('Antes de activar, completá un correo de acceso válido en la ficha del alumno.');
  }
  const email = current.email.trim().toLowerCase();
  const password = securePassword();

  const secondaryApp = initializeApp(firebaseConfig, 'ragnar-activacion-alumnos');
  const secondaryAuth = getAuth(secondaryApp);
  let newlyCreatedUser = null;
  let saved = false;

  try {
    // Memoria, no IndexedDB ni almacenamiento persistente del navegador.
    await setPersistence(secondaryAuth, inMemoryPersistence);
    const account = await createUserWithEmailAndPassword(secondaryAuth, email, password);
    newlyCreatedUser = account.user;

    // Comprobamos con Firebase Authentication que el email y la clave generada
    // realmente son aceptados ANTES de vincular la ficha al UID nuevo.
    await reauthenticateWithCredential(
      newlyCreatedUser,
      EmailAuthProvider.credential(email, password)
    );

    // Si otra persona activó la ficha simultáneamente, no sobrescribimos.
    await runTransaction(db, async tx => {
      const fresh = await tx.get(clientRef);
      if (!fresh.exists()) throw new Error('La ficha se eliminó durante la activación.');
      const data = fresh.data();
      if (data.accountAccessStatus === 'activated' ||
          String(data.email || '').trim().toLowerCase() !== email) {
        throw new Error('La ficha fue modificada durante la activación. Volvé a revisarla.');
      }

      const historicalUid = typeof data.studentUserId === 'string'
        ? data.studentUserId.trim() : '';
      const patch = {
        studentUserId: newlyCreatedUser.uid,
        accountAccessStatus: 'activated',
        accountActivatedAt: serverTimestamp()
      };
      if (historicalUid && historicalUid !== newlyCreatedUser.uid) {
        patch.legacyStudentUserId = data.legacyStudentUserId || historicalUid;
      }
      tx.update(clientRef, patch);
    });
    saved = true;
    return { email, password, studentUid: newlyCreatedUser.uid, clientId: client.id };
  } catch (error) {
    if (newlyCreatedUser && !saved) {
      try {
        // La cuenta aún está recién autenticada en la instancia secundaria:
        // si falló Firestore intentamos no dejar una cuenta huérfana.
        await deleteUser(newlyCreatedUser);
      } catch {
        throw new Error('Se creó la cuenta de Authentication pero no se pudo vincular la ficha ni revertir la cuenta. NO vuelvas a activarla: revisá Authentication y Firestore manualmente.');
      }
    }
    if (error.code === 'auth/email-already-in-use') {
      throw new Error('Este correo ya tiene una cuenta en Authentication del Firebase nuevo. No lo sobrescribimos. Revisá ese usuario antes de continuar.');
    }
    if (error.code === 'auth/operation-not-allowed') {
      throw new Error('Activá Email/Password en Firebase → Authentication → Sign-in method.');
    }
    throw error;
  } finally {
    try { await signOut(secondaryAuth); } catch { /* cuenta revertida */ }
    try { await deleteApp(secondaryApp); } catch { /* limpieza */ }
  }
}
