# separar.py
import sys
import os
import subprocess

"""
Uso: python separar.py <ruta_audio_entrada> <randomId>
Genera una carpeta "stems_<randomId>/" con los stems resultantes.
"""

def main():
    if len(sys.argv) < 3:
        print("Faltan argumentos. Uso: python separar.py <ruta_audio_entrada> <randomId>")
        sys.exit(1)

    audio_input = sys.argv[1]
    random_id = sys.argv[2]

    # Carpeta donde se almacenarán los stems
    output_dir = f"stems_{random_id}"

    # Crear la carpeta si no existe
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)

    # Ejecutar Spleeter con 2 stems (voz / acompañamiento)
    cmd = [
        "spleeter",
        "separate",
        "-p", "spleeter:2stems",
        "-o", output_dir,
        audio_input
    ]

    try:
        subprocess.run(cmd, check=True)
        print("Separación completada correctamente.")
    except subprocess.CalledProcessError as e:
        print("Error al ejecutar Spleeter:", e)
        sys.exit(1)

if __name__ == '__main__':
    main()
