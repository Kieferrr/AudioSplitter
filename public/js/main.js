import { TrackComponent } from './components/TrackComponent.js';
import { authService } from './services/authService.js';
import { AuthComponent } from './components/AuthComponent.js';
import { dbService } from './services/dbService.js';
import { LibraryModal } from './components/LibraryModal.js';

document.addEventListener('DOMContentLoaded', () => {

    const authContainer = document.getElementById('auth-container');
    const appContainer = document.getElementById('app-container');
    const glassCard = document.querySelector('.glass-card');
    let currentUser = null;

    // Referencias
    const appHeaderElement = document.querySelector('.app-header');
    const uploadUi = document.getElementById('upload-ui');
    const resultsArea = document.getElementById('results-area');

    // --- VARIABLES GLOBALES DEL REPRODUCTOR (Aquí para evitar scope issues) ---
    let tracks = [];
    let isPlaying = false;
    let globalDuration = 0;
    let progressInterval = null;
    let visualTimerInterval = null;
    let currentSongData = null;
    let sortableInstance = null;
    let globalMasterVolume = 1.0; // DEFINIDO AQUÍ PARA QUE FUNCIONE SIEMPRE
    let btnPlayPause, btnStop, currentTimeSpan, totalTimeSpan;

    // --- PANEL USUARIO ---
    const updateHeaderWithUser = (user) => {
        const existingPanel = document.getElementById('user-panel');
        if (existingPanel) existingPanel.remove();

        const userPanel = document.createElement('div');
        userPanel.id = 'user-panel';

        if (user) {
            userPanel.innerHTML = `
                <button id="btnLibrary" class="header-btn">
                    <span class="material-icons">library_music</span> Mis Canciones
                </button>
                <div class="v-divider"></div>
                <span class="user-email">${user.email.split('@')[0]}</span>
                <button id="btnLogout" class="logout-btn" title="Salir">
                    <span class="material-icons">logout</span>
                </button>
            `;
            glassCard.appendChild(userPanel);

            document.getElementById('btnLogout').addEventListener('click', async () => {
                await authService.logout(); window.location.reload();
            });
            document.getElementById('btnLibrary').addEventListener('click', () => {
                new LibraryModal(user.uid, (songData) => {
                    resetApplication();
                    setTimeout(() => {
                        currentSongData = songData;
                        // AQUÍ ESTÁ LA CLAVE: true significa "Viene de guardado"
                        initDAW(songData.urls, songData.title, songData.zip, songData.instrumental, songData.bpm, songData.key, true);
                    }, 50);
                });
            });
        } else {
            userPanel.innerHTML = `
                <span style="opacity: 0.6; font-size: 0.8rem; margin-right: 8px;">Invitado</span>
                <button id="btnLoginGuest" style="background:var(--accent-color); border:none; border-radius:20px; padding:4px 10px; cursor:pointer; font-size:0.75rem; font-weight:bold; color:black;">
                    Iniciar Sesión
                </button>
            `;
            glassCard.appendChild(userPanel);
            document.getElementById('btnLoginGuest').addEventListener('click', () => window.location.reload());
        }
    };

    const showApp = (user) => {
        currentUser = user;
        authContainer.classList.add('hidden');
        authContainer.innerHTML = '';
        appContainer.classList.remove('hidden');
        updateHeaderWithUser(user);
    };

    const showLogin = () => {
        currentUser = null;
        appContainer.classList.add('hidden');
        authContainer.classList.remove('hidden');
        new AuthComponent(authContainer, (user) => showApp(user), () => showApp(null));
    };

    authService.observeAuthState((user) => {
        if (user) showApp(user); else showLogin();
    });

    // --- LOGICA UPLOAD ---
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('fileInput');
    const youtubeInput = document.getElementById('youtubeInput');
    const youtubeBtn = document.getElementById('youtubeBtn');
    const formatSelect = document.getElementById('formatSelect');
    const loader = document.getElementById('loader');
    const loaderText = document.getElementById('loader-text');
    const progressBarContainer = document.querySelector('.progress-bar-container');
    const progressBar = document.getElementById('progress-bar');

    let timerText = document.getElementById('timer-text');
    if (!timerText) {
        timerText = document.createElement('p'); timerText.id = 'timer-text'; timerText.className = 'timer-text';
        progressBarContainer.after(timerText);
    }

    dropZone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => { if (e.target.files.length) handleUpload(e.target.files[0]); });
    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, (e) => { e.preventDefault(); e.stopPropagation(); dropZone.classList.add('drag-active'); }, false);
    });
    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, (e) => { e.preventDefault(); e.stopPropagation(); dropZone.classList.remove('drag-active'); }, false);
    });
    dropZone.addEventListener('drop', (e) => { if (e.dataTransfer.files.length) handleUpload(e.dataTransfer.files[0]); });
    youtubeBtn.addEventListener('click', () => { if (youtubeInput.value.trim()) handleYoutube(youtubeInput.value.trim()); });
    youtubeInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') youtubeBtn.click(); });

    function estimateProcessingTime(duration, format) { return (duration * 0.9) + (format === 'wav' ? 60 : 30); }
    function getAudioDuration(file) {
        return new Promise(resolve => {
            const url = URL.createObjectURL(file);
            const a = new Audio(url);
            a.onloadedmetadata = () => { URL.revokeObjectURL(url); resolve(a.duration); };
            a.onerror = () => resolve(180);
        });
    }

    function startProgressTimer(seconds) {
        progressBarContainer.style.display = 'block'; progressBar.style.width = '0%'; progressBar.classList.remove('indeterminate');
        const start = Date.now();
        if (visualTimerInterval) clearInterval(visualTimerInterval);
        visualTimerInterval = setInterval(() => {
            const elapsed = (Date.now() - start) / 1000;
            let pct = (elapsed / seconds) * 100; if (pct > 95) pct = 95;
            progressBar.style.width = `${pct}%`;
            const left = Math.max(0, seconds - elapsed);
            if (left > 0) {
                const m = Math.floor(left / 60), s = Math.floor(left % 60);
                timerText.textContent = `Tiempo estimado: ${m}:${s.toString().padStart(2, '0')}`;
            } else {
                timerText.textContent = "Finalizando...";
                if (pct >= 95) progressBar.classList.add('indeterminate');
            }
        }, 100);
    }
    function stopProgressTimer() {
        if (visualTimerInterval) clearInterval(visualTimerInterval);
        progressBar.classList.remove('indeterminate'); progressBar.style.width = '100%'; timerText.textContent = "¡Listo!";
        setTimeout(() => progressBarContainer.style.display = 'none', 500);
    }

    async function handleUpload(file) {
        showLoader("Analizando archivo...");
        const dur = await getAudioDuration(file);
        const fmt = formatSelect.value;
        loaderText.textContent = `Procesando: ${file.name}`;
        startProgressTimer(estimateProcessingTime(dur, fmt));

        const fd = new FormData(); fd.append('audioFile', file); fd.append('format', fmt);
        try {
            const res = await fetch('/api/upload', { method: 'POST', body: fd });
            if (!res.ok) throw new Error('Error Servidor');
            const data = await res.json();
            currentSongData = { ...data, format: fmt };
            stopProgressTimer();
            // isSaved = false (porque es nueva)
            initDAW(data.files, data.originalName, data.zip, data.instrumental, data.bpm, data.key, false);
        } catch (e) { console.error(e); stopProgressTimer(); alert(e.message); resetUI(); }
    }

    async function handleYoutube(url) {
        showLoader("Analizando video...");
        try {
            const info = await fetch('/api/youtube-info', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ youtubeUrl: url }) });
            if (!info.ok) throw new Error('Error info');
            const meta = await info.json();
            loaderText.textContent = `Procesando: ${meta.title}`;
            startProgressTimer(estimateProcessingTime(meta.duration, formatSelect.value));

            const res = await fetch('/api/youtube', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ youtubeUrl: url, format: formatSelect.value }) });
            if (!res.ok) throw new Error('Error procesar');
            const data = await res.json();
            currentSongData = { ...data, format: formatSelect.value };
            stopProgressTimer();
            // isSaved = false (porque es nueva)
            initDAW(data.files, data.originalName, data.zip, data.instrumental, data.bpm, data.key, false);
        } catch (e) { console.error(e); stopProgressTimer(); alert(e.message); resetUI(); }
    }

    function showLoader(txt) {
        uploadUi.classList.add('hidden');
        loaderText.textContent = txt;
        loader.classList.remove('hidden');
    }

    function resetUI() {
        loader.classList.add('hidden');
        progressBarContainer.style.display = 'none';
        uploadUi.classList.remove('hidden');
        fileInput.value = ''; youtubeInput.value = '';
    }

    // --- REPRODUCTOR (DAW) ---
    // Agregamos parámetro 'isSaved' para controlar el botón guardar
    function initDAW(files, name, zip, inst, bpm, key, isSaved = false) {
        loader.classList.add('hidden');
        uploadUi.classList.add('hidden');
        appHeaderElement.classList.add('hidden');

        glassCard.classList.add('expanded');
        resultsArea.classList.remove('hidden');

        const safeName = name ? name.replace(/\.[^/.]+$/, "") : "Mix";

        // BOTÓN GUARDAR: Solo aparece si hay usuario Y NO está guardada (isSaved == false)
        const saveBtnHTML = (currentUser && !isSaved) ? `
            <button id="btnSaveToCloud" class="action-btn">
                <span class="material-icons">cloud_upload</span> Guardar
            </button>` : '';

        const bpmBadge = bpm > 0 ? `<div class="badges-container"><span class="badge-info">BPM ${bpm}</span><span class="badge-info">KEY ${key}</span></div>` : '';

        // RESTAURADO: Textos completos, iconos correctos, botón nuevo negro
        resultsArea.innerHTML = `
            <div class="player-header">
                <div class="player-top-row">
                    <div class="player-title-container">
                         <div class="player-title-mask">
                             <span class="player-title-text">${safeName}</span>
                         </div>
                         ${bpmBadge}
                    </div>

                    <div class="actions-right">
                        ${saveBtnHTML}
                        ${inst ? `<a href="${inst}" download class="action-btn"><span class="material-icons">download</span> Instrumental</a>` : ''}
                        ${zip ? `<a href="${zip}" download class="action-btn"><span class="material-icons">download</span> ZIP</a>` : ''}
                        <button id="btnReset" class="action-btn black-btn"><span class="material-icons">add</span> Nuevo proyecto</button>
                    </div>
                </div>
                
                <div class="controls-row">
                    <div class="main-controls">
                        <button id="btnPlayPause" class="ctrl-circle play"><span class="material-icons" style="font-size:30px;">play_arrow</span></button>
                        <button id="btnStop" class="ctrl-circle stop"><span class="material-icons" style="font-size:30px;">stop</span></button>
                    </div>
                    <div class="master-vol-container">
                        <span class="material-icons" style="color:var(--accent-color);">volume_up</span>
                        <input type="range" id="masterVolume" min="0" max="1" step="0.01" value="1">
                    </div>
                </div>
                
                <div class="time-display"><span id="currentTime">00:00</span> / <span id="totalTime">00:00</span></div>
            </div>
            
            <div id="tracks-wrapper"></div>
        `;

        // Listeners
        document.getElementById('btnReset').onclick = resetApplication;
        if (document.getElementById('btnSaveToCloud')) {
            document.getElementById('btnSaveToCloud').addEventListener('click', async (e) => {
                const b = e.currentTarget; b.disabled = true; b.innerHTML = '...';
                try { await dbService.saveSong(currentUser.uid, currentSongData); alert("¡Guardada!"); b.remove(); /* Eliminamos el botón al guardar */ }
                catch (e) { alert(e.message); b.disabled = false; b.innerHTML = 'Guardar'; }
            });
        }

        btnPlayPause = document.getElementById('btnPlayPause');
        btnStop = document.getElementById('btnStop');
        currentTimeSpan = document.getElementById('currentTime');
        totalTimeSpan = document.getElementById('totalTime');
        const mVol = document.getElementById('masterVolume');

        // CORRECCIÓN VOLUMEN: Seteamos el valor inicial y el listener
        mVol.value = globalMasterVolume;
        mVol.oninput = (e) => {
            globalMasterVolume = parseFloat(e.target.value);
            tracks.forEach(t => t.setMasterVolume(globalMasterVolume));
        };

        const tWrapper = document.getElementById('tracks-wrapper');
        const colors = { 'vocals': '#FF4081', 'drums': '#00E676', 'bass': '#FFD740', 'other': '#7C4DFF' };
        tracks = [];

        files.forEach(url => {
            // MEJORA: Detección de nombre más robusta
            // Buscamos palabras clave en cualquier parte de la URL, no solo al inicio
            const lowerUrl = url.toLowerCase();
            let stem = 'other'; // Default

            if (lowerUrl.includes('vocals')) stem = 'vocals';
            else if (lowerUrl.includes('drums')) stem = 'drums';
            else if (lowerUrl.includes('bass')) stem = 'bass';
            else if (lowerUrl.includes('other')) stem = 'other';

            // Si el nombre del archivo original era distinto, intentamos usarlo
            // Pero para efectos de color y orden, usaremos las categorías estándar

            const color = colors[stem] || '#7C4DFF';

            // Pasamos 'stem' como nombre para que TrackComponent sepa qué poner en el título
            tracks.push(new TrackComponent(tWrapper, stem, url, color));
        });

        const checkInt = setInterval(() => {
            if (tracks[0] && tracks[0].isReady()) {
                globalDuration = tracks[0].wavesurfer.getDuration();
                totalTimeSpan.textContent = formatTime(globalDuration);
                clearInterval(checkInt);
            }
        }, 500);

        if (typeof Sortable !== 'undefined') {
            if (sortableInstance) sortableInstance.destroy();
            try { sortableInstance = new Sortable(tWrapper, { animation: 250, handle: '.drag-handle', ghostClass: 'sortable-ghost' }); } catch (e) { }
        }

        assignPlayerListeners(tWrapper);
    }

    function assignPlayerListeners(c) {
        btnPlayPause.onclick = () => {
            if (isPlaying) { tracks.forEach(t => t.pause()); isPlaying = false; btnPlayPause.innerHTML = '<span class="material-icons" style="font-size:30px;">play_arrow</span>'; clearInterval(progressInterval); }
            else { tracks.forEach(t => t.play()); isPlaying = true; btnPlayPause.innerHTML = '<span class="material-icons" style="font-size:30px;">pause</span>'; startTimer(); }
        };
        btnStop.onclick = () => { tracks.forEach(t => t.stop()); isPlaying = false; btnPlayPause.innerHTML = '<span class="material-icons" style="font-size:30px;">play_arrow</span>'; clearInterval(progressInterval); currentTimeSpan.textContent = "00:00"; };
        c.addEventListener('track-solo', (e) => {
            const req = tracks.find(t => t.name === e.detail.name);
            if (req.isSolo) tracks.forEach(t => { if (t.name !== req.name) t.disableSolo(); });
            refreshMuteState();
        });
        c.addEventListener('track-mute', refreshMuteState);
        c.addEventListener('track-seek', (e) => {
            tracks.forEach(t => { if (t.name !== e.detail.sourceTrack) t.seekTo(e.detail.progress); });
            currentTimeSpan.textContent = formatTime(globalDuration * e.detail.progress);
        });
    }

    function refreshMuteState() {
        const anySolo = tracks.some(t => t.isSolo);
        tracks.forEach(t => {
            let silent = false;
            if (anySolo) { if (!t.isSolo) silent = true; }
            else { if (t.isMuted) silent = true; }
            t.setSilent(silent);
        });
    }

    function startTimer() {
        if (progressInterval) clearInterval(progressInterval);
        progressInterval = setInterval(() => {
            if (!tracks.length) return;
            const cur = tracks[0].wavesurfer.getCurrentTime();
            currentTimeSpan.textContent = formatTime(cur);
            if (globalDuration > 0 && cur >= globalDuration) btnStop.click();
        }, 100);
    }

    function formatTime(s) { if (!s) return "00:00"; const m = Math.floor(s / 60), sc = Math.floor(s % 60); return `${m.toString().padStart(2, '0')}:${sc.toString().padStart(2, '0')}`; }

    function resetApplication() {
        if (isPlaying && btnStop) btnStop.click();
        tracks.forEach(t => { if (t.wavesurfer) t.wavesurfer.destroy(); });
        tracks = [];
        resultsArea.innerHTML = '';
        resultsArea.classList.add('hidden');

        appHeaderElement.classList.remove('hidden');
        uploadUi.classList.remove('hidden');

        glassCard.classList.remove('expanded');
        resetUI();
        currentSongData = null;
    }
});