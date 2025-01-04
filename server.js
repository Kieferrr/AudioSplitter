// server.js
const express = require('express');
const bodyParser = require('body-parser');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const ytdlp = require('yt-dlp-exec');

const app = express();
const PORT = 3000;

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Variable global para borrar la separación anterior si se quiere
let lastRandomId = null;

/**
 * Función de limpieza al iniciar la aplicación.
 * Borra todas las carpetas stems_<ID> y public/outputs/<ID>.
 */
function cleanupOnStartup() {
  // 1) Borrar todas las carpetas stems_<algo>
  const allItems = fs.readdirSync(__dirname);
  for (const item of allItems) {
    if (item.startsWith('stems_')) {
      const stemsPath = path.join(__dirname, item);
      if (fs.statSync(stemsPath).isDirectory()) {
        fs.rmSync(stemsPath, { recursive: true, force: true });
        console.log(`Limpieza inicial: Borrada carpeta ${item}`);
      }
    }
  }

  // 2) Borrar todas las subcarpetas en public/outputs
  const outputsDir = path.join(__dirname, 'public', 'outputs');
  if (fs.existsSync(outputsDir)) {
    const subfolders = fs.readdirSync(outputsDir);
    for (const sub of subfolders) {
      const subPath = path.join(outputsDir, sub);
      if (fs.statSync(subPath).isDirectory()) {
        fs.rmSync(subPath, { recursive: true, force: true });
        console.log(`Limpieza inicial: Borrada carpeta outputs/${sub}`);
      }
    }
  }
}

app.post('/process-url', async (req, res) => {
  try {
    const youtubeUrl = req.body.youtubeUrl;
    if (!youtubeUrl) {
      return res.status(400).send('No se recibió la URL de YouTube');
    }

    // 1) Borrar la separación anterior (si existe), para no acumular
    if (lastRandomId) {
      const oldStemsDir = path.join(__dirname, `stems_${lastRandomId}`);
      const oldPublicDir = path.join(__dirname, 'public', 'outputs', lastRandomId);
      try {
        if (fs.existsSync(oldStemsDir)) {
          fs.rmSync(oldStemsDir, { recursive: true, force: true });
        }
        if (fs.existsSync(oldPublicDir)) {
          fs.rmSync(oldPublicDir, { recursive: true, force: true });
        }
        console.log(`Eliminados stems y outputs de la separación anterior con ID = ${lastRandomId}`);
      } catch (err) {
        console.error('Error al eliminar la separación anterior:', err);
      }
    }

    // 2) Generar nuevo randomId
    const randomId = Date.now().toString();
    lastRandomId = randomId; // almacenar

    // 3) Descargar el audio con yt-dlp
    console.log(`Descargando audio de: ${youtubeUrl}`);
    const inputAudioPath = path.join(__dirname, `tmp_audio_${randomId}.mp3`);
    await ytdlp(youtubeUrl, {
      output: inputAudioPath,
      extractAudio: true,
      audioFormat: 'mp3',
      audioQuality: '0'
    });
    console.log('Descarga completada:', inputAudioPath);

    // 4) Ejecutar Spleeter mediante separar.py
    const pythonScriptPath = path.join(__dirname, 'separar.py');
    console.log('Ejecutando separación de audio...');
    exec(`python "${pythonScriptPath}" "${inputAudioPath}" "${randomId}"`, (error, stdout, stderr) => {
      console.log('--- SPLITTER STDOUT ---\n', stdout);
      console.log('--- SPLITTER STDERR ---\n', stderr);

      if (error) {
        console.error('Error al ejecutar Spleeter:', error);
        return res.status(500).send('Error en la separación de audio');
      }

      // Buscar carpeta stems_<randomId>
      const stemsDir = path.join(__dirname, `stems_${randomId}`);
      if (!fs.existsSync(stemsDir)) {
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
      if (!fs.existsSync(publicOutputDir)) {
        fs.mkdirSync(publicOutputDir, { recursive: true });
      }

      const files = fs.readdirSync(finalStemsFolder)
        .filter(f => f.endsWith('.wav') || f.endsWith('.mp3'));
      const resultUrls = [];
      for (const file of files) {
        const sourcePath = path.join(finalStemsFolder, file);
        const destPath = path.join(publicOutputDir, file);
        fs.copyFileSync(sourcePath, destPath);
        // URLs publicas
        resultUrls.push(`/outputs/${randomId}/${file}`);
      }

      // Borrar mp3 original
      fs.unlinkSync(inputAudioPath);

      // Responder
      res.json({
        message: 'Separación completada',
        files: resultUrls
      });
    });
  } catch (err) {
    console.error('Error en /process-url:', err);
    res.status(500).send('Error procesando la solicitud');
  }
});

// Llamamos a la limpieza antes de arrancar el servidor
cleanupOnStartup();

app.listen(PORT, () => {
  console.log(`Servidor escuchando en http://localhost:${PORT}`);
});
