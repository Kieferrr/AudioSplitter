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
const bucketName = process.env.BUCKET_NAME;
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

    // Rutas de archivos
    const inputAudioPath = path.join(__dirname, `tmp_audio_${randomId}.mp3`);

    // --- SOLUCIÓN ERROR COOKIES (READ-ONLY) ---
    // 1. Definimos dónde está el secreto original
    let cookiesOriginalPath = '/secrets/cookies.txt';
    if (!fs.existsSync(cookiesOriginalPath)) {
      cookiesOriginalPath = '/app/cookies.txt';
    }

    const cookiesTempPath = '/tmp/cookies.txt';

    // 2. RECREAMOS el archivo en /tmp (asegurando permisos de escritura)
    if (fs.existsSync(cookiesOriginalPath)) {
      try {
        // Leemos el TEXTO del archivo original
        const cookieContent = fs.readFileSync(cookiesOriginalPath, 'utf8');
        // Creamos un archivo NUEVO con ese texto y forzamos permisos de escritura (0o666)
        fs.writeFileSync(cookiesTempPath, cookieContent, { mode: 0o666 });

        logger.info(`Cookies regeneradas y escribibles en: ${cookiesTempPath}`);
      } catch (copyErr) {
        logger.error(`Error preparando cookies: ${copyErr.message}`);
      }
    } else {
      logger.warn('ADVERTENCIA: No se encontró el archivo cookies.txt original.');
    }

    try {
      await ytdlp(youtubeUrl, {
        output: inputAudioPath,
        extractAudio: true,
        audioFormat: 'mp3',
        audioQuality: '0',
        // Usamos la ruta TEMPORAL, no la del secreto
        cookies: cookiesTempPath
      });
      logger.info(`Descarga completada: ${inputAudioPath}`);
    } catch (downloadError) {
      logger.error(`Error al descargar el audio: ${downloadError.message}`);
      return res.status(500).send('Error al descargar el audio de YouTube. Revisa logs.');
    }

    // Ejecutar Spleeter
    const pythonScriptPath = path.join(__dirname, 'separar.py');
    logger.info('Ejecutando separación de audio...');

    const options = { env: { ...process.env, BUCKET_NAME: bucketName } };

    exec(`python "${pythonScriptPath}" "${inputAudioPath}" "${randomId}"`, options, (error, stdout, stderr) => {
      logger.info('Python output:\n' + stdout);
      if (stderr) logger.warn('Python stderr:\n' + stderr);

      if (error) {
        logger.error(`Error Spleeter: ${error.message}`);
        return res.status(500).send('Error en la separación de audio');
      }

      // --- LOGICA DE RESPUESTA CORREGIDA (Rutas Spleeter) ---
      const outputDir = path.join(__dirname, 'public', 'outputs', randomId);

      // Spleeter suele crear una subcarpeta con el nombre del archivo de entrada
      const inputFileName = path.basename(inputAudioPath, path.extname(inputAudioPath));
      const spleeterSubDir = path.join(outputDir, inputFileName);

      let finalPathToRead = outputDir;

      // Verificamos si existe la subcarpeta creada por Spleeter
      if (fs.existsSync(spleeterSubDir)) {
        finalPathToRead = spleeterSubDir;
      }

      let stemFiles = [];
      try {
        // Leemos los archivos donde realmente están
        stemFiles = fs.readdirSync(finalPathToRead).filter(file => file.endsWith('.wav'));
      } catch (e) {
        logger.error(`No se encontraron archivos en: ${finalPathToRead}`);
      }

      let resultUrls;
      if (bucketName) {
        // Si usas bucket, ajusta la ruta según cómo tu script de python suba los archivos
        resultUrls = stemFiles.map(file => `https://storage.googleapis.com/${bucketName}/stems/${randomId}/${file}`);
      } else {
        // Lógica local: Si leímos de una subcarpeta, la URL debe incluirla
        const urlBase = (finalPathToRead === spleeterSubDir)
          ? `/outputs/${randomId}/${inputFileName}`
          : `/outputs/${randomId}`;

        resultUrls = stemFiles.map(file => `${urlBase}/${file}`);
      }

      logger.info(`Enviando archivos al frontend: ${JSON.stringify(resultUrls)}`);
      res.json({ message: 'Separación completada', files: resultUrls });
    });

  } catch (err) {
    logger.error(`Error general: ${err.message}`);
    res.status(500).send('Error procesando la solicitud');
  }
});

// --- RUTA PARA SUBIR ARCHIVOS ---
app.post('/upload-file', upload.single('audioFile'), async (req, res) => {
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

    // Aplicamos la misma lógica de corrección de rutas para Upload
    const outputDir = path.join(__dirname, 'public', 'outputs', randomId);
    // Nota: Multer suele guardar el archivo con un nombre hash, Spleeter usará ese nombre
    const inputFileName = path.basename(uploadedFilePath, path.extname(uploadedFilePath));
    const spleeterSubDir = path.join(outputDir, inputFileName);

    let finalPathToRead = outputDir;
    if (fs.existsSync(spleeterSubDir)) {
      finalPathToRead = spleeterSubDir;
    }

    let stemFiles = [];
    try { stemFiles = fs.readdirSync(finalPathToRead).filter(f => f.endsWith('.wav')); } catch (e) { }

    let resultUrls;
    if (bucketName) {
      resultUrls = stemFiles.map(file => `https://storage.googleapis.com/${bucketName}/stems/${randomId}/${file}`);
    } else {
      const urlBase = (finalPathToRead === spleeterSubDir)
        ? `/outputs/${randomId}/${inputFileName}`
        : `/outputs/${randomId}`;
      resultUrls = stemFiles.map(file => `${urlBase}/${file}`);
    }

    res.json({ message: 'Separación completada', files: resultUrls });
  });
});

// Tarea programada para limpiar archivos temporales (cada hora)
cron.schedule('0 * * * *', () => {
  logger.info('Tarea de limpieza ejecutada (placeholder)');
});

app.listen(PORT, () => {
  logger.info(`Servidor escuchando en puerto ${PORT}`);
});