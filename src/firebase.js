// src/firebase.js
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore'; // Importamos la base de datos

// Tu configuración (La que me pasaste)
const firebaseConfig = {
  apiKey: 'AIzaSyAtzIf6JGLQuDVYc6poZAOMgmjEzbEaZk0',
  authDomain: 'ragnar-training.firebaseapp.com',
  projectId: 'ragnar-training',
  storageBucket: 'ragnar-training.firebasestorage.app',
  messagingSenderId: '727763697342',
  appId: '1:727763697342:web:094a55944d708a80f568ef',
};

// 1. Inicializar Firebase
const app = initializeApp(firebaseConfig);

// 2. Inicializar y exportar la Base de Datos (Firestore)
export const db = getFirestore(app);
