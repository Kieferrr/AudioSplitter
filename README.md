```md
# Audio Splitter (Demo)

Este proyecto permite **separar** la voz y los instrumentos de una canción o video de YouTube.  
Está basado en:  
- **Node.js + Express** para el servidor web.  
- **[yt-dlp-exec](https://www.npmjs.com/package/yt-dlp-exec)** para descargar el audio de YouTube.  
- **[Spleeter](https://github.com/deezer/spleeter)** (Python) para separar voz e instrumentos.

> **Aviso legal**: Descargar contenido de YouTube puede infringir los Términos de Servicio de la plataforma o derechos de autor.  
> Utiliza este proyecto solo con contenido de tu propiedad o que cuente con licencias libres.

---

## Requisitos

1. **Node.js** (versión LTS recomendada: 16.x, 18.x, o 20.x).  
2. **Python 3.x** (Probado en python 3.9.13).  
3. **ffmpeg** instalado y disponible en tu PATH.  
4. **Spleeter** y sus dependencias (TensorFlow, NumPy < 2) en un entorno virtual de Python.

---

## Instrucciones de instalación

### 1. Clonar el repositorio

```bash
git clone https://github.com/TU-USUARIO/TU-REPOSITORIO.git
cd TU-REPOSITORIO

### 2. Instalar dependencias de Node
npm install

Esto descargará las dependencias listadas en package.json.

### 3. Crear y activar un entorno virtual (Python)

Para aislar Spleeter y las librerías de Python, se recomienda usar venv:

python -m venv venv

En Windows PowerShell, si recibes error de “ejecución de scripts deshabilitada”, ajústalo con:

Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
Luego:

# Windows (PowerShell)
.\venv\Scripts\activate

# macOS / Linux
source venv/bin/activate

### 4. Instalar Spleeter y NumPy < 2 en el venv

pip install --upgrade pip
pip install "numpy<2"       # Para evitar conflictos con TensorFlow
pip install spleeter
Para verificar que Spleeter funcione:

spleeter separate -h

No debería dar error.

### 5. Revisar ffmpeg

Asegúrate de tener ffmpeg instalado y en el PATH:

Windows: Descarga FFmpeg y agrégalo a Variables de Entorno.
macOS/Linux: brew install ffmpeg o sudo apt-get install ffmpeg, etc.

### 6. Ejecutar la aplicación

Con el venv activado, inicia el servidor:

npm start

Verás algo como:

Servidor escuchando en http://localhost:3000

### 7. Abrir en el navegador

Visita http://localhost:3000. Verás un formulario:

Pega la URL de YouTube.
Haz clic en “Procesar”.
El servidor descargará el audio, ejecutará Spleeter y mostrará dos reproductores de audio:
Voz (vocals)
Instrumentos (accompaniment)

### Uso de la página

Pega la URL de YouTube que quieras procesar.

Presiona “Procesar”.

Espera unos segundos (depende de la duración).

Aparecerán dos reproductores <audio> para:
Voz
Instrumentos

El campo de URL se limpia de inmediato tras enviar.

### Limpieza de archivos

Cada vez que inicias el servidor (npm start), se ejecuta un script que borra las carpetas stems_<ID> y public/outputs/<ID> que hayan quedado de sesiones anteriores.
Además, cada vez que ingresas un nuevo link, se borra la separación anterior para no llenar tu disco.

### Problemas comunes

Numpy/TensorFlow: Asegúrate de que numpy<2 para evitar el error "A module that was compiled using NumPy 1.x...".

ffmpeg no encontrado: Verifica que esté en tu PATH (where ffmpeg en Windows, which ffmpeg en Linux/macOS).

Permisos de scripts en Windows: Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass antes de activar el venv.
