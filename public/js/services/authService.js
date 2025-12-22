import { auth, db } from '../config/firebase-config.js';
import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    updateProfile,
    sendEmailVerification,
    sendPasswordResetEmail,
    deleteUser,
    GoogleAuthProvider,
    signInWithPopup
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
    doc,
    setDoc,
    getDoc,
    updateDoc,
    deleteDoc,
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
            const q = query(collection(db, "users"), where("username", "==", username));
            const querySnapshot = await getDocs(q);
            if (!querySnapshot.empty) {
                throw { code: 'custom/username-taken' };
            }

            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            let user = userCredential.user;

            await updateProfile(user, { displayName: username });
            await user.reload();
            user = auth.currentUser;

            // Al registrarse, pasamos el flag isNew = true
            await this.saveUserToDB(user, username, true);
            sendEmailVerification(user).catch(err => console.error("Error enviando verificación:", err));

            return user;
        } catch (error) {
            console.error("Error en registro:", error);
            throw this.mapAuthError(error);
        }
    },

    // --- LOGIN CON CORREO ---
    async login(loginInput, password) {
        try {
            let emailToUse = loginInput;
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
            // En login normal, solo actualizamos fecha (isNew = false)
            await this.saveUserToDB(userCredential.user, null, false);
            return userCredential.user;
        } catch (error) {
            console.error("Error en login:", error);
            throw this.mapAuthError(error);
        }
    },

    // --- LOGIN CON GOOGLE ---
    async loginWithGoogle() {
        try {
            const provider = new GoogleAuthProvider();
            provider.setCustomParameters({ prompt: 'select_account' });

            const result = await signInWithPopup(auth, provider);
            const user = result.user;

            // Sincronización silenciosa
            const userRef = doc(db, "users", user.uid);
            const userSnap = await getDoc(userRef);

            if (userSnap.exists()) {
                // USUARIO EXISTENTE
                const data = userSnap.data();
                const dbName = data.username || data.displayName;

                if (dbName && dbName !== user.displayName) {
                    await updateProfile(user, { displayName: dbName });
                }
                // Actualizamos fecha (isNew = false)
                await this.saveUserToDB(user, null, false);
            } else {
                // USUARIO NUEVO
                // Guardamos con nombre de Google y (isNew = true) para dar créditos
                await this.saveUserToDB(user, user.displayName, true);
            }

            return auth.currentUser;
        } catch (error) {
            console.error("Error Google Login:", error);
            if (error.code === 'auth/cancelled-popup-request' || error.code === 'auth/popup-closed-by-user') return null;
            throw this.mapAuthError(error);
        }
    },

    // --- OBTENER DATOS REALES DE BD ---
    async getUserData(uid) {
        try {
            const userRef = doc(db, "users", uid);
            const snap = await getDoc(userRef);
            if (snap.exists()) return snap.data();
            return null;
        } catch (error) {
            console.error("Error obteniendo datos usuario:", error);
            return null;
        }
    },

    // --- UTILS ---
    async sendPasswordReset(email) {
        try { await sendPasswordResetEmail(auth, email); }
        catch (error) { throw this.mapAuthError(error); }
    },

    async logout() {
        try { await signOut(auth); }
        catch (error) { console.error("Error logout:", error); }
    },

    // --- BORRAR CUENTA COMPLETA (DB + AUTH) ---
    async deleteAccount() {
        try {
            const user = auth.currentUser;
            if (user) {
                // 1. Primero borramos sus datos en Firestore
                const userRef = doc(db, "users", user.uid);
                await deleteDoc(userRef);

                // 2. Luego borramos su acceso (Auth)
                await deleteUser(user);
            }
        } catch (error) {
            console.error("Error borrando cuenta:", error);
            // Si falla porque hace mucho que no se loguea, Firebase pide re-login
            if (error.code === 'auth/requires-recent-login') {
                throw "Por seguridad, debes cerrar sesión e iniciar de nuevo antes de borrar tu cuenta.";
            }
            throw error;
        }
    },

    // --- GUARDAR USUARIO EN FIRESTORE (ECONOMÍA Y ROLES) ---
    async saveUserToDB(user, username = null, isNewUser = false) {
        try {
            const userRef = doc(db, "users", user.uid);

            if (isNewUser) {
                // --- CASO 1: USUARIO NUEVO (REGALAMOS CRÉDITOS) ---
                const newUserPayload = {
                    uid: user.uid,
                    email: user.email,
                    displayName: username || user.displayName,
                    username: username || user.displayName || "Usuario",
                    photoURL: user.photoURL || null,
                    createdAt: serverTimestamp(),
                    lastLogin: serverTimestamp(),
                    // --- AQUÍ ESTÁ LA MAGIA ---
                    role: 'user',       // Rol por defecto
                    credits: 100        // Créditos de bienvenida
                };

                // Usamos setDoc para crear el documento inicial
                await setDoc(userRef, newUserPayload, { merge: true });
                console.log("🎉 Usuario creado con 100 créditos de regalo.");

            } else {
                // --- CASO 2: USUARIO ANTIGUO (SOLO ACTUALIZAMOS LOGIN) ---
                // Usamos updateDoc para NO tocar los créditos ni el rol accidentalmente
                const updatePayload = {
                    lastLogin: serverTimestamp()
                };
                // Solo actualizamos nombre si se proporciona explícitamente
                if (username) updatePayload.displayName = username;

                // updateDoc falla si el documento no existe, así que hacemos un fallback seguro
                try {
                    await updateDoc(userRef, updatePayload);
                } catch (e) {
                    // Si por alguna razón rara no existía el doc, lo creamos
                    await setDoc(userRef, {
                        ...updatePayload,
                        uid: user.uid,
                        email: user.email,
                        role: 'user',
                        credits: 100
                    }, { merge: true });
                }
            }
        } catch (error) {
            console.error("Error guardando usuario en DB:", error);
        }
    },

    observeAuthState(callback) {
        onAuthStateChanged(auth, (user) => callback(user));
    },

    mapAuthError(error) {
        const code = error.code || '';
        if (code === 'auth/email-already-in-use') return 'Este correo ya está registrado.';
        if (code === 'auth/invalid-email') return 'El correo no es válido.';
        if (code === 'auth/weak-password') return 'Contraseña débil.';
        if (code === 'auth/user-not-found' || code === 'auth/invalid-credential') return 'Credenciales incorrectas.';
        if (code === 'custom/username-taken') return 'Usuario ya existe.';
        return 'Error inesperado.';
    }
};