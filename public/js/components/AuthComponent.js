import { authService } from '../services/authService.js';

export class AuthComponent {
    constructor(containerElement, onLoginSuccess, onGuestAccess) {
        this.container = containerElement;
        this.onLoginSuccess = onLoginSuccess; // Función a ejecutar cuando entra un usuario
        this.onGuestAccess = onGuestAccess;   // Función a ejecutar cuando entra un invitado
        this.isRegistering = false; // Estado inicial: Login

        this.render();
    }

    render() {
        // Título y Texto del botón según el estado
        const title = this.isRegistering ? "Crear Cuenta" : "Iniciar Sesión";
        const actionBtnText = this.isRegistering ? "Registrarse" : "Ingresar";
        const toggleText = this.isRegistering
            ? "¿Ya tienes cuenta? <span class='link-highlight'>Inicia sesión</span>"
            : "¿No tienes cuenta? <span class='link-highlight'>Regístrate</span>";

        this.container.innerHTML = `
            <div class="glass-card auth-card">
                <div class="auth-header">
                    <h2>${title}</h2>
                    <p class="auth-subtitle">Guarda tus canciones y accede a ellas desde cualquier lugar.</p>
                </div>

                <form id="authForm" class="auth-form">
                    <div class="input-group">
                        <span class="material-icons">email</span>
                        <input type="email" id="email" placeholder="Correo electrónico" required autocomplete="email">
                    </div>
                    
                    <div class="input-group">
                        <span class="material-icons">lock</span>
                        <input type="password" id="password" placeholder="Contraseña" required autocomplete="current-password">
                    </div>

                    <div id="authError" class="auth-error hidden"></div>

                    <button type="submit" class="btn-primary full-width" id="submitBtn">
                        ${actionBtnText}
                    </button>
                </form>

                <div class="auth-toggle" id="toggleAuth">
                    ${toggleText}
                </div>

                <div class="divider">
                    <span>O</span>
                </div>

                <button id="guestBtn" class="btn-secondary full-width">
                    Continuar como Invitado
                </button>
            </div>
        `;

        this.addListeners();
    }

    addListeners() {
        const form = this.container.querySelector('#authForm');
        const toggleBtn = this.container.querySelector('#toggleAuth');
        const guestBtn = this.container.querySelector('#guestBtn');
        const errorDiv = this.container.querySelector('#authError');
        const submitBtn = this.container.querySelector('#submitBtn');

        // 1. Manejo del Formulario (Login/Registro)
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = form.email.value;
            const password = form.password.value;

            errorDiv.classList.add('hidden');
            submitBtn.disabled = true;
            submitBtn.textContent = "Procesando...";

            try {
                let user;
                if (this.isRegistering) {
                    user = await authService.register(email, password);
                } else {
                    user = await authService.login(email, password);
                }
                // Si todo sale bien, llamamos al callback de éxito
                if (this.onLoginSuccess) this.onLoginSuccess(user);

            } catch (errorMsg) {
                errorDiv.textContent = errorMsg;
                errorDiv.classList.remove('hidden');
                submitBtn.disabled = false;
                submitBtn.textContent = this.isRegistering ? "Registrarse" : "Ingresar";
            }
        });

        // 2. Alternar entre Login y Registro
        toggleBtn.addEventListener('click', () => {
            this.isRegistering = !this.isRegistering;
            this.render(); // Re-renderizamos para cambiar textos
        });

        // 3. Modo Invitado
        guestBtn.addEventListener('click', () => {
            if (this.onGuestAccess) this.onGuestAccess();
        });
    }
}