# 🎵 AudioSplitter AI V3

> **Separa voces e instrumentos con Inteligencia Artificial directamente desde el navegador.**

[![Status](https://img.shields.io/badge/Status-Online-success)]()
[![Tech](https://img.shields.io/badge/Stack-Node.js%20%7C%20Python%20%7C%20Demucs-blue)]()

## 🔗 Demo en Vivo
¡No necesitas instalar nada! Puedes usar la aplicación desplegada en Google Cloud aquí:

👉 **[ACCEDER A AUDIOSPLITTER AI](https://audiosplitter-v2-215477168026.us-central1.run.app/)** 👈

---

## 📖 Sobre el Proyecto

AudioSplitter es una herramienta web que utiliza modelos de Deep Learning (Spleeter/Demucs) para descomponer cualquier archivo de audio en 4 pistas independientes (Voces, Batería, Bajo, Otros).

### Características
* ☁️ **Cloud Native:** Arquitectura desplegada en Google Cloud Run.
* 🔒 **Seguridad:** Autenticación gestionada con Firebase Auth.
* 💾 **Almacenamiento:** Gestión de archivos con Google Cloud Storage.
* 🧠 **IA:** Procesamiento de audio con Python y PyTorch.
* 📂 **Drag & Drop:** Interfaz moderna y simple.

---

## 📝 Registro de Decisiones (Changelog)

### [3.0.0] - Refactorización Mayor
**Cambio Importante:** Se eliminó la funcionalidad de importar directamente desde YouTube.
* **Motivo:** Google Cloud bloquea activamente las peticiones a YouTube provenientes de IPs de centros de datos ("Data Centers"), lo que hacía la función inestable e insostenible a largo plazo.
* **Solución:** Se reorientó la aplicación a una arquitectura "File-First" (subida de archivos), mejorando la estabilidad, la velocidad y reduciendo riesgos legales.

---

## 🛠️ Guía de Desarrollo Local

Si eres desarrollador y quieres correr este proyecto en tu propia máquina, sigue estos pasos.

### Requisitos
* **Node.js** (v18 o superior)
* **Python** (3.10 o superior)
* **FFmpeg** instalado y agregado al PATH del sistema.

### 1. Instalación

```bash
# Clonar el repositorio
git clone [https://github.com/Kieferrr/AudioSplitter.git](https://github.com/Kieferrr/AudioSplitter.git)
cd AudioSplitter

# Instalar Backend (Node)
npm install

# Instalar IA (Python)
pip install -r requirements.txt
```

### 2. Configuración de Entorno (.env)

Crea un archivo `.env` en la raíz del proyecto:

```env
PORT=8080
# BUCKET_NAME=  <-- Deja esto vacío o comentado para trabajar en modo local (disco duro)
```

> **Nota:** Para que funcione la autenticación, necesitas el archivo `public/js/config/firebase-config.js`. Si no lo tienes, crea un proyecto en Firebase y añade tus credenciales web.

### 3. Ejecutar

```bash
npm run dev
```

La aplicación correrá en [http://localhost:8080](http://localhost:8080)

## 🏗️ Arquitectura del Proyecto

* **Frontend:** Vanilla JS + CSS Glassmorphism.
* **Backend:** Express.js (Node).
* **Procesamiento:** Python Child Process (spawn) ejecutando scripts de PyTorch.
* **Infraestructura:** Docker + Google Cloud Run.