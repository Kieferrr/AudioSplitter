import sys
import os
import yt_dlp
import json

# Forzar codificación UTF-8
sys.stdout.reconfigure(encoding='utf-8')

def download_audio(youtube_url, random_id):
    output_dir = "uploads"
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)

    # --- LÓGICA DE COOKIES ---
    secret_cookie_path = '/secrets/cookies.txt'
    local_cookie_path = 'cookies.txt'
    
    cookie_file = None
    if os.path.exists(secret_cookie_path):
        cookie_file = secret_cookie_path
    elif os.path.exists(local_cookie_path):
        cookie_file = local_cookie_path
        
    use_cookies = cookie_file is not None

    # Configuración de yt-dlp (HÍBRIDO: ANDROID + FORMATO LIBRE)
    ydl_opts = {
        # 1. PEDIMOS "BEST" (Cualquier cosa de buena calidad)
        # Esto soluciona el error "Requested format is not available"
        'format': 'best', 
        
        'outtmpl': f'{output_dir}/{random_id}.%(ext)s',
        
        # 2. NOS ASEGURAMOS QUE SALGA COMO MP3
        'postprocessors': [{
            'key': 'FFmpegExtractAudio',
            'preferredcodec': 'mp3',
            'preferredquality': '192',
        }],
        
        'quiet': True,
        'no_warnings': True,
        'noprogress': True,
        'cookiefile': cookie_file,
        
        # 3. USAMOS EL DISFRAZ DE ANDROID (El único que no te dio error 403)
        'extractor_args': {
            'youtube': {
                'player_client': ['android'], 
            }
        },
        # User Agent de Android para completar el engaño
        'user_agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Mobile Safari/537.36',
    }

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            # 1. Obtener Info
            info = ydl.extract_info(youtube_url, download=False)
            video_title = info.get('title', 'YouTube Audio')
            
            if use_cookies:
                print(f"[INFO] 🍪 Usando cookies desde: {cookie_file}")
            else:
                print(f"[INFO] ⚠️ Sin cookies.")
                
            print(f"[INFO] Descargando: {video_title}...")
            
            # 2. Descargar
            ydl.download([youtube_url])
            
            # 3. Respuesta JSON
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
        error_res = {"success": False, "error": str(e)}
        print(json.dumps(error_res))

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(json.dumps({"success": False, "error": "Faltan argumentos"}))
        sys.exit(1)
        
    url = sys.argv[1]
    rid = sys.argv[2]
    download_audio(url, rid)