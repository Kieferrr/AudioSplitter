// server.js
const express = require('express');
const bodyParser = require('body-parser');
const { exec } = require('child_process');
const fs = require('fs-extra');
const path = require('path');
const ytdlp = require('yt-dlp-exec');
const multer = require('multer');
const winston = require('winston');
const cron = require('node-cron');
const { Storage } = require('@google-cloud/storage');

// Configuración de Google Cloud Storage
const bucketName = process.env.BUCKET_NAME; // Asegúrate de definir esta variable en Cloud Run
const storage = bucketName ? new Storage() : null;

const app = express();
const PORT = process.env.PORT || 8080;

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => `${timestamp} [${level.toUpperCase()}]: ${message}`)
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'server.log' })
  ]
});

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

const upload = multer({
  dest: 'uploads/',
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['audio/mpeg', 'audio/wav', 'audio/mp4', 'video/mp4'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten archivos mp3, wav, y mp4.'));
    }
  }
});

// --- RUTA PARA PROCESAR YOUTUBE ---
app.post('/process-url', async (req, res) => {
  try {
    const youtubeUrl = req.body.youtubeUrl;
    if (!youtubeUrl) return res.status(400).send('No se recibió la URL de YouTube');

    const randomId = Date.now().toString();
    logger.info(`Descargando audio de: ${youtubeUrl}`);
    const inputAudioPath = path.join(__dirname, `tmp_audio_${randomId}.mp3`);

    try {
      await ytdlp(youtubeUrl, {
        output: inputAudioPath,
        extractAudio: true,
        audioFormat: 'mp3',
        audioQuality: '0',
        // --- CAMBIO CRÍTICO AQUÍ ABAJO ---
        cookies: '/secrets/cookies.txt'  // <--- CORREGIDO: Apunta al volumen montado
      });
      logger.info(`Descarga completada: ${inputAudioPath}`);
    } catch (downloadError) {
      logger.error(`Error al descargar el audio: ${downloadError.message}`);
      return res.status(500).send('Error al descargar el audio de YouTube. Revisa logs.');
    }

    // Ejecutar Spleeter
    const pythonScriptPath = path.join(__dirname, 'separar.py');
    logger.info('Ejecutando separación de audio...');
    
    // Pasamos el BUCKET_NAME como variable de entorno al script de Python por si acaso
    const options = { env: { ...process.env, BUCKET_NAME: bucketName } };

    exec(`python "${pythonScriptPath}" "${inputAudioPath}" "${randomId}"`, options, (error, stdout, stderr) => {
      logger.info('Python output:\n' + stdout);
      if (stderr) logger.warn('Python stderr:\n' + stderr);

      if (error) {
        logger.error(`Error Spleeter: ${error.message}`);
        return res.status(500).send('Error en la separación de audio');
      }

      // --- LOGICA DE RESPUESTA MEJORADA ---
      const outputDir = path.join(__dirname, 'public', 'outputs', randomId);
      
      // Intentamos leer qué archivos se generaron
      let stemFiles = [];
      try {
          stemFiles = fs.readdirSync(outputDir).filter(file => file.endsWith('.wav'));
      } catch (e) {
          logger.error("No se encontró la carpeta de salida local (¿Quizás Python falló silenciosamente?)");
      }

      // DECISIÓN INTELIGENTE:
      // Si tenemos bucket configurado, devolvemos la URL pública del bucket.
      // Si no, devolvemos la URL local.
      let resultUrls;
      if (bucketName) {
        // Asumiendo que el bucket es público o tienes acceso. 
        // La ruta en 'separar.py' es: stems/{randomId}/{file}
        resultUrls = stemFiles.map(file => `https://storage.googleapis.com/${bucketName}/stems/${randomId}/${file}`);
      } else {
        resultUrls = stemFiles.map(file => `/outputs/${randomId}/${file}`);
      }

      res.json({ message: 'Separación completada', files: resultUrls });
    });

  } catch (err) {
    logger.error(`Error general: ${err.message}`);
    res.status(500).send('Error procesando la solicitud');
  }
});

// --- RUTA PARA SUBIR ARCHIVOS ---
app.post('/upload-file', upload.single('audioFile'), async (req, res) => {
    // ... (Mantén tu lógica aquí, es similar a la de arriba)
    // Solo recuerda aplicar la misma lógica de resultUrls si quieres que sea persistente.
    if (!req.file) return res.status(400).send('No file uploaded.');
    
    const randomId = Date.now().toString();
    const uploadedFilePath = req.file.path;
    const pythonScriptPath = path.join(__dirname, 'separar.py');
    const options = { env: { ...process.env, BUCKET_NAME: bucketName } };

    exec(`python "${pythonScriptPath}" "${uploadedFilePath}" "${randomId}"`, options, (error, stdout, stderr) => {
        if (error) {
            logger.error(error);
            return res.status(500).send('Error splitter');
        }
        
        const outputDir = path.join(__dirname, 'public', 'outputs', randomId);
        let stemFiles = [];
        try { stemFiles = fs.readdirSync(outputDir).filter(f => f.endsWith('.wav')); } catch(e){}

        let resultUrls;
        if (bucketName) {
            resultUrls = stemFiles.map(file => `https://storage.googleapis.com/${bucketName}/stems/${randomId}/${file}`);
        } else {
            resultUrls = stemFiles.map(file => `/outputs/${randomId}/${file}`);
        }

        res.json({ message: 'Separación completada', files: resultUrls });
    });
});

// ... (El resto de tu código de limpieza está bien) ...

app.listen(PORT, () => {
  logger.info(`Servidor escuchando en puerto ${PORT}`);
});