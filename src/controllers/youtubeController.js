import { downloadFromYoutube } from '../services/youtubeService.js';
import { processAudio } from '../services/audioService.js';
import { bucketName } from '../config/storage.js';
import fs from 'fs';

// Reutilizamos la función de limpieza
const sanitizeFilename = (name) => {
    return name
        .replace(/\.[^/.]+$/, "")
        .replace(/[^a-zA-Z0-9]/g, "_")
        .replace(/_+/g, "_")
        .toLowerCase();
};

export const processYoutube = async (req, res) => {
    try {
        const { youtubeUrl, format } = req.body;
        const selectedFormat = format || 'mp3';

        if (!youtubeUrl) return res.status(400).json({ message: 'Falta URL' });

        const randomId = Date.now().toString();

        // 1. Descargar
        const downloadResult = await downloadFromYoutube(youtubeUrl, randomId);

        // 2. Limpiar nombre del video de YouTube
        const songLabel = sanitizeFilename(downloadResult.title);

        console.log(`🔗 YT: ${downloadResult.title} -> Label: ${songLabel}`);

        // 3. Separar (Pasamos songLabel)
        await processAudio(downloadResult.path, randomId, selectedFormat, songLabel);

        const stems = ['vocals', 'drums', 'bass', 'other'];

        // 4. URLs (Formato: vocals_metallica_one.wav)
        const filesUrls = stems.map(stem => {
            const fileName = `${stem}_${songLabel}.${selectedFormat}`;
            if (bucketName) {
                return `https://storage.googleapis.com/${bucketName}/stems/${randomId}/${fileName}`;
            } else {
                return `/outputs/${randomId}/${fileName}`;
            }
        });

        // URL ZIP
        const zipName = `${songLabel}_Mix.zip`;
        let zipUrl = "";
        if (bucketName) {
            zipUrl = `https://storage.googleapis.com/${bucketName}/stems/${randomId}/${zipName}`;
        } else {
            zipUrl = `/outputs/${randomId}/${zipName}`;
        }

        fs.unlink(downloadResult.path, (err) => { });

        res.json({
            message: 'Éxito',
            processId: randomId,
            originalName: downloadResult.title,
            files: filesUrls,
            zip: zipUrl
        });

    } catch (error) {
        console.error('❌ Error YT:', error);
        res.status(500).json({ message: 'Error procesando video', error: error.message });
    }
};