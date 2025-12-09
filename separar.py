import sys
import os
import subprocess
from google.cloud import storage

"""
SCRIPT V3: Usa Demucs (Meta/Facebook) para separar audio.
Correcciones: Sin emojis y comando de bitrate arreglado.
"""

def upload_to_gcp(local_file_path, bucket_name, destination_blob_name):
    """Sube un archivo al bucket de Google Cloud Storage."""
    try:
        storage_client = storage.Client()
        bucket = storage_client.bucket(bucket_name)
        blob = bucket.blob(destination_blob_name)
        blob.upload_from_filename(local_file_path)
        print(f"[OK] Subido a GCP: {destination_blob_name}")
    except Exception as e:
        print(f"[ERROR] Error subiendo {destination_blob_name}: {e}")

def main():
    # Forzar salida en utf-8 para evitar errores en consola de Windows
    sys.stdout.reconfigure(encoding='utf-8')

    if len(sys.argv) < 3:
        print("Faltan argumentos. Uso: python separar.py <input> <randomId>")
        sys.exit(1)

    audio_input = sys.argv[1]
    random_id = sys.argv[2]
    
    # Configuración de carpetas
    output_base = os.path.join("public", "outputs", random_id)
    
    if not os.path.exists(output_base):
        os.makedirs(output_base)

    print(f"[INFO] Procesando con Demucs ID: {random_id}")

    # --- COMANDO DEMUCS ---
    cmd = [
        "demucs",
        "-n", "htdemucs",
        "--mp3",
        "--mp3-bitrate", "192",  # <--- CORREGIDO: Antes decía solo --bitrate
        "-o", output_base,
        audio_input
    ]

    try:
        # Ejecutamos Demucs
        subprocess.run(cmd, check=True)
        print("[INFO] Separacion Demucs completada.")
    except subprocess.CalledProcessError as e:
        print(f"[ERROR] Error fatal al ejecutar Demucs: {e}")
        sys.exit(1)

    # --- SUBIDA A GOOGLE CLOUD ---
    bucket_name = os.environ.get("BUCKET_NAME")
    
    if bucket_name:
        print(f"[INFO] Iniciando subida a bucket: {bucket_name}")
        files_found = False
        
        # Buscar archivos recursivamente
        for root, dirs, files in os.walk(output_base):
            for filename in files:
                if filename.endswith(".mp3") or filename.endswith(".wav"):
                    files_found = True
                    local_path = os.path.join(root, filename)
                    
                    # Ruta destino: stems/ID/vocals.mp3
                    destination_blob = f"stems/{random_id}/{filename}"
                    
                    try:
                        upload_to_gcp(local_path, bucket_name, destination_blob)
                    except Exception as exc:
                        print(f"[ERROR GCP] {exc}")
        
        if not files_found:
            print("[WARN] Demucs termino pero no encontre archivos de audio para subir.")
            
    else:
        print("[WARN] BUCKET_NAME no definido. Archivos quedaron en local.")

if __name__ == '__main__':
    main()