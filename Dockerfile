# Usamos Node 20 (versión ligera) como base
FROM node:20-slim

# 1. INSTALACIÓN DE SISTEMA
# Instalamos Python 3, Pip y FFmpeg
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# --- EL ARREGLO MÁGICO ---
# Creamos un "apodo" para que el comando 'python' llame a 'python3'
# Esto evita el error ENOENT en Linux
RUN ln -s /usr/bin/python3 /usr/bin/python

# Configurar directorio de trabajo
WORKDIR /app

# 2. DEPENDENCIAS DE NODE (Backend)
COPY package*.json ./
RUN npm install --only=production

# 3. DEPENDENCIAS DE PYTHON (IA y YouTube)
COPY requirements.txt ./
# Instalamos librerías (Demucs, yt-dlp, google-cloud)
RUN pip3 install --no-cache-dir -r requirements.txt --break-system-packages

# 4. CÓDIGO FUENTE
COPY . .

# 5. ARRANQUE
EXPOSE 8080
CMD [ "node", "server.js" ]