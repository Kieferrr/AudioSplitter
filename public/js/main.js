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

    if (glassCard) glassCard.style.position = 'relative';

    // Referencias UI
    const appHeaderElement = document.querySelector('.app-header');
    const uploadUi = document.getElementById('upload-ui');
    const resultsArea = document.getElementById('results-area');

    // --- VARIABLES GLOBALES ---
    let tracks = [];
    let isPlaying = false;
    let globalDuration = 0;
    let progressInterval = null;
    let visualTimerInterval = null;
    let currentSongData = null;
    let sortableInstance = null;
    let globalMasterVolume = 1.0;
    let btnPlayPause, btnStop, currentTimeSpan, totalTimeSpan;

    // --- TRANSICIONES ---
    const transitionViews = (oldElem, newElem, onComplete = () => { }) => {
        if (oldElem && !oldElem.classList.contains('hidden')) {
            oldElem.classList.add('fade-out');
            oldElem.classList.remove('fade-in');
            setTimeout(() => {
                oldElem.classList.add('hidden');
                oldElem.classList.remove('fade-out');
                onComplete();
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

    // --- HEADER USUARIO (CON CRÉDITOS VISIBLES) ---
    const updateHeaderWithUser = async (user) => {

        let userPanel = document.getElementById('user-panel');
        let isNew = false;

        if (!userPanel) {
            isNew = true;
            userPanel = document.createElement('div');
            userPanel.id = 'user-panel';
            userPanel.style.display = 'flex';
            userPanel.style.alignItems = 'center';
            userPanel.style.whiteSpace = 'nowrap';

            // ESTILOS CÁPSULA
            userPanel.style.background = 'rgba(255, 255, 255, 0.08)';
            userPanel.style.backdropFilter = 'blur(12px)';
            userPanel.style.border = '1px solid rgba(255, 255, 255, 0.1)';
            userPanel.style.borderRadius = '50px';
            userPanel.style.padding = '6px 16px';
            userPanel.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';

            userPanel.style.position = 'absolute';
            userPanel.style.top = '25px';
            userPanel.style.zIndex = '10';

            userPanel.style.transition = 'transform 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.6s ease, left 0.5s ease';
            userPanel.style.opacity = '0';
        }

        const isExpanded = glassCard.classList.contains('expanded');
        let targetLeft, targetTransformFinal, targetTransformInitial;

        if (isExpanded) {
            targetLeft = '25px';
            targetTransformFinal = 'translateX(0) scale(1)';
            targetTransformInitial = 'translateX(0) scale(0.8)';
        } else {
            targetLeft = '50%';
            targetTransformFinal = 'translateX(-50%) scale(1)';
            targetTransformInitial = 'translateX(-50%) scale(0.8)';
        }

        if (user) {
            let finalDisplayName = user.displayName || "Usuario";
            let credits = 0; // Valor por defecto

            try {
                // Siempre consultamos para tener los créditos frescos
                const dbData = await authService.getUserData(user.uid);
                if (dbData) {
                    if (dbData.username || dbData.displayName) {
                        finalDisplayName = dbData.username || dbData.displayName;
                    }
                    // Leemos los créditos (si no existen, asumimos 0)
                    credits = dbData.credits !== undefined ? dbData.credits : 0;
                }
            } catch (e) { console.warn(e); }

            userPanel.innerHTML = `
            <button id="btnLibrary" class="header-btn">
                <span class="material-icons">library_music</span> Mis Canciones
            </button>
            <div class="v-divider"></div>
            
            <div style="display: flex; flex-direction: column; align-items: flex-start; margin-right: 5px;">
                <span class="user-email" style="font-weight: 600; line-height: 1.1;">${finalDisplayName}</span>
                <span style="font-size: 0.7rem; color: var(--accent-color); font-weight: 500;">${credits} créditos</span>
            </div>

            <button id="btnSettings" class="header-btn" style="margin-left: 10px;" title="Ajustes">
                <span class="material-icons">settings</span>
            </button>
            <button id="btnLogout" class="logout-btn" title="Salir" style="margin-left: 5px;">
                <span class="material-icons">logout</span>
            </button>
            `;

            // Listeners
            const btnLogout = userPanel.querySelector('#btnLogout');
            if (btnLogout) btnLogout.onclick = async () => { await authService.logout(); showLogin(); };

            const btnLibrary = userPanel.querySelector('#btnLibrary');
            if (btnLibrary) btnLibrary.onclick = () => {
                new LibraryModal(user.uid, (songData) => {
                    resetApplication();
                    setTimeout(() => {
                        currentSongData = songData;
                        initDAW(songData.urls, songData.title, songData.zip, songData.instrumental, songData.bpm, songData.key, true);
                    }, 350);
                });
            };

            const btnSettings = userPanel.querySelector('#btnSettings');
            if (btnSettings) btnSettings.onclick = () => { new SettingsModal(user, () => showLogin()); };

        } else {
            userPanel.style.gap = '10px';
            userPanel.innerHTML = `
                <span class="user-email" style="color: #aaa; font-size: 0.8rem;">Invitado</span>
                <button id="btnLoginGuestBack" class="btn-login-guest" style="padding: 4px 12px; font-size: 0.75rem;">
                    Iniciar Sesión
                </button>
            `;
            const btnGuest = userPanel.querySelector('#btnLoginGuestBack');
            if (btnGuest) btnGuest.onclick = () => showLogin();
        }

        if (isNew) {
            userPanel.style.left = targetLeft;
            userPanel.style.transform = targetTransformInitial;
            glassCard.appendChild(userPanel);

            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    userPanel.style.opacity = '1';
                    userPanel.style.left = targetLeft;
                    userPanel.style.transform = targetTransformFinal;
                });
            });
        } else {
            requestAnimationFrame(() => {
                userPanel.style.opacity = '1';
                userPanel.style.left = targetLeft;
                userPanel.style.transform = targetTransformFinal;
            });
        }
    };

    const showApp = (user) => {
        if (!appContainer.classList.contains('hidden') && currentUser?.uid === user.uid) return;
        currentUser = user;
        updateHeaderWithUser(user);
        if (!appContainer.classList.contains('hidden')) return;
        transitionViews(authContainer, appContainer, () => { authContainer.innerHTML = ''; });
    };

    const showLogin = () => {
        currentUser = null;
        if (!authContainer.classList.contains('hidden') && appContainer.classList.contains('hidden')) return;
        transitionViews(appContainer, authContainer, () => {
            resetApplication();
            glassCard.classList.remove('expanded');

            const p = document.getElementById('user-panel');
            if (p) {
                // Animación de salida: encoger y desaparecer
                p.style.transform = p.style.transform.replace('scale(1)', 'scale(0.8)');
                p.style.opacity = '0';
                setTimeout(() => p.remove(), 300);
            }

            new AuthComponent(authContainer, (user) => showApp(user), () => showApp(null));
        });
    };

    // --- OBSERVER ---
    authService.observeAuthState((user) => {
        if (user) showApp(user);
        else showLogin();
    });

    // --- UPLOAD ---
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('fileInput');
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
    ['dragenter', 'dragover'].forEach(e => dropZone.addEventListener(e, (ev) => { ev.preventDefault(); dropZone.classList.add('drag-active'); }));
    ['dragleave', 'drop'].forEach(e => dropZone.addEventListener(e, (ev) => { ev.preventDefault(); dropZone.classList.remove('drag-active'); }));
    dropZone.addEventListener('drop', (e) => { if (e.dataTransfer.files.length) handleUpload(e.dataTransfer.files[0]); });

    function estimateProcessingTime(dur, fmt) { return (dur * 0.9) + (fmt === 'wav' ? 60 : 30); }
    function getAudioDuration(file) {
        return new Promise(r => {
            const u = URL.createObjectURL(file), a = new Audio(u);
            a.onloadedmetadata = () => { URL.revokeObjectURL(u); r(a.duration); };
            a.onerror = () => r(180);
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
        const dur = await getAudioDuration(file), fmt = formatSelect.value;
        loaderText.textContent = `Procesando: ${file.name}`;
        startProgressTimer(estimateProcessingTime(dur, fmt));
        const fd = new FormData(); fd.append('audioFile', file); fd.append('format', fmt);

        try {
            const res = await fetch('/api/upload', { method: 'POST', body: fd });
            if (!res.ok) throw new Error('Error servidor');
            const data = await res.json();
            currentSongData = { ...data, format: fmt };
            stopProgressTimer();
            initDAW(data.files, data.originalName, data.zip, data.instrumental, data.bpm, data.key, false);
        } catch (e) {
            console.error(e); stopProgressTimer();
            Swal.fire({ icon: 'error', title: 'Error', text: e.message });
            resetUI();
        }
    }

    function showLoader(txt) { loaderText.textContent = txt; transitionViews(uploadUi, loader); }
    function resetUI() { loader.classList.add('hidden'); progressBarContainer.style.display = 'none'; uploadUi.classList.remove('hidden'); fileInput.value = ''; }

    function initDAW(files, name, zip, inst, bpm, key, isSaved = false) {
        const safeName = name ? name.replace(/\.[^/.]+$/, "") : "Mix";
        const saveBtnHTML = (currentUser && !isSaved) ? `<button id="btnSaveToCloud" class="action-btn"><span class="material-icons">cloud_upload</span> Guardar</button>` : '';
        const bpmBadge = bpm > 0 ? `<div class="badges-container"><span class="badge-info">BPM ${bpm}</span><span class="badge-info">KEY ${key}</span></div>` : '';

        resultsArea.innerHTML = `
            <div class="player-header">
                <div class="player-top-row">
                    <div class="player-title-container"><div class="player-title-mask"><span class="player-title-text">${safeName}</span></div>${bpmBadge}</div>
                    <div class="actions-right">
                        ${saveBtnHTML}
                        ${inst ? `<a href="${inst}" download class="action-btn"><span class="material-icons">download</span> Instrumental</a>` : ''}
                        ${zip ? `<a href="${zip}" download class="action-btn"><span class="material-icons">download</span> ZIP</a>` : ''}
                        <button id="btnReset" class="action-btn black-btn"><span class="material-icons">add</span> Nuevo</button>
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

            // REUTILIZAR EL PANEL (Esto lo moverá a la izquierda)
            if (currentUser) updateHeaderWithUser(currentUser);
        });

        setTimeout(() => {
            document.getElementById('btnReset').onclick = resetApplication;
            if (document.getElementById('btnSaveToCloud')) {
                document.getElementById('btnSaveToCloud').addEventListener('click', async (e) => {
                    const b = e.currentTarget, orig = b.innerHTML;
                    b.disabled = true; b.innerHTML = '<span class="material-icons icon-spin">sync</span> ...';
                    try {
                        await dbService.saveSong(currentUser.uid, currentSongData);
                        Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Guardado', showConfirmButton: false, timer: 2000, background: '#1a1a1a', color: '#fff' });
                        b.remove();
                    } catch (e) {
                        Swal.fire({ icon: 'error', text: e.message }); b.disabled = false; b.innerHTML = orig;
                    }
                });
            }

            btnPlayPause = document.getElementById('btnPlayPause'); btnStop = document.getElementById('btnStop');
            currentTimeSpan = document.getElementById('currentTime'); totalTimeSpan = document.getElementById('totalTime');
            const mVol = document.getElementById('masterVolume');
            mVol.value = globalMasterVolume; mVol.oninput = (e) => { globalMasterVolume = parseFloat(e.target.value); tracks.forEach(t => t.setMasterVolume(globalMasterVolume)); };

            const tWrapper = document.getElementById('tracks-wrapper');
            tracks = [];
            const colors = { 'vocals': '#FF4081', 'drums': '#00E676', 'bass': '#FFD740', 'other': '#7C4DFF' };
            files.forEach(url => {
                let stem = 'other';
                if (url.includes('vocals')) stem = 'vocals'; else if (url.includes('drums')) stem = 'drums'; else if (url.includes('bass')) stem = 'bass';
                tracks.push(new TrackComponent(tWrapper, stem, url, colors[stem] || '#7C4DFF'));
            });

            const checkInt = setInterval(() => {
                if (tracks[0] && tracks[0].isReady()) {
                    globalDuration = tracks[0].wavesurfer.getDuration(); totalTimeSpan.textContent = formatTime(globalDuration); clearInterval(checkInt);
                }
            }, 500);

            if (typeof Sortable !== 'undefined' && sortableInstance) sortableInstance.destroy();
            if (typeof Sortable !== 'undefined') try { sortableInstance = new Sortable(tWrapper, { animation: 250, handle: '.drag-handle', ghostClass: 'sortable-ghost' }); } catch (e) { }

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
            if (req.isSolo) tracks.forEach(t => { if (t.name !== req.name) t.disableSolo(); }); refreshMuteState();
        });
        c.addEventListener('track-mute', refreshMuteState);
        c.addEventListener('track-seek', (e) => { tracks.forEach(t => { if (t.name !== e.detail.sourceTrack) t.seekTo(e.detail.progress); }); currentTimeSpan.textContent = formatTime(globalDuration * e.detail.progress); });
    }

    function refreshMuteState() {
        const anySolo = tracks.some(t => t.isSolo);
        tracks.forEach(t => { let silent = false; if (anySolo) { if (!t.isSolo) silent = true; } else { if (t.isMuted) silent = true; } t.setSilent(silent); });
    }

    function startTimer() {
        if (progressInterval) clearInterval(progressInterval);
        progressInterval = setInterval(() => {
            if (!tracks.length) return;
            const cur = tracks[0].wavesurfer.getCurrentTime(); currentTimeSpan.textContent = formatTime(cur);
            if (globalDuration > 0 && cur >= globalDuration) btnStop.click();
        }, 100);
    }
    function formatTime(s) { if (!s) return "00:00"; const m = Math.floor(s / 60), sc = Math.floor(s % 60); return `${m.toString().padStart(2, '0')}:${sc.toString().padStart(2, '0')}`; }

    function resetApplication() {
        if (isPlaying && btnStop) btnStop.click();
        transitionViews(resultsArea, uploadUi, () => {
            appHeaderElement.classList.remove('hidden'); glassCard.classList.remove('expanded');
            tracks.forEach(t => { if (t.wavesurfer) t.wavesurfer.destroy(); }); tracks = []; resultsArea.innerHTML = '';
            resetUI(); currentSongData = null;
            // REUTILIZAR EL PANEL (Esto lo moverá al centro)
            if (currentUser) updateHeaderWithUser(currentUser);
        });
    }
});