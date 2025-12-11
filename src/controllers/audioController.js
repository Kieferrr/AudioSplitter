import { processAudio } from '../services/audioService.js';
import { bucketName } from '../config/storage.js';
import path from 'path';
import fs from 'fs';

// Función para limpiar nombres (Sanitize)
const sanitizeFilename = (name) => {
    return name
        .replace(/\.[^/.]+$/, "") // Quitar extensión original
        .replace(/[^a-zA-Z0-9]/g, "_") // Símbolos a guion bajo
        .replace(/_+/g, "_") // Evitar __ dobles
        .toLowerCase(); // Todo minúscula
};

export const splitTrack = async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ message: 'No file' });

        const inputPath = req.file.path;
        const randomId = Date.now().toString();
        const format = req.body.format || 'mp3';

        // 1. GENERAR ETIQUETA LIMPIA
        const originalName = req.file.originalname;
        const songLabel = sanitizeFilename(originalName);

        console.log(`📥 Procesando: ${originalName} -> Label: ${songLabel}`);

        // 2. PASAR LABEL A PYTHON
        await processAudio(inputPath, randomId, format, songLabel);

        const stems = ['vocals', 'drums', 'bass', 'other'];

        // 3. GENERAR URLS (Formato: vocals_metallica_one.wav)
        const filesUrls = stems.map(stem => {
            const fileName = `${stem}_${songLabel}.${format}`;

            if (bucketName) {
                return `https://storage.googleapis.com/${bucketName}/stems/${randomId}/${fileName}`;
            } else {
                return `/outputs/${randomId}/${fileName}`;
            }
        });

        // 4. URL DEL ZIP (Nombre: metallica_one_Mix.zip)
        const zipName = `${songLabel}_Mix.zip`;
        let zipUrl = "";
        if (bucketName) {
            zipUrl = `https://storage.googleapis.com/${bucketName}/stems/${randomId}/${zipName}`;
        } else {
            zipUrl = `/outputs/${randomId}/${zipName}`;
        }

        fs.unlink(inputPath, (err) => { if (err) console.error(err); });

        res.json({
            message: 'Separación completada',
            processId: randomId,
            originalName: originalName,
            files: filesUrls,
            zip: zipUrl
        });

    } catch (error) {
        console.error('❌ Error:', error);
        res.status(500).json({ message: 'Error interno', error: error.message });
    }
};