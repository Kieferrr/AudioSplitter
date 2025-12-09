import { processAudio } from '../services/audioService.js';
import { bucket, bucketName } from '../config/storage.js';
import path from 'path';
import fs from 'fs';

export const splitTrack = async (req, res) => {
    try {
        // 1. Validar que llegó un archivo
        if (!req.file) {
            return res.status(400).json({ message: 'No se subió ningún archivo de audio.' });
        }

        const inputPath = req.file.path; // Ruta temporal donde Multer guardó el archivo
        const randomId = Date.now().toString(); // ID único para esta separación

        console.log(`📥 Archivo recibido: ${req.file.originalname} -> Guardado en: ${inputPath}`);

        // 2. Llamar al Servicio de Python
        // Esto tardará unos segundos/minutos
        await processAudio(inputPath, randomId, 5);

        // 3. Generar las URLs firmadas o públicas de los archivos resultantes
        // Sabemos que el Python los sube a: stems/{randomId}/{stem}.wav
        const stems = ['vocals', 'drums', 'bass', 'piano', 'other'];
        const filesUrls = stems.map(stem => {
            // Construimos la URL pública asumiendo que el bucket es público (como lo configuraste antes)
            // Ojo: Si tu bucket fuera privado, aquí generaríamos Signed URLs.
            return `https://storage.googleapis.com/${bucketName}/stems/${randomId}/${stem}.wav`;
        });

        // 4. Limpieza (Borrar el archivo original subido para no llenar el disco del servidor)
        fs.unlink(inputPath, (err) => {
            if (err) console.error("Error borrando archivo temporal:", err);
        });

        // 5. Responder al Frontend
        res.json({
            message: 'Separación completada con éxito',
            processId: randomId,
            files: filesUrls
        });

    } catch (error) {
        console.error('❌ Error en el controlador:', error);
        res.status(500).json({
            message: 'Error interno del servidor al procesar el audio.',
            error: error.message
        });
    }
};