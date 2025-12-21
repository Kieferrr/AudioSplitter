# Registro de Decisiones de Arquitectura

## 001. Eliminación de descarga de YouTube (2024-05-20)

**Estado:** Aceptado

**Contexto:**
La aplicación utilizaba `yt-dlp` para descargar audio. Sin embargo, al desplegar en Google Cloud Run, YouTube bloquea las peticiones provenientes de IPs de centros de datos. Las soluciones intentadas (Cookies, Proxies gratuitos, OAuth) resultaron inestables o temporales.

**Decisión:**
Se decide eliminar la integración directa con YouTube y enfocar la aplicación únicamente en la subida de archivos (Upload).

**Consecuencias:**
* (+) Mayor estabilidad del sistema (cero errores de bloqueo).
* (+) Reducción del tamaño del contenedor Docker.
* (+) Menor riesgo legal/copyright.
* (-) El usuario debe descargar el archivo por su cuenta antes de subirlo.