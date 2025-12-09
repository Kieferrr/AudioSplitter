import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

// Truco para __dirname en ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const processAudio = (inputPath, randomId, stems = 5) => {
    return new Promise((resolve, reject) => {
        // Ruta absoluta al script de Python (está en la raíz del proyecto)
        // Subimos 2 niveles desde src/services/ hasta la raíz
        const scriptPath = path.join(__dirname, '../../separar.py');

        console.log(`⚙️ Iniciando procesamiento para ID: ${randomId}`);

        // Ejecutar: python separar.py <input> <id> <stems>
        const pythonProcess = spawn('python', [scriptPath, inputPath, randomId, stems.toString()]);

        let dataString = '';
        let errorString = '';

        // Capturar lo que imprime el Python (print)
        pythonProcess.stdout.on('data', (data) => {
            const msg = data.toString();
            console.log(`🐍 Python: ${msg.trim()}`);
            dataString += msg;
        });

        // Capturar errores de Python
        pythonProcess.stderr.on('data', (data) => {
            console.error(`🔴 Python Error: ${data.toString()}`);
            errorString += data.toString();
        });

        // Cuando Python termina
        pythonProcess.on('close', (code) => {
            if (code === 0) {
                resolve({ success: true, logs: dataString });
            } else {
                reject(new Error(`El proceso de Python falló con código ${code}. Error: ${errorString}`));
            }
        });
    });
};