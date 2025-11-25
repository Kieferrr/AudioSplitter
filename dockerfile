# Usar una imagen base oficial de Python 3.10 (slim para reducir el tamaño)
FROM python:3.10-slim

# Establecer variables de entorno para evitar prompts interactivos durante la instalación de paquetes
ENV DEBIAN_FRONTEND=noninteractive

# Actualizar el sistema e instalar Node.js y otras dependencias necesarias
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        curl \
        ffmpeg \
        build-essential \
        libclang-dev \
        libffi-dev \
        libssl-dev \
        libbz2-dev \
        zlib1g-dev \
        libncurses5-dev \
        libncursesw5-dev \
        libreadline-dev \
        libsqlite3-dev \
        libgdbm-dev \
        libdb5.3-dev \
        liblzma-dev \
        uuid-dev \
    && \
    # Instalar Node.js 18.x
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash - && \
    apt-get install -y --no-install-recommends nodejs \
    && \
    # Actualizar pip, setuptools y wheel con la opción --break-system-packages
    python3 -m pip install --upgrade pip setuptools wheel --verbose --break-system-packages \
    && \
    # Instalar yt-dlp para la descarga de YouTube
    python3 -m pip install yt-dlp \
    && \
    # Instalar spleeter para separar audios
    python3 -m pip install spleeter \
    && \
    # Limpiar el caché de apt para reducir el tamaño de la imagen
    apt-get clean && rm -rf /var/lib/apt/lists/*

# Establecer el directorio de trabajo dentro del contenedor
WORKDIR /app

# Copiar los archivos de dependencias de Node.js
COPY package.json package-lock.json* ./ 

# Instalar dependencias de Node.js
RUN npm install || { echo "Fallo al instalar dependencias de Node.js"; exit 1; }

# Copiar el archivo de dependencias de Python
COPY requirements.txt ./ 

# Instalar dependencias de Python
RUN pip install --no-cache-dir -r requirements.txt || { echo "Fallo al instalar dependencias de Python"; exit 1; }

# Copiar el resto del código de la aplicación
COPY . . 

# Crear las carpetas necesarias
RUN mkdir -p public/outputs uploads

# Exponer el puerto que usa el servidor (ajústalo si es necesario)
EXPOSE 8080

# Comando para iniciar la aplicación
CMD ["npm", "start"]
