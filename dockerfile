FROM python:3.10-slim
ENV DEBIAN_FRONTEND=noninteractive

# Instalar dependencias de sistema
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        curl ffmpeg build-essential git && \
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash - && \
    apt-get install -y --no-install-recommends nodejs && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Dependencias Python
COPY requirements.txt ./
RUN pip install --no-cache-dir --upgrade pip setuptools wheel && \
    pip install --no-cache-dir -r requirements.txt && \
    pip install --no-cache-dir yt-dlp spleeter

# Dependencias Node
COPY package.json package-lock.json* ./
RUN npm install --production

# Copiar app
COPY . .

# Carpetas
RUN mkdir -p public/outputs uploads

# IMPORTANTE: 
# 1. NO instalamos google-cloud-storage aquí (debe estar en requirements.txt)
# 2. NO descargamos el JSON.
# 3. NO seteamos GOOGLE_APPLICATION_CREDENTIALS.

EXPOSE 8080
CMD ["npm", "start"]