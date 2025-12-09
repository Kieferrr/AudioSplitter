import sys
import os
import yt_dlp
import json

# Forzar codificación UTF-8 para evitar errores de emojis/tildes en Windows
sys.stdout.reconfigure(encoding='utf-8')

def download_audio(youtube_url, random_id):
    output_dir = "uploads"
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)

    # Configuración de yt-dlp
    ydl_opts = {
        'format': 'bestaudio/best',
        # Guardamos el archivo con el ID para encontrarlo fácil: uploads/123456.mp3
        'outtmpl': f'{output_dir}/{random_id}.%(ext)s',
        'postprocessors': [{
            'key': 'FFmpegExtractAudio',
            'preferredcodec': 'mp3',
            'preferredquality': '192',
        }],
        'quiet': True, # Menos ruido en consola
        'no_warnings': True,
    }

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            # 1. Obtener información del video (Título)
            info = ydl.extract_info(youtube_url, download=False)
            video_title = info.get('title', 'YouTube Audio')
            
            # 2. Descargar
            print(f"[INFO] Descargando: {video_title}...")
            ydl.download([youtube_url])
            
            # 3. Devolver JSON a Node.js con los datos
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