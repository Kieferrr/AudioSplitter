# Usamos una imagen base oficial de Node.js (versión ligera)
FROM node:20-slim

# Instalamos Python 3, pip y FFmpeg (necesario para audio)
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Creamos el directorio de trabajo dentro del contenedor
WORKDIR /app

# Copiamos los archivos de dependencias de Node
COPY package*.json ./

# Instalamos las dependencias de Node (solo producción)
RUN npm install --only=production

# Copiamos el archivo de requerimientos de Python (lo crearemos en un momento)
COPY requirements.txt ./

# Instalamos las librerías de Python (Spleeter, Google Cloud)
# Usamos --break-system-packages porque en contenedores es seguro hacerlo
RUN pip3 install --no-cache-dir -r requirements.txt --break-system-packages

# Copiamos el resto del código fuente del proyecto
COPY . .

# Exponemos el puerto 8080
EXPOSE 8080

# Comando para iniciar el servidor
CMD [ "node", "server.js" ]