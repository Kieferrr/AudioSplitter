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
    getDocs,
    onSnapshot // <--- IMPORTANTE: NECESARIO PARA TIEMPO REAL
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { dbService } from './dbService.js';

export const authService = {

    // --- REGISTRO ---
    async register(email, password, username) {
        try {
            const safeEmail = email.toLowerCase();
            const usernameKey = username.toLowerCase();

            const q = query(collection(db, "users"), where("usernameLower", "==", usernameKey));
            const querySnapshot = await getDocs(q);

            if (!querySnapshot.empty) {
                throw { code: 'custom/username-taken' };
            }

            const userCredential = await createUserWithEmailAndPassword(auth, safeEmail, password);
            let user = userCredential.user;

            await updateProfile(user, { displayName: username });
            await user.reload();
            user = auth.currentUser;

            await this.saveUserToDB(user, username, true);
            sendEmailVerification(user).catch(err => console.error(err));

            return user;
        } catch (error) {
            console.error("Error registro:", error);
            throw this.mapAuthError(error);
        }
    },

    // --- LOGIN BLINDADO ---
    async login(loginInput, password) {
        try {
            let emailToUse = loginInput.trim();
            const isEmail = emailToUse.includes('@');

            if (isEmail) {
                emailToUse = emailToUse.toLowerCase();
            } else {
                console.log(`🔍 Buscando usuario: "${loginInput}"...`);
                const inputLower = loginInput.toLowerCase();
                let q = query(collection(db, "users"), where("usernameLower", "==", inputLower));
                let snapshot = await getDocs(q);

                if (snapshot.empty) {
                    console.log("⚠️ No encontrado por minúscula. Intentando legacy...");
                    q = query(collection(db, "users"), where("username", "==", loginInput));
                    snapshot = await getDocs(q);
                }

                if (snapshot.empty) throw { code: 'auth/user-not-found' };

                const userDoc = snapshot.docs[0].data();
                emailToUse = userDoc.email;
            }

            const userCredential = await signInWithEmailAndPassword(auth, emailToUse, password);
            await this.saveUserToDB(userCredential.user, null, false);
            return userCredential.user;

        } catch (error) {
            console.error("Error login:", error);
            throw this.mapAuthError(error);
        }
    },

    async loginWithGoogle() {
        try {
            const provider = new GoogleAuthProvider();
            provider.setCustomParameters({ prompt: 'select_account' });
            const result = await signInWithPopup(auth, provider);
            const user = result.user;

            const userRef = doc(db, "users", user.uid);
            const userSnap = await getDoc(userRef);

            if (userSnap.exists()) {
                await this.saveUserToDB(user, null, false);
            } else {
                await this.saveUserToDB(user, user.displayName, true);
            }
            return auth.currentUser;
        } catch (error) {
            if (error.code === 'auth/cancelled-popup-request' || error.code === 'auth/popup-closed-by-user') return null;
            throw this.mapAuthError(error);
        }
    },

    // --- LEER DATOS (FETCH ÚNICO) ---
    async getUserData(uid) {
        try {
            const userRef = doc(db, "users", uid);
            const snap = await getDoc(userRef);
            if (snap.exists()) return snap.data();
            return null;
        } catch (error) {
            return null;
        }
    },

    // --- NUEVO: ESCUCHAR DATOS (TIEMPO REAL) 📡 ---
    // Esto arregla el problema de los 0 créditos
    subscribeToUser(uid, callback) {
        const userRef = doc(db, "users", uid);
        // onSnapshot se queda escuchando cambios.
        // Si al principio falla o es lento, se actualiza solo después.
        const unsubscribe = onSnapshot(userRef, (doc) => {
            if (doc.exists()) {
                callback(doc.data());
            } else {
                callback(null);
            }
        }, (error) => {
            console.error("Error escuchando usuario:", error);
            callback(null);
        });
        return unsubscribe; // Devolvemos la función para "colgar" la llamada
    },

    async sendPasswordReset(email) {
        try { await sendPasswordResetEmail(auth, email); }
        catch (error) { throw this.mapAuthError(error); }
    },

    async logout() {
        try { await signOut(auth); }
        catch (error) { console.error(error); }
    },

    async deleteAccount() {
        try {
            const user = auth.currentUser;
            if (user) {
                const userData = await this.getUserData(user.uid);
                const currentCredits = userData ? (userData.credits || 0) : 0;

                if (user.email) {
                    await setDoc(doc(db, "deleted_history", user.email.toLowerCase()), {
                        credits: currentCredits,
                        deletedAt: serverTimestamp(),
                        lastUid: user.uid
                    });
                }
                await dbService.deleteUserAccountData(user.uid);
                await deleteUser(user);
            }
        } catch (error) {
            console.error(error);
            if (error.code === 'auth/requires-recent-login') throw "Por seguridad, debes cerrar sesión e iniciar de nuevo.";
            throw error;
        }
    },

    async saveUserToDB(user, username = null, isNewUser = false) {
        try {
            const userRef = doc(db, "users", user.uid);
            const emailKey = user.email.toLowerCase();

            if (isNewUser) {
                let initialCredits = 100;
                const historyRef = doc(db, "deleted_history", emailKey);
                const historySnap = await getDoc(historyRef);

                if (historySnap.exists()) {
                    const historyData = historySnap.data();
                    initialCredits = historyData.credits !== undefined ? historyData.credits : 0;
                }

                const visualName = username || user.displayName || "Usuario";

                const newUserPayload = {
                    uid: user.uid,
                    email: emailKey,
                    displayName: visualName,
                    username: visualName,
                    usernameLower: visualName.toLowerCase(),
                    photoURL: user.photoURL || null,
                    createdAt: serverTimestamp(),
                    lastLogin: serverTimestamp(),
                    role: 'user',
                    credits: initialCredits
                };

                await setDoc(userRef, newUserPayload, { merge: true });

            } else {
                const currentSnap = await getDoc(userRef);
                const updatePayload = { lastLogin: serverTimestamp() };

                if (username) {
                    updatePayload.displayName = username;
                    updatePayload.username = username;
                    updatePayload.usernameLower = username.toLowerCase();
                }
                else if (currentSnap.exists()) {
                    const data = currentSnap.data();
                    if (data.username && !data.usernameLower) {
                        updatePayload.usernameLower = data.username.toLowerCase();
                    }
                }

                await setDoc(userRef, {
                    ...updatePayload,
                    uid: user.uid,
                    email: emailKey
                }, { merge: true });
            }
        } catch (error) {
            console.error("Error DB:", error);
        }
    },

    observeAuthState(callback) { onAuthStateChanged(auth, callback); },

    mapAuthError(error) {
        const code = error.code || '';
        if (code === 'auth/email-already-in-use') return 'Este correo ya está registrado.';
        if (code === 'auth/invalid-email') return 'El correo no es válido.';
        if (code === 'auth/user-not-found' || code === 'auth/invalid-credential') return 'Credenciales incorrectas.';
        if (code === 'custom/username-taken') return 'Ese usuario ya existe.';
        return 'Error inesperado.';
    }
};