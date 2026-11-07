// Rama de migracion: ESTA copia apunta solamente al Firebase nuevo.
// La rama main conserva la configuracion original para el respaldo.
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyAVxRCZ3gG1QGehoLZ9I1yd-qnhm4MKK3M',
  authDomain: 'ragnar-5f8d7.firebaseapp.com',
  projectId: 'ragnar-5f8d7',
  storageBucket: 'ragnar-5f8d7.firebasestorage.app',
  messagingSenderId: '986593179800',
  appId: '1:986593179800:web:0301184bed7a5a642778ed'
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
