import { processAudio } from '../services/audioService.js';
import { bucket, bucketName } from '../config/storage.js';
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

        // Stems esperados de Demucs
        const stems = ['vocals', 'drums', 'bass', 'other'];

        const filesUrls = stems.map(stem => {
            return `https://storage.googleapis.com/${bucketName}/stems/${randomId}/${stem}.mp3`;
        });

        // Limpieza
        fs.unlink(inputPath, (err) => {
            if (err) console.error("Error borrando temporal:", err);
        });

        // Responder (INCLUYENDO EL NOMBRE ORIGINAL)
        res.json({
            message: 'Separación completada con éxito',
            processId: randomId,
            originalName: req.file.originalname, // <--- ESTO ES VITAL PARA EL TÍTULO
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