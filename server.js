import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { Storage } from '@google-cloud/storage';
import apiRoutes from './src/routes/api.js';

// 1. Configuración Inicial (IMPORTANTE: dotenv primero)
dotenv.config();

// Definimos bucketName AQUÍ DIRECTAMENTE para asegurar que dotenv ya cargó
const bucketName = process.env.BUCKET_NAME;

const app = express();
const PORT = process.env.PORT || 8080;

// Inicializar Google Storage
// Usamos try/catch por si falta la llave JSON
let storage, bucket;
try {
  if (bucketName) {
    storage = new Storage(); // Busca automáticamente GOOGLE_APPLICATION_CREDENTIALS
    bucket = storage.bucket(bucketName);
    console.log(`✅ Google Storage configurado con bucket: ${bucketName}`);
  } else {
    console.warn("⚠️ No se detectó BUCKET_NAME en .env. Modo local sin guardado en nube.");
  }
} catch (error) {
  console.error("❌ Error inicializando Google Storage:", error.message);
}

// Definir rutas base
const publicDir = path.join(process.cwd(), 'public');
const outputsDir = path.join(publicDir, 'outputs');

// --- LIMPIEZA AUTOMÁTICA AL INICIAR (SOLO MODO LOCAL) ---
if (!bucketName) {
  if (fs.existsSync(outputsDir)) {
    try {
      fs.rmSync(outputsDir, { recursive: true, force: true });
      fs.mkdirSync(outputsDir);
    } catch (e) {
      console.log("⚠️ No se pudo limpiar la carpeta temporal anterior.");
    }
  } else {
    fs.mkdirSync(outputsDir, { recursive: true });
  }
}

// 2. Middlewares
app.use(cors());
app.use(express.json());

// 3. Configuración de Archivos Estáticos
app.use('/outputs', express.static(outputsDir));
app.use(express.static(publicDir));

// 4. Rutas

app.get('/ping', (req, res) => res.send('pong 🏓'));

// --- RUTA: GUARDAR (MUDANZA ORDENADA) ---
app.post('/api/save-song', async (req, res) => {
  try {
    if (!bucket) return res.status(500).json({ error: 'No hay Bucket configurado.' });

    const { urls, userId, songTitle } = req.body; // Recibimos songTitle para la carpeta
    if (!urls || !userId) return res.status(400).json({ error: 'Faltan datos.' });

    const savedUrls = [];
    // Limpiamos el título para que sea válido como nombre de carpeta
    const safeTitle = (songTitle || 'Untitled').replace(/[^a-zA-Z0-9-_]/g, '_');
    const timestamp = Date.now();
    const songFolder = `${timestamp}_${safeTitle}`; // Ej: 17123456_Mi_Cancion

    for (const url of urls) {
      if (!url) continue;
      try {
        const urlParts = url.split(bucketName + '/')[1];
        if (!urlParts) continue;

        const decodedName = decodeURIComponent(urlParts);
        // Detectar tipo de archivo original (vocals, drums, etc) para mantener el nombre limpio
        let originalFileName = decodedName.split('/').pop();

        // Si el archivo ya tiene prefijos raros, intentamos limpiarlo, 
        // pero lo más importante es la carpeta contenedora.

        // Nueva Ruta: saved_songs / USER_ID / SONG_FOLDER / filename.mp3
        const destination = `saved_songs/${userId}/${songFolder}/${originalFileName}`;

        await bucket.file(decodedName).copy(bucket.file(destination));
        // await bucket.file(destination).makePublic(); // YA NO ES NECESARIO

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

// --- RUTA: BORRAR CARPETA DE CANCIÓN ---
app.post('/api/delete-song', async (req, res) => {
  try {
    console.log("🗑️ Petición de borrado recibida. Body:", req.body); // <--- LOG NUEVO

    if (!bucket) {
      return res.status(500).json({ error: 'No hay Bucket configurado.' });
    }

    const { folderPath } = req.body;

    if (!folderPath) {
      console.error("❌ Error: folderPath llegó vacío o undefined.");
      return res.status(400).json({ error: 'Falta folderPath.' });
    }

    console.log(`📂 Ejecutando borrado en prefijo: ${folderPath}`);

    // Borra todos los archivos que empiecen con esa ruta
    await bucket.deleteFiles({ prefix: folderPath });

    console.log("✅ Archivos eliminados del bucket correctamente.");
    res.json({ success: true });

  } catch (error) {
    console.error("❌ Error delete-song:", error);
    res.status(500).json({ error: error.message });
  }
});

// Rutas API
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

server.setTimeout(1200000);