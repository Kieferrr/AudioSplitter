# Usamos Node 20 (versión ligera) como base
FROM node:20-slim

# 1. INSTALACIÓN DE SISTEMA
# Instalamos Python 3, Pip, FFmpeg Y LIBSNDFILE (¡Vital!)
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    ffmpeg \
    libsndfile1 \
    && rm -rf /var/lib/apt/lists/*

# Fix para que 'python' llame a 'python3'
RUN ln -s /usr/bin/python3 /usr/bin/python

# Directorio de trabajo
WORKDIR /app

# 2. DEPENDENCIAS
COPY package*.json ./
RUN npm install --only=production

COPY requirements.txt ./
# Usamos --break-system-packages porque en las nuevas versiones de Debian/Python es necesario
RUN pip3 install --no-cache-dir -r requirements.txt --break-system-packages

# 3. CÓDIGO FUENTE
COPY . .

# 4. ARRANQUE
EXPOSE 8080
CMD [ "node", "server.js" ]