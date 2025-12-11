import { Storage } from '@google-cloud/storage';
import dotenv from 'dotenv';

// Cargar variables de entorno
dotenv.config();

// Inicializar el cliente de Storage
const bucketName = process.env.BUCKET_NAME;
let bucket = null;

if (bucketName) {
    // MODO NUBE (Producción)
    try {
        const storage = new Storage();
        bucket = storage.bucket(bucketName);
        console.log(`✅ Configuración de Storage cargada para bucket: ${bucketName}`);
    } catch (error) {
        console.error("❌ Error conectando a Google Cloud Storage:", error.message);
    }
} else {
    // MODO LOCAL (Tu hermano)
    console.log("⚠️ BUCKET_NAME no definido. Iniciando en MODO LOCAL (Archivos en disco).");
}

export { bucket, bucketName };