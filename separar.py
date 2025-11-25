import sys
import os
import subprocess
from google.cloud import storage

"""
Uso: python separar.py <ruta_audio_entrada> <randomId> [stems]
Genera una carpeta "public/outputs/<randomId>/" con los stems resultantes.
Si se define la variable de entorno BUCKET_NAME, sube los stems al bucket de GCP.
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
    stems = sys.argv[3] if len(sys.argv) > 3 else "5"  # Predeterminado a 5 stems

    # Carpeta donde se almacenarán los stems (servida por Express)
    output_dir = os.path.join("public", "outputs", random_id)

    # Crear la carpeta si no existe
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)

    # Construir el comando para Spleeter
    preset = f"spleeter:{stems}stems"
    cmd = [
        "spleeter",
        "separate",
        "-p", preset,
        "-o", output_dir,
        audio_input
    ]

    try:
        subprocess.run(cmd, check=True)
        print("Separación completada correctamente.")
    except subprocess.CalledProcessError as e:
        print("Error al ejecutar Spleeter:", e)
        sys.exit(1)

    # Subir los archivos generados al bucket de GCP si está configurado
    bucket_name = os.environ.get("BUCKET_NAME")
    if bucket_name:
        for stem_file in os.listdir(output_dir):
            if stem_file.endswith(".wav"):
                local_file_path = os.path.join(output_dir, stem_file)
                destination_blob_name = f"stems/{random_id}/{stem_file}"  # Ruta dentro del bucket
                try:
                    upload_to_gcp(local_file_path, bucket_name, destination_blob_name)
                except Exception as exc:  # pylint: disable=broad-except
                    print(f"No se pudo subir {stem_file} a GCP: {exc}")
    else:
        print("BUCKET_NAME no está definido; se omite la subida a GCP.")

if __name__ == '__main__':
    main()
