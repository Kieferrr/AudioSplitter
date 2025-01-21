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

const app = express();
const PORT = 3000;

// Configuración de winston
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
  dest: 'uploads/',
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

/**
 * Función para limpiar la carpeta public/outputs
 */
async function cleanOutputs() {
  const outputsDir = path.join(__dirname, 'public', 'outputs');
  try {
    await fs.emptyDir(outputsDir);
    logger.info(`Carpeta ${outputsDir} ha sido limpiada.`);
  } catch (err) {
    logger.error(`Error al limpiar la carpeta ${outputsDir}: ${err.message}`);
  }
}

/**
 * Función de limpieza para una solicitud específica.
 * Borra las carpetas stems_<ID> y public/outputs/<ID>.
 * @param {string} randomId 
 */
function cleanupSeparacion(randomId) {
  try {
    // Carpeta stems_<randomId>
    const stemsDir = path.join(__dirname, `stems_${randomId}`);
    if (fs.existsSync(stemsDir)) {
      fs.rmSync(stemsDir, { recursive: true, force: true });
      logger.info(`Borrada carpeta ${stemsDir}`);
    }

    // Carpeta public/outputs/<randomId>
    const publicOutputDir = path.join(__dirname, 'public', 'outputs', randomId);
    if (fs.existsSync(publicOutputDir)) {
      fs.rmSync(publicOutputDir, { recursive: true, force: true });
      logger.info(`Borrada carpeta ${publicOutputDir}`);
    }
  } catch (err) {
    logger.error(`Error al limpiar separaciones para ID ${randomId}: ${err.message}`);
  }
}

/**
 * Limpia las carpetas en public/outputs que sean mayores a 24 horas.
 */
async function cleanOldOutputs() {
  const outputsDir = path.join(__dirname, 'public', 'outputs');
  try {
    const folders = await fs.readdir(outputsDir);
    const now = Date.now();
    const expirationTime = 24 * 60 * 60 * 1000; // 24 horas en milisegundos

    for (const folder of folders) {
      const folderPath = path.join(outputsDir, folder);
      const stats = await fs.stat(folderPath);
      const modifiedTime = new Date(stats.mtime).getTime();

      if (now - modifiedTime > expirationTime) {
        await fs.remove(folderPath);
        logger.info(`Carpeta eliminada por antigüedad: ${folderPath}`);
      }
    }
  } catch (err) {
    logger.error(`Error durante la limpieza de outputs: ${err.message}`);
  }
}

// Programar la tarea para que se ejecute cada hora (opcional)
cron.schedule('0 * * * *', () => {
  logger.info('Iniciando tarea de limpieza de outputs antiguos...');
  cleanOldOutputs();
});

/**
 * Obtener el nombre del archivo sin la extensión
 * @param {string} filename 
 * @returns {string}
 */
function getFileNameWithoutExt(filename) {
  return path.parse(filename).name;
}

// Rutas para procesar URLs de YouTube y subir archivos
// Asegúrate de incluir las rutas actualizadas con las mejoras previas

