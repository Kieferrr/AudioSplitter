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

// --- CONFIGURACIÓN DEL BUCKET ---
// IMPORTANTE: Verifica que este nombre sea EXACTO al de tu consola de GCP.
// He puesto 'example_audiosplitter_v1' (con doble T). 
// Si el tuyo es con una T, cámbialo aquí.
const bucketName = 'example_audiospliter_v1';
const storage = new Storage();

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

// --- FUNCIÓN AUXILIAR: BUSCAR ARCHIVOS LOCALES ---
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

// --- FUNCIÓN AUXILIAR: SUBIR A BUCKET ---
async function uploadToBucket(localFiles, randomId) {
  if (!bucketName) throw new Error("Nombre del Bucket no configurado.");

  const uploadedUrls = [];
  const bucket = storage.bucket(bucketName);

  for (const filePath of localFiles) {
    const fileName = path.basename(filePath);
    // Organizamos los archivos en carpetas dentro del bucket: stems/ID/archivo.wav
    const destination = `stems/${randomId}/${fileName}`;

    logger.info(`Subiendo ${fileName} a Google Cloud Storage...`);

    await bucket.upload(filePath, {
      destination: destination,
      resumable: false,
      metadata: {
        cacheControl: 'public, max-age=31536000',
      },
    });

    // URL pública directa
    const publicUrl = `https://storage.googleapis.com/${bucketName}/${destination}`;
    uploadedUrls.push(publicUrl);
  }
  return uploadedUrls;
}

// --- RUTA PARA PROCESAR YOUTUBE ---
app.post('/process-url', async (req, res) => {
  try {
    const youtubeUrl = req.body.youtubeUrl;
    if (!youtubeUrl) return res.status(400).send('No se recibió la URL de YouTube');

    const randomId = Date.now().toString();
    logger.info(`Descargando audio de: ${youtubeUrl}`);

    const inputAudioPath = path.join(__dirname, `tmp_audio_${randomId}.mp3`);

    // --- COOKIES ---
    let cookiesOriginalPath = '/secrets/cookies.txt';
    if (!fs.existsSync(cookiesOriginalPath)) cookiesOriginalPath = '/app/cookies.txt';
    const cookiesTempPath = '/tmp/cookies.txt';

    if (fs.existsSync(cookiesOriginalPath)) {
      try {
        const cookieContent = fs.readFileSync(cookiesOriginalPath, 'utf8');
        fs.writeFileSync(cookiesTempPath, cookieContent, { mode: 0o666 });
      } catch (copyErr) { logger.error(copyErr); }
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
      logger.error(downloadError);
      return res.status(500).send('Error descarga YT. Revisa logs.');
    }

    // Ejecutar Spleeter
    const pythonScriptPath = path.join(__dirname, 'separar.py');
    const options = { env: { ...process.env } };

    exec(`python "${pythonScriptPath}" "${inputAudioPath}" "${randomId}"`, options, async (error, stdout, stderr) => {
      logger.info('Python output:\n' + stdout);
      if (stderr) logger.warn('Python stderr: ' + stderr);
      if (error) {
        logger.error(error);
        return res.status(500).send('Error Spleeter');
      }

      // Buscar archivos generados localmente
      const outputDir = path.join(__dirname, 'public', 'outputs', randomId);
      let allWavFiles = [];
      try {
        if (fs.existsSync(outputDir)) {
          allWavFiles = findWavFilesRecursively(outputDir);
        }
      } catch (e) { logger.error(e); }

      if (allWavFiles.length === 0) {
        return res.status(500).send("No se generaron archivos de audio.");
      }

      try {
        // SUBIDA AL BUCKET
        const resultUrls = await uploadToBucket(allWavFiles, randomId);
        logger.info(`Enviando ${resultUrls.length} URLs del bucket al frontend.`);
        res.json({ message: 'Separación completada', files: resultUrls });

      } catch (bucketErr) {
        logger.error(`Error subiendo al bucket: ${bucketErr.message}`);
        res.status(500).send('Error subiendo archivos a la nube.');
      }
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
  const options = { env: { ...process.env } };

  exec(`python "${pythonScriptPath}" "${uploadedFilePath}" "${randomId}"`, options, async (error, stdout, stderr) => {
    if (error) { logger.error(error); return res.status(500).send('Error splitter'); }

    const outputDir = path.join(__dirname, 'public', 'outputs', randomId);
    let allWavFiles = [];
    try {
      if (fs.existsSync(outputDir)) allWavFiles = findWavFilesRecursively(outputDir);
    } catch (e) { logger.error(e); }

    try {
      const resultUrls = await uploadToBucket(allWavFiles, randomId);
      res.json({ message: 'Separación completada', files: resultUrls });
    } catch (bucketErr) {
      logger.error(bucketErr);
      res.status(500).send('Error subiendo a la nube');
    }
  });
});

// --- TAREA DE LIMPIEZA AUTOMÁTICA (LOCAL Y BUCKET) ---
cron.schedule('*/30 * * * *', async () => {
  logger.info('--- INICIANDO LIMPIEZA AUTOMÁTICA (30 MIN) ---');

  const MAX_AGE = 30 * 60 * 1000; // 30 minutos
  const now = Date.now();

  // 1. Limpieza Local (Disco del servidor)
  const outputsDir = path.join(__dirname, 'public', 'outputs');
  const uploadsDir = path.join(__dirname, 'uploads');
  const rootDir = __dirname;

  // Limpiar stems locales
  if (fs.existsSync(outputsDir)) {
    try {
      fs.readdirSync(outputsDir).forEach(file => {
        const curPath = path.join(outputsDir, file);
        const stats = fs.statSync(curPath);
        if (now - stats.mtimeMs > MAX_AGE) {
          fs.removeSync(curPath);
          logger.info(`Local borrado: ${file}`);
        }
      });
    } catch (e) { logger.error(`Error limpieza local: ${e.message}`); }
  }

  // Limpiar mp3 temporales en raíz
  try {
    fs.readdirSync(rootDir).forEach(file => {
      if (file.startsWith('tmp_audio_') && (file.endsWith('.mp3') || file.endsWith('.mp4'))) {
        const curPath = path.join(rootDir, file);
        const stats = fs.statSync(curPath);
        if (now - stats.mtimeMs > MAX_AGE) {
          fs.unlinkSync(curPath);
        }
      }
    });
  } catch (e) { }

  // 2. Limpieza del Bucket (Nube)
  if (bucketName) {
    try {
      const bucket = storage.bucket(bucketName);
      // Buscamos archivos en la carpeta 'stems/'
      const [files] = await bucket.getFiles({ prefix: 'stems/' });

      files.forEach(async (file) => {
        if (file.metadata.timeCreated) {
          const createdTime = new Date(file.metadata.timeCreated).getTime();
          if (now - createdTime > MAX_AGE) {
            try {
              await file.delete();
              logger.info(`Bucket borrado: ${file.name}`);
            } catch (delErr) {
              logger.error(`Falló borrado bucket: ${file.name}`);
            }
          }
        }
      });
    } catch (bucketErr) {
      logger.error(`Error conectando al bucket para limpieza: ${bucketErr.message}`);
    }
  }

  logger.info('--- LIMPIEZA FINALIZADA ---');
});

app.listen(PORT, () => {
  logger.info(`Servidor escuchando en puerto ${PORT}`);
});