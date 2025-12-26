import express from 'express';
import { splitTrack } from '../controllers/audioController.js';
import { upload } from '../config/multer.js';
// 1. Importamos el guardia de seguridad
import { checkCreditBalance } from '../middlewares/paywall.js';

const router = express.Router();

// Única ruta de procesamiento: Subida de Archivo Local
router.post('/upload',
    // PASO A: ¿Tiene saldo?
    checkCreditBalance,

    // PASO B: Multer recibe el archivo
    upload.single('audioFile'),

    // PASO C (NUEVO): Arreglar nombres con tildes/chinos/japoneses
    (req, res, next) => {
        if (req.file) {
            // Convertimos de latin1 a utf8 para arreglar el "Mojibake"
            req.file.originalname = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
        }
        next(); // Pasamos la pelota al siguiente paso (splitTrack)
    },

    // PASO D: Controlador de IA
    splitTrack
);

export default router;