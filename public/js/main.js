import { TrackComponent } from './components/TrackComponent.js';
import { authService } from './services/authService.js';
import { AuthComponent } from './components/AuthComponent.js';
import { dbService } from './services/dbService.js'; // --- NUEVO IMPORT ---

document.addEventListener('DOMContentLoaded', () => {

    // --- VARIABLES DE AUTENTICACIÓN ---
    const authContainer = document.getElementById('auth-container');
    const appContainer = document.getElementById('app-container');
    let currentUser = null; // --- NUEVO: Aquí guardaremos quién está conectado

    // --- UI HELPERS PARA AUTH ---
    // Creamos el botón de logout dinámicamente en el header principal
    const appHeader = document.querySelector('.app-header');

    // Función para inyectar info del usuario en el header
    const updateHeaderWithUser = (user) => {
        // Buscamos si ya existe el panel de usuario para no duplicarlo
        const existingPanel = document.getElementById('user-panel');
        if (existingPanel) existingPanel.remove();

        if (user) {
            const userPanel = document.createElement('div');
            userPanel.id = 'user-panel';
            userPanel.style.cssText = "position: absolute; top: 20px; right: 20px; display: flex; align-items: center; gap: 10px; font-size: 0.8rem;";

            userPanel.innerHTML = `
                <span style="opacity: 0.7;">${user.email}</span>
                <button id="btnLogout" style="background: rgba(255,255,255,0.1); border: none; color: white; padding: 5px 10px; border-radius: 5px; cursor: pointer;">
                    Salir
                </button>
            `;
            appHeader.appendChild(userPanel);

            // Listener del Logout
            document.getElementById('btnLogout').addEventListener('click', async () => {
                await authService.logout();
                window.location.reload(); // Recargamos para limpiar todo
            });
        }
    };

    // Función para mostrar la App Principal
    const showApp = (user) => {
        currentUser = user; // Guardamos el usuario globalmente
        authContainer.classList.add('hidden');
        authContainer.innerHTML = '';
        appContainer.classList.remove('hidden');
        updateHeaderWithUser(user); // Actualizamos el header
        console.log("Acceso concedido a:", user ? user.email : "Invitado");
    };

    // Función para mostrar el Login
    const showLogin = () => {
        currentUser = null;
        appContainer.classList.add('hidden');
        authContainer.classList.remove('hidden');

        new AuthComponent(
            authContainer,
            (user) => showApp(user),
            () => showApp(null)
        );
    };

    authService.observeAuthState((user) => {
        if (user) {
            showApp(user);
        } else {
            showLogin();
        }
    });

    // ----------------------------------------------------
    // --- LÓGICA DE LA APLICACIÓN ---
    // ----------------------------------------------------

    // 1. DOM ELEMENTS
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('fileInput');
    const youtubeInput = document.getElementById('youtubeInput');
    const youtubeBtn = document.getElementById('youtubeBtn');
    const formatSelect = document.getElementById('formatSelect');
    const formatContainer = document.querySelector('.format-selector-container');
    const loader = document.getElementById('loader');
    const loaderText = document.getElementById('loader-text');
    const progressBarContainer = document.querySelector('.progress-bar-container');
    const progressBar = document.getElementById('progress-bar');

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
    // const appHeader ya está definido arriba

    // Estado
    let tracks = [];
    let isPlaying = false;
    let globalDuration = 0;
    let progressInterval = null;
    let btnPlayPause, btnStop, currentTimeSpan, totalTimeSpan;
    let sortableInstance = null;
    let globalMasterVolume = 1.0;
    let visualTimerInterval = null;

    // Variables para guardar los datos de la canción actual (para poder guardarla en DB)
    let currentSongData = null;

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


    // --- HELPERS TIEMPO ---
    function estimateProcessingTime(durationSeconds, format) {
        const PROCESSING_SPEED = 0.9;
        const overhead = (format === 'wav') ? 60 : 30;
        return (durationSeconds * PROCESSING_SPEED) + overhead;
    }

    function startProgressTimer(estimatedSeconds) {
        progressBarContainer.style.display = 'block';
        progressBar.style.width = '0%';
        progressBar.classList.remove('indeterminate');
        const startTime = Date.now();
        const updateInterval = 100;
        updateTimerText(estimatedSeconds);

        if (visualTimerInterval) clearInterval(visualTimerInterval);

        visualTimerInterval = setInterval(() => {
            const now = Date.now();
            const elapsed = (now - startTime) / 1000;
            let percentage = (elapsed / estimatedSeconds) * 100;
            if (percentage > 95) percentage = 95;

            progressBar.style.width = `${percentage}%`;
            const remaining = Math.max(0, estimatedSeconds - elapsed);

            if (remaining > 0) {
                updateTimerText(remaining);
            } else {
                timerText.textContent = "Finalizando últimos detalles...";
                if (percentage >= 95) progressBar.classList.add('indeterminate');
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
        setTimeout(() => { progressBarContainer.style.display = 'none'; }, 500);
    }

    function getAudioDuration(file) {
        return new Promise((resolve) => {
            const objectUrl = URL.createObjectURL(file);
            const audio = new Audio(objectUrl);
            audio.onloadedmetadata = () => {
                URL.revokeObjectURL(objectUrl);
                resolve(audio.duration);
            };
            audio.onerror = () => resolve(180);
        });
    }

    // 3. API CALLS
    async function handleUpload(file) {
        showLoader("Analizando archivo...");
        const duration = await getAudioDuration(file);
        const format = formatSelect.value;
        const estimatedTime = estimateProcessingTime(duration, format);

        loaderText.textContent = `Subiendo y procesando: ${file.name}`;
        startProgressTimer(estimatedTime);

        const formData = new FormData();
        formData.append('audioFile', file);
        formData.append('format', format);

        try {
            const response = await fetch('/api/upload', { method: 'POST', body: formData });
            if (!response.ok) throw new Error('Error Servidor');
            const data = await response.json();

            // Guardamos datos temporales por si quiere guardar en DB
            currentSongData = { ...data, format };

            stopProgressTimer();
            initDAW(data.files, data.originalName, data.zip, data.instrumental, data.bpm, data.key);
        } catch (error) {
            console.error(error);
            stopProgressTimer();
            alert(error.message);
            resetUI();
        }
    }

    async function handleYoutube(url) {
        showLoader("Analizando video...");
        progressBarContainer.style.display = 'none';

        try {
            const infoResponse = await fetch('/api/youtube-info', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ youtubeUrl: url })
            });

            if (!infoResponse.ok) throw new Error('No se pudo obtener información del video.');
            const metaData = await infoResponse.json();

            const realDuration = metaData.duration;
            const format = formatSelect.value;
            const estimatedTime = estimateProcessingTime(realDuration, format);

            loaderText.textContent = `Procesando: ${metaData.title}`;
            startProgressTimer(estimatedTime);

            const processResponse = await fetch('/api/youtube', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ youtubeUrl: url, format: format })
            });

            if (!processResponse.ok) throw new Error('Error en el procesamiento');
            const data = await processResponse.json();

            // Guardamos datos temporales
            currentSongData = { ...data, format };

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

        // --- BOTÓN GUARDAR (SOLO SI ESTÁ LOGUEADO) ---
        // Verificamos si hay usuario activo para mostrar el botón
        const saveButtonHTML = currentUser ? `
            <button id="btnSaveToCloud" style="
                display: flex; align-items: center; gap: 6px; 
                background: var(--accent-color); color: black; border: none;
                padding: 5px 12px; border-radius: 20px; font-weight: bold;
                font-size: 0.8rem; cursor: pointer; transition: transform 0.2s;
            " onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
                <span class="material-icons" style="font-size: 16px;">cloud_upload</span>
                <span>Guardar</span>
            </button>
        ` : '';
        // ----------------------------------------------

        const badgeStyle = `background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.15); padding: 3px 10px; border-radius: 12px; font-size: 0.75rem; font-family: monospace; color: rgba(255, 255, 255, 0.7); letter-spacing: 0.5px;`;
        const badgesHTML = (bpm > 0) ? `
            <div style="display: flex; gap: 8px; margin-top: 6px; justify-content: center; opacity: 1;">
                <span style="${badgeStyle}">BPM ${bpm}</span>
                <span style="${badgeStyle}">KEY ${key}</span>
            </div>` : '';

        const btnStyle = `display: flex; align-items: center; gap: 6px; text-decoration: none; color: rgba(255, 255, 255, 0.6); border: 1px solid rgba(255, 255, 255, 0.2); background: rgba(255, 255, 255, 0.05); padding: 5px 12px; border-radius: 20px; font-size: 0.8rem; transition: all 0.2s ease;`;
        const btnHover = "this.style.borderColor='rgba(255,255,255,0.8)'; this.style.color='white'; this.style.background='rgba(255,255,255,0.1)'";
        const btnOut = "this.style.borderColor='rgba(255,255,255,0.2)'; this.style.color='rgba(255,255,255,0.6)'; this.style.background='rgba(255,255,255,0.05)'";

        const instrButtonHTML = instrumentalUrl ? `<a href="${instrumentalUrl}" download target="_blank" style="${btnStyle}" onmouseover="${btnHover}" onmouseout="${btnOut}" title="Descargar Instrumental"><span class="material-icons" style="font-size: 16px;">download</span><span>Instrumental</span></a>` : '';
        const zipButtonHTML = zipUrl ? `<a href="${zipUrl}" download target="_blank" style="${btnStyle}" onmouseover="${btnHover}" onmouseout="${btnOut}" title="Descargar Todo (ZIP)"><span class="material-icons" style="font-size: 16px;">download</span><span>ZIP</span></a>` : '';

        resultsArea.innerHTML = `
            <div class="player-header">
                <div class="player-top-row">
                    <div class="player-title-container" style="display: flex; flex-direction: column; justify-content: center; overflow: visible;">
                         <div style="width: 100%; overflow: hidden; mask-image: linear-gradient(to right, transparent, black 5%, black 95%, transparent);">
                             <span class="player-title-text" id="playerTitle">${safeTitle}</span>
                         </div>
                         ${badgesHTML}
                    </div>

                    <div style="position: absolute; right: 140px; top: 50%; transform: translateY(-50%); display: flex; gap: 8px;">
                        ${saveButtonHTML} ${instrButtonHTML}
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

        // --- LISTENERS DEL PLAYER ---
        btnPlayPause = document.getElementById('btnPlayPause');
        btnStop = document.getElementById('btnStop');
        currentTimeSpan = document.getElementById('currentTime');
        totalTimeSpan = document.getElementById('totalTime');
        document.getElementById('btnReset').onclick = resetApplication;

        // Listener para el Botón Guardar (si existe)
        const btnSave = document.getElementById('btnSaveToCloud');
        if (btnSave) {
            btnSave.addEventListener('click', async () => {
                btnSave.disabled = true;
                btnSave.innerHTML = '<span class="material-icons spin">refresh</span> Guardando...';
                try {
                    await dbService.saveSong(currentUser.uid, currentSongData);
                    alert("¡Canción guardada con éxito!");
                    btnSave.innerHTML = '<span class="material-icons">check</span> Guardada';
                } catch (error) {
                    alert(error.message);
                    btnSave.disabled = false;
                    btnSave.innerHTML = '<span class="material-icons">cloud_upload</span> Guardar';
                }
            });
        }

        const masterSlider = document.getElementById('masterVolume');
        masterSlider.oninput = (e) => {
            globalMasterVolume = parseFloat(e.target.value);
            tracks.forEach(t => t.setMasterVolume(globalMasterVolume));
        };

        const tracksWrapper = document.getElementById('tracks-wrapper');
        const stemConfig = { 'vocals': { color: '#FF4081' }, 'drums': { color: '#00E676' }, 'bass': { color: '#FFD740' }, 'other': { color: '#7C4DFF' } };

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
                animation: 250, handle: '.drag-handle', ghostClass: 'sortable-ghost', dragClass: 'sortable-drag',
            });
        }
        assignPlayerListeners(tracksWrapper);
    }

    function assignPlayerListeners(container) {
        btnPlayPause.addEventListener('click', () => {
            if (isPlaying) {
                tracks.forEach(t => t.pause());
                isPlaying = false;
                btnPlayPause.innerHTML = '<span class="material-icons" style="font-size: 28px;">play_arrow</span>';
                stopTimer();
            } else {
                tracks.forEach(t => t.play());
                isPlaying = true;
                btnPlayPause.innerHTML = '<span class="material-icons" style="font-size: 28px;">pause</span>';
                startTimer();
            }
        });
        btnStop.addEventListener('click', () => {
            tracks.forEach(t => t.stop());
            isPlaying = false;
            btnPlayPause.innerHTML = '<span class="material-icons" style="font-size: 28px;">play_arrow</span>';
            stopTimer();
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
        currentSongData = null; // Resetear datos de canción
    }
});