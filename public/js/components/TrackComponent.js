export class TrackComponent {
    constructor(container, name, url, color) {
        this.container = container;
        this.name = name;
        this.url = url;
        this.color = color || '#5c5cec';
        this.wavesurfer = null;
        this.isMuted = false;
        this.isSolo = false;

        this.userVolume = 1.0;
        this.currentMasterVolume = 1.0;

        this.element = this.createDOM();
        this.container.appendChild(this.element);
        this.initWaveSurfer();
    }

    createDOM() {
        const div = document.createElement('div');
        div.className = 'track-row';

        div.innerHTML = `
            <div class="drag-handle" title="Arrastrar para ordenar">
                <span class="material-icons" style="font-size: 18px;">drag_indicator</span>
            </div>

            <div class="track-controls">
                <div class="track-header">
                    <span class="material-icons" style="font-size: 16px; color: ${this.color}">graphic_eq</span>
                    ${this.name.toUpperCase()}
                </div>
                
                <div class="track-actions">
                    <button class="btn-small" id="btnMute" title="Silenciar">M</button>
                    <button class="btn-small" id="btnSolo" title="Solo">S</button>
                    <button class="btn-small" id="btnDownload" title="Descargar">
                        <span class="material-icons" style="font-size: 14px;">download</span>
                    </button>
                </div>
                
                <input type="range" id="volumeSlider" min="0" max="1" step="0.01" value="1" title="Volumen Pista">
            </div>
            
            <div class="track-waveform" id="waveform-${this.name}" style="position: relative;">
                <div class="hover-tooltip" data-tooltip>00:00</div>
            </div>
        `;

        // Listeners
        div.querySelector('#btnMute').onclick = (e) => this.toggleMute(e.target);

        div.querySelector('#volumeSlider').oninput = (e) => {
            this.userVolume = parseFloat(e.target.value);
            this.updateEffectiveVolume();
        };

        div.querySelector('#btnSolo').onclick = (e) => {
            this.toggleSoloState();
            const event = new CustomEvent('track-solo', { detail: { name: this.name }, bubbles: true });
            this.container.dispatchEvent(event);
        };
        div.querySelector('#btnDownload').onclick = () => { window.open(this.url, '_blank'); };

        return div;
    }

    initWaveSurfer() {
        const waveformContainer = this.element.querySelector(`#waveform-${this.name}`);
        const tooltip = this.element.querySelector('[data-tooltip]');

        this.wavesurfer = WaveSurfer.create({
            container: waveformContainer,
            waveColor: this.color,
            progressColor: 'rgba(255, 255, 255, 0.4)',
            url: this.url,
            height: 100,
            normalize: true,
            interact: true,
            cursorColor: '#ffffff',
            cursorWidth: 2,
            hideScrollbar: true,
            barWidth: 2,
            barGap: 1,
            barRadius: 2
        });

        this.wavesurfer.on('interaction', (newTime) => {
            const duration = this.wavesurfer.getDuration();
            const progress = newTime / duration;
            const event = new CustomEvent('track-seek', {
                detail: { progress: progress, sourceTrack: this.name },
                bubbles: true
            });
            this.container.dispatchEvent(event);
        });

        waveformContainer.addEventListener('mousemove', (e) => {
            const duration = this.wavesurfer.getDuration();
            if (!duration) return;
            const rect = waveformContainer.getBoundingClientRect();
            const offsetX = e.clientX - rect.left;
            const hoverTime = (offsetX / rect.width) * duration;
            tooltip.textContent = this.formatTime(hoverTime);
            tooltip.style.left = `${offsetX}px`;
            tooltip.style.display = 'block';
        });

        waveformContainer.addEventListener('mouseleave', () => {
            tooltip.style.display = 'none';
        });
    }

    setMasterVolume(val) {
        this.currentMasterVolume = val;
        this.updateEffectiveVolume();
    }

    updateEffectiveVolume() {
        if (!this.wavesurfer) return;
        const effectiveVol = this.userVolume * this.currentMasterVolume;
        this.wavesurfer.setVolume(effectiveVol);
    }

    formatTime(seconds) {
        if (!seconds || seconds < 0) return "00:00";
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    // --- LÓGICA DE ESTADO (Dispara Eventos) ---

    toggleMute(btn) {
        this.isMuted = !this.isMuted;

        // Exclusividad: Si Mute ON, Solo OFF
        if (this.isMuted && this.isSolo) {
            this.isSolo = false;
            const btnSolo = this.element.querySelector('#btnSolo');
            if (btnSolo) btnSolo.classList.remove('solo-active');
        }

        if (btn) btn.classList.toggle('mute-active', this.isMuted);

        // Avisamos al Main
        const event = new CustomEvent('track-mute', { detail: { name: this.name }, bubbles: true });
        this.container.dispatchEvent(event);
    }

    toggleSoloState() {
        this.isSolo = !this.isSolo;
        const btnSolo = this.element.querySelector('#btnSolo');

        // Exclusividad: Si Solo ON, Mute OFF
        if (this.isSolo && this.isMuted) {
            this.isMuted = false;
            const btnMute = this.element.querySelector('#btnMute');
            if (btnMute) btnMute.classList.remove('mute-active');

            // Refrescar estado visual de mute
            const event = new CustomEvent('track-mute', { detail: { name: this.name }, bubbles: true });
            this.container.dispatchEvent(event);
        }

        btnSolo.classList.toggle('solo-active', this.isSolo);
    }

    disableSolo() {
        if (this.isSolo) {
            this.isSolo = false;
            const btn = this.element.querySelector('#btnSolo');
            btn.classList.remove('solo-active');
        }
    }

    // --- LÓGICA VISUAL FINAL (Recibe Órdenes) ---
    setSilent(shouldBeSilent) {
        // Silencio de audio real
        this.wavesurfer.setMuted(shouldBeSilent);

        // Cambio visual (Gris/Color)
        const waveformDiv = this.element.querySelector(`#waveform-${this.name}`);
        if (shouldBeSilent) {
            waveformDiv.classList.add('waveform-muted');
        } else {
            waveformDiv.classList.remove('waveform-muted');
        }
    }

    play() { this.wavesurfer.play(); }
    pause() { this.wavesurfer.pause(); }
    stop() { this.wavesurfer.stop(); }
    seekTo(progress) { this.wavesurfer.seekTo(progress); }
    isReady() { return this.wavesurfer.getDuration() > 0; }
}