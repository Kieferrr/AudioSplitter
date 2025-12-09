import { TrackComponent } from './components/TrackComponent.js';

const uploadSection = document.getElementById('uploadSection');
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const loader = document.getElementById('loader');
const dawInterface = document.getElementById('dawInterface');
const tracksContainer = document.getElementById('tracksContainer');
const btnPlayPause = document.getElementById('btnPlayPause');
const btnStop = document.getElementById('btnStop');
const currentTimeSpan = document.getElementById('currentTime');
const totalTimeSpan = document.getElementById('totalTime');
const songTitleSpan = document.getElementById('songTitle');
const ytInput = document.getElementById('ytUrl');
const btnYt = document.getElementById('btnYt');
const loaderText = document.getElementById('loaderText'); // Para cambiar mensaje

let tracks = [];
let isPlaying = false;
let globalDuration = 0;
let progressInterval = null;

// --- 1. EVENTOS DRAG & DROP ---
['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    document.body.addEventListener(eventName, preventDefaults, false);
    dropZone.addEventListener(eventName, preventDefaults, false);
});
function preventDefaults(e) { e.preventDefault(); e.stopPropagation(); }

['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, () => {
        dropZone.style.borderColor = 'var(--accent)';
        dropZone.style.backgroundColor = 'rgba(92, 92, 236, 0.1)';
    }, false);
});

['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, () => {
        dropZone.style.borderColor = 'var(--border)';
        dropZone.style.backgroundColor = 'transparent';
    }, false);
});

dropZone.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    if (dt.files.length) handleUpload(dt.files[0]);
});
dropZone.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', (e) => {
    if (e.target.files.length) handleUpload(e.target.files[0]);
});

// Evento Click Botón YouTube
btnYt.addEventListener('click', () => {
    const url = ytInput.value.trim();
    if (url) handleYoutube(url);
});

// Evento Enter en el Input
ytInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        const url = ytInput.value.trim();
        if (url) handleYoutube(url);
    }
});

// --- 2. SUBIDA ---
async function handleUpload(file) {
    dropZone.classList.add('hidden');
    loader.classList.remove('hidden');

    const formData = new FormData();
    formData.append('audioFile', file);

    try {
        const response = await fetch('/api/upload', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) throw new Error('Error en servidor');
        const data = await response.json();
        initDAW(data.files, data.originalName);

    } catch (error) {
        console.error(error);
        alert('Error al procesar el archivo.');
        location.reload();
    }
}

async function handleYoutube(url) {
    // Interfaz de carga
    dropZone.parentElement.classList.add('loading-mode'); // Ocultar inputs
    document.querySelector('.youtube-box').style.display = 'none';
    document.querySelector('.divider').style.display = 'none';
    dropZone.style.display = 'none';

    loader.classList.remove('hidden');
    loaderText.textContent = "Descargando de YouTube y Separando...";

    try {
        const response = await fetch('/api/youtube', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ youtubeUrl: url })
        });

        if (!response.ok) throw new Error('Error en servidor');

        const data = await response.json();
        initDAW(data.files, data.originalName);

    } catch (error) {
        console.error(error);
        alert('Error al procesar el video. Verifica el link.');
        location.reload();
    }
}

// --- 3. INICIO DAW ---
function initDAW(filesUrls, originalName) {
    uploadSection.classList.add('hidden');
    dawInterface.classList.remove('hidden');

    songTitleSpan.textContent = originalName ? originalName.replace(/\.[^/.]+$/, "") : "Proyecto Sin Título";

    const stemConfig = {
        'vocals': { color: '#FF4081' },
        'drums': { color: '#00E676' },
        'bass': { color: '#FFD740' },
        'other': { color: '#7C4DFF' }
    };

    filesUrls.forEach(url => {
        const name = url.split('/').pop().split('.')[0].toLowerCase();
        const color = stemConfig[name]?.color || '#ffffff';
        const track = new TrackComponent(tracksContainer, name, url, color);
        tracks.push(track);
    });

    if (tracks.length > 0) {
        const checkReadyInterval = setInterval(() => {
            if (tracks[0].isReady()) {
                globalDuration = tracks[0].wavesurfer.getDuration();
                totalTimeSpan.textContent = formatTime(globalDuration);
                clearInterval(checkReadyInterval);
            }
        }, 500);
    }

    // LISTENERS GLOBALES DEL DAW

    // 1. Manejo de Solo (Exclusivo)
    tracksContainer.addEventListener('track-solo', (e) => {
        handleSoloExclusive(e.detail.name);
    });

    // 2. Manejo de Seek (Sincronización al clickear)
    tracksContainer.addEventListener('track-seek', (e) => {
        syncAllTracks(e.detail.progress, e.detail.sourceTrack);
    });
}

// --- LÓGICA SOLO EXCLUSIVO ---
function handleSoloExclusive(activeTrackName) {
    // 1. Revisamos quién pidió el solo
    const trackRequesting = tracks.find(t => t.name === activeTrackName);

    // Si el usuario acaba de activar el solo en este track:
    if (trackRequesting.isSolo) {
        // Desactivamos el solo en TODOS los demás
        tracks.forEach(t => {
            if (t.name !== activeTrackName) {
                t.disableSolo(); // Apaga el botón S visualmente y la flag interna
            }
        });
    }

    // 2. Aplicamos el silencio global basado en el nuevo estado
    updateMuteState();
}

function updateMuteState() {
    const anySoloActive = tracks.some(t => t.isSolo);
    tracks.forEach(track => {
        if (anySoloActive) {
            // Si hay un solo activo, silenciamos a los que NO son el solista
            track.setSilent(!track.isSolo);
        } else {
            // Si no hay solo, todos suenan (según su mute manual)
            track.setSilent(false);
        }
    });
}

// --- LÓGICA SEEK (ADELANTAR) ---
function syncAllTracks(progress, sourceName) {
    // Evitamos bucles: movemos todos MENOS el que generó el evento (porque ese ya se movió al clickear)
    tracks.forEach(track => {
        if (track.name !== sourceName) {
            track.seekTo(progress);
        }
    });

    // Actualizamos el tiempo visual
    const currentTime = globalDuration * progress;
    currentTimeSpan.textContent = formatTime(currentTime);
}

// --- 4. CONTROLES GLOBALES ---
btnPlayPause.addEventListener('click', () => {
    if (isPlaying) {
        tracks.forEach(t => t.pause());
        isPlaying = false;
        btnPlayPause.innerHTML = '<span class="material-icons">play_arrow</span>';
        stopTimer();
    } else {
        tracks.forEach(t => t.play());
        isPlaying = true;
        btnPlayPause.innerHTML = '<span class="material-icons">pause</span>';
        startTimer();
    }
});

btnStop.addEventListener('click', () => {
    tracks.forEach(t => t.stop());
    isPlaying = false;
    btnPlayPause.innerHTML = '<span class="material-icons">play_arrow</span>';
    stopTimer();
    currentTimeSpan.textContent = "00:00";
});

function startTimer() {
    if (progressInterval) clearInterval(progressInterval);
    progressInterval = setInterval(() => {
        if (tracks.length === 0) return;
        const currentTime = tracks[0].wavesurfer.getCurrentTime();
        currentTimeSpan.textContent = formatTime(currentTime);
        if (globalDuration > 0 && currentTime >= globalDuration) {
            btnStop.click();
        }
    }, 100);
}

function stopTimer() { clearInterval(progressInterval); }

function formatTime(seconds) {
    if (!seconds) return "00:00";
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}