import { dbService } from '../services/dbService.js';
import { CustomModal } from './CustomModal.js'; // <--- IMPORTANTE

export class LibraryModal {
    constructor(userId, onLoadSong) {
        this.userId = userId;
        this.onLoadSong = onLoadSong;
        this.songs = [];
        this.render();
        this.loadSongs();
    }

    render() {
        // Estructura Base (Overlay)
        this.overlay = document.createElement('div');
        this.overlay.className = 'modal-overlay';

        this.overlay.innerHTML = `
            <div class="modal-glass-card" style="width: 95%; max-width: 600px; height: 80vh; display: flex; flex-direction: column; padding: 0;">
                
                <div style="padding: 20px; border-bottom: 1px solid rgba(255,255,255,0.1); display: flex; justify-content: space-between; align-items: center;">
                    <h3 style="margin: 0; font-size: 1.2rem;">Mis Canciones</h3>
                    <button id="btnCloseLib" style="background: none; border: none; color: #fff; cursor: pointer;">
                        <span class="material-icons">close</span>
                    </button>
                </div>

                <div id="songsList" style="flex: 1; overflow-y: auto; padding: 20px;">
                    <div style="text-align: center; color: #888; margin-top: 50px;">
                        <span class="material-icons icon-spin">sync</span> Cargando...
                    </div>
                </div>

            </div>
        `;

        document.body.appendChild(this.overlay);
        requestAnimationFrame(() => this.overlay.classList.add('active'));

        // Evento Cerrar
        const closeBtn = this.overlay.querySelector('#btnCloseLib');
        closeBtn.onclick = () => this.close();
        this.overlay.onclick = (e) => { if (e.target === this.overlay) this.close(); };
    }

    close() {
        this.overlay.classList.remove('active');
        setTimeout(() => this.overlay.remove(), 300);
    }

    async loadSongs() {
        const listContainer = this.overlay.querySelector('#songsList');
        try {
            this.songs = await dbService.getUserSongs(this.userId);
            this.renderList(listContainer);
        } catch (e) {
            console.error(e);
            listContainer.innerHTML = `<div style="text-align: center; color: #FF5252;">Error cargando canciones.</div>`;
        }
    }

    renderList(container) {
        if (this.songs.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; color: #666; margin-top: 50px;">
                    <span class="material-icons" style="font-size: 40px; margin-bottom: 10px;">music_off</span><br>
                    No tienes canciones guardadas.
                </div>`;
            return;
        }

        container.innerHTML = '';

        this.songs.forEach(song => {
            const item = document.createElement('div');
            // Estilos en línea para la lista (puedes pasarlo a CSS luego si quieres)
            item.style.cssText = `
                display: flex; 
                align-items: center; 
                background: rgba(255,255,255,0.05); 
                padding: 12px; 
                margin-bottom: 10px; 
                border-radius: 12px; 
                transition: background 0.2s;
            `;
            item.onmouseover = () => item.style.background = 'rgba(255,255,255,0.1)';
            item.onmouseout = () => item.style.background = 'rgba(255,255,255,0.05)';

            // Fecha formateada
            let dateStr = "Fecha desconocida";
            if (song.createdAt && song.createdAt.seconds) {
                dateStr = new Date(song.createdAt.seconds * 1000).toLocaleDateString();
            }

            item.innerHTML = `
                <div style="width: 40px; height: 40px; background: #333; border-radius: 8px; display: flex; align-items: center; justify-content: center; margin-right: 15px;">
                    <span class="material-icons" style="color: var(--accent-color);">music_note</span>
                </div>
                <div style="flex: 1; text-align: left; cursor: pointer;">
                    <div style="font-weight: 600; font-size: 1rem;">${song.title || "Sin título"}</div>
                    <div style="font-size: 0.75rem; color: #888;">${dateStr} • BPM: ${song.bpm || '?'}</div>
                </div>
                <button class="btn-delete-song" style="background: none; border: none; color: #666; cursor: pointer; padding: 8px; transition: color 0.2s;">
                    <span class="material-icons">delete</span>
                </button>
            `;

            // Click en el cuerpo -> Cargar canción
            item.children[1].onclick = () => {
                this.onLoadSong(song);
                this.close();
                CustomModal.toast(`Cargando "${song.title}"...`, 'info');
            };

            // Click en basurero -> Borrar canción
            const btnDel = item.querySelector('.btn-delete-song');
            btnDel.onmouseover = () => btnDel.style.color = '#FF5252';
            btnDel.onmouseout = () => btnDel.style.color = '#666';

            btnDel.onclick = async (e) => {
                e.stopPropagation(); // Evitar que se cargue la canción al borrar

                // --- CONFIRMACIÓN NUEVA ---
                const confirm = await CustomModal.confirm(
                    '¿Borrar Canción?',
                    `Vas a eliminar <b>"${song.title}"</b> de tu biblioteca.`,
                    'Borrar',
                    'Cancelar'
                );

                if (confirm) {
                    try {
                        // Feedback visual inmediato
                        item.style.opacity = '0.5';
                        item.style.pointerEvents = 'none';

                        await dbService.deleteSong(this.userId, song.id, song);

                        // Eliminar de la lista local y visual
                        this.songs = this.songs.filter(s => s.id !== song.id);
                        this.renderList(container);

                        CustomModal.toast('Canción eliminada', 'success');
                    } catch (err) {
                        console.error(err);
                        CustomModal.alert('Error', 'No se pudo borrar la canción.');
                        item.style.opacity = '1';
                        item.style.pointerEvents = 'all';
                    }
                }
            };

            container.appendChild(item);
        });
    }
}