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
    # Buscamos 'cookies.txt' en la carpeta actual (/app en Docker)
    # Cloud Run montará el secreto justo aquí con este nombre.
    cookie_file = 'cookies.txt'
    use_cookies = os.path.exists(cookie_file)

    ydl_opts = {
        'format': 'bestaudio/best',
        'outtmpl': f'{output_dir}/{random_id}.%(ext)s',
        'postprocessors': [{
            'key': 'FFmpegExtractAudio',
            'preferredcodec': 'mp3',
            'preferredquality': '192',
        }],
        'quiet': True,
        'no_warnings': True,
        # Aquí es donde le pasamos las cookies a la librería
        'cookiefile': cookie_file if use_cookies else None
    }

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            # Info
            info = ydl.extract_info(youtube_url, download=False)
            video_title = info.get('title', 'YouTube Audio')
            
            # Log para saber si detectó las cookies
            if use_cookies:
                print(f"[INFO] 🍪 Cookies detectadas. Usando para: {video_title}...")
            else:
                print(f"[INFO] ⚠️ NO se detectaron cookies. Riesgo de bloqueo.")
                
            ydl.download([youtube_url])
            
            result = {
                "success": True,
                "filename": f"{random_id}.mp3",
                "title": video_title,
                "path": os.path.join(output_dir, f"{random_id}.mp3")
            }
            print(json.dumps(result))

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