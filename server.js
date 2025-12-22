import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { Storage } from '@google-cloud/storage';
import apiRoutes from './src/routes/api.js';

// 1. Configuración Inicial
dotenv.config();

// Configuración de Google Cloud Storage
const bucketName = process.env.BUCKET_NAME;
const app = express();
const PORT = process.env.PORT || 8080;

// Inicializar Storage
let storage, bucket;
try {
  if (bucketName) {
    storage = new Storage();
    bucket = storage.bucket(bucketName);
    console.log(`✅ Google Storage configurado con bucket: ${bucketName}`);
  } else {
    console.warn("⚠️ MODO LOCAL: No se detectó BUCKET_NAME. Los archivos no se guardarán en la nube.");
  }
} catch (error) {
  console.error("❌ Error inicializando Google Storage:", error.message);
}

// Directorios
const publicDir = path.join(process.cwd(), 'public');
const outputsDir = path.join(publicDir, 'outputs');

// Limpieza inicial de temporales (Solo si no hay bucket o para asegurar limpieza)
if (!fs.existsSync(outputsDir)) {
  fs.mkdirSync(outputsDir, { recursive: true });
}

// 2. Middlewares
app.use(cors());
app.use(express.json());

// 3. Archivos Estáticos
app.use('/outputs', express.static(outputsDir));
app.use(express.static(publicDir));

// 4. Rutas de Sistema

// Health Check (Ping)
app.get('/ping', (req, res) => res.send('pong 🏓'));

// --- RUTA: GUARDAR CANCIÓN EN LA NUBE ---
app.post('/api/save-song', async (req, res) => {
  try {
    if (!bucket) return res.status(500).json({ error: 'No hay Bucket configurado.' });

    const { urls, userId, songTitle } = req.body;
    if (!urls || !userId) return res.status(400).json({ error: 'Faltan datos.' });

    const savedUrls = [];
    // Sanitizar nombre de carpeta
    const safeTitle = (songTitle || 'Untitled').replace(/[^a-zA-Z0-9-_]/g, '_');
    const timestamp = Date.now();
    const songFolder = `${timestamp}_${safeTitle}`;

    for (const url of urls) {
      if (!url) continue;
      try {
        // Extraer nombre del archivo de la URL actual
        const urlParts = url.split(bucketName + '/')[1];
        if (!urlParts) continue;

        const decodedName = decodeURIComponent(urlParts);
        let originalFileName = decodedName.split('/').pop();

        // Destino: saved_songs / USER_ID / SONG_FOLDER / filename.mp3
        const destination = `saved_songs/${userId}/${songFolder}/${originalFileName}`;

        // Copiar de temporal a permanente
        await bucket.file(decodedName).copy(bucket.file(destination));

        const publicUrl = `https://storage.googleapis.com/${bucketName}/${destination}`;
        savedUrls.push(publicUrl);

      } catch (e) {
        console.error(`Error copiando ${url}:`, e.message);
      }
    }

    if (savedUrls.length === 0) return res.status(500).json({ error: 'No se pudo guardar nada.' });
    res.json({ savedUrls });

  } catch (error) {
    console.error("Error save-song:", error);
    res.status(500).json({ error: error.message });
  }
});

// --- RUTA: BORRAR CANCIÓN DE LA NUBE ---
app.post('/api/delete-song', async (req, res) => {
  try {
    if (!bucket) return res.status(500).json({ error: 'No hay Bucket configurado.' });

    const { folderPath } = req.body;
    if (!folderPath) return res.status(400).json({ error: 'Falta folderPath.' });

    console.log(`🗑️ Borrando carpeta de nube: ${folderPath}`);
    await bucket.deleteFiles({ prefix: folderPath });

    res.json({ success: true });
  } catch (error) {
    console.error("❌ Error delete-song:", error);
    res.status(500).json({ error: error.message });
  }
});

// --- RUTA PRINCIPAL DE PROCESAMIENTO (Separación) ---
// Aquí es donde vive la lógica de subir archivo y separar
app.use('/api', apiRoutes);

// 5. Iniciar Servidor
const server = app.listen(PORT, () => {
  console.log(`
  ==========================================
  🚀 AUDIO SPLITTER V2 - SERVIDOR ACTIVO
  ==========================================
  📡 URL:  http://localhost:${PORT}
  📦 Modo: ${bucketName ? '☁️ NUBE (GCP)' : '💻 LOCAL (Disco Duro)'}
  🪣 Bucket: ${bucketName || 'NINGUNO'}
  ⏳ Timeout: 20 minutos
  ==========================================
  `);
});

server.setTimeout(1200000); // 20 minutos timeout