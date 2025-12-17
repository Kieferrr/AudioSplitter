import { spawn, exec } from 'child_process'; // Importamos AMBOS
import path from 'path';
import { fileURLToPath } from 'url';
import util from 'util'; // Para prometer exec

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Convertimos exec a promesa para usar await
const execPromise = util.promisify(exec);

export const youtubeService = {

    // --- NUEVA FUNCIÓN: Obtener Metadata (Rápida) ---
    async getVideoMeta(url) {
        try {
            // --dump-json: Info JSON completa
            // --skip-download: No baja nada
            // --flat-playlist: No escanea playlists enteras
            const command = `yt-dlp --dump-json --skip-download --flat-playlist "${url}"`;

            // Usamos exec porque esperamos una respuesta de texto única y rápida
            const { stdout } = await execPromise(command);
            const data = JSON.parse(stdout);

            return {
                title: data.title,
                duration: data.duration, // Duración en segundos (float o int)
                thumbnail: data.thumbnail
            };
        } catch (error) {
            console.error("Error obteniendo metadata:", error);
            // Mensaje amigable para el frontend
            throw new Error("No se pudo obtener información. Verifica que el video exista y sea público.");
        }
    },

    // --- TU FUNCIÓN ORIGINAL: Descargar (Pesada) ---
    downloadFromYoutube(url, randomId) {
        return new Promise((resolve, reject) => {
            const scriptPath = path.join(__dirname, '../../descargar_yt.py');

            // Usamos spawn para stream de datos en tiempo real
            const pythonProcess = spawn('python', [scriptPath, url, randomId]);

            let dataParts = [];

            pythonProcess.stdout.on('data', (data) => {
                const msg = data.toString();
                dataParts.push(msg);

                // Logueamos solo si no es JSON para no ensuciar
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
                    const fullOutput = dataParts.join('');
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
                                    break;
                                } else if (json.error) {
                                    errorResult = json;
                                }
                            } catch (e) {
                                // Ignoramos líneas rotas
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
    }
};

// Mantenemos exportación por defecto si la usas en otros lados, 
// o exportación nombrada como arriba.
// Para compatibilidad con tu código actual que usa "import { downloadFromYoutube }..."
export const downloadFromYoutube = youtubeService.downloadFromYoutube;