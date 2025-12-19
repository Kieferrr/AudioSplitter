import { auth, db } from '../config/firebase-config.js';
import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    updateProfile,
    sendEmailVerification,
    sendPasswordResetEmail,
    deleteUser // <--- IMPORTANTE: Necesario para borrar la cuenta
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
    doc,
    setDoc,
    serverTimestamp,
    collection,
    query,
    where,
    getDocs
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

export const authService = {

    // --- REGISTRO ---
    async register(email, password, username) {
        try {
            // 1. Verificar si el username ya existe
            const q = query(collection(db, "users"), where("username", "==", username));
            const querySnapshot = await getDocs(q);
            if (!querySnapshot.empty) {
                throw { code: 'custom/username-taken' };
            }

            // 2. Crear usuario
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            let user = userCredential.user;

            // 3. Poner nombre
            await updateProfile(user, { displayName: username });

            // 4. Recargar para asegurar que el nombre esté listo
            await user.reload();
            user = auth.currentUser;

            // 5. Guardar en BD
            await this.saveUserToDB(user, username);

            // 6. ENVIAR CORREO DE VERIFICACIÓN (Silencioso)
            sendEmailVerification(user).catch(err => console.error("Error enviando verificación:", err));

            return user;
        } catch (error) {
            console.error("Error en registro:", error);
            throw this.mapAuthError(error);
        }
    },

    // --- LOGIN ---
    async login(loginInput, password) {
        try {
            let emailToUse = loginInput;

            // Detectar si es Username
            const isEmail = String(loginInput).toLowerCase().match(
                /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
            );

            if (!isEmail) {
                const q = query(collection(db, "users"), where("username", "==", loginInput));
                const querySnapshot = await getDocs(q);

                if (querySnapshot.empty) throw { code: 'auth/user-not-found' };

                const userDoc = querySnapshot.docs[0].data();
                emailToUse = userDoc.email;
            }

            const userCredential = await signInWithEmailAndPassword(auth, emailToUse, password);
            return userCredential.user;

        } catch (error) {
            console.error("Error en login:", error);
            throw this.mapAuthError(error);
        }
    },

    // --- RECUPERAR CONTRASEÑA ---
    async sendPasswordReset(email) {
        try {
            await sendPasswordResetEmail(auth, email);
        } catch (error) {
            console.error("Error reset pass:", error);
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

    // --- BORRAR CUENTA (NUEVO) ---
    async deleteAccount() {
        try {
            const user = auth.currentUser;
            if (user) {
                await deleteUser(user);
            }
        } catch (error) {
            console.error("Error borrando cuenta Auth:", error);
            throw error;
        }
    },

    // --- GUARDAR USUARIO ---
    async saveUserToDB(user, username = null) {
        try {
            const userRef = doc(db, "users", user.uid);
            const userData = {
                email: user.email,
                lastLogin: serverTimestamp(),
                uid: user.uid
            };
            if (username) {
                userData.username = username;
                userData.displayName = username;
            }
            await setDoc(userRef, userData, { merge: true });
        } catch (error) {
            console.error("Error guardando usuario en DB:", error);
        }
    },

    // --- OBSERVADOR ---
    observeAuthState(callback) {
        onAuthStateChanged(auth, (user) => {
            callback(user);
        });
    },

    // --- ERRORES ---
    mapAuthError(error) {
        const code = error.code || '';
        if (code === 'auth/email-already-in-use') return 'Este correo ya está registrado.';
        if (code === 'auth/invalid-email') return 'El correo no es válido.';
        if (code === 'auth/weak-password') return 'La contraseña es muy débil (mínimo 6 caracteres).';
        if (code === 'auth/user-not-found' || code === 'auth/invalid-login-credentials' || code === 'auth/invalid-credential') return 'Usuario o contraseña incorrectos.';
        if (code === 'auth/wrong-password') return 'Usuario o contraseña incorrectos.';
        if (code === 'custom/username-taken') return 'Este nombre de usuario ya está ocupado.';
        return 'Ocurrió un error inesperado. Intenta de nuevo.';
    }
};