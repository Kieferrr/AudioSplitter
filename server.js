import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import apiRoutes from './src/routes/api.js';

// 1. Configuración Inicial
dotenv.config();
const app = express();
const PORT = process.env.PORT || 8080;

// Configurar __dirname para ES Modules (Node moderno)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 2. Middlewares (Herramientas intermedias)
app.use(cors()); // Permitir conexiones externas
app.use(express.json()); // Entender JSON
app.use(express.static(path.join(__dirname, 'public'))); // Servir la página web

// 3. Rutas de Prueba
// Esto es para ver si el servidor respira
app.get('/ping', (req, res) => {
    res.send('pong 🏓 - El servidor V2 está vivo');
});

// Rutas de la API
app.use('/api', apiRoutes);

// 4. Iniciar Servidor
app.listen(PORT, () => {
    console.log(`
  ==========================================
  🚀 SERVIDOR V2 LISTO
  📡 URL: http://localhost:${PORT}
  📦 Ambiente: ${process.env.NODE_ENV || 'development'}
  ==========================================
  `);
});