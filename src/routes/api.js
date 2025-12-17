import express from 'express';
import { splitTrack } from '../controllers/audioController.js';
import { processYoutube } from '../controllers/youtubeController.js';
import { upload } from '../config/multer.js';
// Importamos el servicio directamente para la ruta ligera de info
import { youtubeService } from '../services/youtubeService.js';

const router = express.Router();

// Ruta Archivo Local
router.post('/upload', upload.single('audioFile'), splitTrack);

// Ruta YouTube (Procesamiento pesado)
router.post('/youtube', processYoutube);

// Ruta YouTube Info (Metadata rápida - NUEVA)
router.post('/youtube-info', async (req, res) => {
    try {
        const { youtubeUrl } = req.body;
        if (!youtubeUrl) return res.status(400).json({ error: 'Falta URL' });

        // Llamamos a la nueva función del servicio
        const meta = await youtubeService.getVideoMeta(youtubeUrl);
        
        // Devolvemos { title, duration, thumbnail }
        res.json(meta);
    } catch (error) {
        console.error("Error en /youtube-info:", error);
        res.status(500).json({ error: error.message || "Error obteniendo info del video" });
    }
});

export default router;