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

    if len(sys.argv) < 5:
        print("[WARN] Faltan argumentos, usando valores por defecto.")
        audio_format = "mp3"
        song_label = "track"
    else:
        audio_format = sys.argv[3]
        song_label = sys.argv[4]

    audio_input = sys.argv[1]
    random_id = sys.argv[2]
    
    output_base = os.path.join("public", "outputs", random_id)
    if not os.path.exists(output_base):
        os.makedirs(output_base)

    print(f"[INFO] ID: {random_id} | Label: {song_label} | Formato: {audio_format}")

    # --- DEMUCS ---
    cmd = ["demucs", "-n", "htdemucs", "-o", output_base]
    if audio_format == "mp3":
        cmd.extend(["--mp3", "--mp3-bitrate", "192"])
    
    cmd.append(audio_input)

    try:
        subprocess.run(cmd, check=True)
        print("[INFO] Separacion Demucs completada.")
    except subprocess.CalledProcessError as e:
        print(f"[ERROR] Error fatal Demucs: {e}")
        sys.exit(1)

    # ==========================================
    # 1. ORGANIZAR Y RENOMBRAR
    # ==========================================
    print("[INFO] Renombrando archivos...")
    
    target_ext = f".{audio_format}"
    
    # Diccionario para guardar las rutas de los archivos generados y usarlos en la mezcla
    generated_files = {} 

    for root, dirs, files in os.walk(output_base):
        if root == output_base: continue 
            
        for filename in files:
            if filename.endswith(target_ext):
                stem_name = filename.replace(target_ext, "") # vocals, drums, etc.
                new_filename = f"{stem_name}_{song_label}{target_ext}"
                
                source_path = os.path.join(root, filename)
                dest_path = os.path.join(output_base, new_filename)
                
                shutil.move(source_path, dest_path)
                
                # Guardamos la ruta para usarla después
                generated_files[stem_name] = dest_path
                print(f" -> {new_filename}")

    # Limpiar carpetas vacías
    for root, dirs, files in os.walk(output_base, topdown=False):
        for name in dirs:
            try: os.rmdir(os.path.join(root, name))
            except OSError: pass 

   # ==========================================
    # 2. GENERAR PISTA INSTRUMENTAL (MEZCLA) 🎸
    # ==========================================
    # Mezclamos: drums + bass + other = instrumental
    
    if 'drums' in generated_files and 'bass' in generated_files and 'other' in generated_files:
        print("[INFO] Generando pista Instrumental...")
        
        # CAMBIO DE NOMBRE: karaoke -> instrumental
        instr_filename = f"instrumental_{song_label}{target_ext}"
        instr_path = os.path.join(output_base, instr_filename)

        mix_cmd = [
            "ffmpeg", "-y",
            "-i", generated_files['drums'],
            "-i", generated_files['bass'],
            "-i", generated_files['other'],
            "-filter_complex", "amix=inputs=3:duration=first:dropout_transition=0:normalize=0",
            instr_path
        ]
        
        try:
            subprocess.run(mix_cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            print(f"[OK] Instrumental creado: {instr_filename}")
        except subprocess.CalledProcessError:
            print("[WARN] No se pudo crear el Instrumental.")
    else:
        print("[WARN] Faltan pistas para crear el Instrumental.")


    # ==========================================
    # 3. CREAR ZIP
    # ==========================================
    print("[INFO] Creando ZIP...")
    
    zip_temp_name = os.path.join("public", "outputs", f"{random_id}_temp")
    shutil.make_archive(zip_temp_name, 'zip', output_base)
    
    final_zip_name = f"{song_label}_Mix.zip"
    final_zip_path = os.path.join(output_base, final_zip_name)
    
    shutil.move(f"{zip_temp_name}.zip", final_zip_path)
    print(f"[OK] ZIP creado: {final_zip_name}")

    # ==========================================
    # 4. LÓGICA HÍBRIDA
    # ==========================================
    bucket_name = os.environ.get("BUCKET_NAME")
    
    if bucket_name:
        print(f"[INFO] Subiendo a Bucket...")
        files_found = False
        
        for filename in os.listdir(output_base):
            if filename.endswith(target_ext) or filename.endswith(".zip"):
                files_found = True
                local_path = os.path.join(output_base, filename)
                destination_blob = f"stems/{random_id}/{filename}"
                upload_to_gcp(local_path, bucket_name, destination_blob)
        
        if not files_found: print("[WARN] Nada para subir.")

        try:
            shutil.rmtree(output_base)
            print("[OK] Limpieza Nube.")
        except Exception: pass

    else:
        print("[INFO] Modo Local. Archivos listos.")

if __name__ == '__main__':
    main()