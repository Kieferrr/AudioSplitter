// Usamos URLs directas (CDN) para que funcione en el navegador sin instalar nada extra
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Tu configuración (La dejé tal cual me la pasaste)
const firebaseConfig = {
    apiKey: "AIzaSyC4p1I4c6JIquY_Jz3Of8HEgvT2BtBdDjE",
    authDomain: "absolute-text-478800-r0.firebaseapp.com",
    projectId: "absolute-text-478800-r0",
    storageBucket: "absolute-text-478800-r0.firebasestorage.app",
    messagingSenderId: "215477168026",
    appId: "1:215477168026:web:946852478d4bf4cd327c23",
    measurementId: "G-MMLGHSCKPD"
};

// 1. Inicializar App
const app = initializeApp(firebaseConfig);

// 2. Inicializar Servicios (Para usarlos en otros archivos)
const auth = getAuth(app);
const db = getFirestore(app);

// 3. Exportarlos
export { app, auth, db };