// Ejemplo de ruta para procesar URLs de YouTube
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
        audioQuality: '0'
      });
      logger.info(`Descarga completada: ${inputAudioPath}`);
    } catch (downloadError) {
      logger.error(`Error al descargar el audio: ${downloadError.message}`);
      return res.status(500).send('Error al descargar el audio de YouTube');
    }

    // Ejecutar Spleeter mediante separar.py
    const pythonScriptPath = path.join(__dirname, 'separar.py');
    logger.info('Ejecutando separación de audio...');
    exec(`python "${pythonScriptPath}" "${inputAudioPath}" "${randomId}"`, (error, stdout, stderr) => {
      logger.info('--- SPLITTER STDOUT ---\n' + stdout);
      logger.info('--- SPLITTER STDERR ---\n' + stderr);

      if (error) {
        logger.error(`Error al ejecutar Spleeter: ${error.message}`);
        // Limpieza en caso de error
        cleanupSeparacion(randomId);
        // Borrar archivo de audio descargado
        if (fs.existsSync(inputAudioPath)) {
          fs.unlinkSync(inputAudioPath);
          logger.info(`Archivo de audio descargado borrado: ${inputAudioPath}`);
        }
        return res.status(500).send('Error en la separación de audio');
      }

      // Buscar carpeta stems_<randomId>
      const stemsDir = path.join(__dirname, `stems_${randomId}`);
      if (!fs.existsSync(stemsDir)) {
        // Limpieza en caso de fallo
        cleanupSeparacion(randomId);
        // Borrar archivo de audio descargado
        if (fs.existsSync(inputAudioPath)) {
          fs.unlinkSync(inputAudioPath);
          logger.info(`Archivo de audio descargado borrado: ${inputAudioPath}`);
        }
        return res.status(500).send('No se generaron archivos de salida');
      }

      // Spleeter suele crear subcarpeta con el nombre base del archivo
      const baseName = path.parse(inputAudioPath).name;
      let finalStemsFolder = path.join(stemsDir, baseName);
      if (!fs.existsSync(finalStemsFolder)) {
        finalStemsFolder = stemsDir;
      }

      // Copiar .wav a public/outputs/<randomId>
      const publicOutputDir = path.join(__dirname, 'public', 'outputs', randomId);
      try {
        if (!fs.existsSync(publicOutputDir)) {
          fs.mkdirSync(publicOutputDir, { recursive: true });
          logger.info(`Creada carpeta de salida pública: ${publicOutputDir}`);
        }

        const files = fs.readdirSync(finalStemsFolder)
          .filter(f => f.endsWith('.wav') || f.endsWith('.mp3'));
        const resultUrls = [];
        for (const file of files) {
          const sourcePath = path.join(finalStemsFolder, file);
          const destPath = path.join(publicOutputDir, file);
          fs.copyFileSync(sourcePath, destPath);
          logger.info(`Archivo copiado: ${sourcePath} -> ${destPath}`);
          // URLs públicas
          resultUrls.push(`/outputs/${randomId}/${file}`);
        }

        // Borrar mp3 original
        if (fs.existsSync(inputAudioPath)) {
          fs.unlinkSync(inputAudioPath);
          logger.info(`Archivo de audio original borrado: ${inputAudioPath}`);
        }

        // Borrar la carpeta de stems después de copiar los archivos
        fs.rmSync(stemsDir, { recursive: true, force: true });
        logger.info(`Separación completada y carpeta de stems borrada para ID: ${randomId}`);

        // Responder al frontend con información de los archivos generados
        res.json({
          message: 'Separación completada',
          files: resultUrls
        });
      } catch (copyError) {
        logger.error(`Error al copiar los archivos de stems: ${copyError.message}`);
        // Limpieza en caso de error
        cleanupSeparacion(randomId);
        // Borrar archivo de audio descargado
        if (fs.existsSync(inputAudioPath)) {
          fs.unlinkSync(inputAudioPath);
          logger.info(`Archivo de audio descargado borrado: ${inputAudioPath}`);
        }
        return res.status(500).send('Error al procesar los archivos de salida');
      }
    });
  } catch (err) {
    logger.error(`Error en /process-url: ${err.message}`);
    res.status(500).send('Error procesando la solicitud');
  }
});

