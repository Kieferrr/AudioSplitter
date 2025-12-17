import { db } from '../config/firebase-config.js';
import {
    collection,
    addDoc,
    query,
    where,
    getDocs,
    orderBy,
    serverTimestamp,
    limit
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

export const dbService = {

    // --- GUARDAR CANCIÓN ---
    async saveSong(userId, songData) {
        try {
            // 1. Verificar límite de 5 canciones
            const songsRef = collection(db, "users", userId, "songs");
            const q = query(songsRef);
            const snapshot = await getDocs(q);

            if (snapshot.size >= 5) {
                throw new Error("Has alcanzado el límite de 5 canciones. Borra alguna para continuar.");
            }

            // 2. Preparar datos
            const newSong = {
                title: songData.originalName,
                createdAt: serverTimestamp(),
                // Guardamos las URLs importantes para reconstruir el reproductor
                urls: songData.files,
                zip: songData.zip || null,
                instrumental: songData.instrumental || null,
                bpm: songData.bpm || 0,
                key: songData.key || "Unknown",
                format: songData.format || 'mp3'
            };

            // 3. Guardar en Firestore
            await addDoc(songsRef, newSong);
            return true;

        } catch (error) {
            console.error("Error guardando canción:", error);
            throw error; // Lanzamos el error para que la UI lo muestre
        }
    },

    // --- OBTENER CANCIONES (Para "Mi Biblioteca") ---
    async getUserSongs(userId) {
        try {
            const songsRef = collection(db, "users", userId, "songs");
            // Ordenamos por fecha (más nuevas primero)
            const q = query(songsRef, orderBy("createdAt", "desc"));

            const snapshot = await getDocs(q);
            return snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
        } catch (error) {
            console.error("Error obteniendo canciones:", error);
            return [];
        }
    }
};