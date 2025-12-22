import express from 'express';
import { splitTrack } from '../controllers/audioController.js';
import { upload } from '../config/multer.js';

const router = express.Router();

// Única ruta de procesamiento: Subida de Archivo Local
router.post('/upload', upload.single('audioFile'), splitTrack);

export default router;