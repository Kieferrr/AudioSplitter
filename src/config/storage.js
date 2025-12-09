import { Storage } from '@google-cloud/storage';
import dotenv from 'dotenv';

// Cargar variables de entorno
dotenv.config();

// Inicializar el cliente de Storage
// Nota: En local busca tus credenciales de gcloud. En la nube usa la cuenta de servicio.
const storage = new Storage();
const bucketName = process.env.BUCKET_NAME;

if (!bucketName) {
    console.error("❌ ERROR: No se definió BUCKET_NAME en el archivo .env");
}

const bucket = storage.bucket(bucketName);

console.log(`✅ Configuración de Storage cargada para bucket: ${bucketName}`);

export { bucket, bucketName };