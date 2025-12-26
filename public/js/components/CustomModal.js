export const CustomModal = {
    // 1. CONFIRMACIÓN (Sí / No)
    confirm(title, text, confirmText = "Confirmar", cancelText = "Cancelar") {
        return new Promise((resolve) => {
            const overlay = this._createOverlay(title, text, confirmText, cancelText, true);
            document.body.appendChild(overlay);
            requestAnimationFrame(() => overlay.classList.add('active'));

            const close = (result) => {
                overlay.classList.remove('active');
                setTimeout(() => { overlay.remove(); resolve(result); }, 300);
            };

            overlay.querySelector('.btn-confirm').onclick = () => close(true);
            overlay.querySelector('.btn-cancel').onclick = () => close(false);
            overlay.onclick = (e) => { if (e.target === overlay) close(false); };
        });
    },

    // 2. ALERTA SIMPLE (Solo botón OK)
    alert(title, text, btnText = "Entendido") {
        return new Promise((resolve) => {
            // Usamos la misma estructura pero escondemos el botón cancelar
            const overlay = this._createOverlay(title, text, btnText, '', false);
            document.body.appendChild(overlay);
            requestAnimationFrame(() => overlay.classList.add('active'));

            const close = () => {
                overlay.classList.remove('active');
                setTimeout(() => { overlay.remove(); resolve(true); }, 300);
            };

            overlay.querySelector('.btn-confirm').onclick = close;
            overlay.onclick = (e) => { if (e.target === overlay) close(); };
        });
    },

    // 3. TOAST (Notificación de esquina)
    toast(text, type = 'success') {
        const icons = { success: 'check_circle', error: 'error', info: 'info' };
        const icon = icons[type] || 'info';

        const toast = document.createElement('div');
        toast.className = 'custom-toast';
        toast.innerHTML = `
            <span class="material-icons toast-icon toast-${type}">${icon}</span>
            <span>${text}</span>
        `;

        document.body.appendChild(toast);

        // Animación Entrada
        requestAnimationFrame(() => toast.classList.add('active'));

        // Salida automática
        setTimeout(() => {
            toast.classList.remove('active');
            setTimeout(() => toast.remove(), 400);
        }, 3000); // Dura 3 segundos
    },

    // --- HELPER PRIVADO PARA NO REPETIR HTML ---
    _createOverlay(title, text, confirmBtn, cancelBtn, showCancel) {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';

        const cancelHTML = showCancel ? `<button class="modal-btn btn-cancel">${cancelBtn}</button>` : '';

        overlay.innerHTML = `
            <div class="modal-glass-card">
                <div class="modal-title">${title}</div>
                <div class="modal-text">${text}</div>
                <div class="modal-actions">
                    ${cancelHTML}
                    <button class="modal-btn btn-confirm">${confirmBtn}</button>
                </div>
            </div>
        `;
        return overlay;
    }
};