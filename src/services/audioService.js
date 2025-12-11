import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// RECIBE 4 ARGUMENTOS: inputPath, randomId, format, songLabel
export const processAudio = (inputPath, randomId, format = 'mp3', songLabel = 'track') => {
    return new Promise((resolve, reject) => {

        const scriptPath = path.join(__dirname, '../../separar.py');

        // Log para depuración
        console.log(`⚙️ ID: ${randomId} | Formato: ${format.toUpperCase()} | Etiqueta: ${songLabel}`);

        // Agregamos songLabel como 4to argumento para Python
        const pythonProcess = spawn('python', [scriptPath, inputPath, randomId, format, songLabel]);

        pythonProcess.on('error', (err) => {
            console.error("🔴 Error CRÍTICO al iniciar Python:", err);
            reject(new Error("No se pudo iniciar el separador de audio."));
        });

        let dataString = '';
        let errorString = '';

        pythonProcess.stdout.on('data', (data) => {
            const msg = data.toString();
            console.log(`🐍 Python: ${msg.trim()}`);
            dataString += msg;
        });

        pythonProcess.stderr.on('data', (data) => {
            const msg = data.toString();
            // Demucs usa stderr para la barra de progreso
            console.log(`🔹 Demucs Info: ${msg.trim()}`);
            errorString += msg;
        });

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