import { TrackComponent } from './components/TrackComponent.js';
import { authService } from './services/authService.js';
import { AuthComponent } from './components/AuthComponent.js';
import { dbService } from './services/dbService.js';
import { LibraryModal } from './components/LibraryModal.js';
import { SettingsModal } from './components/SettingsModal.js';

document.addEventListener('DOMContentLoaded', () => {

    const authContainer = document.getElementById('auth-container');
    const appContainer = document.getElementById('app-container');
    const glassCard = document.querySelector('.glass-card');
    let currentUser = null;

    // Referencias
    const appHeaderElement = document.querySelector('.app-header');
    const uploadUi = document.getElementById('upload-ui');
    const resultsArea = document.getElementById('results-area');

    // --- VARIABLES GLOBALES DEL REPRODUCTOR ---
    let tracks = [];
    let isPlaying = false;
    let globalDuration = 0;
    let progressInterval = null;
    let visualTimerInterval = null;
    let currentSongData = null;
    let sortableInstance = null;
    let globalMasterVolume = 1.0;
    let btnPlayPause, btnStop, currentTimeSpan, totalTimeSpan;

    // --- FUNCIÓN AUXILIAR PARA TRANSICIONES SUAVES ---
    const transitionViews = (oldElem, newElem, onComplete = () => { }) => {
        if (oldElem && !oldElem.classList.contains('hidden')) {
            // 1. Animación de salida
            oldElem.classList.add('fade-out');
            oldElem.classList.remove('fade-in');

            setTimeout(() => {
                // 2. Ocultar real y limpiar clases
                oldElem.classList.add('hidden');
                oldElem.classList.remove('fade-out');

                // 3. Ejecutar cambios estructurales
                onComplete();

                // 4. Animación de entrada
                if (newElem) {
                    newElem.classList.remove('hidden');
                    newElem.classList.add('fade-in');
                    setTimeout(() => newElem.classList.remove('fade-in'), 500);
                }
            }, 300);
        } else {
            onComplete();
            if (newElem) {
                newElem.classList.remove('hidden');
                newElem.classList.add('fade-in');
            }
        }
    };

    // --- PANEL USUARIO ---
    const updateHeaderWithUser = (user) => {
        const existingPanel = document.getElementById('user-panel');
        if (existingPanel) existingPanel.remove();

        const userPanel = document.createElement('div');
        userPanel.id = 'user-panel';

        if (user) {
            const displayName = user.displayName || "Usuario";

            userPanel.innerHTML = `
            <button id="btnLibrary" class="header-btn">
                <span class="material-icons">library_music</span> Mis Canciones
            </button>
            <div class="v-divider"></div>
            
            <span class="user-email">${displayName}</span>
            
            <button id="btnSettings" class="header-btn" style="margin-left: 10px;" title="Ajustes">
                <span class="material-icons">settings</span>
            </button>

            <button id="btnLogout" class="logout-btn" title="Salir" style="margin-left: 5px;">
                <span class="material-icons">logout</span>
            </button>
        `;
            glassCard.appendChild(userPanel);

            // Listener Logout
            document.getElementById('btnLogout').addEventListener('click', async () => {
                await authService.logout();
                showLogin();
            });

            // Listener Library
            document.getElementById('btnLibrary').addEventListener('click', () => {
                new LibraryModal(user.uid, (songData) => {
                    resetApplication();
                    setTimeout(() => {
                        currentSongData = songData;
                        initDAW(songData.urls, songData.title, songData.zip, songData.instrumental, songData.bpm, songData.key, true);
                    }, 350);
                });
            });

            // NUEVO LISTENER SETTINGS
            document.getElementById('btnSettings').addEventListener('click', () => {
                // Pasamos el usuario y qué hacer si se borra la cuenta (showLogin)
                new SettingsModal(user, () => showLogin());
            });

        } else {
            // ... (código de invitado igual que antes) ...
        }
    };

    const showApp = (user) => {
        currentUser = user;
        updateHeaderWithUser(user);
        transitionViews(authContainer, appContainer, () => {
            authContainer.innerHTML = '';
        });
    };

    const showLogin = () => {
        currentUser = null;
        if (!authContainer.classList.contains('hidden') && appContainer.classList.contains('hidden')) return;

        transitionViews(appContainer, authContainer, () => {
            resetApplication();
            glassCard.classList.remove('expanded');
            new AuthComponent(authContainer, (user) => showApp(user), () => showApp(null));
        });
    };

    authService.observeAuthState((user) => {
        if (user) {
            const isJustCreated = user.metadata.creationTime === user.metadata.lastSignInTime;
            const noName = !user.displayName;

            if (isJustCreated && noName) {
                console.log("⏳ Esperando actualización de nombre para usuario nuevo...");
                return; // NO mostramos la app todavía
            }
            // -------------------------

            showApp(user);
        } else {
            showLogin();
        }
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
            initDAW(data.files, data.originalName, data.zip, data.instrumental, data.bpm, data.key, false);
        } catch (e) {
            console.error(e);
            stopProgressTimer();
            Swal.fire({
                icon: 'error',
                title: '¡Ups!',
                text: e.message || 'Ocurrió un error al procesar el archivo.',
                confirmButtonText: 'Entendido'
            });
            resetUI();
        }
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
            initDAW(data.files, data.originalName, data.zip, data.instrumental, data.bpm, data.key, false);
        } catch (e) {
            console.error(e);
            stopProgressTimer();
            Swal.fire({
                icon: 'error',
                title: 'Error de YouTube',
                text: e.message || 'No se pudo procesar el video.',
                confirmButtonText: 'Cerrar'
            });
            resetUI();
        }
    }

    function showLoader(txt) {
        loaderText.textContent = txt;
        transitionViews(uploadUi, loader);
    }

    function resetUI() {
        loader.classList.add('hidden');
        progressBarContainer.style.display = 'none';
        uploadUi.classList.remove('hidden');
        fileInput.value = ''; youtubeInput.value = '';
    }

    // --- REPRODUCTOR (DAW) ---
    function initDAW(files, name, zip, inst, bpm, key, isSaved = false) {
        const safeName = name ? name.replace(/\.[^/.]+$/, "") : "Mix";

        // Botón Guardar
        const saveBtnHTML = (currentUser && !isSaved) ? `
            <button id="btnSaveToCloud" class="action-btn">
                <span class="material-icons">cloud_upload</span> Guardar
            </button>` : '';

        const bpmBadge = bpm > 0 ? `<div class="badges-container"><span class="badge-info">BPM ${bpm}</span><span class="badge-info">KEY ${key}</span></div>` : '';

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

        transitionViews(loader, resultsArea, () => {
            appHeaderElement.classList.add('hidden');
            uploadUi.classList.add('hidden');
            glassCard.classList.add('expanded');
        });

        setTimeout(() => {
            document.getElementById('btnReset').onclick = resetApplication;

            // Lógica Guardar con SweetAlert (Toast)
            if (document.getElementById('btnSaveToCloud')) {
                document.getElementById('btnSaveToCloud').addEventListener('click', async (e) => {
                    const b = e.currentTarget;
                    const originalText = b.innerHTML;
                    b.disabled = true;
                    // Usamos 'sync' o 'refresh' con la clase simple .icon-spin
                    b.innerHTML = '<span class="material-icons icon-spin">sync</span> Guardando...';

                    try {
                        await dbService.saveSong(currentUser.uid, currentSongData);

                        // ALERTA EXITOSA (Toast)
                        const Toast = Swal.mixin({
                            toast: true,
                            position: 'top-end',
                            showConfirmButton: false,
                            timer: 3000,
                            timerProgressBar: true,
                            background: '#1a1a1a',
                            color: '#fff',
                            didOpen: (toast) => {
                                toast.addEventListener('mouseenter', Swal.stopTimer)
                                toast.addEventListener('mouseleave', Swal.resumeTimer)
                            }
                        });
                        Toast.fire({ icon: 'success', title: '¡Canción guardada en la nube!' });
                        b.remove();
                    }
                    catch (e) {
                        Swal.fire({ icon: 'error', title: 'Error al guardar', text: e.message, confirmButtonText: 'Intentar de nuevo' });
                        b.disabled = false;
                        b.innerHTML = originalText;
                    }
                });
            }

            btnPlayPause = document.getElementById('btnPlayPause');
            btnStop = document.getElementById('btnStop');
            currentTimeSpan = document.getElementById('currentTime');
            totalTimeSpan = document.getElementById('totalTime');
            const mVol = document.getElementById('masterVolume');

            mVol.value = globalMasterVolume;
            mVol.oninput = (e) => {
                globalMasterVolume = parseFloat(e.target.value);
                tracks.forEach(t => t.setMasterVolume(globalMasterVolume));
            };

            const tWrapper = document.getElementById('tracks-wrapper');
            const colors = { 'vocals': '#FF4081', 'drums': '#00E676', 'bass': '#FFD740', 'other': '#7C4DFF' };
            tracks = [];

            files.forEach(url => {
                const lowerUrl = url.toLowerCase();
                let stem = 'other';
                if (lowerUrl.includes('vocals')) stem = 'vocals';
                else if (lowerUrl.includes('drums')) stem = 'drums';
                else if (lowerUrl.includes('bass')) stem = 'bass';
                else if (lowerUrl.includes('other')) stem = 'other';
                const color = colors[stem] || '#7C4DFF';
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
        }, 50);
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

        transitionViews(resultsArea, uploadUi, () => {
            appHeaderElement.classList.remove('hidden');
            glassCard.classList.remove('expanded');

            tracks.forEach(t => { if (t.wavesurfer) t.wavesurfer.destroy(); });
            tracks = [];
            resultsArea.innerHTML = '';

            resetUI();
            currentSongData = null;
        });
    }
});