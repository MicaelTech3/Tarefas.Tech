// Firebase config + inicialização (v9 modular)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

export const app = initializeApp({
  apiKey: "AIzaSyCPaEHGkmNdg7ibvq5C6AyEnNTfr1vREVc",
  authDomain: "tarefas-tech.firebaseapp.com",
  databaseURL: "https://tarefas-tech-default-rtdb.firebaseio.com",
  projectId: "tarefas-tech",
  storageBucket: "tarefas-tech.appspot.com",
  messagingSenderId: "878840840919",
  appId: "1:878840840919:web:1232d415e38d9ff526e692"
});

export const db = getDatabase(app);
export const auth = getAuth(app);

// Login anônimo
signInAnonymously(auth).catch(console.error);

// Função para aguardar login antes de continuar
export function onAuthReady(callback) {
  onAuthStateChanged(auth, (user) => {
    if (user) callback(user);
  });
}