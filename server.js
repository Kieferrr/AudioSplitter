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

// --- FUNCIÓN AUXILIAR: EL SABUESO DE ARCHIVOS ---
// Busca archivos .wav en todas las subcarpetas recursivamente
function findWavFilesRecursively(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      findWavFilesRecursively(filePath, fileList);
    } else {
      if (file.endsWith('.wav')) {
        fileList.push(filePath);
      }
    }
  });
  return fileList;
}

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
    let cookiesOriginalPath = '/secrets/cookies.txt';
    if (!fs.existsSync(cookiesOriginalPath)) {
      cookiesOriginalPath = '/app/cookies.txt';
    }

    const cookiesTempPath = '/tmp/cookies.txt';

    if (fs.existsSync(cookiesOriginalPath)) {
      try {
        const cookieContent = fs.readFileSync(cookiesOriginalPath, 'utf8');
        fs.writeFileSync(cookiesTempPath, cookieContent, { mode: 0o666 });
        logger.info(`Cookies regeneradas en: ${cookiesTempPath}`);
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
      // stderr en Python suele tener warnings, no necesariamente errores fatales
      if (stderr) logger.warn('Python stderr (Warnings): ' + stderr);

      if (error) {
        logger.error(`Error FATAL Spleeter: ${error.message}`);
        return res.status(500).send('Error en la separación de audio');
      }

      // --- LOGICA INFALIBLE PARA ENCONTRAR ARCHIVOS ---
      const outputDir = path.join(__dirname, 'public', 'outputs', randomId);

      let allWavFiles = [];
      try {
        // Usamos el "Sabueso" para buscar en profundidad
        if (fs.existsSync(outputDir)) {
          allWavFiles = findWavFilesRecursively(outputDir);
        } else {
          logger.error(`No existe el directorio de salida: ${outputDir}`);
        }
      } catch (e) {
        logger.error(`Error buscando archivos: ${e.message}`);
      }

      // Generar URLs públicas
      let resultUrls = [];
      const publicPath = path.join(__dirname, 'public');

      if (bucketName) {
        // Lógica Bucket (simplificada, asume que subiste los archivos con la misma estructura)
        // Nota: Si usas bucket, asegúrate de que tu script Python devuelva las rutas del bucket o suba recursivamente.
        // Por ahora, mantendremos la lógica local que es la que estás probando.
        resultUrls = allWavFiles.map(filePath => {
          const fileName = path.basename(filePath);
          return `https://storage.googleapis.com/${bucketName}/stems/${randomId}/${fileName}`;
        });
      } else {
        // Lógica Local
        resultUrls = allWavFiles.map(filePath => {
          // Convertimos la ruta absoluta del sistema (/app/public/outputs/...) 
          // en una URL relativa para el navegador (/outputs/...)
          // Reemplazamos backslashes por slashes normales para asegurar compatibilidad web
          let relativePath = path.relative(publicPath, filePath).split(path.sep).join('/');
          return `/${relativePath}`;
        });
      }

      logger.info(`Enviando ${resultUrls.length} archivos al frontend: ${JSON.stringify(resultUrls)}`);

      if (resultUrls.length === 0) {
        return res.status(500).send('Spleeter terminó, pero no se encontraron archivos .wav resultantes.');
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
    let allWavFiles = [];
    try {
      if (fs.existsSync(outputDir)) {
        allWavFiles = findWavFilesRecursively(outputDir);
      }
    } catch (e) { logger.error(e); }

    const publicPath = path.join(__dirname, 'public');
    let resultUrls = allWavFiles.map(filePath => {
      let relativePath = path.relative(publicPath, filePath).split(path.sep).join('/');
      return `/${relativePath}`;
    });

    res.json({ message: 'Separación completada', files: resultUrls });
  });
});

// Limpieza
cron.schedule('0 * * * *', () => {
  logger.info('Tarea de limpieza ejecutada');
});

app.listen(PORT, () => {
  logger.info(`Servidor escuchando en puerto ${PORT}`);
});