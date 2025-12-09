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
            <div class="track-waveform" id="waveform-${this.name}"></div>
        `;

        div.querySelector('#btnMute').onclick = (e) => this.toggleMute(e.target);
        div.querySelector('#volumeSlider').oninput = (e) => this.setVolume(e.target.value);
        
        div.querySelector('#btnSolo').onclick = (e) => {
            // Lógica interna
            this.toggleSoloState();
            
            // Avisar al padre
            const event = new CustomEvent('track-solo', { 
                detail: { name: this.name },
                bubbles: true 
            });
            this.container.dispatchEvent(event);
        };

        return div;
    }

    initWaveSurfer() {
        this.wavesurfer = WaveSurfer.create({
            container: this.element.querySelector(`#waveform-${this.name}`),
            waveColor: this.color,
            progressColor: 'rgba(255, 255, 255, 0.3)', // Color de lo ya reproducido
            url: this.url,
            height: 100,
            normalize: true,
            
            // --- HABILITAR CLICK Y ADELANTAR ---
            interact: true, 
            cursorColor: '#5c5cec', // Color de la línea de tiempo (Morado)
            cursorWidth: 2,
            hideScrollbar: true,
        });

        // --- SINCRONIZACIÓN GLOBAL AL CLICKEAR ---
        // Cuando el usuario hace click o arrastra en ESTE waveform
        this.wavesurfer.on('interaction', (newTime) => {
            // Calculamos el porcentaje relativo (0 a 1)
            const duration = this.wavesurfer.getDuration();
            const progress = newTime / duration;

            // Emitimos evento para que main.js mueva a TODOS los demás
            const event = new CustomEvent('track-seek', { 
                detail: { progress: progress, sourceTrack: this.name },
                bubbles: true 
            });
            this.container.dispatchEvent(event);
        });
    }

    toggleMute(btn) {
        this.isMuted = !this.isMuted;
        this.wavesurfer.setMuted(this.isMuted);
        if(btn) btn.classList.toggle('mute-active', this.isMuted);
    }

    // Método para cambiar el estado visual e interno del Solo
    toggleSoloState() {
        this.isSolo = !this.isSolo;
        const btn = this.element.querySelector('#btnSolo');
        btn.classList.toggle('solo-active', this.isSolo);
    }

    // Método para apagar el Solo forzosamente (cuando otro track pide exclusividad)
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