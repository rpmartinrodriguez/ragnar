import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

// Conexión independiente para importar al Firebase nuevo.
// No cambiar src/firebase.js (la app principal usa aún el Firebase original).
const firebaseConfig = {
  apiKey: 'AIzaSyAVxRCZ3gG1QGehoLZ9I1yd-qnhm4MKK3M',
  authDomain: 'ragnar-5f8d7.firebaseapp.com',
  projectId: 'ragnar-5f8d7',
  storageBucket: 'ragnar-5f8d7.firebasestorage.app',
  messagingSenderId: '986593179800',
  appId: '1:986593179800:web:0301184bed7a5a642778ed'
};

const appMigration = initializeApp(firebaseConfig, 'ragnar-migration');
export const dbMigration = getFirestore(appMigration);
export const authMigration = getAuth(appMigration);
