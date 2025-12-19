import { authService } from '../services/authService.js';
import { dbService } from '../services/dbService.js';

export class SettingsModal {
    constructor(user, onLogout) {
        this.user = user;
        this.onLogout = onLogout; // Callback para sacar al usuario a la pantalla de login
        this.render();
    }

    render() {
        // Usamos SweetAlert como menú de opciones (se ve muy bien y ahorra código HTML)
        Swal.fire({
            title: 'Ajustes de Cuenta',
            html: `
                <div style="text-align: left; margin-top: 10px;">
                    <p style="color: #aaa; font-size: 0.9rem; margin-bottom: 5px;">Usuario</p>
                    <div style="background: rgba(255,255,255,0.05); padding: 10px; border-radius: 8px; color: white; margin-bottom: 20px;">
                        ${this.user.displayName || 'Usuario'} <br>
                        <span style="font-size: 0.8rem; color: #666;">${this.user.email}</span>
                    </div>
                    
                    <button id="btn-delete-account" class="swal2-confirm swal2-styled" style="background: #2a1a1a !important; border: 1px solid #ff5252 !important; color: #ff5252 !important; width: 100%; margin: 0;">
                        <span class="material-icons" style="vertical-align: middle; font-size: 18px; margin-right: 5px;">delete_forever</span>
                        Eliminar Cuenta
                    </button>
                </div>
            `,
            showConfirmButton: false, // Ocultamos el OK por defecto
            showCloseButton: true,
            background: '#1a1a1a',
            color: '#fff',
            didOpen: () => {
                // Asignamos el evento al botón HTML que inyectamos
                const btnDelete = document.getElementById('btn-delete-account');
                btnDelete.addEventListener('click', () => this.handleDelete());
            }
        });
    }

    async handleDelete() {
        // 1. Confirmación de seguridad
        const result = await Swal.fire({
            title: '¿Estás completamente seguro?',
            text: "Se borrarán todas tus canciones y datos. Esta acción no se puede deshacer.",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Sí, borrar todo',
            cancelButtonText: 'Cancelar',
            background: '#1a1a1a',
            color: '#fff'
        });

        if (result.isConfirmed) {
            Swal.fire({
                title: 'Eliminando...',
                text: 'Borrando tus datos y archivos.',
                allowOutsideClick: false,
                didOpen: () => {
                    Swal.showLoading();
                },
                background: '#1a1a1a',
                color: '#fff'
            });

            try {
                // Paso 1: Borrar datos de Firestore y Storage
                await dbService.deleteUserAccountData(this.user.uid);

                // Paso 2: Borrar usuario de Auth
                await authService.deleteAccount();

                // Paso 3: Éxito y Logout
                Swal.fire({
                    icon: 'success',
                    title: 'Cuenta eliminada',
                    text: 'Lamentamos verte partir.',
                    timer: 2000,
                    showConfirmButton: false,
                    background: '#1a1a1a',
                    color: '#fff'
                }).then(() => {
                    this.onLogout(); // Redirigir al login
                });

            } catch (error) {
                console.error(error);
                let msg = "No se pudo borrar la cuenta.";
                
                // Si el usuario lleva mucho tiempo logueado, Firebase pide re-autenticación
                if (error.code === 'auth/requires-recent-login') {
                    msg = "Por seguridad, necesitas cerrar sesión e iniciar de nuevo para poder borrar tu cuenta.";
                }

                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: msg,
                    background: '#1a1a1a',
                    color: '#fff'
                });
            }
        }
    }
}