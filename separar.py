import sys
import os
import shutil
import subprocess
from google.cloud import storage

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
    # Forzar salida en utf-8
    sys.stdout.reconfigure(encoding='utf-8')

    if len(sys.argv) < 3:
        print("Faltan argumentos. Uso: python separar.py <input> <randomId>")
        sys.exit(1)

    audio_input = sys.argv[1]
    random_id = sys.argv[2]
    
    # Carpeta donde están los MP3 (ej: public/outputs/12345)
    output_base = os.path.join("public", "outputs", random_id)
    
    if not os.path.exists(output_base):
        os.makedirs(output_base)

    print(f"[INFO] Procesando con Demucs ID: {random_id}")

    # --- COMANDO DEMUCS ---
    cmd = [
        "demucs",
        "-n", "htdemucs",
        "--mp3",
        "--mp3-bitrate", "192",
        "-o", output_base,
        audio_input
    ]

    try:
        subprocess.run(cmd, check=True)
        print("[INFO] Separacion Demucs completada.")
    except subprocess.CalledProcessError as e:
        print(f"[ERROR] Error fatal al ejecutar Demucs: {e}")
        sys.exit(1)

    # ==========================================
    # 1. APLANAR CARPETAS
    # ==========================================
    print("[INFO] Organizando archivos...")
    
    for root, dirs, files in os.walk(output_base):
        if root == output_base:
            continue 
            
        for filename in files:
            if filename.endswith(".mp3") or filename.endswith(".wav"):
                source_path = os.path.join(root, filename)
                dest_path = os.path.join(output_base, filename)
                shutil.move(source_path, dest_path)

    # Limpiar carpetas vacías
    for root, dirs, files in os.walk(output_base, topdown=False):
        for name in dirs:
            try:
                os.rmdir(os.path.join(root, name))
            except OSError:
                pass 

    # ==========================================
    # 2. CREAR ARCHIVO .ZIP (CORREGIDO) 📦
    # ==========================================
    print("[INFO] Creando archivo ZIP...")
    
    # TRUCO: Creamos el zip UN NIVEL ARRIBA (en public/outputs) para no crear bucle infinito
    # Nombre temporal: public/outputs/12345_temp
    zip_temp_name = os.path.join("public", "outputs", f"{random_id}_temp")
    
    # Esto crea public/outputs/12345_temp.zip
    shutil.make_archive(zip_temp_name, 'zip', output_base)
    
    # Ahora movemos el ZIP terminado ADENTRO de la carpeta 12345
    final_zip_path = os.path.join(output_base, "full_mix.zip")
    shutil.move(f"{zip_temp_name}.zip", final_zip_path)
    
    print(f"[OK] ZIP creado y movido a: {final_zip_path}")

    # ==========================================
    # 3. LÓGICA HÍBRIDA: NUBE vs LOCAL
    # ==========================================
    bucket_name = os.environ.get("BUCKET_NAME")
    
    if bucket_name:
        # MODO NUBE
        print(f"[INFO] BUCKET_NAME detectado: {bucket_name}")
        print("[INFO] Subiendo archivos a Google Cloud Storage...")
        
        files_found = False
        
        for filename in os.listdir(output_base):
            # Subimos MP3s y el ZIP
            if filename.endswith(".mp3") or filename.endswith(".wav") or filename.endswith(".zip"):
                files_found = True
                local_path = os.path.join(output_base, filename)
                destination_blob = f"stems/{random_id}/{filename}"
                upload_to_gcp(local_path, bucket_name, destination_blob)
        
        if not files_found:
            print("[WARN] No encontré archivos para subir.")

        # Limpieza Local
        try:
            shutil.rmtree(output_base)
            print("[OK] Limpieza temporal completada.")
        except Exception as e:
            print(f"[WARN] No se pudo borrar carpeta temporal: {e}")

    else:
        # MODO LOCAL
        print("[INFO] Modo Local. Archivos listos en disco.")
        print(f"[INFO] ZIP disponible en: {output_base}/full_mix.zip")

if __name__ == '__main__':
    main()