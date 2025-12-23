import express from 'express';
import { splitTrack } from '../controllers/audioController.js';
import { upload } from '../config/multer.js';
// 1. Importamos el guardia de seguridad
import { checkCreditBalance } from '../middlewares/paywall.js';

const router = express.Router();

// Única ruta de procesamiento: Subida de Archivo Local
// 2. Inyectamos 'checkCreditBalance' AL PRINCIPIO de la cadena
router.post('/upload',
    checkCreditBalance,       // PASO A: ¿Tiene saldo? (Si no, rechaza aquí)
    upload.single('audioFile'), // PASO B: Si pasó, sube el archivo
    splitTrack                  // PASO C: Procesa la IA
);

export default router;