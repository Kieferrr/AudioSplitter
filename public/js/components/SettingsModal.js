import { authService } from '../services/authService.js';
import { CustomModal } from './CustomModal.js';

export class SettingsModal {
    constructor(user, onLogout) {
        this.user = user;
        this.onLogout = onLogout;
        this.pendingFile = null;
        this.pendingPreset = null;
        this.originalPhoto = null;
        this.render();
    }

    async render() {
        const dbUser = await authService.getUserData(this.user.uid);
        this.originalPhoto = dbUser?.photoURL || this.user.photoURL;
        const currentName = dbUser?.username || this.user.displayName || "Usuario";

        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';

        const getAvatarMarkup = (photoSource) => {
            if (photoSource && photoSource.startsWith('http')) {
                return `<img src="${photoSource}" class="avatar-img" id="avatarPreview">`;
            } else if (photoSource && photoSource.startsWith('preset:')) {
                const parts = photoSource.split('|');
                const icon = parts[1] ? parts[0].split(':')[1] : 'default';
                const color = parts[1] || '#fff';
                const safeIcons = {
                    default: 'music_note',
                    rock: 'album',
                    pop: 'mic',
                    electro: 'headphones',
                    jazz: 'piano',
                    rap: 'graphic_eq'
                };
                return `<span class="material-icons" style="font-size:3rem; color:${color};">${safeIcons[icon] || 'music_note'}</span><img id="avatarPreview" class="avatar-img hidden">`;
            } else {
                return `<span class="material-icons avatar-placeholder">music_note</span><img id="avatarPreview" class="avatar-img hidden">`;
            }
        };

        const avatarInner = getAvatarMarkup(this.originalPhoto);
        const presets = [{
            id: 'default',
            icon: 'music_note',
            color: '#fff',
            bg: '#222'
        },
        {
            id: 'rock',
            icon: 'album',
            color: '#FF5252',
            bg: '#330000'
        },
        {
            id: 'pop',
            icon: 'mic',
            color: '#FF4081',
            bg: '#330011'
        },
        {
            id: 'electro',
            icon: 'headphones',
            color: '#00E676',
            bg: '#001100'
        },
        {
            id: 'jazz',
            icon: 'piano',
            color: '#FFD740',
            bg: '#332200'
        },
        {
            id: 'rap',
            icon: 'graphic_eq',
            color: '#7C4DFF',
            bg: '#110033'
        }
        ];

        const presetsHTML = presets.map(p => `
            <div class="preset-btn" data-id="${p.id}" data-color="${p.color}" 
                 style="background: ${p.bg}; border: 1px solid ${p.color};">
                <span class="material-icons" style="color: ${p.color}; font-size: 20px;">${p.icon}</span>
            </div>
        `).join('');

        overlay.innerHTML = `
            <div class="modal-glass-card" style="max-width: 420px; text-align: left; padding: 30px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                    <div class="modal-title" style="margin:0;">Mi Perfil</div>
                    <button id="btnCloseSettings" style="background:none; border:none; color:#fff; cursor:pointer;"><span class="material-icons">close</span></button>
                </div>

                <div class="profile-header">
                    <div class="avatar-container">
                        <div class="avatar-circle" id="avatarCircle">${avatarInner}</div>
                        <label for="avatarInput" class="btn-edit-avatar" title="Subir foto propia">
                            <span class="material-icons" style="font-size:18px; color:#000;">photo_camera</span>
                        </label>
                    </div>
                    <input type="file" id="avatarInput" accept="image/*" hidden>
                    
                    <div id="nameDisplayContainer" style="position: relative; display: flex; justify-content: center; align-items: center; margin-top: 5px; width: 100%;">
                        <div style="position: relative; display: inline-block;">
                            <span style="font-size: 1.2rem; font-weight: 700;">${currentName}</span>
                            <button id="btnEditNameIcon" style="position: absolute; right: -30px; top: 50%; transform: translateY(-50%); background: none; border: none; color: #888; cursor: pointer; padding: 4px;">
                                <span class="material-icons" style="font-size: 16px;">edit</span>
                            </button>
                        </div>
                    </div>

                    <div id="nameEditContainer" style="display: none; justify-content: center; align-items: center; gap: 5px; margin-top: 5px; width: 100%;">
                        <input type="text" id="usernameInput" value="${currentName}" maxlength="15"
                            style="background: rgba(0,0,0,0.3); border: 1px solid #555; color: #fff; font-size: 1rem; font-weight: 600; text-align: center; width: 140px; border-radius: 6px; padding: 6px;">
                        <button id="btnSaveName" class="modal-btn" style="padding: 6px 12px; font-size: 0.8rem; background: #00E676; color: #000;">
                            <span class="material-icons" style="font-size: 16px;">check</span>
                        </button>
                        <button id="btnCancelName" class="modal-btn" style="padding: 6px 12px; font-size: 0.8rem; background: #333; color: #fff;">
                            <span class="material-icons" style="font-size: 16px;">close</span>
                        </button>
                    </div>
                    
                    <div style="font-size: 0.8rem; color: var(--accent-color); margin-top: 5px;">${dbUser?.role === 'admin' ? 'Administrador' : 'Plan Gratuito'}</div>
                </div>

                <div style="text-align: center;">
                    <div class="avatar-presets-title">Personalizar Avatar</div>
                    <div class="avatar-grid">${presetsHTML}</div>
                    <button id="btnSaveAvatar" class="modal-btn" style="background: var(--accent-color); color: #000; font-size: 0.85rem; padding: 8px 20px; margin-bottom: 20px; opacity: 0.5; cursor: default;">Guardar Foto de Perfil</button>
                </div>

                <div class="settings-section">
                    <div class="section-title">Información de Cuenta</div>
                    <label class="settings-label">Correo Electrónico</label>
                    <input type="text" class="settings-input-readonly" value="${this.user.email}" disabled>
                </div>

                <div class="settings-section">
                    <div style="display:flex; justify-content:space-between; align-items:center; cursor:pointer;" id="togglePassword">
                        <div class="section-title" style="margin:0; color:#fff;">Cambiar Contraseña</div>
                        <span class="material-icons" style="font-size:1.2rem; color:#aaa; transition: transform 0.3s;" id="arrowPass">expand_more</span>
                    </div>
                    <div class="password-accordion" id="passAccordion">
                        <div style="margin-top:15px;">
                            <input type="password" id="newPass" placeholder="Nueva contraseña" style="width: 100%; padding: 10px; background: rgba(0,0,0,0.3); border: 1px solid #333; color: #fff; border-radius: 8px; margin-bottom:10px;">
                            <input type="password" id="confirmPass" placeholder="Confirmar Contraseña" style="width: 100%; padding: 10px; background: rgba(0,0,0,0.3); border: 1px solid #333; color: #fff; border-radius: 8px; margin-bottom:10px;">
                            <button id="btnSavePass" class="modal-btn" style="width:100%; background: #333; color: #fff; font-size:0.8rem;">Actualizar Contraseña</button>
                        </div>
                    </div>
                </div>

                <div style="margin-top: 15px; text-align: center;">
                    <button id="btnDeleteAccount" style="background: none; border: none; color: #FF5252; font-size: 0.8rem; cursor: pointer; opacity: 0.7;">Eliminar cuenta permanentemente</button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);
        requestAnimationFrame(() => overlay.classList.add('active'));

        const close = () => {
            overlay.classList.remove('active');
            setTimeout(() => overlay.remove(), 300);
        };
        overlay.querySelector('#btnCloseSettings').onclick = close;
        overlay.onclick = (e) => {
            if (e.target === overlay) close();
        };

        const displayContainer = overlay.querySelector('#nameDisplayContainer');
        const editContainer = overlay.querySelector('#nameEditContainer');
        const usernameInput = overlay.querySelector('#usernameInput');

        overlay.querySelector('#btnEditNameIcon').onclick = () => {
            displayContainer.style.display = 'none';
            editContainer.style.display = 'flex';
            usernameInput.focus();
        };

        overlay.querySelector('#btnCancelName').onclick = () => {
            editContainer.style.display = 'none';
            displayContainer.style.display = 'flex'; // Vuelve a flex para centrar
            usernameInput.value = currentName;
        };

        overlay.querySelector('#btnSaveName').onclick = async () => {
            const newName = usernameInput.value.trim();
            if (newName.length < 3) return CustomModal.alert('Error', 'Mínimo 3 caracteres.');

            try {
                overlay.querySelector('#btnSaveName').innerHTML = '<span class="material-icons icon-spin" style="font-size:16px;">sync</span>';

                await authService.updateUsername(newName);
                CustomModal.toast('Nombre actualizado', 'success');

                displayContainer.querySelector('span').textContent = newName;
                editContainer.style.display = 'none';
                displayContainer.style.display = 'flex';
                overlay.querySelector('#btnSaveName').innerHTML = '<span class="material-icons" style="font-size:16px;">check</span>';
            } catch (err) {
                CustomModal.alert('Error', err.message);
                overlay.querySelector('#btnSaveName').innerHTML = '<span class="material-icons" style="font-size:16px;">check</span>';
            }
        };

        const btnSaveAvatar = overlay.querySelector('#btnSaveAvatar');
        const avatarCircle = overlay.querySelector('#avatarCircle');
        const enableSaveButton = () => {
            btnSaveAvatar.style.opacity = '1';
            btnSaveAvatar.style.cursor = 'pointer';
        };

        overlay.querySelector('#avatarInput').onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            if (file.size > 2 * 1024 * 1024) {
                CustomModal.alert('Archivo muy grande', 'Máximo 2MB');
                return;
            }
            this.pendingFile = file;
            this.pendingPreset = null;
            const reader = new FileReader();
            reader.onload = (ev) => {
                avatarCircle.innerHTML = `<img src="${ev.target.result}" class="avatar-img">`;
            };
            reader.readAsDataURL(file);
            enableSaveButton();
        };

        const presetBtns = overlay.querySelectorAll('.preset-btn');
        presetBtns.forEach(btn => {
            btn.onclick = () => {
                presetBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const id = btn.dataset.id;
                const color = btn.dataset.color;
                this.pendingPreset = `preset:${id}|${color}`;
                this.pendingFile = null;
                const iconMap = {
                    default: 'music_note',
                    rock: 'album',
                    pop: 'mic',
                    electro: 'headphones',
                    jazz: 'piano',
                    rap: 'graphic_eq'
                };
                avatarCircle.innerHTML = `<span class="material-icons" style="font-size:3rem; color:${color};">${iconMap[id]}</span>`;
                enableSaveButton();
            };
        });

        btnSaveAvatar.onclick = async () => {
            if (!this.pendingFile && !this.pendingPreset) return;
            try {
                btnSaveAvatar.textContent = 'Guardando...';
                if (this.pendingFile) await authService.updateAvatar(this.pendingFile);
                else if (this.pendingPreset) await authService.setAvatarPreset(this.pendingPreset);
                CustomModal.toast('Perfil actualizado', 'success');
                btnSaveAvatar.style.opacity = '0.5';
                btnSaveAvatar.style.cursor = 'default';
                btnSaveAvatar.textContent = 'Guardado';
                this.pendingFile = null;
                this.pendingPreset = null;
            } catch (err) {
                console.error(err);
                CustomModal.alert('Error', 'Error al guardar.');
                btnSaveAvatar.textContent = 'Guardar Foto de Perfil';
            }
        };

        const togglePass = overlay.querySelector('#togglePassword');
        const passAccordion = overlay.querySelector('#passAccordion');
        const arrowPass = overlay.querySelector('#arrowPass');
        togglePass.onclick = () => {
            passAccordion.classList.toggle('open');
            arrowPass.style.transform = passAccordion.classList.contains('open') ? 'rotate(180deg)' : 'rotate(0deg)';
        };

        const btnSavePass = overlay.querySelector('#btnSavePass');
        btnSavePass.onclick = async () => {
            const p1 = overlay.querySelector('#newPass').value;
            const p2 = overlay.querySelector('#confirmPass').value;
            if (p1.length < 6) return CustomModal.alert('Error', 'Mínimo 6 caracteres.');
            if (p1 !== p2) return CustomModal.alert('Error', 'No coinciden.');
            try {
                btnSavePass.textContent = '...';
                await authService.changeUserPassword(p1);
                CustomModal.toast('Contraseña cambiada', 'success');
                togglePass.click();
            } catch (err) {
                CustomModal.alert('Error', typeof err === 'string' ? err : err.message);
                btnSavePass.textContent = 'Actualizar Contraseña';
            }
        };

        overlay.querySelector('#btnDeleteAccount').onclick = async () => {
            const confirmed = await CustomModal.confirm('¿Borrar Cuenta?', 'Perderás todo.', 'Borrar', 'Cancelar');
            if (confirmed) {
                try {
                    await authService.deleteAccount();
                    close();
                    CustomModal.toast('Cuenta eliminada', 'info');
                    if (this.onLogout) this.onLogout();
                } catch (error) {
                    CustomModal.alert('Error', error.message);
                }
            }
        };
    }
}