// Ejemplo de ruta para subir archivos
app.post('/upload-file', upload.single('audioFile'), (req, res) => {
  try {
    if (!req.file) {
      logger.warn('No se subió ningún archivo.');
      return res.status(400).send('No se subió ningún archivo.');
    }

    // Obtener el nombre de la canción (sin extensión)
    const originalFileName = req.file.originalname;
    const songTitle = getFileNameWithoutExt(originalFileName);

    // Generar nuevo randomId
    const randomId = Date.now().toString();

    // Mover el archivo subido a una ubicación permanente
    const uploadedFilePath = req.file.path;
    const originalExtension = path.extname(req.file.originalname).toLowerCase();
    const newFileName = `uploaded_audio_${randomId}${originalExtension}`;
    const newFilePath = path.join(__dirname, newFileName);
    fs.renameSync(uploadedFilePath, newFilePath);
    logger.info(`Archivo subido movido a: ${newFilePath}`);

    // Ejecutar Spleeter mediante separar.py
    const pythonScriptPath = path.join(__dirname, 'separar.py');
    logger.info('Ejecutando separación de audio...');
    exec(`python "${pythonScriptPath}" "${newFilePath}" "${randomId}"`, (error, stdout, stderr) => {
      logger.info('--- SPLITTER STDOUT ---\n' + stdout);
      logger.info('--- SPLITTER STDERR ---\n' + stderr);

      if (error) {
        logger.error(`Error al ejecutar Spleeter: ${error.message}`);
        // Limpieza en caso de error
        cleanupSeparacion(randomId);
        // Borrar archivo subido
        if (fs.existsSync(newFilePath)) {
          fs.unlinkSync(newFilePath);
          logger.info(`Archivo subido borrado: ${newFilePath}`);
        }
        return res.status(500).send('Error en la separación de audio');
      }

      // Buscar carpeta stems_<randomId>
      const stemsDir = path.join(__dirname, `stems_${randomId}`);
      if (!fs.existsSync(stemsDir)) {
        // Limpieza en caso de fallo
        cleanupSeparacion(randomId);
        // Borrar archivo subido
        if (fs.existsSync(newFilePath)) {
          fs.unlinkSync(newFilePath);
          logger.info(`Archivo subido borrado: ${newFilePath}`);
        }
        return res.status(500).send('No se generaron archivos de salida');
      }

      // Spleeter suele crear subcarpeta con el nombre base del archivo
      const baseName = path.parse(newFilePath).name;
      let finalStemsFolder = path.join(stemsDir, baseName);
      if (!fs.existsSync(finalStemsFolder)) {
        finalStemsFolder = stemsDir;
      }

      // Copiar .wav a public/outputs/<randomId>
      const publicOutputDir = path.join(__dirname, 'public', 'outputs', randomId);
      try {
        if (!fs.existsSync(publicOutputDir)) {
          fs.mkdirSync(publicOutputDir, { recursive: true });
          logger.info(`Creada carpeta de salida pública: ${publicOutputDir}`);
        }

        const files = fs.readdirSync(finalStemsFolder)
          .filter(f => f.endsWith('.wav') || f.endsWith('.mp3'));
        const resultUrls = [];
        for (const file of files) {
          const sourcePath = path.join(finalStemsFolder, file);
          const destPath = path.join(publicOutputDir, file);
          fs.copyFileSync(sourcePath, destPath);
          logger.info(`Archivo copiado: ${sourcePath} -> ${destPath}`);
          // URLs públicas
          resultUrls.push(`/outputs/${randomId}/${file}`);
        }

        // Borrar archivo subido original
        if (fs.existsSync(newFilePath)) {
          fs.unlinkSync(newFilePath);
          logger.info(`Archivo subido borrado: ${newFilePath}`);
        }

        // Borrar la carpeta de stems después de copiar los archivos
        fs.rmSync(stemsDir, { recursive: true, force: true });
        logger.info(`Separación completada y carpeta de stems borrada para ID: ${randomId}`);

        // Responder al frontend con información de los archivos generados
        res.json({
          message: `Separación completada: ${songTitle}`,
          files: resultUrls
        });
      } catch (copyError) {
        logger.error(`Error al copiar los archivos de stems: ${copyError.message}`);
        // Limpieza en caso de error
        cleanupSeparacion(randomId);
        // Borrar archivo subido
        if (fs.existsSync(newFilePath)) {
          fs.unlinkSync(newFilePath);
          logger.info(`Archivo subido borrado: ${newFilePath}`);
        }
        return res.status(500).send('Error al procesar los archivos de salida');
      }
    });
  } catch (err) {
    logger.error(`Error en /upload-file: ${err.message}`);
    res.status(500).send('Error procesando la solicitud');
  }
});

// Implementar limpieza al iniciar la aplicación
async function initializeApp() {
  await cleanOutputs();
  logger.info('Aplicación inicializada y outputs limpiados.');
}

initializeApp();

// Manejar señales para limpieza al detener la aplicación
process.on('SIGINT', () => {
  logger.info('Recibida señal SIGINT. Iniciando limpieza y apagando...');
  cleanOutputs().then(() => {
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  logger.info('Recibida señal SIGTERM. Iniciando limpieza y apagando...');
  cleanOutputs().then(() => {
    process.exit(0);
  });
});

// Iniciar el servidor
app.listen(PORT, () => {
  logger.info(`Servidor escuchando en http://localhost:${PORT}`);
});
