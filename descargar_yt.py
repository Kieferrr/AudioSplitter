import sys
import os
import yt_dlp
import json

# Forzar codificación UTF-8 para evitar errores de caracteres en consola
sys.stdout.reconfigure(encoding='utf-8')

def download_audio(youtube_url, random_id):
    output_dir = "uploads"
    # Crear carpeta uploads si no existe
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)

    # --- LÓGICA DE COOKIES INTELIGENTE ---
    # 1. Prioridad: Carpeta de secretos en la Nube (Cloud Run)
    secret_cookie_path = '/secrets/cookies.txt'
    # 2. Respaldo: Archivo local (Para pruebas en tu PC)
    local_cookie_path = 'cookies.txt'
    
    cookie_file = None
    
    if os.path.exists(secret_cookie_path):
        cookie_file = secret_cookie_path
    elif os.path.exists(local_cookie_path):
        cookie_file = local_cookie_path
        
    use_cookies = cookie_file is not None
    # -------------------------------------

    # Configuración de yt-dlp
    ydl_opts = {
        'format': 'bestaudio/best',
        # Nombre de salida: uploads/ID.mp3
        'outtmpl': f'{output_dir}/{random_id}.%(ext)s',
        'postprocessors': [{
            'key': 'FFmpegExtractAudio',
            'preferredcodec': 'mp3',
            'preferredquality': '192',
        }],
        'quiet': True,      # Menos basura en el log
        'no_warnings': True,
        'noprogress': True,
        # Inyectamos la ruta de las cookies (si existen)
        'cookiefile': cookie_file
    }

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            # 1. Obtener Info
            info = ydl.extract_info(youtube_url, download=False)
            video_title = info.get('title', 'YouTube Audio')
            
            # Log informativo para saber qué está pasando
            if use_cookies:
                print(f"[INFO] 🍪 Usando cookies desde: {cookie_file}")
            else:
                print(f"[INFO] ⚠️ NO se detectaron cookies. Riesgo de bloqueo por YouTube.")
                
            print(f"[INFO] Descargando: {video_title}...")
            
            # 2. Descargar
            ydl.download([youtube_url])
            
            # 3. Respuesta JSON para Node.js
            result = {
                "success": True,
                "filename": f"{random_id}.mp3",
                "title": video_title,
                "path": os.path.join(output_dir, f"{random_id}.mp3")
            }
            print(json.dumps(result))
            sys.stdout.flush()
            sys.exit(0)

    except Exception as e:
        # Manejo de errores
        error_res = {"success": False, "error": str(e)}
        print(json.dumps(error_res))

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(json.dumps({"success": False, "error": "Faltan argumentos"}))
        sys.exit(1)
        
    url = sys.argv[1]
    rid = sys.argv[2]
    download_audio(url, rid)