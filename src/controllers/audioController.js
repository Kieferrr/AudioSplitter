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

        // --- CORRECCIÓN AQUÍ: Agregamos "const result =" ---
        const result = await processAudio(inputPath, randomId, format, songLabel);

        // 1. URLs de STEMS
        const stems = ['karaoke', 'vocals', 'drums', 'bass', 'other']; // Karaoke no, porque lo manejamos aparte ahora?
        // Ah, recuerda que habíamos sacado 'karaoke' de la lista visual.
        // Solo usamos los 4 originales para el player:
        const playerStems = ['vocals', 'drums', 'bass', 'other'];

        const filesUrls = playerStems.map(stem => {
            const fileName = `${stem}_${songLabel}.${format}`;
            return bucketName 
                ? `https://storage.googleapis.com/${bucketName}/stems/${randomId}/${fileName}`
                : `/outputs/${randomId}/${fileName}`;
        });

        // 2. URL INSTRUMENTAL
        const instrName = `instrumental_${songLabel}.${format}`;
        const instrUrl = bucketName 
            ? `https://storage.googleapis.com/${bucketName}/stems/${randomId}/${instrName}`
            : `/outputs/${randomId}/${instrName}`;

        // 3. URL ZIP
        const zipName = `${songLabel}_Mix.zip`;
        const zipUrl = bucketName 
            ? `https://storage.googleapis.com/${bucketName}/stems/${randomId}/${zipName}`
            : `/outputs/${randomId}/${zipName}`;

        fs.unlink(inputPath, (err) => { if (err) console.error(err); });

        // --- CORRECCIÓN AQUÍ: Usamos result.analysis ---
        res.json({
            message: 'Separación completada',
            processId: randomId,
            originalName: originalName,
            bpm: result.analysis.bpm,   // Leemos del resultado
            key: result.analysis.key,   // Leemos del resultado
            files: filesUrls,
            zip: zipUrl,
            instrumental: instrUrl
        });

    } catch (error) {
        console.error('❌ Error:', error);
        res.status(500).json({ message: 'Error interno', error: error.message });
    }
};