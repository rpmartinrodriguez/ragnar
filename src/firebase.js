// Ragnar staging: Firebase nuevo importado. Main sigue apuntando a la base original.
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

export const firebaseConfig = {
  apiKey: 'AIzaSyAVxRCZ3gG1QGehoLZ9I1yd-qnhm4MKK3M',
  authDomain: 'ragnar-5f8d7.firebaseapp.com',
  projectId: 'ragnar-5f8d7',
  storageBucket: 'ragnar-5f8d7.firebasestorage.app',
  messagingSenderId: '986593179800',
  appId: '1:986593179800:web:0301184bed7a5a642778ed'
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
