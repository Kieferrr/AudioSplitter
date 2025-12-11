import { processAudio } from '../services/audioService.js';
import { bucketName } from '../config/storage.js';
import path from 'path';
import fs from 'fs';

export const splitTrack = async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ message: 'No file' });

        const inputPath = req.file.path;
        const randomId = Date.now().toString();

        // 1. CAPTURAR EL FORMATO (Si no envían nada, default mp3)
        const format = req.body.format || 'mp3';

        console.log(`📥 Archivo: ${req.file.originalname} | Formato: ${format}`);

        // 2. PASAR FORMATO AL SERVICIO
        await processAudio(inputPath, randomId, format);

        const stems = ['vocals', 'drums', 'bass', 'other'];

        // 3. GENERAR URLS DINÁMICAS (Usando ${format})
        const filesUrls = stems.map(stem => {
            if (bucketName) {
                return `https://storage.googleapis.com/${bucketName}/stems/${randomId}/${stem}.${format}`;
            } else {
                return `/outputs/${randomId}/${stem}.${format}`;
            }
        });

        // El ZIP siempre es .zip, así que no cambia su extensión, pero sí su contenido
        let zipUrl = "";
        if (bucketName) {
            zipUrl = `https://storage.googleapis.com/${bucketName}/stems/${randomId}/full_mix.zip`;
        } else {
            zipUrl = `/outputs/${randomId}/full_mix.zip`;
        }

        fs.unlink(inputPath, (err) => { if (err) console.error(err); });

        res.json({
            message: 'Separación completada',
            processId: randomId,
            originalName: req.file.originalname,
            files: filesUrls,
            zip: zipUrl
        });

    } catch (error) {
        console.error('❌ Error:', error);
        res.status(500).json({ message: 'Error interno', error: error.message });
    }
};