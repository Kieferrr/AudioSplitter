# 🎵 AudioSplitter V2 (Edición Local)

Este proyecto permite separar las pistas de cualquier canción (Voz, Batería, Bajo, Otros) o video de YouTube utilizando Inteligencia Artificial (**Demucs**).

Esta versión incluye un **"Modo Híbrido"**, lo que significa que está configurada para funcionar **100% en tu computador**, guardando los archivos en tu disco duro sin necesidad de configurar servidores en la nube.

---

## 🛠️ 1. Requisitos Previos

Antes de instalar, asegúrate de tener estos programas en tu computadora:

1.  **Git:** [Descargar aquí](https://git-scm.com/downloads)
2.  **Node.js (Versión LTS):** [Descargar aquí](https://nodejs.org/) (Para el servidor web).
3.  **Python (3.10 o superior):** [Descargar aquí](https://www.python.org/downloads/) (Para la IA).
    * **IMPORTANTE:** Al instalar, marca la casilla que dice **"Add Python to PATH"**.
4.  **FFmpeg:** (Vital para procesar audio).
    * Si estás en Windows y no lo tienes, [sigue esta guía rápida](https://es.wikihow.com/instalar-FFmpeg-en-Windows).
    * Básicamente: Descargar, descomprimir y agregar la carpeta `bin` a las Variables de Entorno.

---

## 📥 2. Instalación

Abre una terminal (PowerShell o CMD) en la carpeta donde quieras guardar el proyecto y ejecuta estos comandos en orden:

### Paso A: Clonar el proyecto
Esto descargará la versión específica que funciona localmente.

```bash
git clone -b feature/hybrid-mode [https://github.com/Kieferrr/AudioSplitter.git](https://github.com/Kieferrr/AudioSplitter.git)
cd AudioSplitter
```

### Paso B: Instalar dependencias del Servidor

```bash
npm install
```

### Paso C: Instalar dependencias de la IA

```bash
pip install -r requirements.txt
```

## ⚙️ 3. Configuración (.env)

Para que el programa sepa que debe ejecutarse en "Modo Local", debes configurar un archivo de entorno.

1. En la carpeta raíz del proyecto, crea un archivo nuevo llamado .env

2. Ábrelo con el Bloc de Notas.

3. Pega exactamente lo siguiente:

```
PORT=8080
# NOTA: No agregues la variable BUCKET_NAME.
# Al no estar definida, el sistema activa automáticamente el Modo Local.
```

## 🚀 4. Cómo usar la App

1. En la terminal, dentro de la carpeta del proyecto, ejecuta:

```bash
npm run dev
```

2. Verás un mensaje confirmando el modo local.

3. Abre tu navegador (se recomienda Chrome) e ingresa a: http://localhost:8080

¡Listo! Sube una canción o pega un link de YouTube. Los archivos separados se guardarán en la carpeta public/outputs de tu proyecto.

Nota: La primera vez que lo uses, puede tardar un poco más mientras descarga los modelos de IA básicos.

## 🏎️ 5. (Opcional) Activar Modo Turbo con GPU

Por defecto, la IA usa tu CPU (Procesador), lo cual tarda entre 3 a 5 minutos por canción. Si tienes una tarjeta gráfica NVIDIA, puedes reducir ese tiempo a 20-30 segundos.

### Pasos para activar la GPU:

1. Abre la terminal en la carpeta del proyecto.

2. Desinstala la versión básica de PyTorch:

```bash
pip uninstall torch torchvision torchaudio
```
(Escribe 'Y' y dale Enter si pide confirmación).

3. Instala la versión con soporte CUDA (Aceleración Gráfica):

```bash
pip install torch torchvision torchaudio --index-url [https://download.pytorch.org/whl/cu121](https://download.pytorch.org/whl/cu121)
```

4. Vuelve a iniciar el servidor (npm run dev) y disfruta la velocidad.