import multer from 'multer';
import path from 'path';
import fs from 'fs';

// Asegurar que exista la carpeta uploads
const uploadDir = 'uploads';
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

// Configuración de almacenamiento
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir); // Guardar en carpeta 'uploads'
    },
    filename: function (req, file, cb) {
        // Guardamos con un nombre limpio: timestamp-nombreOriginal
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

// Filtro de archivos (Solo audio)
const fileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('audio/') || file.mimetype === 'video/mp4') {
        cb(null, true);
    } else {
        cb(new Error('Formato de archivo no soportado. Sube MP3, WAV o MP4.'), false);
    }
};

export const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: { fileSize: 50 * 1024 * 1024 } // Límite de 50MB
});