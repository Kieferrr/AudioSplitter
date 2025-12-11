import { downloadFromYoutube } from '../services/youtubeService.js';
import { processAudio } from '../services/audioService.js';
import { bucketName } from '../config/storage.js';
import fs from 'fs';

export const processYoutube = async (req, res) => {
    try {
        // 1. AHORA CAPTURAMOS EL FORMATO TAMBIÉN
        const { youtubeUrl, format } = req.body;
        // Si no llega formato, usamos 'mp3' por defecto
        const selectedFormat = format || 'mp3';

        if (!youtubeUrl) {
            return res.status(400).json({ message: 'Falta la URL de YouTube' });
        }

        const randomId = Date.now().toString();
        console.log(`🔗 Procesando YouTube: ${youtubeUrl} | Formato: ${selectedFormat}`);

        // 1. Descargar (Esto siempre baja un temporal, no importa el formato final)
        const downloadResult = await downloadFromYoutube(youtubeUrl, randomId);

        // 2. Separar (Pasamos el formato seleccionado a Python)
        await processAudio(downloadResult.path, randomId, selectedFormat);

        // 3. Generar URLs (HÍBRIDO Y DINÁMICO)
        const stems = ['vocals', 'drums', 'bass', 'other'];
        const filesUrls = stems.map(stem => {
            // Usamos selectedFormat para la extensión correcta (.mp3 o .wav)
            if (bucketName) {
                return `https://storage.googleapis.com/${bucketName}/stems/${randomId}/${stem}.${selectedFormat}`;
            } else {
                return `/outputs/${randomId}/${stem}.${selectedFormat}`;
            }
        });

        // URL del ZIP (Siempre es .zip)
        let zipUrl = "";
        if (bucketName) {
            zipUrl = `https://storage.googleapis.com/${bucketName}/stems/${randomId}/full_mix.zip`;
        } else {
            zipUrl = `/outputs/${randomId}/full_mix.zip`;
        }

        // 4. Limpieza (Borrar el archivo descargado de YT)
        fs.unlink(downloadResult.path, (err) => {
            if (err) console.error("Error borrando descarga temporal:", err);
        });

        // 5. Responder
        res.json({
            message: 'Procesamiento de YouTube exitoso',
            processId: randomId,
            originalName: downloadResult.title,
            files: filesUrls,
            zip: zipUrl
        });

    } catch (error) {
        console.error('❌ Error YouTube Controller:', error);
        res.status(500).json({ message: 'Error procesando video', error: error.message });
    }
};