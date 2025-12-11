import { downloadFromYoutube } from '../services/youtubeService.js';
import { processAudio } from '../services/audioService.js';
import { bucketName } from '../config/storage.js';
import fs from 'fs';

// Función para limpiar nombres (Sanitize) - Igual que en audioController
const sanitizeFilename = (name) => {
    return name
        .replace(/\.[^/.]+$/, "") // Quitar extensión si la tuviera
        .replace(/[^a-zA-Z0-9]/g, "_") // Reemplazar símbolos por guion bajo
        .replace(/_+/g, "_") // Evitar guiones dobles
        .toLowerCase(); // Todo minúscula
};

export const processYoutube = async (req, res) => {
    try {
        const { youtubeUrl, format } = req.body;
        // Si no llega formato, usamos 'mp3' por defecto
        const selectedFormat = format || 'mp3';

        if (!youtubeUrl) {
            return res.status(400).json({ message: 'Falta la URL de YouTube' });
        }

        const randomId = Date.now().toString();

        // 1. Descargar video de YouTube
        console.log(`🔗 Procesando YouTube: ${youtubeUrl} | Formato: ${selectedFormat}`);
        const downloadResult = await downloadFromYoutube(youtubeUrl, randomId);

        // 2. Limpiar nombre (Usamos el título del video)
        const songLabel = sanitizeFilename(downloadResult.title);
        console.log(`🏷️ Label generado: ${songLabel}`);

        // 3. Separar Audio (Pasamos el formato y el label a Python)
        // Python generará: instrumental_label.format, vocals_label.format, etc.
        const result = await processAudio(downloadResult.path, randomId, selectedFormat, songLabel);

        // 4. Generar URLs para los REPRODUCTORES (Solo los 4 originales)
        const stems = ['vocals', 'drums', 'bass', 'other'];

        const filesUrls = stems.map(stem => {
            const fileName = `${stem}_${songLabel}.${selectedFormat}`;

            if (bucketName) {
                return `https://storage.googleapis.com/${bucketName}/stems/${randomId}/${fileName}`;
            } else {
                return `/outputs/${randomId}/${fileName}`;
            }
        });

        // 5. Generar URL para el INSTRUMENTAL (Botón de descarga)
        const instrName = `instrumental_${songLabel}.${selectedFormat}`;
        let instrUrl = "";

        if (bucketName) {
            instrUrl = `https://storage.googleapis.com/${bucketName}/stems/${randomId}/${instrName}`;
        } else {
            instrUrl = `/outputs/${randomId}/${instrName}`;
        }

        // 6. Generar URL del ZIP
        const zipName = `${songLabel}_Mix.zip`;
        let zipUrl = "";

        if (bucketName) {
            zipUrl = `https://storage.googleapis.com/${bucketName}/stems/${randomId}/${zipName}`;
        } else {
            zipUrl = `/outputs/${randomId}/${zipName}`;
        }

        // 7. Limpieza (Borrar el archivo descargado de YT)
        fs.unlink(downloadResult.path, (err) => {
            if (err) console.error("⚠️ Error borrando descarga temporal de YT:", err);
        });

        // 8. Responder al Frontend
        res.json({
            message: 'Procesamiento de YouTube exitoso',
            processId: randomId,
            originalName: downloadResult.title,
            bpm: result.analysis.bpm,   // <--- NUEVO
            key: result.analysis.key,   // <--- NUEVO
            files: filesUrls,      // Array [URL, URL, URL, URL] para los reproductores
            zip: zipUrl,           // URL para el botón ZIP
            instrumental: instrUrl // URL para el botón Instrumental
        });

    } catch (error) {
        console.error('❌ Error YouTube Controller:', error);
        res.status(500).json({ message: 'Error procesando video', error: error.message });
    }
};