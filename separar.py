import sys
import os
import shutil
import subprocess
import json
import numpy as np
import warnings # Para silenciar el aviso amarillo
import torch    # <--- NUEVO: Necesario para detectar GPU/CPU

# Esto hace que la consola ignore la advertencia de versión futura
warnings.filterwarnings("ignore", category=FutureWarning)

# Importamos librosa con seguridad
try:
    import librosa
except ImportError:
    librosa = None

from google.cloud import storage

# --- 1. NUEVO: FUNCIÓN DE DETECCIÓN INTELIGENTE DE HARDWARE ---
def get_optimal_device():
    # Caso 1: Nvidia (Docker en Windows o Linux nativo)
    if torch.cuda.is_available():
        print("🚀 [Sistema] GPU Nvidia detectada (Modo Turbo)")
        return "cuda"
    # Caso 2: Mac Nativo (Fuera de Docker) - Por si acaso lo usas sin Docker
    elif hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
        print("🍎 [Sistema] Apple Silicon detectado (Modo MPS)")
        return "mps"
    # Caso 3: Fallback CPU (Docker en Mac o PC sin GPU)
    else:
        print("🐢 [Sistema] No se detectó aceleración. Usando CPU (Modo Compatibilidad)")
        return "cpu"

# Guardamos el dispositivo seleccionado en una variable global
DEVICE_SELECCIONADO = get_optimal_device()
# ---------------------------------------------------------------

def upload_to_gcp(local_file_path, bucket_name, destination_blob_name):
    try:
        storage_client = storage.Client()
        bucket = storage_client.bucket(bucket_name)
        blob = bucket.blob(destination_blob_name)
        blob.upload_from_filename(local_file_path)
        print(f"[OK] Subido a GCP: {destination_blob_name}")
    except Exception as e:
        print(f"[ERROR] Error subiendo {destination_blob_name}: {e}")

# --- FUNCIÓN DE ANÁLISIS (VERSIÓN CLÁSICA Y ESTABLE) ---
def analyze_bpm_key(audio_path):
    if librosa is None:
        return {"bpm": 0, "key": "Unknown"}
    
    print(f"[INFO] Analizando canción COMPLETA (esto puede tardar unos segundos)...")
    
    try:
        # 1. Cargar audio COMPLETO
        y, sr = librosa.load(audio_path)
        
        if len(y) == 0:
             return {"bpm": 0, "key": "Unknown"}

        # 2. Calcular BPM (USANDO LA LÍNEA CLÁSICA QUE SÍ FUNCIONA)
        onset_env = librosa.onset.onset_strength(y=y, sr=sr)
        
        # Volvimos a la vieja confiable:
        tempo = librosa.beat.tempo(onset_envelope=onset_env, sr=sr)
        
        bpm = int(round(tempo[0])) if len(tempo) > 0 else 0
        
        # 3. Calcular Key (Tonalidad)
        chroma = librosa.feature.chroma_cqt(y=y, sr=sr)
        chroma_vals = np.sum(chroma, axis=1)
        
        pitches = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
        maj_profile = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88]
        min_profile = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17]
        
        max_corr = -1
        key_name = "Unknown"
        
        for i in range(12):
            # Mayor
            profile = np.roll(maj_profile, i)
            corr = np.corrcoef(chroma_vals, profile)[0, 1]
            if corr > max_corr:
                max_corr = corr
                key_name = f"{pitches[i]} Maj"
            # Menor
            profile = np.roll(min_profile, i)
            corr = np.corrcoef(chroma_vals, profile)[0, 1]
            if corr > max_corr:
                max_corr = corr
                key_name = f"{pitches[i]} Min"

        print(f"[INFO] Análisis Exitoso -> BPM: {bpm} | Key: {key_name}")
        return {"bpm": bpm, "key": key_name}

    except Exception as e:
        print(f"🔴 [ERROR LIBROSA]: {str(e)}")
        return {"bpm": 0, "key": "Unknown"}


def main():
    sys.stdout.reconfigure(encoding='utf-8')

    if len(sys.argv) < 5:
        print("[WARN] Faltan argumentos.")
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

    print(f"[INFO] ID: {random_id} | Label: {song_label}")

    # --- 1. ANÁLISIS ---
    analysis_data = analyze_bpm_key(audio_input)
    print(f"[DATA_JSON] {json.dumps(analysis_data)}")

    # --- 2. DEMUCS ---
    # AQUÍ ESTÁ EL CAMBIO CLAVE: Agregamos "-d" y la variable DEVICE_SELECCIONADO
    cmd = ["demucs", "-n", "htdemucs", "-d", DEVICE_SELECCIONADO, "-o", output_base]
    
    if audio_format == "mp3":
        cmd.extend(["--mp3", "--mp3-bitrate", "192"])
    
    cmd.append(audio_input)

    try:
        subprocess.run(cmd, check=True)
        print("[INFO] Separacion Demucs completada.")
    except subprocess.CalledProcessError as e:
        print(f"[ERROR] Error fatal Demucs: {e}")
        sys.exit(1)

    # --- 3. RENOMBRAR Y ORGANIZAR ---
    print("[INFO] Organizando...")
    target_ext = f".{audio_format}"
    generated_files = {} 

    for root, dirs, files in os.walk(output_base):
        if root == output_base: continue 
        for filename in files:
            if filename.endswith(target_ext):
                stem_name = filename.replace(target_ext, "")
                new_filename = f"{stem_name}_{song_label}{target_ext}"
                source_path = os.path.join(root, filename)
                dest_path = os.path.join(output_base, new_filename)
                shutil.move(source_path, dest_path)
                generated_files[stem_name] = dest_path

    # Limpiar
    for root, dirs, files in os.walk(output_base, topdown=False):
        for name in dirs:
            try: os.rmdir(os.path.join(root, name))
            except OSError: pass 

    # --- 4. INSTRUMENTAL ---
    if 'drums' in generated_files and 'bass' in generated_files and 'other' in generated_files:
        print("[INFO] Creando Instrumental...")
        instr_filename = f"instrumental_{song_label}{target_ext}"
        instr_path = os.path.join(output_base, instr_filename)
        
        mix_cmd = [
            "ffmpeg", "-y", "-i", generated_files['drums'], "-i", generated_files['bass'], "-i", generated_files['other'],
            "-filter_complex", "amix=inputs=3:duration=first:dropout_transition=0:normalize=0", instr_path
        ]
        try:
            subprocess.run(mix_cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            print(f"[OK] Instrumental creado: {instr_filename}")
        except: pass

    # --- 5. ZIP ---
    print("[INFO] Creando ZIP...")
    zip_temp = os.path.join("public", "outputs", f"{random_id}_temp")
    shutil.make_archive(zip_temp, 'zip', output_base)
    final_zip = os.path.join(output_base, f"{song_label}_Mix.zip")
    shutil.move(f"{zip_temp}.zip", final_zip)

    # --- 6. NUBE ---
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
        try: shutil.rmtree(output_base)
        except: pass
    else:
        print("[INFO] Modo Local Listo.")

if __name__ == '__main__':
    main()