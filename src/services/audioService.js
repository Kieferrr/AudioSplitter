import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

// Configuración de rutas para ES Modules (Mantener esto es vital)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1. CAMBIO: Agregamos el argumento 'format' con valor por defecto 'mp3'
export const processAudio = (inputPath, randomId, format = 'mp3') => {
    return new Promise((resolve, reject) => {

        // Ruta al script de Python
        const scriptPath = path.join(__dirname, '../../separar.py');

        // 2. CAMBIO: Actualizamos el log para ver el formato
        console.log(`⚙️ Iniciando procesamiento para ID: ${randomId} | Formato: ${format.toUpperCase()}`);

        // IMPORTANTE: Usamos 'python' a secas (usa el PATH global del sistema)
        // 3. CAMBIO: Agregamos 'format' al final del array de argumentos
        const pythonProcess = spawn('python', [scriptPath, inputPath, randomId, format]);

        // --- Capturar error de arranque (Airbag) ---
        pythonProcess.on('error', (err) => {
            console.error("🔴 Error CRÍTICO al iniciar Python:", err);
            reject(new Error("No se pudo iniciar el separador de audio. ¿Está instalado Python?"));
        });
        // --------------------------------------------------

        let dataString = '';
        let errorString = '';

        // Escuchar logs normales (print de Python)
        pythonProcess.stdout.on('data', (data) => {
            const msg = data.toString();
            console.log(`🐍 Python: ${msg.trim()}`);
            dataString += msg;
        });

        // Escuchar errores y progreso de Demucs
        pythonProcess.stderr.on('data', (data) => {
            const msg = data.toString();
            // Demucs usa stderr para la barra de progreso, así que lo mostramos como Info
            console.log(`🔹 Demucs Info: ${msg.trim()}`);
            errorString += msg;
        });

        // Cuando termina el proceso
        pythonProcess.on('close', (code) => {
            if (code === 0) {
                console.log('✅ Python: Proceso finalizado con éxito.');
                resolve({ success: true, logs: dataString });
            } else {
                console.error("❌ Error final Python:", errorString);
                reject(new Error(`El proceso falló con código ${code}`));
            }
        });
    });
};