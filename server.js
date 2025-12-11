import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs'; // Importamos fs para verificar existencia
import apiRoutes from './src/routes/api.js';

// 1. Configuración Inicial
dotenv.config();
const app = express();
const PORT = process.env.PORT || 8080;

// 2. Middlewares
app.use(cors());
app.use(express.json());

// --- CORRECCIÓN DE RUTAS (LA SOLUCIÓN) ---
// Usamos process.cwd() que apunta a la raíz del proyecto (C:\Users\Kiefer\Desktop\AudioSplitter)
const publicDir = path.join(process.cwd(), 'public');
const outputsDir = path.join(publicDir, 'outputs');

console.log("------------------------------------------------");
console.log("🔍 DIAGNÓSTICO DE RUTAS:");
console.log("📂 Raíz del proyecto:", process.cwd());
console.log("📂 Carpeta Public:", publicDir);
console.log("📂 Carpeta Outputs:", outputsDir);

// Verificar si la carpeta existe físicamente
if (fs.existsSync(outputsDir)) {
  console.log("✅ La carpeta 'outputs' EXISTE físicamente.");
} else {
  console.log("❌ ALERTA: La carpeta 'outputs' NO fue encontrada en esa ruta.");
}
console.log("------------------------------------------------");

// Forzar el servicio de la carpeta outputs
app.use('/outputs', express.static(outputsDir));

// Servir el resto de la carpeta public (index.html, css, js)
app.use(express.static(publicDir));

// 3. Rutas
app.get('/ping', (req, res) => {
  res.send('pong 🏓 - El servidor V2 está vivo');
});

app.use('/api', apiRoutes);

// 4. Iniciar Servidor
app.listen(PORT, () => {
  console.log(`🚀 SERVIDOR CORRIENDO EN: http://localhost:${PORT}`);
});