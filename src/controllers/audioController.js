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

        // Stems esperados
        const stems = ['vocals', 'drums', 'bass', 'other'];

        // --- LÓGICA HÍBRIDA DE URLS ---
        const filesUrls = stems.map(stem => {
            if (bucketName) {
                // MODO NUBE: Link de Google Storage
                return `https://storage.googleapis.com/${bucketName}/stems/${randomId}/${stem}.mp3`;
            } else {
                // MODO LOCAL: Link relativo a tu servidor
                return `/outputs/${randomId}/${stem}.mp3`;
            }
        });

        // Limpieza: Borramos SIEMPRE el archivo original subido (input)
        fs.unlink(inputPath, (err) => {
            if (err) console.error("Error borrando temporal:", err);
        });

        // Responder
        res.json({
            message: 'Separación completada con éxito',
            processId: randomId,
            originalName: req.file.originalname,
            files: filesUrls
        });

    } catch (error) {
        console.error('❌ Error en controlador:', error);
        res.status(500).json({
            message: 'Error interno del servidor.',
            error: error.message
        });
    }
};