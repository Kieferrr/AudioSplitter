import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const downloadFromYoutube = (url, randomId) => {
    return new Promise((resolve, reject) => {
        const scriptPath = path.join(__dirname, '../../descargar_yt.py');

        // Llamamos a python
        const pythonProcess = spawn('python', [scriptPath, url, randomId]);

        let dataString = '';

        pythonProcess.stdout.on('data', (data) => {
            const msg = data.toString();
            // Solo nos interesa el JSON final, ignoramos logs de texto intermedios si los hubiera
            if (msg.trim().startsWith('{')) {
                dataString += msg;
            } else {
                console.log(`🎥 YT-DLP: ${msg.trim()}`);
            }
        });

        pythonProcess.stderr.on('data', (data) => {
            console.error(`⚠️ YT Error: ${data.toString()}`);
        });

        pythonProcess.on('close', (code) => {
            try {
                // Intentamos leer la respuesta JSON del script
                const result = JSON.parse(dataString);
                if (result.success) {
                    resolve(result);
                } else {
                    reject(new Error(result.error));
                }
            } catch (e) {
                reject(new Error("Error al procesar la respuesta del descargador de YouTube"));
            }
        });
    });
};