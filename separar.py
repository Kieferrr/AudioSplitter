import sys
import os
import subprocess
from google.cloud import storage

"""
Uso: python separar.py <ruta_audio_entrada> <randomId> [stems]
"""

def upload_to_gcp(local_file_path, bucket_name, destination_blob_name):
    """Sube un archivo al bucket de Google Cloud Storage."""
    storage_client = storage.Client()
    bucket = storage_client.bucket(bucket_name)
    blob = bucket.blob(destination_blob_name)
    blob.upload_from_filename(local_file_path)
    print(f"Archivo {local_file_path} subido a {bucket_name}/{destination_blob_name}.")

def main():
    if len(sys.argv) < 3:
        print("Faltan argumentos. Uso: python separar.py <ruta_audio_entrada> <randomId> [stems]")
        sys.exit(1)

    audio_input = sys.argv[1]
    random_id = sys.argv[2]
    stems = sys.argv[3] if len(sys.argv) > 3 else "5"

    # Carpeta temporal (Ojo: en V2 usaremos rutas absolutas desde Node, pero esto sirve)
    output_dir = os.path.join("public", "outputs", random_id)

    if not os.path.exists(output_dir):
        os.makedirs(output_dir)

    # Comando Spleeter
    preset = f"spleeter:{stems}stems"
    cmd = ["spleeter", "separate", "-p", preset, "-o", output_dir, audio_input]

    try:
        subprocess.run(cmd, check=True)
        print("Separación completada correctamente.")
    except subprocess.CalledProcessError as e:
        print("Error al ejecutar Spleeter:", e)
        sys.exit(1)

    # Subida a GCP
    bucket_name = os.environ.get("BUCKET_NAME")
    
    if bucket_name:
        print(f"DEBUG: BUCKET_NAME detectado: {bucket_name}. Iniciando búsqueda...")
        files_found = False
        
        for root, dirs, files in os.walk(output_dir):
            for stem_file in files:
                if stem_file.endswith(".wav"):
                    files_found = True
                    local_file_path = os.path.join(root, stem_file)
                    destination_blob_name = f"stems/{random_id}/{stem_file}" 
                    
                    try:
                        print(f"DEBUG: Subiendo {stem_file}...")
                        upload_to_gcp(local_file_path, bucket_name, destination_blob_name)
                    except Exception as exc:
                        print(f"ERROR: No se pudo subir {stem_file} a GCP: {exc}")
        
        if not files_found:
            print(f"ADVERTENCIA: No se encontraron archivos .wav en {output_dir}")
    else:
        print("BUCKET_NAME no está definido; se omite la subida a GCP.")

if __name__ == '__main__':
    main()