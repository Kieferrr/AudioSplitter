import { dbService } from '../services/dbService.js';

export class LibraryModal {
    constructor(userId, onLoadSong) {
        this.userId = userId;
        this.onLoadSong = onLoadSong; // Función que cargará la canción en el DAW
        this.overlay = null;
        this.render();
    }

    async render() {
        // 1. Crear el fondo oscuro (Overlay)
        this.overlay = document.createElement('div');
        this.overlay.className = 'modal-overlay';
        this.overlay.innerHTML = `
            <div class="glass-card modal-content">
                <div class="modal-header">
                    <h3>🎵 Mi Biblioteca</h3>
                    <button id="btnCloseModal" class="btn-icon"><span class="material-icons">close</span></button>
                </div>
                <div id="songsList" class="songs-list">
                    <div class="spinner" style="margin: 20px auto;"></div>
                </div>
            </div>
        `;
        document.body.appendChild(this.overlay);

        // 2. Listeners
        this.overlay.querySelector('#btnCloseModal').addEventListener('click', () => this.close());

        // Cerrar si clicamos fuera de la tarjeta
        this.overlay.addEventListener('click', (e) => {
            if (e.target === this.overlay) this.close();
        });

        // 3. Cargar datos
        await this.loadSongs();
    }

    async loadSongs() {
        const listContainer = this.overlay.querySelector('#songsList');
        try {
            const songs = await dbService.getUserSongs(this.userId);

            if (songs.length === 0) {
                listContainer.innerHTML = `<p style="text-align:center; color: #aaa; padding: 20px;">Aún no tienes canciones guardadas.</p>`;
                return;
            }

            listContainer.innerHTML = ''; // Limpiar spinner

            songs.forEach(song => {
                const item = document.createElement('div');
                item.className = 'song-item';

                // Formatear fecha
                const date = song.createdAt ? new Date(song.createdAt.seconds * 1000).toLocaleDateString() : 'Reciente';

                item.innerHTML = `
                    <div class="song-info">
                        <div class="song-title">${song.title}</div>
                        <div class="song-meta">
                            <span>${date}</span> • 
                            <span style="text-transform: uppercase;">${song.format}</span> • 
                            <span>${song.bpm > 0 ? song.bpm + ' BPM' : ''}</span>
                        </div>
                    </div>
                    <button class="btn-load">
                        <span class="material-icons">play_circle</span> Cargar
                    </button>
                `;

                // Acción de Cargar
                item.querySelector('.btn-load').addEventListener('click', () => {
                    this.onLoadSong(song); // Pasamos los datos al main.js
                    this.close();
                });

                listContainer.appendChild(item);
            });

        } catch (error) {
            console.error(error);
            listContainer.innerHTML = `<p style="color: #ff5252; text-align:center;">Error cargando canciones.</p>`;
        }
    }

    close() {
        if (this.overlay) {
            this.overlay.remove();
            this.overlay = null;
        }
    }
}