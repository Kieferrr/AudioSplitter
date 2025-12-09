import { downloadFromYoutube } from '../services/youtubeService.js';
import { processAudio } from '../services/audioService.js'; // ¡Reutilizamos esto!
import { bucketName } from '../config/storage.js';
import fs from 'fs';

export const processYoutube = async (req, res) => {
    try {
        const { youtubeUrl } = req.body;

        if (!youtubeUrl) {
            return res.status(400).json({ message: 'Falta la URL de YouTube' });
        }

        const randomId = Date.now().toString();
        console.log(`🔗 Procesando YouTube: ${youtubeUrl}`);

        // 1. Descargar audio desde YouTube (Python yt-dlp)
        const downloadResult = await downloadFromYoutube(youtubeUrl, randomId);
        console.log(`✅ Descarga completada: ${downloadResult.title}`);

        // 2. Separar audio (Python Demucs - Reutilizado)
        // downloadResult.path es "uploads/123456.mp3"
        await processAudio(downloadResult.path, randomId);

        // 3. Generar URLs
        const stems = ['vocals', 'drums', 'bass', 'other'];
        const filesUrls = stems.map(stem => {
            return `https://storage.googleapis.com/${bucketName}/stems/${randomId}/${stem}.mp3`;
        });

        // 4. Limpieza (Borrar el mp3 descargado de uploads)
        fs.unlink(downloadResult.path, (err) => {
            if (err) console.error("Error borrando descarga temporal:", err);
        });

        // 5. Responder
        res.json({
            message: 'Procesamiento de YouTube exitoso',
            processId: randomId,
            originalName: downloadResult.title, // Enviamos el título del video
            files: filesUrls
        });

    } catch (error) {
        console.error('❌ Error YouTube Controller:', error);
        res.status(500).json({ message: 'Error procesando video', error: error.message });
    }
};