// Importamos las funciones necesarias desde la CDN (para que funcione sin npm/webpack)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

// Tu configuración web de Firebase
const firebaseConfig = {
    apiKey: "AIzaSyC4p1I4c6JIquY_Jz3Of8HEgvT2BtBdDjE",
    authDomain: "absolute-text-478800-r0.firebaseapp.com",
    projectId: "absolute-text-478800-r0",
    storageBucket: "absolute-text-478800-r0.firebasestorage.app",
    messagingSenderId: "215477168026",
    appId: "1:215477168026:web:946852478d4bf4cd327c23",
    measurementId: "G-MMLGHSCKPD"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);

// Inicializar y exportar los servicios que usa tu app (Auth, DB, Storage)
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

export { app, auth, db, storage };