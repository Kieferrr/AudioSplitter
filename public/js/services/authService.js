import { auth, db } from '../config/firebase-config.js';
import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, setDoc, getDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

export const authService = {

    // --- REGISTRO ---
    async register(email, password) {
        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // Crear documento del usuario en Firestore
            await this.saveUserToDB(user);
            return user;
        } catch (error) {
            console.error("Error en registro:", error);
            throw this.mapAuthError(error);
        }
    },

    // --- LOGIN ---
    async login(email, password) {
        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            return userCredential.user;
        } catch (error) {
            console.error("Error en login:", error);
            throw this.mapAuthError(error);
        }
    },

    // --- LOGOUT ---
    async logout() {
        try {
            await signOut(auth);
        } catch (error) {
            console.error("Error cerrando sesión:", error);
        }
    },

    // --- GUARDAR USUARIO EN BD ---
    async saveUserToDB(user) {
        try {
            const userRef = doc(db, "users", user.uid);
            // setDoc con { merge: true } actualiza si existe, crea si no
            await setDoc(userRef, {
                email: user.email,
                lastLogin: serverTimestamp(),
                uid: user.uid
            }, { merge: true });
        } catch (error) {
            console.error("Error guardando usuario en DB:", error);
        }
    },

    // --- ESCUCHAR ESTADO (OBSERVADOR) ---
    // Esta función avisa automáticamente cuando el usuario entra o sale
    observeAuthState(callback) {
        onAuthStateChanged(auth, (user) => {
            callback(user);
        });
    },

    // --- TRADUCTOR DE ERRORES DE FIREBASE A ESPAÑOL ---
    mapAuthError(error) {
        const code = error.code;
        if (code === 'auth/email-already-in-use') return 'Este correo ya está registrado.';
        if (code === 'auth/invalid-email') return 'El correo no es válido.';
        if (code === 'auth/weak-password') return 'La contraseña es muy débil (mínimo 6 caracteres).';
        if (code === 'auth/user-not-found') return 'Usuario no encontrado.';
        if (code === 'auth/wrong-password') return 'Contraseña incorrecta.';
        if (code === 'auth/invalid-credential') return 'Credenciales inválidas.';
        return 'Ocurrió un error inesperado. Intenta de nuevo.';
    }
};