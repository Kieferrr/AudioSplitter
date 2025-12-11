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
    # Forzar salida en utf-8 para que Windows no falle con caracteres raros
    sys.stdout.reconfigure(encoding='utf-8')

    if len(sys.argv) < 3:
        print("Faltan argumentos. Uso: python separar.py <input> <randomId>")
        sys.exit(1)

    audio_input = sys.argv[1]
    random_id = sys.argv[2]
    
    # Esta es la carpeta raiz del ID (ej: public/outputs/12345)
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
    # NUEVO: APLANAR CARPETAS (La Solución)
    # ==========================================
    # Demucs crea subcarpetas (htdemucs/cancion/...). 
    # Vamos a sacar los mp3 de ahí y ponerlos en la raíz de output_base.
    print("[INFO] Organizando archivos...")
    
    for root, dirs, files in os.walk(output_base):
        if root == output_base:
            continue # No procesar la carpeta raíz todavía
            
        for filename in files:
            if filename.endswith(".mp3") or filename.endswith(".wav"):
                source_path = os.path.join(root, filename)
                dest_path = os.path.join(output_base, filename)
                
                # Mover archivo a la raíz del ID
                # Si ya existe (raro), lo sobreescribe
                shutil.move(source_path, dest_path)
                print(f"[INFO] Movido: {filename} -> Raíz")

    # Opcional: Borrar las carpetas vacías que dejó Demucs (htdemucs, etc)
    # para que quede limpio
    for root, dirs, files in os.walk(output_base, topdown=False):
        for name in dirs:
            try:
                os.rmdir(os.path.join(root, name))
            except OSError:
                pass # Si no está vacía, la dejamos

    # ==========================================
    # LÓGICA HÍBRIDA: NUBE vs LOCAL
    # ==========================================
    bucket_name = os.environ.get("BUCKET_NAME")
    
    if bucket_name:
        # MODO NUBE
        print(f"[INFO] BUCKET_NAME detectado: {bucket_name}")
        print("[INFO] Subiendo archivos a Google Cloud Storage...")
        
        files_found = False
        
        # Ahora los archivos están ordenaditos en la raíz
        for filename in os.listdir(output_base):
            if filename.endswith(".mp3") or filename.endswith(".wav"):
                files_found = True
                local_path = os.path.join(output_base, filename)
                destination_blob = f"stems/{random_id}/{filename}"
                upload_to_gcp(local_path, bucket_name, destination_blob)
        
        if not files_found:
            print("[WARN] No encontré archivos MP3 para subir.")

        print(f"[INFO] Limpiando archivos temporales locales (Modo Nube)...")
        try:
            shutil.rmtree(output_base)
            print("[OK] Limpieza completada.")
        except Exception as e:
            print(f"[WARN] No se pudo borrar carpeta temporal: {e}")

    else:
        # MODO LOCAL
        print("[INFO] BUCKET_NAME no definido. Modo Local activado.")
        print(f"[INFO] Los archivos están listos en: {output_base}")
        print("[INFO] NO se borrarán los archivos para que Node pueda servirlos.")

if __name__ == '__main__':
    main()