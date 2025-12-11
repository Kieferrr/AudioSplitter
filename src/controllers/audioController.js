import { processAudio } from '../services/audioService.js';
import { bucketName } from '../config/storage.js';
import path from 'path';
import fs from 'fs';

export const splitTrack = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No se subió ningún archivo.' });
        }

        const inputPath = req.file.path;
        const randomId = Date.now().toString();

        console.log(`📥 Archivo recibido: ${req.file.originalname}`);

        // Llamar a Python (Demucs)
        await processAudio(inputPath, randomId);

        // ... (código anterior de stems) ...

        const stems = ['vocals', 'drums', 'bass', 'other'];

        // Generar URLs de los audios
        const filesUrls = stems.map(stem => {
            if (bucketName) {
                return `https://storage.googleapis.com/${bucketName}/stems/${randomId}/${stem}.mp3`;
            } else {
                return `/outputs/${randomId}/${stem}.mp3`;
            }
        });

        // --- NUEVO: Generar URL del ZIP ---
        let zipUrl = "";
        if (bucketName) {
            zipUrl = `https://storage.googleapis.com/${bucketName}/stems/${randomId}/full_mix.zip`;
        } else {
            zipUrl = `/outputs/${randomId}/full_mix.zip`;
        }

        // Limpieza del archivo input...
        fs.unlink(inputPath, (err) => { if (err) console.error(err); });

        // Responder
        res.json({
            message: 'Separación completada con éxito',
            processId: randomId,
            originalName: req.file.originalname,
            files: filesUrls,
            zip: zipUrl // <--- Agregamos esto
        });

    } catch (error) {
        console.error('❌ Error en controlador:', error);
        res.status(500).json({
            message: 'Error interno del servidor.',
            error: error.message
        });
    }
};