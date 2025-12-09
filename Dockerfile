# Usamos Node 20 (versión ligera) como base
FROM node:20-slim

# 1. INSTALACIÓN DE SISTEMA
# Instalamos Python, Pip y FFmpeg (Vital para Demucs y yt-dlp)
# -y confirma automáticamente
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Configurar directorio de trabajo
WORKDIR /app

# 2. DEPENDENCIAS DE NODE (Backend)
# Copiamos primero package.json para aprovechar el caché de Docker
COPY package*.json ./
RUN npm install --only=production

# 3. DEPENDENCIAS DE PYTHON (IA y YouTube)
COPY requirements.txt ./
# --break-system-packages es necesario en las nuevas versiones de Debian/Docker
RUN pip3 install --no-cache-dir -r requirements.txt --break-system-packages

# 4. CÓDIGO FUENTE
# Copiamos el resto de los archivos
COPY . .

# 5. ARRANQUE
# Exponemos el puerto que espera Cloud Run
EXPOSE 8080
# Comando de inicio
CMD [ "node", "server.js" ]