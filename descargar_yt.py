import sys
import os
import yt_dlp
import json

sys.stdout.reconfigure(encoding='utf-8')

def download_audio(youtube_url, random_id):
    output_dir = "uploads"
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)

    # --- Cookies ---
    secret_cookie_path = '/secrets/cookies.txt'
    local_cookie_path = 'cookies.txt'
    cookie_file = secret_cookie_path if os.path.exists(secret_cookie_path) else (local_cookie_path if os.path.exists(local_cookie_path) else None)
    use_cookies = cookie_file is not None

    ydl_opts = {
        # 1. VOLVEMOS AL FORMATO ESTÁNDAR
        # Buscamos el mejor audio. Si no hay, el mejor video y extraemos audio.
        'format': 'bestaudio/best', 
        
        # 2. MANTENEMOS IPV4 (Vital para Google Cloud)
        'force_ipv4': True,
        
        'outtmpl': f'{output_dir}/{random_id}.%(ext)s',
        
        'postprocessors': [{
            'key': 'FFmpegExtractAudio',
            'preferredcodec': 'mp3',
            'preferredquality': '192',
        }],
        
        'quiet': True,
        'no_warnings': True,
        'noprogress': True,
        'cookiefile': cookie_file,
        
        # 3. ELIMINAMOS EL DISFRAZ (extractor_args y user_agent)
        # Como ya tenemos cookies de EEUU, entramos como "PC Normal"
        # Esto soluciona el error "Format not available"
    }

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            # Info
            if use_cookies:
                print(f"[INFO] 🍪 Cookies cargadas.")
            else:
                print(f"[INFO] ⚠️ Sin cookies.")
            
            info = ydl.extract_info(youtube_url, download=False)
            video_title = info.get('title', 'YouTube Audio')
            print(f"[INFO] Descargando: {video_title}...")
            
            # Descarga
            ydl.download([youtube_url])
            
            # Resultado
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
    download_audio(sys.argv[1], sys.argv[2])