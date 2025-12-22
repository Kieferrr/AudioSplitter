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

            await this.saveUserToDB(user, username);
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

            // Sincronización silenciosa (la UI se encargará de mostrar el nombre correcto)
            const userRef = doc(db, "users", user.uid);
            const userSnap = await getDoc(userRef);

            if (userSnap.exists()) {
                const data = userSnap.data();
                const dbName = data.username || data.displayName;

                if (dbName && dbName !== user.displayName) {
                    await updateProfile(user, { displayName: dbName });
                }
                await this.saveUserToDB(user, null);
            } else {
                await this.saveUserToDB(user, user.displayName);
            }

            return auth.currentUser;
        } catch (error) {
            console.error("Error Google Login:", error);
            if (error.code === 'auth/cancelled-popup-request' || error.code === 'auth/popup-closed-by-user') return null;
            throw this.mapAuthError(error);
        }
    },

    // --- OBTENER DATOS REALES DE BD (NUEVO) ---
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

    async deleteAccount() {
        try { const user = auth.currentUser; if (user) await deleteUser(user); }
        catch (error) { throw error; }
    },

    async saveUserToDB(user, username = null) {
        try {
            const userRef = doc(db, "users", user.uid);
            const userData = { email: user.email, lastLogin: serverTimestamp(), uid: user.uid };
            if (username) { userData.displayName = username; userData.username = username; }
            await setDoc(userRef, userData, { merge: true });
        } catch (error) { console.error("Error DB save:", error); }
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