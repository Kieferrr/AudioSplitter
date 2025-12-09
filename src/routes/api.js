import express from 'express';
import { splitTrack } from '../controllers/audioController.js';
import { upload } from '../config/multer.js';

const router = express.Router();

// Definir la ruta POST /upload
// 'audioFile' es el nombre del campo que debe enviar el formulario HTML
router.post('/upload', upload.single('audioFile'), splitTrack);

export default router;