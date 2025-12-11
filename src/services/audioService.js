import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const processAudio = (inputPath, randomId, format = 'mp3', songLabel = 'track') => {
    return new Promise((resolve, reject) => {

        const scriptPath = path.join(__dirname, '../../separar.py');
        console.log(`⚙️ ID: ${randomId} | Formato: ${format.toUpperCase()}`);

        const pythonProcess = spawn('python', [scriptPath, inputPath, randomId, format, songLabel]);

        pythonProcess.on('error', (err) => {
            console.error("🔴 Error CRÍTICO Python:", err);
            reject(new Error("No se pudo iniciar Python."));
        });

        let dataString = '';
        let errorString = '';

        // VARIABLE PARA GUARDAR LOS DATOS ANALIZADOS
        let analysisResult = { bpm: 0, key: 'Unknown' };

        pythonProcess.stdout.on('data', (data) => {
            const msg = data.toString();
            console.log(`🐍 Python: ${msg.trim()}`);
            dataString += msg;

            // --- NUEVO: DETECTAR EL JSON DE DATOS ---
            const jsonMatch = msg.match(/\[DATA_JSON\]\s*(\{.*\})/);
            if (jsonMatch && jsonMatch[1]) {
                try {
                    analysisResult = JSON.parse(jsonMatch[1]);
                    console.log("🎹 Datos Musicales Detectados:", analysisResult);
                } catch (e) {
                    console.error("Error parseando JSON de Python:", e);
                }
            }
            // ----------------------------------------
        });

        pythonProcess.stderr.on('data', (data) => {
            const msg = data.toString();
            console.log(`🔹 Demucs: ${msg.trim()}`);
            errorString += msg;
        });

        pythonProcess.on('close', (code) => {
            if (code === 0) {
                // RESOLVEMOS DEVOLVIENDO TAMBIÉN LOS DATOS MUSICALES
                resolve({ success: true, logs: dataString, analysis: analysisResult });
            } else {
                reject(new Error(`Falló con código ${code}`));
            }
        });
    });
};