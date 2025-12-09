import express from 'express';
import { splitTrack } from '../controllers/audioController.js';
import { processYoutube } from '../controllers/youtubeController.js'; // Importar nuevo controller
import { upload } from '../config/multer.js';

const router = express.Router();

// Ruta Archivo Local
router.post('/upload', upload.single('audioFile'), splitTrack);

// Ruta YouTube (Nueva)
router.post('/youtube', processYoutube);

export default router;