import { authService } from '../services/authService.js';
import { CustomModal } from './CustomModal.js';

export class SettingsModal {
    constructor(user, onLogout) {
        this.user = user;
        this.onLogout = onLogout;
        this.render();
    }

    render() {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';

        overlay.innerHTML = `
            <div class="modal-glass-card" style="max-width: 450px; text-align: left;">
                <div class="modal-title" style="text-align: center; margin-bottom: 25px;">Ajustes de Cuenta</div>
                
                <div style="margin-bottom: 30px;">
                    <label style="display:block; color:#aaa; font-size:0.85rem; margin-bottom:8px; font-weight:500;">Correo Electrónico</label>
                    <input type="text" value="${this.user.email}" disabled 
                        style="width: 100%; padding: 12px; background: rgba(0,0,0,0.3); border: 1px solid #333; color: #fff; border-radius: 10px; font-size: 1rem;">
                </div>

                <div style="border-top: 1px solid rgba(255,255,255,0.1); padding-top: 25px; margin-top: 25px;">
                    <div style="color: #FF5252; font-weight: bold; margin-bottom: 10px; font-size: 0.9rem;">Zona de Peligro</div>
                    <p style="color: #888; font-size: 0.85rem; margin-bottom: 15px; line-height: 1.4;">
                        Al eliminar tu cuenta, tus datos personales desaparecerán. <br>
                        <b>Nota:</b> Si vuelves a registrarte con este correo, recuperarás tu saldo actual (incluso si es 0).
                    </p>
                    <button id="btnDeleteAccount" class="modal-btn" style="background: rgba(255, 82, 82, 0.1); color: #FF5252; border: 1px solid rgba(255, 82, 82, 0.3); width: 100%;">
                        Eliminar mi cuenta
                    </button>
                </div>

                <button id="btnCloseSettings" class="modal-btn" style="margin-top: 20px; width: 100%; background: #fff; color: #000; font-weight:700;">
                    Cerrar
                </button>
            </div>
        `;

        document.body.appendChild(overlay);
        requestAnimationFrame(() => overlay.classList.add('active'));

        const close = () => {
            overlay.classList.remove('active');
            setTimeout(() => overlay.remove(), 300);
        };
        overlay.querySelector('#btnCloseSettings').onclick = close;
        overlay.onclick = (e) => { if (e.target === overlay) close(); };

        const btnDel = overlay.querySelector('#btnDeleteAccount');
        btnDel.onclick = async () => {
            const confirmed = await CustomModal.confirm(
                '¿Eliminar Cuenta?',
                'Se borrarán tus canciones guardadas, pero mantendremos tu historial de créditos por si decides volver.',
                'Sí, eliminar',
                'Cancelar'
            );

            if (confirmed) {
                try {
                    await authService.deleteAccount();
                    close();
                    CustomModal.toast('Cuenta eliminada.', 'info');
                    if (this.onLogout) this.onLogout();
                } catch (error) {
                    console.error(error);
                    CustomModal.alert('No se pudo eliminar', error.message || error);
                }
            }
        };
    }
}