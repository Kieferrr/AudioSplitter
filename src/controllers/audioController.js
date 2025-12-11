import { processAudio } from '../services/audioService.js';
import { bucketName } from '../config/storage.js';
import path from 'path';
import fs from 'fs';

const sanitizeFilename = (name) => {
    return name.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9]/g, "_").replace(/_+/g, "_").toLowerCase();
};

export const splitTrack = async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ message: 'No file' });

        const inputPath = req.file.path;
        const randomId = Date.now().toString();
        const format = req.body.format || 'mp3';
        const originalName = req.file.originalname;
        const songLabel = sanitizeFilename(originalName);

        console.log(`📥 Procesando: ${originalName} -> Label: ${songLabel}`);

        await processAudio(inputPath, randomId, format, songLabel);

        // 1. VOLVEMOS A LOS 4 STEMS ORIGINALES (Para que el player suene bien)
        const stems = ['vocals', 'drums', 'bass', 'other'];

        const filesUrls = stems.map(stem => {
            const fileName = `${stem}_${songLabel}.${format}`;
            return bucketName
                ? `https://storage.googleapis.com/${bucketName}/stems/${randomId}/${fileName}`
                : `/outputs/${randomId}/${fileName}`;
        });

        // 2. GENERAMOS LA URL DEL INSTRUMENTAL APARTE
        const instrName = `instrumental_${songLabel}.${format}`;
        const instrUrl = bucketName
            ? `https://storage.googleapis.com/${bucketName}/stems/${randomId}/${instrName}`
            : `/outputs/${randomId}/${instrName}`;

        // 3. GENERAMOS LA URL DEL ZIP
        const zipName = `${songLabel}_Mix.zip`;
        const zipUrl = bucketName
            ? `https://storage.googleapis.com/${bucketName}/stems/${randomId}/${zipName}`
            : `/outputs/${randomId}/${zipName}`;

        fs.unlink(inputPath, (err) => { if (err) console.error(err); });

        res.json({
            message: 'Separación completada',
            processId: randomId,
            originalName: originalName,
            files: filesUrls, // Solo los 4 reproductores
            zip: zipUrl,      // Link ZIP
            instrumental: instrUrl // <--- Link Instrumental Nuevo
        });

    } catch (error) {
        console.error('❌ Error:', error);
        res.status(500).json({ message: 'Error interno', error: error.message });
    }
};