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

        let dataParts = [];

        pythonProcess.stdout.on('data', (data) => {
            const msg = data.toString();
            dataParts.push(msg);

            // Logueamos solo si no es JSON para no ensuciar, o si es un mensaje de progreso limpio
            if (!msg.trim().startsWith('{')) {
                console.log(`🎥 YT-DLP: ${msg.trim()}`);
            }
        });

        pythonProcess.stderr.on('data', (data) => {
            console.error(`⚠️ YT Log: ${data.toString()}`);
        });

        pythonProcess.on('error', (err) => {
            console.error("🔴 Error CRÍTICO al iniciar script YouTube:", err);
            reject(new Error("No se pudo iniciar el descargador. ¿Está instalado Python?"));
        });

        pythonProcess.on('close', (code) => {
            try {
                // Unimos todo lo recibido
                const fullOutput = dataParts.join('');

                // --- NUEVA LÓGICA DE PARSEO ROBUSTA ---
                // Dividimos por saltos de línea para analizar mensaje por mensaje
                const lines = fullOutput.split('\n');
                let successResult = null;
                let errorResult = null;

                for (const line of lines) {
                    const cleanLine = line.trim();
                    if (cleanLine.startsWith('{') && cleanLine.endsWith('}')) {
                        try {
                            const json = JSON.parse(cleanLine);
                            if (json.success) {
                                successResult = json;
                                break; // ¡Encontramos el éxito! Dejamos de buscar.
                            } else if (json.error) {
                                errorResult = json;
                            }
                        } catch (e) {
                            // Ignoramos líneas que parezcan JSON pero estén rotas
                        }
                    }
                }

                if (successResult) {
                    resolve(successResult);
                } else if (errorResult) {
                    reject(new Error(errorResult.error));
                } else {
                    reject(new Error("No se recibió respuesta válida del descargador."));
                }

            } catch (e) {
                reject(new Error("Error al procesar la respuesta del descargador de YouTube"));
            }
        });
    });
};