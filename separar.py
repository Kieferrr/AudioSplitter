import sys
import os
import shutil
import subprocess
from google.cloud import storage

def upload_to_gcp(local_file_path, bucket_name, destination_blob_name):
    try:
        storage_client = storage.Client()
        bucket = storage_client.bucket(bucket_name)
        blob = bucket.blob(destination_blob_name)
        blob.upload_from_filename(local_file_path)
        print(f"[OK] Subido a GCP: {destination_blob_name}")
    except Exception as e:
        print(f"[ERROR] Error subiendo {destination_blob_name}: {e}")

def main():
    sys.stdout.reconfigure(encoding='utf-8')

    # Ahora esperamos 3 argumentos: script, input, id, format
    if len(sys.argv) < 4:
        # Si falta el formato, asumimos mp3 por compatibilidad
        print("[WARN] Faltan argumentos, usando MP3 por defecto.")
        audio_format = "mp3"
    else:
        audio_format = sys.argv[3] # 'mp3' o 'wav'

    audio_input = sys.argv[1]
    random_id = sys.argv[2]
    
    output_base = os.path.join("public", "outputs", random_id)
    if not os.path.exists(output_base):
        os.makedirs(output_base)

    print(f"[INFO] Procesando ID: {random_id} | Formato: {audio_format.upper()}")

    # --- CONFIGURAR COMANDO DEMUCS ---
    cmd = ["demucs", "-n", "htdemucs", "-o", output_base]

    # Lógica de Formato
    if audio_format == "mp3":
        cmd.extend(["--mp3", "--mp3-bitrate", "192"])
    else:
        # Si es WAV, Demucs lo hace por defecto, no agregamos flags extras.
        # WAV usa más espacio pero es calidad pura (lossless).
        pass

    cmd.append(audio_input)

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
    
    # Buscamos la extensión correcta
    target_ext = f".{audio_format}" # .mp3 o .wav
    
    for root, dirs, files in os.walk(output_base):
        if root == output_base:
            continue 
            
        for filename in files:
            # Solo movemos los archivos del formato solicitado
            if filename.endswith(target_ext):
                source_path = os.path.join(root, filename)
                dest_path = os.path.join(output_base, filename)
                shutil.move(source_path, dest_path)

    for root, dirs, files in os.walk(output_base, topdown=False):
        for name in dirs:
            try: os.rmdir(os.path.join(root, name))
            except OSError: pass 

    # ==========================================
    # 2. CREAR ZIP
    # ==========================================
    print("[INFO] Creando archivo ZIP...")
    zip_temp_name = os.path.join("public", "outputs", f"{random_id}_temp")
    shutil.make_archive(zip_temp_name, 'zip', output_base)
    
    final_zip_path = os.path.join(output_base, "full_mix.zip")
    shutil.move(f"{zip_temp_name}.zip", final_zip_path)
    print(f"[OK] ZIP creado.")

    # ==========================================
    # 3. LÓGICA HÍBRIDA
    # ==========================================
    bucket_name = os.environ.get("BUCKET_NAME")
    
    if bucket_name:
        print(f"[INFO] Subiendo a Bucket: {bucket_name}")
        files_found = False
        
        for filename in os.listdir(output_base):
            # Subir el formato correcto Y el zip
            if filename.endswith(target_ext) or filename.endswith(".zip"):
                files_found = True
                local_path = os.path.join(output_base, filename)
                destination_blob = f"stems/{random_id}/{filename}"
                upload_to_gcp(local_path, bucket_name, destination_blob)
        
        if not files_found: print("[WARN] No encontré archivos para subir.")

        try:
            shutil.rmtree(output_base)
            print("[OK] Limpieza Nube completada.")
        except Exception as e: print(f"[WARN] Error limpieza: {e}")

    else:
        print("[INFO] Modo Local. Archivos listos.")

if __name__ == '__main__':
    main()