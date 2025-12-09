import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const processAudio = (inputPath, randomId, stems = 5) => {
    return new Promise((resolve, reject) => {
        // Ruta al script de Python
        const scriptPath = path.join(__dirname, '../../separar.py');

        console.log(`⚙️ Iniciando procesamiento para ID: ${randomId}`);

        // IMPORTANTE: Usamos 'python' a secas (usa el PATH global del sistema)
        // Demucs se instaló ahí en el Paso 1.
        const pythonProcess = spawn('python', [scriptPath, inputPath, randomId]);

        let dataString = '';
        let errorString = '';

        // Escuchar logs normales
        pythonProcess.stdout.on('data', (data) => {
            const msg = data.toString();
            console.log(`🐍 Python: ${msg.trim()}`);
            dataString += msg;
        });

        // Escuchar errores
        pythonProcess.stderr.on('data', (data) => {
            const msg = data.toString();
            // Demucs usa stderr para la barra de progreso, así que no siempre es error
            console.log(`🔹 Demucs Info: ${msg.trim()}`);
            errorString += msg;
        });

        pythonProcess.on('close', (code) => {
            if (code === 0) {
                resolve({ success: true, logs: dataString });
            } else {
                console.error("❌ Error final Python:", errorString);
                reject(new Error(`El proceso falló con código ${code}`));
            }
        });
    });
};