# Audio Splitter (Demo)

Este proyecto permite **separar** la voz y los instrumentos de una canción o video de YouTube.  
Está basado en:  
- **Node.js + Express** para el servidor web.  
- **[yt-dlp-exec](https://www.npmjs.com/package/yt-dlp-exec)** para descargar el audio de YouTube.  
- **[Spleeter](https://github.com/deezer/spleeter)** (Python) para separar voz e instrumentos.
- **[Howler.js](https://howlerjs.com/):** Gestión de la reproducción de audio.
- **[Wavesurfer.js](https://wavesurfer-js.org/):** Visualización del waveform de audio.

> **Aviso legal**: Descargar contenido de YouTube puede infringir los Términos de Servicio de la plataforma o derechos de autor.  
> Utiliza este proyecto solo con contenido de tu propiedad o que cuente con licencias libres.

## ✨ Características Nuevas

- **Sincronización Mejorada de Stems:** Al mutear o desmutear un stem durante la reproducción, la sincronización se mantiene perfectamente, evitando retrocesos o saltos en la reproducción.
- **Control Centralizado del Tiempo de Reproducción:** Implementación de un temporizador centralizado que asegura que todos los stems se mantengan sincronizados con la posición actual de reproducción.
- **Interfaz de Usuario Mejorada:** Optimización de la experiencia de usuario al interactuar con los controles de reproducción y los botones de mute/unmute para cada stem.


# Uso

- Se puede procesar cualquier canción que no tengo una duración de más de **7 minutos**
---

## 📋 Requisitos

### Opción 1: Usando Docker

1. **Docker** instalado en tu sistema.
   - [Instalar Docker](https://docs.docker.com/get-docker/)

2. **Docker Compose** (incluido con Docker Desktop en Windows y macOS, puede requerir instalación en Linux).
   - [Instalar Docker Compose](https://docs.docker.com/compose/install/)

### Opción 2: Instalación Manual

1. **Node.js** (versión LTS recomendada: 16.x, 18.x, o 20.x).  
2. **Python 3.x** (Probado en Python 3.9.13. No utilizar en Python 3.13).  
3. **ffmpeg** instalado y disponible en tu PATH.  
4. **Spleeter** y sus dependencias (TensorFlow, NumPy < 2) en un entorno virtual de Python.

---

## 🚀 Instalación

### Opción 1: Usando Docker Compose

- Docker Compose simplifica la gestión de dependencias y entornos. Sigue estos pasos para dockerizar y ejecutar la aplicación utilizando Docker Compose.

#### **1. Clonar el Repositorio**


git clone https://github.com/TU-USUARIO/TU-REPOSITORIO.git
cd TU-REPOSITORIO

#### 2. Crear el Archivo docker-compose.yml

- Asegúrate de tener un archivo docker-compose.yml en la raíz de tu proyecto con el siguiente contenido:


services:
  audiosplitter:
    build: .
    container_name: myaudiosplitter-container
    ports:
      - "3000:3000"
    volumes:
      - .:/app
      - /app/node_modules
    restart: unless-stopped

#### 3. Construir la Imagen Docker (si aún no lo has hecho)

- Si ya has construido la imagen myaudiosplitter, puedes omitir este paso. De lo contrario, ejecuta:

docker-compose build

> Si despliegas en Cloud Run o usas GCP, define la variable de entorno `BUCKET_NAME` con el nombre del bucket donde quieras guardar copias de los stems. Si no la defines, la app seguirá funcionando guardando los resultados localmente dentro del contenedor.

### 4. Iniciar los Servicios con Docker Compose

- En la raíz de tu proyecto, ejecuta:

docker-compose up -d

- up: Crea e inicia los contenedores.
- -d: Ejecuta los contenedores en segundo plano (detached mode).

### 5. Verificar que el Contenedor Está Corriendo

docker-compose ps

- Deberías ver una entrada para myaudiosplitter-container en la lista de contenedores en ejecución.

#### 6. Acceder a la Aplicación

- Abre tu navegador y navega a http://localhost:3000. Deberías ver la interfaz de usuario con un formulario para procesar URLs de YouTube.

#### 7. Detener y Reiniciar el Contenedor Docker Compose

- Detener los Servicios:

- docker-compose stop

- Iniciar los Servicios Detenidos:

- docker-compose start

- Reiniciar los Servicios:

- docker-compose restart

#### 8. Eliminar los Servicios Docker Compose (Opcional)

- Si ya no necesitas los contenedores, redes o volúmenes creados, ejecuta:

- docker-compose down


#### Opción 2: Instalación Manual

- Sigue los pasos originales si prefieres no usar Docker.

- Clonar el repositorio

- git clone https://github.com/TU-USUARIO/TU-REPOSITORIO.git
cd TU-REPOSITORIO

- Instalar dependencias de Node

npm install

- Crear y activar un entorno virtual (Python)

python -m venv venv

# Windows (PowerShell)
.\venv\Scripts\activate

# macOS / Linux
source venv/bin/activate
Instalar Spleeter y NumPy < 2 en el entorno virtual

pip install --upgrade pip
pip install "numpy<2"
pip install spleeter

- Revisar ffmpeg

- Asegúrate de tener ffmpeg instalado y en el PATH.

- Ejecutar la aplicación

- Con el entorno virtual activado, inicia el servidor:

npm start

- Verás algo como:

Servidor escuchando en http://localhost:3000

- Abrir en el navegador

- Visita http://localhost:3000 para utilizar la aplicación.

🧹 Limpieza de Archivos

- Con Docker:

- Al detener y eliminar el contenedor Docker, las carpetas mapeadas (public/outputs y uploads) permanecen en tu sistema host. Puedes limpiarlas manualmente si lo deseas:

rm -rf public/outputs/*
rm -rf uploads/*

- Instalación Manual:

- Cada vez que inicias el servidor (npm start), se ejecuta un script que borra las carpetas stems_<ID> y public/outputs/<ID> de sesiones anteriores.
Además, al procesar un nuevo enlace o archivo, se borra la separación anterior para evitar ocupar espacio innecesariamente.

🛠️ Problemas Comunes

# Opción 1: Usando Docker Compose

- Contenedor no arranca:

- Verifica los logs del contenedor para identificar errores:

docker-compose logs -f

- Permisos de Volúmenes:

- Asegúrate de que las carpetas public/outputs y uploads tienen los permisos adecuados para que el contenedor pueda escribir en ellas.

# Opción 2: Instalación Manual

- Numpy/TensorFlow:

- Asegúrate de que numpy<2 está instalado para evitar conflictos con TensorFlow.

- ffmpeg no encontrado:- 

- Verifica que ffmpeg está instalado y en el PATH:

which ffmpeg

- Permisos de scripts en Windows:

- Ejecuta PowerShell con permisos de administrador y ajusta la política de ejecución si es necesario:

Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
🔄 Actualizaciones y Mantenimiento

- Actualizar la Imagen Docker

- Si realizas cambios en el código o las dependencias, reconstruye la imagen Docker:

docker build --no-cache -t myaudiosplitter .

- Luego, detén y elimina el contenedor existente, y ejecuta uno nuevo:

docker-compose down
docker-compose up -d

- Reutilizar el Contenedor Docker Compose

- Para reiniciar tu contenedor sin eliminarlo cada vez, sigue estos pasos:

- Detener los Servicios:

docker-compose stop

- Iniciar los Servicios Detenidos:

docker-compose start

- Notas para Usuarios de Windows (PowerShell):

docker-compose stop
docker-compose start

- Actualizar Dependencias de Python

- Dentro del contenedor Docker, puedes actualizar las dependencias de Python si es necesario:

docker exec -it myaudiosplitter-container /bin/bash
pip install --upgrade pip setuptools wheel
exit
