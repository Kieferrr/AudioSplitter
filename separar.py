# separar.py
import sys
import os
import subprocess

"""
Uso: python separar.py <ruta_audio_entrada> <randomId> [stems]
Genera una carpeta "stems_<randomId>/" con los stems resultantes.
"""

def main():
    if len(sys.argv) < 3:
        print("Faltan argumentos. Uso: python separar.py <ruta_audio_entrada> <randomId> [stems]")
        sys.exit(1)

    audio_input = sys.argv[1]
    random_id = sys.argv[2]
    stems = sys.argv[3] if len(sys.argv) > 3 else "5"  # Predeterminado a 5 stems

    # Carpeta donde se almacenarán los stems
    output_dir = f"stems_{random_id}"

    # Crear la carpeta si no existe
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)

    # Construir el comando para Spleeter
    preset = f"spleeter:{stems}stems"
    cmd = [
        "spleeter",
        "separate",
        "-p", preset,
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
