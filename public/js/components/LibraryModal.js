import { dbService } from '../services/dbService.js';

export class LibraryModal {
    constructor(userId, onLoadSong) {
        this.userId = userId;
        this.onLoadSong = onLoadSong;
        this.overlay = null;
        this.render();
    }

    async render() {
        this.overlay = document.createElement('div');
        this.overlay.className = 'modal-overlay';
        this.overlay.innerHTML = `
            <div class="glass-card modal-content">
                <div class="modal-header">
                    <h3>🎵 Mi Biblioteca</h3>
                    <button id="btnCloseModal" class="btn-icon">
                        <span class="material-icons">close</span>
                    </button>
                </div>
                <div id="songsList" class="songs-list">
                    <div class="spinner" style="margin: 40px auto;"></div>
                </div>
            </div>
        `;
        document.body.appendChild(this.overlay);

        this.overlay.querySelector('#btnCloseModal').addEventListener('click', () => this.close());

        // Cerrar al hacer clic fuera
        this.overlay.addEventListener('click', (e) => {
            if (e.target === this.overlay) this.close();
        });

        await this.loadSongs();
    }

    async loadSongs() {
        const listContainer = this.overlay.querySelector('#songsList');
        try {
            const songs = await dbService.getUserSongs(this.userId);

            if (songs.length === 0) {
                listContainer.innerHTML = `
                    <div style="text-align:center; padding: 40px; color: #666;">
                        <span class="material-icons" style="font-size: 40px; margin-bottom: 10px; display:block;">music_off</span>
                        <p>No tienes canciones guardadas aún.</p>
                    </div>`;
                return;
            }

            listContainer.innerHTML = '';

            songs.forEach(song => {
                const item = document.createElement('div');
                item.className = 'song-item';

                const date = song.createdAt ? new Date(song.createdAt.seconds * 1000).toLocaleDateString() : 'Reciente';

                // HTML ESTRUCTURADO PARA CORTAR TEXTO
                item.innerHTML = `
                    <div class="song-info">
                        <div class="song-title" title="${song.title}">${song.title}</div>
                        <div class="song-meta">${date} • ${song.format.toUpperCase()} • ${song.bpm > 0 ? song.bpm + ' BPM' : ''}</div>
                    </div>
                    
                    <div class="song-actions">
                        <button class="btn-icon-delete" title="Borrar">
                            <span class="material-icons">delete_outline</span>
                        </button>
                        <button class="btn-load">
                            <span class="material-icons" style="font-size: 18px;">play_arrow</span> Cargar
                        </button>
                    </div>
                `;

                // Evento Cargar
                item.querySelector('.btn-load').addEventListener('click', () => {
                    this.onLoadSong(song);
                    this.close();
                });

                // --- AQUÍ ESTÁ EL CAMBIO ---
                // Evento Borrar con SweetAlert2
                item.querySelector('.btn-icon-delete').addEventListener('click', async (e) => {

                    const result = await Swal.fire({
                        title: '¿Estás seguro?',
                        text: `Vas a borrar "${song.title}". No podrás recuperarla.`,
                        icon: 'warning',
                        showCancelButton: true,
                        confirmButtonColor: '#d33',
                        cancelButtonColor: '#3085d6',
                        confirmButtonText: 'Sí, borrar',
                        cancelButtonText: 'Cancelar',
                        background: '#1a1a1a', // Fondo oscuro para que combine
                        color: '#fff'          // Texto blanco
                    });

                    if (result.isConfirmed) {
                        try {
                            // Feedback visual inmediato
                            item.style.opacity = '0.5';
                            item.style.pointerEvents = 'none';

                            // Borramos
                            await dbService.deleteSong(this.userId, song.id, song);

                            // Alerta de éxito pequeña
                            Swal.fire({
                                title: '¡Borrado!',
                                text: 'La canción ha sido eliminada.',
                                icon: 'success',
                                timer: 1500,
                                showConfirmButton: false,
                                background: '#1a1a1a',
                                color: '#fff'
                            });

                            // Recargamos la lista
                            this.loadSongs();

                        } catch (error) {
                            console.error("Error al borrar:", error);
                            Swal.fire({
                                title: 'Error',
                                text: 'No se pudo borrar la canción.',
                                icon: 'error',
                                background: '#1a1a1a',
                                color: '#fff'
                            });
                            // Restauramos el item si falló
                            item.style.opacity = '1';
                            item.style.pointerEvents = 'auto';
                        }
                    }
                });
                // ---------------------------

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