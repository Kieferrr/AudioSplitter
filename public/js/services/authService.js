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
    signInWithPopup,
    updatePassword
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
    onSnapshot
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import {
    getStorage,
    ref,
    uploadBytes,
    getDownloadURL,
    listAll,
    deleteObject
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

import { dbService } from './dbService.js';

export const authService = {

    // --- CAMBIAR NOMBRE DE USUARIO (Límite 15) ---
    async updateUsername(newUsername) {
        try {
            const user = auth.currentUser;
            if (!user) throw new Error("No hay sesión activa");

            const cleanName = newUsername.trim();
            const cleanLower = cleanName.toLowerCase();

            // Límite ajustado para no romper la UI
            if (cleanName.length < 3 || cleanName.length > 15) {
                throw new Error("El nombre debe tener entre 3 y 15 caracteres.");
            }

            // Verificar duplicados
            const q = query(collection(db, "users"), where("usernameLower", "==", cleanLower));
            const snapshot = await getDocs(q);

            if (!snapshot.empty) {
                const docFound = snapshot.docs[0];
                if (docFound.id !== user.uid) {
                    throw new Error("Ese nombre de usuario ya está en uso.");
                }
            }

            await updateProfile(user, { displayName: cleanName });

            const userRef = doc(db, "users", user.uid);
            await updateDoc(userRef, {
                username: cleanName,
                usernameLower: cleanLower,
                displayName: cleanName
            });

            return true;
        } catch (error) {
            console.error("Error actualizando username:", error);
            throw error;
        }
    },

    // --- REGISTRO ---
    async register(email, password, username) {
        try {
            const safeEmail = email.toLowerCase();
            const usernameKey = username.toLowerCase();

            const q = query(collection(db, "users"), where("usernameLower", "==", usernameKey));
            const querySnapshot = await getDocs(q);

            if (!querySnapshot.empty) throw { code: 'custom/username-taken' };

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

    // --- LOGIN ---
    async login(loginInput, password) {
        try {
            let emailToUse = loginInput.trim();
            const isEmail = emailToUse.includes('@');

            if (isEmail) {
                emailToUse = emailToUse.toLowerCase();
            } else {
                const inputLower = loginInput.toLowerCase();
                let q = query(collection(db, "users"), where("usernameLower", "==", inputLower));
                let snapshot = await getDocs(q);

                if (snapshot.empty) {
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

    async getUserData(uid) {
        try {
            const userRef = doc(db, "users", uid);
            const snap = await getDoc(userRef);
            if (snap.exists()) return snap.data();
            return null;
        } catch (error) { return null; }
    },

    subscribeToUser(uid, callback) {
        const userRef = doc(db, "users", uid);
        return onSnapshot(userRef, (doc) => {
            if (doc.exists()) callback(doc.data());
            else callback(null);
        }, (error) => callback(null));
    },

    async deleteOldAvatars(uid) {
        try {
            const storage = getStorage();
            const folderRef = ref(storage, `profile_pictures/${uid}`);
            const listResult = await listAll(folderRef);
            const deletePromises = listResult.items.map((itemRef) => deleteObject(itemRef));
            await Promise.all(deletePromises);
        } catch (error) { console.warn(error); }
    },

    async updateAvatar(file) {
        try {
            const user = auth.currentUser;
            if (!user) throw new Error("No hay sesión activa");
            await this.deleteOldAvatars(user.uid);
            const storage = getStorage();
            const storageRef = ref(storage, `profile_pictures/${user.uid}/avatar_${Date.now()}`);
            await uploadBytes(storageRef, file);
            const photoURL = await getDownloadURL(storageRef);
            await updateProfile(user, { photoURL: photoURL });
            const userRef = doc(db, "users", user.uid);
            await updateDoc(userRef, { photoURL: photoURL });
            return photoURL;
        } catch (error) { throw error; }
    },

    async setAvatarPreset(presetString) {
        try {
            const user = auth.currentUser;
            if (!user) throw new Error("No sesión");
            await this.deleteOldAvatars(user.uid);
            await updateProfile(user, { photoURL: presetString });
            const userRef = doc(db, "users", user.uid);
            await updateDoc(userRef, { photoURL: presetString });
            return true;
        } catch (error) { throw error; }
    },

    async changeUserPassword(newPassword) {
        try {
            const user = auth.currentUser;
            if (!user) throw new Error("No sesión");
            await updatePassword(user, newPassword);
            return true;
        } catch (error) {
            if (error.code === 'auth/requires-recent-login') throw "Cierra sesión y vuelve a entrar para cambiar contraseña.";
            throw this.mapAuthError(error);
        }
    },

    async sendPasswordReset(email) { try { await sendPasswordResetEmail(auth, email); } catch (e) { throw this.mapAuthError(e); } },
    async logout() { try { await signOut(auth); } catch (e) { } },

    async deleteAccount() {
        try {
            const user = auth.currentUser;
            if (user) {
                await this.deleteOldAvatars(user.uid);
                const userData = await this.getUserData(user.uid);
                const credits = userData ? (userData.credits || 0) : 0;
                if (user.email) {
                    await setDoc(doc(db, "deleted_history", user.email.toLowerCase()), {
                        credits, deletedAt: serverTimestamp(), lastUid: user.uid
                    });
                }
                await dbService.deleteUserAccountData(user.uid);
                await deleteUser(user);
            }
        } catch (error) {
            if (error.code === 'auth/requires-recent-login') throw "Por seguridad, relogueate antes de borrar.";
            throw error;
        }
    },

    async saveUserToDB(user, username = null, isNewUser = false) {
        try {
            const userRef = doc(db, "users", user.uid);
            const emailKey = user.email.toLowerCase();
            if (isNewUser) {
                let initialCredits = 100;
                const hRef = doc(db, "deleted_history", emailKey);
                const hSnap = await getDoc(hRef);
                if (hSnap.exists()) initialCredits = hSnap.data().credits || 0;
                const vName = username || user.displayName || "Usuario";
                await setDoc(userRef, {
                    uid: user.uid, email: emailKey, displayName: vName, username: vName,
                    usernameLower: vName.toLowerCase(), photoURL: user.photoURL || null,
                    createdAt: serverTimestamp(), lastLogin: serverTimestamp(), role: 'user', credits: initialCredits
                }, { merge: true });
            } else {
                const cSnap = await getDoc(userRef);
                const up = { lastLogin: serverTimestamp() };
                if (username) {
                    up.displayName = username; up.username = username; up.usernameLower = username.toLowerCase();
                } else if (cSnap.exists()) {
                    const d = cSnap.data();
                    if (d.username && !d.usernameLower) up.usernameLower = d.username.toLowerCase();
                }
                await setDoc(userRef, { ...up, uid: user.uid, email: emailKey }, { merge: true });
            }
        } catch (error) { console.error("Error DB:", error); }
    },

    observeAuthState(cb) { onAuthStateChanged(auth, cb); },
    mapAuthError(error) {
        const code = error.code || '';
        if (code === 'auth/email-already-in-use') return 'Correo registrado.';
        if (code === 'auth/invalid-email') return 'Correo inválido.';
        if (code === 'auth/weak-password') return 'Contraseña débil.';
        if (code === 'auth/user-not-found' || code === 'auth/invalid-credential') return 'Credenciales incorrectas.';
        if (code === 'custom/username-taken') return 'Usuario ya existe.';
        return 'Error inesperado.';
    }
};