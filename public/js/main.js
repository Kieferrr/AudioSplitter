import { TrackComponent } from './components/TrackComponent.js';

document.addEventListener('DOMContentLoaded', () => {

    // 1. DOM ELEMENTS
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('fileInput');
    const youtubeInput = document.getElementById('youtubeInput');
    const youtubeBtn = document.getElementById('youtubeBtn');

    const formatSelect = document.getElementById('formatSelect');
    const formatContainer = document.querySelector('.format-selector-container');

    const loader = document.getElementById('loader');
    const loaderText = document.getElementById('loader-text');

    // Elementos nuevos para el Timer
    const progressBarContainer = document.querySelector('.progress-bar-container');
    const progressBar = document.getElementById('progress-bar');

    // Creamos dinámicamente el texto del timer si no existe en HTML
    let timerText = document.getElementById('timer-text');
    if (!timerText) {
        timerText = document.createElement('p');
        timerText.id = 'timer-text';
        timerText.className = 'timer-text';
        progressBarContainer.after(timerText);
    }

    const resultsArea = document.getElementById('results-area');
    const youtubeBox = document.querySelector('.youtube-box');
    const divider = document.querySelector('.divider');
    const appHeader = document.querySelector('.app-header');

    // Estado
    let tracks = [];
    let isPlaying = false;
    let globalDuration = 0;
    let progressInterval = null;
    let btnPlayPause, btnStop, currentTimeSpan, totalTimeSpan;
    let sortableInstance = null;
    let globalMasterVolume = 1.0;

    // Estado Timer Visual
    let visualTimerInterval = null;

    // 2. LISTENERS
    dropZone.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length) handleUpload(e.target.files[0]);
    });

    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, (e) => {
            e.preventDefault(); e.stopPropagation();
            dropZone.style.borderColor = 'var(--accent-color)';
            dropZone.style.backgroundColor = 'rgba(187, 134, 252, 0.1)';
        }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, (e) => {
            e.preventDefault(); e.stopPropagation();
            dropZone.style.borderColor = 'rgba(255, 255, 255, 0.15)';
            dropZone.style.backgroundColor = 'rgba(0,0,0,0.02)';
        }, false);
    });

    dropZone.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        if (dt.files.length) handleUpload(dt.files[0]);
    });

    youtubeBtn.addEventListener('click', () => {
        const url = youtubeInput.value.trim();
        if (url) handleYoutube(url);
    });

    youtubeInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') youtubeBtn.click(); });


    // --- LÓGICA DE TIEMPO ESTIMADO (REGRESIÓN LINEAL) ---
    function estimateProcessingTime(durationSeconds, format) {
        // Factor de velocidad IA (0.9x tiempo real)
        const PROCESSING_SPEED = 0.9;

        // Overhead (Descarga + Subida + Cold Start)
        // WAV tarda más por la subida de archivos grandes (aprox 30s más que MP3)
        const overhead = (format === 'wav') ? 60 : 30;

        return (durationSeconds * PROCESSING_SPEED) + overhead;
    }

    function startProgressTimer(estimatedSeconds) {
        progressBarContainer.style.display = 'block';
        progressBar.style.width = '0%';
        progressBar.classList.remove('indeterminate');

        // CORRECCIÓN: Usamos la hora del sistema (Timestamp)
        const startTime = Date.now();

        const updateInterval = 100; // Actualizar visualmente cada 100ms

        // Texto inicial
        updateTimerText(estimatedSeconds);

        if (visualTimerInterval) clearInterval(visualTimerInterval);

        visualTimerInterval = setInterval(() => {
            // CORRECCIÓN: Calculamos la diferencia real de tiempo
            const now = Date.now();
            const elapsed = (now - startTime) / 1000; // Convertimos ms a segundos

            // Calculamos porcentaje (Topamos en 95% para no mentir si se demora más)
            let percentage = (elapsed / estimatedSeconds) * 100;
            if (percentage > 95) percentage = 95;

            progressBar.style.width = `${percentage}%`;

            // Cuenta regresiva visual
            const remaining = Math.max(0, estimatedSeconds - elapsed);

            if (remaining > 0) {
                updateTimerText(remaining);
            } else {
                timerText.textContent = "Finalizando últimos detalles...";
                // Si nos pasamos del tiempo, ponemos modo "indeterminado"
                if (percentage >= 95) {
                    progressBar.classList.add('indeterminate');
                }
            }

        }, updateInterval);
    }

    function updateTimerText(secondsLeft) {
        const minutes = Math.floor(secondsLeft / 60);
        const seconds = Math.floor(secondsLeft % 60);
        timerText.textContent = `Tiempo estimado: ${minutes}:${seconds.toString().padStart(2, '0')}`;
    }

    function stopProgressTimer() {
        if (visualTimerInterval) clearInterval(visualTimerInterval);
        progressBar.classList.remove('indeterminate');
        progressBar.style.width = '100%';
        timerText.textContent = "¡Listo!";

        // Pequeño delay para que el usuario vea el 100% antes de desaparecer
        setTimeout(() => {
            progressBarContainer.style.display = 'none';
        }, 500);
    }

    // Función auxiliar para obtener duración de archivo local
    function getAudioDuration(file) {
        return new Promise((resolve) => {
            const objectUrl = URL.createObjectURL(file);
            const audio = new Audio(objectUrl);
            audio.onloadedmetadata = () => {
                URL.revokeObjectURL(objectUrl);
                resolve(audio.duration);
            };
            audio.onerror = () => resolve(180); // 3 min default si falla
        });
    }

    // 3. API CALLS

    // A) MANEJO DE ARCHIVOS LOCALES
    async function handleUpload(file) {
        // 1. Obtenemos la duración EXACTA leyendo el archivo en el navegador
        showLoader("Analizando archivo...");
        const duration = await getAudioDuration(file);

        // 2. Calculamos el tiempo basado en esa duración
        const format = formatSelect.value;
        const estimatedTime = estimateProcessingTime(duration, format);

        // 3. Iniciamos el timer con precisión
        loaderText.textContent = `Subiendo y procesando: ${file.name}`;
        startProgressTimer(estimatedTime);

        const formData = new FormData();
        formData.append('audioFile', file);
        formData.append('format', format);

        try {
            const response = await fetch('/api/upload', { method: 'POST', body: formData });
            if (!response.ok) throw new Error('Error Servidor');
            const data = await response.json();

            stopProgressTimer(); // Detener timer
            initDAW(data.files, data.originalName, data.zip, data.instrumental, data.bpm, data.key);
        } catch (error) {
            console.error(error);
            stopProgressTimer();
            alert(error.message);
            resetUI();
        }
    }

    // B) MANEJO DE YOUTUBE (ESTRATEGIA 2 PASOS)
    async function handleYoutube(url) {
        showLoader("Analizando video...");
        // Ocultamos la barra temporalmente porque aun no sabemos el tiempo
        progressBarContainer.style.display = 'none';

        try {
            // PASO 1: Obtener Metadata (Título y Duración) - RÁPIDO
            const infoResponse = await fetch('/api/youtube-info', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ youtubeUrl: url })
            });

            if (!infoResponse.ok) throw new Error('No se pudo obtener información del video. Revisa el link.');
            const metaData = await infoResponse.json();

            // PASO 2: Calcular Tiempo Exacto
            const realDuration = metaData.duration;
            const format = formatSelect.value;
            const estimatedTime = estimateProcessingTime(realDuration, format);

            // PASO 3: Iniciar Proceso Pesado con Timer Preciso
            loaderText.textContent = `Procesando: ${metaData.title}`;
            startProgressTimer(estimatedTime);

            const processResponse = await fetch('/api/youtube', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    youtubeUrl: url,
                    format: format
                })
            });

            if (!processResponse.ok) throw new Error('Error en el procesamiento');
            const data = await processResponse.json();

            stopProgressTimer();
            initDAW(data.files, data.originalName, data.zip, data.instrumental, data.bpm, data.key);

        } catch (error) {
            console.error(error);
            stopProgressTimer();
            alert(error.message);
            resetUI();
        }
    }

    // 4. UI HELPERS
    function showLoader(text) {
        dropZone.classList.add('hidden');
        youtubeBox.classList.add('hidden');
        divider.classList.add('hidden');
        if (formatContainer) formatContainer.style.display = 'none';

        loaderText.textContent = text;
        loader.classList.remove('hidden');
    }

    function resetUI() {
        loader.classList.add('hidden');
        progressBarContainer.style.display = 'none';

        dropZone.classList.remove('hidden');
        youtubeBox.classList.remove('hidden');
        divider.classList.remove('hidden');
        if (formatContainer) formatContainer.style.display = 'flex';

        fileInput.value = ''; youtubeInput.value = '';
        dropZone.style.borderColor = 'rgba(255, 255, 255, 0.15)';
    }

    // 5. DAW INITIALIZATION
    function initDAW(filesUrls, originalName, zipUrl = null, instrumentalUrl = null, bpm = 0, key = "Unknown") {
        loader.classList.add('hidden');
        appHeader.classList.add('hidden');

        const glassCard = document.querySelector('.glass-card');
        glassCard.classList.add('expanded');

        setTimeout(() => { resultsArea.classList.remove('hidden'); }, 300);

        const safeTitle = originalName ? originalName.replace(/\.[^/.]+$/, "") : "Mix";

        // --- A. BADGES DE BPM & KEY ---
        const badgeStyle = `
            background: rgba(255, 255, 255, 0.05); 
            border: 1px solid rgba(255, 255, 255, 0.15); 
            padding: 3px 10px; 
            border-radius: 12px; 
            font-size: 0.75rem; 
            font-family: monospace; 
            color: rgba(255, 255, 255, 0.7); 
            letter-spacing: 0.5px;
        `;

        const badgesHTML = (bpm > 0) ? `
            <div style="display: flex; gap: 8px; margin-top: 6px; justify-content: center; opacity: 1;">
                <span style="${badgeStyle}">BPM ${bpm}</span>
                <span style="${badgeStyle}">KEY ${key}</span>
            </div>
        ` : '';

        // --- B. BOTONES DESCARGA ---
        const btnStyle = `
            display: flex; align-items: center; gap: 6px; text-decoration: none;
            color: rgba(255, 255, 255, 0.6); border: 1px solid rgba(255, 255, 255, 0.2);
            background: rgba(255, 255, 255, 0.05); padding: 5px 12px; border-radius: 20px;
            font-size: 0.8rem; transition: all 0.2s ease;
        `;
        const btnHover = "this.style.borderColor='rgba(255,255,255,0.8)'; this.style.color='white'; this.style.background='rgba(255,255,255,0.1)'";
        const btnOut = "this.style.borderColor='rgba(255,255,255,0.2)'; this.style.color='rgba(255,255,255,0.6)'; this.style.background='rgba(255,255,255,0.05)'";

        const instrButtonHTML = instrumentalUrl ? `
            <a href="${instrumentalUrl}" download target="_blank" style="${btnStyle}" onmouseover="${btnHover}" onmouseout="${btnOut}" title="Descargar Instrumental">
                <span class="material-icons" style="font-size: 16px;">download</span>
                <span>Instrumental</span>
            </a>
        ` : '';

        const zipButtonHTML = zipUrl ? `
            <a href="${zipUrl}" download target="_blank" style="${btnStyle}" onmouseover="${btnHover}" onmouseout="${btnOut}" title="Descargar Todo (ZIP)">
                <span class="material-icons" style="font-size: 16px;">download</span>
                <span>ZIP</span>
            </a>
        ` : '';

        // --- C. RENDERIZADO DEL HEADER ---
        resultsArea.innerHTML = `
            <div class="player-header">
                <div class="player-top-row">
                    <div class="player-title-container" style="display: flex; flex-direction: column; justify-content: center; overflow: visible;">
                        <div style="width: 100%; overflow: hidden; mask-image: linear-gradient(to right, transparent, black 5%, black 95%, transparent); -webkit-mask-image: linear-gradient(to right, transparent, black 5%, black 95%, transparent);">
                             <span class="player-title-text" id="playerTitle">${safeTitle}</span>
                        </div>
                        ${badgesHTML}
                    </div>

                    <div style="position: absolute; right: 140px; top: 50%; transform: translateY(-50%); display: flex; gap: 8px;">
                        ${instrButtonHTML}
                        ${zipButtonHTML}
                    </div>
                    
                    <button id="btnReset" class="btn-new-project-absolute">
                        <span class="material-icons" style="font-size: 16px;">add</span> Nuevo proyecto
                    </button>
                </div>

                <div class="controls-row">
                    <div style="display: flex; gap: 15px;">
                        <button id="btnPlayPause" class="btn-primary" style="border-radius: 50%; width: 50px; height: 50px; padding: 0; display: flex; align-items: center; justify-content: center;">
                            <span class="material-icons" style="font-size: 28px;">play_arrow</span>
                        </button>
                        <button id="btnStop" class="btn-primary" style="border-radius: 50%; width: 50px; height: 50px; padding: 0; display: flex; align-items: center; justify-content: center; background: #333;">
                            <span class="material-icons" style="font-size: 28px;">stop</span>
                        </button>
                    </div>

                    <div class="master-vol-container">
                        <span class="material-icons" style="font-size: 22px; color: var(--accent-color);">volume_up</span>
                        <input type="range" id="masterVolume" class="master-slider" min="0" max="1" step="0.01" value="1">
                    </div>
                </div>

                <div class="time-display" style="font-family: monospace; font-size: 1.2rem; margin-bottom: 20px;">
                    <span id="currentTime">00:00</span> / <span id="totalTime">00:00</span>
                </div>
            </div>
            <div id="tracks-wrapper"></div>
        `;

        btnPlayPause = document.getElementById('btnPlayPause');
        btnStop = document.getElementById('btnStop');
        currentTimeSpan = document.getElementById('currentTime');
        totalTimeSpan = document.getElementById('totalTime');
        document.getElementById('btnReset').onclick = resetApplication;

        const masterSlider = document.getElementById('masterVolume');
        masterSlider.oninput = (e) => {
            globalMasterVolume = parseFloat(e.target.value);
            tracks.forEach(t => t.setMasterVolume(globalMasterVolume));
        };

        const tracksWrapper = document.getElementById('tracks-wrapper');

        // --- D. COLORES DE STEMS ---
        const stemConfig = {
            'vocals': { color: '#FF4081' },
            'drums': { color: '#00E676' },
            'bass': { color: '#FFD740' },
            'other': { color: '#7C4DFF' }
        };

        tracks = [];

        filesUrls.forEach((url) => {
            const filename = url.split('/').pop().toLowerCase();
            let stemName = 'unknown';

            if (filename.startsWith('vocals')) stemName = 'vocals';
            else if (filename.startsWith('drums')) stemName = 'drums';
            else if (filename.startsWith('bass')) stemName = 'bass';
            else if (filename.startsWith('other')) stemName = 'other';

            if (stemName === 'unknown') stemName = filename.split('.')[0];

            const config = stemConfig[stemName] || { color: '#00d2ff' };

            const track = new TrackComponent(tracksWrapper, stemName, url, config.color);
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

        if (typeof Sortable !== 'undefined') {
            sortableInstance = new Sortable(tracksWrapper, {
                animation: 250,
                handle: '.drag-handle',
                ghostClass: 'sortable-ghost',
                dragClass: 'sortable-drag',
            });
        }

        assignPlayerListeners(tracksWrapper);
    }

    // 6. LOGICA REPRODUCTOR
    function assignPlayerListeners(container) {
        btnPlayPause.addEventListener('click', () => {
            if (isPlaying) {
                tracks.forEach(t => t.pause());
                isPlaying = false;
                btnPlayPause.innerHTML = '<span class="material-icons" style="font-size: 28px;">play_arrow</span>';
                stopTimer(); // Detener timer de reproducción
            } else {
                tracks.forEach(t => t.play());
                isPlaying = true;
                btnPlayPause.innerHTML = '<span class="material-icons" style="font-size: 28px;">pause</span>';
                startTimer(); // Iniciar timer de reproducción
            }
        });
        btnStop.addEventListener('click', () => {
            tracks.forEach(t => t.stop());
            isPlaying = false;
            btnPlayPause.innerHTML = '<span class="material-icons" style="font-size: 28px;">play_arrow</span>';
            stopTimer(); // Detener timer de reproducción
            currentTimeSpan.textContent = "00:00";
        });

        container.addEventListener('track-solo', (e) => handleSoloExclusive(e.detail.name));
        container.addEventListener('track-mute', () => refreshAllTracksState());
        container.addEventListener('track-seek', (e) => syncAllTracks(e.detail.progress, e.detail.sourceTrack));
    }

    function handleSoloExclusive(activeTrackName) {
        const trackRequesting = tracks.find(t => t.name === activeTrackName);
        if (trackRequesting.isSolo) {
            tracks.forEach(t => { if (t.name !== activeTrackName) t.disableSolo(); });
        }
        refreshAllTracksState();
    }

    function refreshAllTracksState() {
        const isAnySoloActive = tracks.some(t => t.isSolo);
        tracks.forEach(track => {
            let shouldBeSilent = false;
            if (isAnySoloActive) {
                if (!track.isSolo) shouldBeSilent = true;
            } else {
                if (track.isMuted) shouldBeSilent = true;
            }
            track.setSilent(shouldBeSilent);
        });
    }

    function syncAllTracks(progress, sourceName) {
        tracks.forEach(track => { if (track.name !== sourceName) track.seekTo(progress); });
        const currentTime = globalDuration * progress;
        currentTimeSpan.textContent = formatTime(currentTime);
    }

    function startTimer() {
        if (progressInterval) clearInterval(progressInterval);
        progressInterval = setInterval(() => {
            if (tracks.length === 0) return;
            const currentTime = tracks[0].wavesurfer.getCurrentTime();
            currentTimeSpan.textContent = formatTime(currentTime);
            if (globalDuration > 0 && currentTime >= globalDuration) btnStop.click();
        }, 100);
    }

    function stopTimer() { clearInterval(progressInterval); }
    function formatTime(seconds) {
        if (!seconds) return "00:00";
        const minutes = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    function resetApplication() {
        if (isPlaying) btnStop.click();

        tracks.forEach(t => { if (t.wavesurfer) t.wavesurfer.destroy(); });
        tracks = [];
        if (sortableInstance) sortableInstance.destroy();

        resultsArea.classList.add('hidden');
        resultsArea.innerHTML = '';

        appHeader.classList.remove('hidden');
        resetUI();

        document.querySelector('.glass-card').classList.remove('expanded');
    }
});