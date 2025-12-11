import { TrackComponent } from './components/TrackComponent.js';

document.addEventListener('DOMContentLoaded', () => {

    // 1. DOM
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('fileInput');
    const youtubeInput = document.getElementById('youtubeInput');
    const youtubeBtn = document.getElementById('youtubeBtn');

    const formatSelect = document.getElementById('formatSelect');
    const loader = document.getElementById('loader');
    const loaderText = document.getElementById('loader-text');
    const resultsArea = document.getElementById('results-area');

    const youtubeBox = document.querySelector('.youtube-box');
    const divider = document.querySelector('.divider');
    const appHeader = document.querySelector('.app-header');

    const formatContainer = document.querySelector('.format-selector-container');

    let tracks = [];
    let isPlaying = false;
    let globalDuration = 0;
    let progressInterval = null;
    let btnPlayPause, btnStop, currentTimeSpan, totalTimeSpan;
    let sortableInstance = null;
    let globalMasterVolume = 1.0;

    // 2. Listeners
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
            dropZone.style.backgroundColor = 'rgba(0,0,0,0.3)';
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


    // 3. API
    async function handleUpload(file) {
        showLoader("Subiendo y procesando audio...");
        const formData = new FormData();
        formData.append('audioFile', file);
        formData.append('format', formatSelect.value);

        try {
            const response = await fetch('/api/upload', { method: 'POST', body: formData });
            if (!response.ok) throw new Error('Error Servidor');
            const data = await response.json();
            initDAW(data.files, data.originalName, data.zip, data.instrumental);
        } catch (error) { console.error(error); alert(error.message); resetUI(); }
    }

    async function handleYoutube(url) {
        showLoader("Procesando YouTube...");
        try {
            const response = await fetch('/api/youtube', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    youtubeUrl: url,
                    format: formatSelect.value
                })
            });
            if (!response.ok) throw new Error('Error Conexión');
            const data = await response.json();
            initDAW(data.files, data.originalName, data.zip, data.instrumental);
        } catch (error) { console.error(error); alert(error.message); resetUI(); }
    }

    // 4. UI Helpers
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
        dropZone.classList.remove('hidden');
        youtubeBox.classList.remove('hidden');
        divider.classList.remove('hidden');
        if (formatContainer) formatContainer.style.display = 'flex';

        fileInput.value = ''; youtubeInput.value = '';
        dropZone.style.borderColor = 'rgba(255, 255, 255, 0.15)';
    }

    // 5. DAW Init
    function initDAW(filesUrls, originalName, zipUrl = null, instrumentalUrl = null) {
        loader.classList.add('hidden');
        appHeader.classList.add('hidden');

        const glassCard = document.querySelector('.glass-card');
        glassCard.classList.add('expanded');

        setTimeout(() => { resultsArea.classList.remove('hidden'); }, 300);

        const safeTitle = originalName ? originalName.replace(/\.[^/.]+$/, "") : "Mix";

        // ESTILO UNIFICADO (Sutil/Ghost)
        const commonStyle = `
            display: flex; align-items: center; gap: 6px; text-decoration: none;
            color: rgba(255, 255, 255, 0.6); border: 1px solid rgba(255, 255, 255, 0.2);
            background: rgba(255, 255, 255, 0.05); padding: 5px 12px; border-radius: 20px;
            font-size: 0.8rem; transition: all 0.2s ease;
        `;

        const hoverJs = "this.style.borderColor='rgba(255,255,255,0.8)'; this.style.color='white'; this.style.background='rgba(255,255,255,0.1)'";
        const outJs = "this.style.borderColor='rgba(255,255,255,0.2)'; this.style.color='rgba(255,255,255,0.6)'; this.style.background='rgba(255,255,255,0.05)'";

        // --- BOTÓN INSTRUMENTAL ---
        const instrButtonHTML = instrumentalUrl ? `
            <a href="${instrumentalUrl}" download target="_blank" 
               style="${commonStyle}"
               onmouseover="${hoverJs}"
               onmouseout="${outJs}"
               title="Descargar Instrumental">
                <span class="material-icons" style="font-size: 16px;">download</span>
                <span>Instrumental</span>
            </a>
        ` : '';

        // --- BOTÓN ZIP ---
        const zipButtonHTML = zipUrl ? `
            <a href="${zipUrl}" download target="_blank" 
               style="${commonStyle}"
               onmouseover="${hoverJs}"
               onmouseout="${outJs}"
               title="Descargar Todo">
                <span class="material-icons" style="font-size: 16px;">download</span>
                <span>ZIP</span>
            </a>
        ` : '';

        resultsArea.innerHTML = `
            <div class="player-header">
                
                <div class="player-top-row">
                    <div class="player-title-container">
                        <span class="player-title-text" id="playerTitle">${safeTitle}</span>
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

        const stemConfig = {
            'karaoke': { color: '#00FFFF' },
            'vocals': { color: '#FF4081' },
            'drums': { color: '#00E676' },
            'bass': { color: '#FFD740' },
            'other': { color: '#7C4DFF' }
        };

        tracks = [];

        filesUrls.forEach((url) => {
            const filename = url.split('/').pop().toLowerCase();
            let stemName = 'unknown';

            if (filename.startsWith('karaoke')) stemName = 'karaoke';
            else if (filename.startsWith('vocals')) stemName = 'vocals';
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
    }
});