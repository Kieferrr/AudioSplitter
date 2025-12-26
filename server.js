import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { Storage } from '@google-cloud/storage';
import apiRoutes from './src/routes/api.js';

// --- NUEVOS IMPORTS PARA ADMIN ---
import admin from 'firebase-admin';
import { requireAdmin } from './src/middlewares/paywall.js';

// 1. Configuración Inicial
dotenv.config();

// Inicializar Firebase Admin si no está iniciado (necesario para buscar emails)
if (!admin.apps.length) {
  admin.initializeApp();
}

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

// Limpieza inicial de temporales
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
    const safeTitle = (songTitle || 'Untitled').replace(/[^a-zA-Z0-9-_]/g, '_');
    const timestamp = Date.now();
    const songFolder = `${timestamp}_${safeTitle}`;

    for (const url of urls) {
      if (!url) continue;
      try {
        const urlParts = url.split(bucketName + '/')[1];
        if (!urlParts) continue;

        const decodedName = decodeURIComponent(urlParts);
        let originalFileName = decodedName.split('/').pop();
        const destination = `saved_songs/${userId}/${songFolder}/${originalFileName}`;

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

// --- RUTA ADMIN: DAR CRÉDITOS ---
app.post('/api/admin/add-credits', requireAdmin, async (req, res) => {
  try {
    const { targetEmail, amount } = req.body;

    if (!targetEmail || !amount) {
      return res.status(400).json({ error: 'Faltan datos (email o monto).' });
    }

    const creditsToAdd = parseInt(amount);

    // 1. Buscar usuario por Email
    const userRecord = await admin.auth().getUserByEmail(targetEmail);
    const uid = userRecord.uid;

    // 2. Referencia a Firestore
    const db = admin.firestore();
    const userRef = db.collection('users').doc(uid);

    // 3. Transacción para sumar seguro
    await db.runTransaction(async (t) => {
      const doc = await t.get(userRef);
      if (!doc.exists) throw new Error("El usuario no tiene documento en BD.");

      const currentCredits = doc.data().credits || 0;
      const newTotal = currentCredits + creditsToAdd;

      t.update(userRef, { credits: newTotal });
    });

    console.log(`⚡ ADMIN: Recarga de ${creditsToAdd} a ${targetEmail}`);
    res.json({ success: true, message: `✅ Se agregaron ${creditsToAdd} créditos a ${targetEmail}` });

  } catch (error) {
    console.error("Error dando créditos:", error);
    if (error.code === 'auth/user-not-found') {
      return res.status(404).json({ error: 'No existe usuario con ese correo.' });
    }
    res.status(500).json({ error: error.message });
  }
});

// --- RUTA PRINCIPAL DE PROCESAMIENTO ---
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
  ⚡ Admin System: ACTIVO
  ==========================================
  `);
});

server.setTimeout(1200000); // 20 minutos timeout