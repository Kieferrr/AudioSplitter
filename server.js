// server.js
const express = require('express');
const bodyParser = require('body-parser');
const { exec } = require('child_process');
const fs = require('fs-extra'); // Usamos fs-extra para simplificar operaciones
const path = require('path');
const ytdlp = require('yt-dlp-exec');
const multer = require('multer');
const winston = require('winston');
const cron = require('node-cron');
const { Storage } = require('@google-cloud/storage');

// Configuración de Google Cloud Storage
const storage = new Storage();
const bucketName = 'example_audiospliter_v1'; // Cambia esto con el nombre de tu bucket en GCP

const app = express();
const PORT = process.env.PORT || 8080;

// Configuración de winston (registro de logs)
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

// Middleware para parsear el cuerpo de las solicitudes
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Servir archivos estáticos desde la carpeta 'public'
app.use(express.static(path.join(__dirname, 'public')));

// Configuración de Multer para manejar subidas de archivos
const upload = multer({
  dest: 'uploads/', // Esta carpeta ya no se usará de manera persistente
  limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['audio/mpeg', 'audio/wav', 'audio/mp4', 'video/mp4'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten archivos mp3, wav, y mp4.'));
    }
  }
});

// Función para subir archivos a GCP
async function uploadToGCP(filePath, randomId) {
  const bucket = storage.bucket(bucketName);
  const destination = `audios/${randomId}.mp3`; // Subir el archivo MP3 con un nombre único
  await bucket.upload(filePath, { destination });
  logger.info(`Archivo subido a GCP: ${destination}`);
  return destination; // Retorna el nombre del archivo en GCP
}

// Función para descargar archivos desde GCP
async function downloadFromGCP(fileName, randomId) {
  const bucket = storage.bucket(bucketName);
  const destPath = path.join(__dirname, `tmp_audio_${randomId}.mp3`);
  await bucket.file(fileName).download({ destination: destPath });
  logger.info(`Archivo descargado de GCP: ${destPath}`);
  return destPath; // Retorna la ruta de destino donde se descargó el archivo
}

/**
 * Ruta para procesar URLs de YouTube
 */
app.post('/process-url', async (req, res) => {
  try {
    const youtubeUrl = req.body.youtubeUrl;
    if (!youtubeUrl) {
      logger.warn('No se recibió la URL de YouTube');
      return res.status(400).send('No se recibió la URL de YouTube');
    }

    // Generar nuevo randomId
    const randomId = Date.now().toString();

    // Descargar el audio con yt-dlp
    logger.info(`Descargando audio de: ${youtubeUrl}`);
    const inputAudioPath = path.join(__dirname, `tmp_audio_${randomId}.mp3`);
    try {
      await ytdlp(youtubeUrl, {
        output: inputAudioPath,
        extractAudio: true,
        audioFormat: 'mp3',
        audioQuality: '0',
        cookies: '/app/cookies.txt'  // Ruta al archivo de cookies en el contenedor
      });
      logger.info(`Descarga completada: ${inputAudioPath}`);
    } catch (downloadError) {
      logger.error(`Error al descargar el audio: ${downloadError.message}`);
      return res.status(500).send('Error al descargar el audio de YouTube');
    }

    // Subir el archivo descargado a Google Cloud Storage
    const audioFileName = await uploadToGCP(inputAudioPath, randomId);

    // Descargar el archivo desde GCP para procesarlo
    const downloadPath = await downloadFromGCP(audioFileName, randomId);

    // Ejecutar Spleeter para separar el audio
    const pythonScriptPath = path.join(__dirname, 'separar.py');
    logger.info('Ejecutando separación de audio...');
    exec(`python "${pythonScriptPath}" "${downloadPath}" "${randomId}"`, (error, stdout, stderr) => {
      logger.info('--- SPLITTER STDOUT ---\n' + stdout);
      logger.info('--- SPLITTER STDERR ---\n' + stderr);

      if (error) {
        logger.error(`Error al ejecutar Spleeter: ${error.message}`);
        return res.status(500).send('Error en la separación de audio');
      }

      // Generar las URLs de los archivos separados (suponiendo que están en /public/outputs/randomId/)
      const resultUrls = ['vocals.wav', 'drums.wav', 'bass.wav'].map(file => `/outputs/${randomId}/${file}`);

      // Si todo fue exitoso, responder con la URL de los archivos generados
      res.json({ message: 'Separación completada', files: resultUrls });
    });
  } catch (err) {
    logger.error(`Error en /process-url: ${err.message}`);
    res.status(500).send('Error procesando la solicitud');
  }
});

/**
 * Ruta para subir archivos
 */
app.post('/upload-file', upload.single('audioFile'), async (req, res) => {
  try {
    if (!req.file) {
      logger.warn('No se subió ningún archivo.');
      return res.status(400).send('No se subió ningún archivo.');
    }

    // Subir el archivo a Google Cloud Storage
    const randomId = Date.now().toString();
    const uploadedFilePath = req.file.path;
    const audioFileName = await uploadToGCP(uploadedFilePath, randomId);

    // Descargar el archivo desde GCP para procesarlo
    const downloadPath = await downloadFromGCP(audioFileName, randomId);

    // Ejecutar Spleeter para separar el audio
    const pythonScriptPath = path.join(__dirname, 'separar.py');
    exec(`python "${pythonScriptPath}" "${downloadPath}" "${randomId}"`, (error, stdout, stderr) => {
      logger.info('--- SPLITTER STDOUT ---\n' + stdout);
      logger.info('--- SPLITTER STDERR ---\n' + stderr);

      if (error) {
        logger.error(`Error al ejecutar Spleeter: ${error.message}`);
        return res.status(500).send('Error en la separación de audio');
      }

      // Generar las URLs de los archivos separados (suponiendo que están en /public/outputs/randomId/)
      const resultUrls = ['vocals.wav', 'drums.wav', 'bass.wav'].map(file => `/outputs/${randomId}/${file}`);

      // Si todo fue exitoso, responder con la URL de los archivos generados
      res.json({ message: 'Separación completada', files: resultUrls });
    });
  } catch (err) {
    logger.error(`Error en /upload-file: ${err.message}`);
    res.status(500).send('Error procesando la solicitud');
  }
});

// Función de limpieza para eliminar archivos antiguos en GCP
async function cleanOldOutputs() {
  const now = Date.now();
  const expirationTime = 24 * 60 * 60 * 1000; // 24 horas en milisegundos

  try {
    const [files] = await storage.bucket(bucketName).getFiles();
    for (const file of files) {
      const lastModified = new Date(file.metadata.updated).getTime();
      if (now - lastModified > expirationTime) {
        await file.delete();
        logger.info(`Archivo borrado por antigüedad: ${file.name}`);
      }
    }
  } catch (err) {
    logger.error(`Error durante la limpieza de archivos en GCP: ${err.message}`);
  }
}

// Programar la tarea para que se ejecute cada hora (opcional)
cron.schedule('0 * * * *', () => {
  logger.info('Iniciando tarea de limpieza de outputs antiguos...');
  cleanOldOutputs();
});

// Iniciar servidor
app.listen(PORT, () => {
  logger.info(`Servidor escuchando en http://localhost:${PORT}`);
});
