import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import apiRoutes from './src/routes/api.js';
import { bucketName } from './src/config/storage.js';

// 1. Configuración Inicial
dotenv.config();
const app = express();
const PORT = process.env.PORT || 8080;

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

// 3. Configuración de Archivos Estáticos (Vital para que funcionen los audios)
// Prioridad: Servir carpeta outputs explícitamente
app.use('/outputs', express.static(outputsDir));
// Servir el resto de la web
app.use(express.static(publicDir));

// 4. Rutas
app.get('/ping', (req, res) => res.send('pong 🏓'));
app.use('/api', apiRoutes);

// 5. Iniciar Servidor (CON TIMEOUT EXTENDIDO)
const server = app.listen(PORT, () => {
  console.log(`
  ==========================================
  🚀 AUDIO SPLITTER V2 - SERVIDOR ACTIVO
  ==========================================
  📡 URL:  http://localhost:${PORT}
  📦 Modo: ${bucketName ? '☁️ NUBE (GCP)' : '💻 LOCAL (Disco Duro)'}
  📂 Outputs: ${bucketName ? 'Google Storage' : '/public/outputs'}
  ⏳ Timeout: 20 minutos (Anti-corte Docker)
  ==========================================
  `);
});

// Aumentamos el timeout a 20 minutos (1.200.000 ms)
// Esto evita que Node cierre la conexión si el proceso Python tarda mucho en CPU
server.setTimeout(1200000);