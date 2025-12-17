import { db } from '../config/firebase-config.js';
import {
    collection, addDoc, query, getDocs, orderBy, serverTimestamp, deleteDoc, doc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

export const dbService = {

    async saveSong(userId, songData) {
        try {
            // 1. Verificar límite
            const songsRef = collection(db, "users", userId, "songs");
            const q = query(songsRef);
            const snapshot = await getDocs(q);
            if (snapshot.size >= 5) throw new Error("Límite de 5 canciones alcanzado. Borra alguna.");

            // 2. Preparar archivos
            const filesToSave = [...songData.files];
            if (songData.zip) filesToSave.push(songData.zip);
            if (songData.instrumental) filesToSave.push(songData.instrumental);

            // 3. Guardar en Nube (CON CARPETA ORGANIZADA)
            const response = await fetch('/api/save-song', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    urls: filesToSave,
                    userId: userId,
                    songTitle: songData.originalName || "Mi_Mezcla"
                })
            });

            if (!response.ok) throw new Error("Error asegurando archivos en la nube.");
            const result = await response.json();
            const newUrls = result.savedUrls;

            // 4. Reasignar URLs (Mismo orden)
            const newFiles = newUrls.slice(0, songData.files.length);
            let newZip = null, newInst = null;
            let idx = songData.files.length;

            if (songData.zip) newZip = newUrls[idx++];
            if (songData.instrumental) newInst = newUrls[idx++];

            // 5. Guardar en BD
            await addDoc(songsRef, {
                title: songData.originalName,
                createdAt: serverTimestamp(),
                urls: newFiles,
                zip: newZip,
                instrumental: newInst,
                bpm: songData.bpm || 0,
                key: songData.key || "Unknown",
                format: songData.format || 'mp3'
            });
            return true;
        } catch (error) { console.error(error); throw error; }
    },

    async getUserSongs(userId) {
        try {
            const q = query(collection(db, "users", userId, "songs"), orderBy("createdAt", "desc"));
            return (await getDocs(q)).docs.map(d => ({ id: d.id, ...d.data() }));
        } catch (e) { return []; }
    },

    // --- BORRADO REAL (CARPETA COMPLETA) ---
    async deleteSong(userId, songId, songData) {
        try {
            // 1. Detectar la carpeta de la canción en la nube
            const anyUrl = songData.urls?.[0] || songData.zip || songData.instrumental;

            if (anyUrl) {
                // A. Decodificamos la URL por si tiene espacios (%20) u otros símbolos
                const decodedUrl = decodeURIComponent(anyUrl);

                // B. Buscamos el marcador clave "saved_songs/"
                // La URL típica es: .../bucket/saved_songs/USER/CARPETA/archivo.mp3
                const marker = "saved_songs/";
                const parts = decodedUrl.split(marker);

                if (parts.length > 1) {
                    // Tomamos la parte derecha: USER/CARPETA/archivo.mp3
                    const pathWithFile = parts[1];

                    // Quitamos el nombre del archivo para dejar solo la carpeta
                    // Buscamos el último slash "/"
                    const lastSlashIndex = pathWithFile.lastIndexOf('/');

                    if (lastSlashIndex !== -1) {
                        // Reconstruimos la ruta: saved_songs/USER/CARPETA/
                        const folderPath = marker + pathWithFile.substring(0, lastSlashIndex + 1);

                        console.log("📂 Carpeta detectada para borrar:", folderPath);

                        // C. Llamada al servidor
                        const response = await fetch('/api/delete-song', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ folderPath })
                        });

                        // D. FRENO DE EMERGENCIA 🚨
                        // Si el servidor dice "Error 400/500", lanzamos error y NO borramos de la DB
                        if (!response.ok) {
                            const errData = await response.json();
                            throw new Error(errData.error || "Error al borrar archivos de la nube");
                        }
                    } else {
                        console.warn("⚠️ No se pudo aislar la carpeta de la URL:", decodedUrl);
                    }
                } else {
                    console.warn("⚠️ La URL no contiene 'saved_songs/'. ¿Es un archivo antiguo?", decodedUrl);
                }
            }

            // 2. Si llegamos aquí, la nube se borró bien. Ahora borramos la BD.
            await deleteDoc(doc(db, "users", userId, "songs", songId));
            return true;

        } catch (error) {
            console.error("❌ Error en proceso de borrado:", error);
            // Re-lanzamos el error para que el usuario vea la alerta
            throw error;
        }
    }
};