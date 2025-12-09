export class TrackComponent {
    constructor(container, name, url, color) {
        this.container = container;
        this.name = name;
        this.url = url;
        this.color = color || '#5c5cec';
        this.wavesurfer = null;
        this.isMuted = false;
        this.isSolo = false;

        this.element = this.createDOM();
        this.container.appendChild(this.element);
        this.initWaveSurfer();
    }

    createDOM() {
        const div = document.createElement('div');
        div.className = 'track-row';
        div.innerHTML = `
            <div class="track-controls">
                <div class="track-header">
                    <span class="material-icons" style="font-size: 16px; color: ${this.color}">graphic_eq</span>
                    ${this.name.toUpperCase()}
                </div>
                <div class="track-actions">
                    <button class="btn-small" id="btnMute" title="Mute">M</button>
                    <button class="btn-small" id="btnSolo" title="Solo">S</button>
                </div>
                <input type="range" id="volumeSlider" min="0" max="1" step="0.01" value="1" title="Volumen">
            </div>
            
            <div class="track-waveform" id="waveform-${this.name}">
                <div class="hover-tooltip" data-tooltip>00:00</div>
            </div>
        `;

        div.querySelector('#btnMute').onclick = (e) => this.toggleMute(e.target);
        div.querySelector('#volumeSlider').oninput = (e) => this.setVolume(e.target.value);

        div.querySelector('#btnSolo').onclick = (e) => {
            this.toggleSoloState();
            const event = new CustomEvent('track-solo', {
                detail: { name: this.name },
                bubbles: true
            });
            this.container.dispatchEvent(event);
        };

        return div;
    }

    initWaveSurfer() {
        const waveformContainer = this.element.querySelector(`#waveform-${this.name}`);
        // Seleccionamos por el atributo data-tooltip que pusimos arriba
        const tooltip = this.element.querySelector('[data-tooltip]');

        this.wavesurfer = WaveSurfer.create({
            container: waveformContainer,
            waveColor: this.color,
            progressColor: 'rgba(255, 255, 255, 0.3)',
            url: this.url,
            height: 100,
            normalize: true,
            interact: true,
            cursorColor: '#5c5cec',
            cursorWidth: 2,
            hideScrollbar: true,
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
            const width = rect.width;

            const hoverTime = (offsetX / width) * duration;

            tooltip.textContent = this.formatTime(hoverTime);
            tooltip.style.left = `${offsetX}px`;
            tooltip.style.display = 'block';
        });

        waveformContainer.addEventListener('mouseleave', () => {
            tooltip.style.display = 'none';
        });
    }

    formatTime(seconds) {
        if (!seconds || seconds < 0) return "00:00";
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    toggleMute(btn) {
        this.isMuted = !this.isMuted;
        this.wavesurfer.setMuted(this.isMuted);
        if (btn) btn.classList.toggle('mute-active', this.isMuted);
    }

    toggleSoloState() {
        this.isSolo = !this.isSolo;
        const btn = this.element.querySelector('#btnSolo');
        btn.classList.toggle('solo-active', this.isSolo);
    }

    disableSolo() {
        if (this.isSolo) {
            this.isSolo = false;
            const btn = this.element.querySelector('#btnSolo');
            btn.classList.remove('solo-active');
        }
    }

    setSilent(shouldBeSilent) {
        if (shouldBeSilent) {
            this.wavesurfer.setMuted(true);
            this.element.style.opacity = "0.4";
        } else {
            this.wavesurfer.setMuted(this.isMuted);
            this.element.style.opacity = "1";
        }
    }

    setVolume(value) { this.wavesurfer.setVolume(value); }
    play() { this.wavesurfer.play(); }
    pause() { this.wavesurfer.pause(); }
    stop() { this.wavesurfer.stop(); }
    seekTo(progress) { this.wavesurfer.seekTo(progress); }
    isReady() { return this.wavesurfer.getDuration() > 0; }
}