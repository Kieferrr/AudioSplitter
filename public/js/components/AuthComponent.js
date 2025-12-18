import { authService } from '../services/authService.js';

export class AuthComponent {
    constructor(container, onLoginSuccess, onSkip) {
        this.container = container;
        this.onLoginSuccess = onLoginSuccess;
        this.onSkip = onSkip;
        this.isLoginMode = true; // Empezamos en Login
        this.render();
    }

    // Función auxiliar para animar el cambio interno del formulario
    async switchMode(targetMode) {
        const card = this.container.querySelector('.auth-card');

        // 1. Fade Out del contenido actual
        card.classList.add('fade-out');
        card.classList.remove('fade-in');

        // Esperamos que termine la animación (300ms)
        await new Promise(r => setTimeout(r, 300));

        // 2. Cambiamos el modo y renderizamos el HTML nuevo
        this.isLoginMode = targetMode;
        this.container.innerHTML = this.getHTML();

        // Re-asignar eventos porque el HTML es nuevo
        this.addEventListeners();

        // 3. Fade In del nuevo contenido
        const newCard = this.container.querySelector('.auth-card');
        newCard.classList.remove('fade-out'); // Limpieza
        newCard.classList.add('fade-in');

        // Limpiar clase de animación después
        setTimeout(() => newCard.classList.remove('fade-in'), 500);
    }

    render() {
        // Renderizado inicial (sin animación de salida)
        this.container.innerHTML = this.getHTML();
        this.addEventListeners();

        // Animación de entrada suave inicial
        const card = this.container.querySelector('.auth-card');
        if (card) card.classList.add('fade-in');
    }

    getHTML() {
        const title = this.isLoginMode ? 'Iniciar Sesión' : 'Crear Cuenta';
        const btnText = this.isLoginMode ? 'Entrar' : 'Registrarse';

        const toggleText = this.isLoginMode
            ? '¿No tienes cuenta? <span class="link-highlight">Regístrate</span>'
            : '¿Ya tienes cuenta? <span class="link-highlight">Inicia sesión</span>';

        return `
            <div class="auth-card">
                <div class="auth-header">
                    <h2>AudioSplitter <span class="accent">AI</span></h2>
                    <p class="auth-subtitle">${title}</p>
                </div>

                <div id="auth-error-msg" class="auth-error hidden"></div>

                <form id="auth-form">
                    <div class="input-group">
                        <span class="material-icons">email</span>
                        <input type="email" id="email" placeholder="Correo electrónico" required autocomplete="email">
                    </div>
                    
                    <div class="input-group">
                        <span class="material-icons">lock</span>
                        <input type="password" id="password" placeholder="Contraseña" required autocomplete="current-password">
                    </div>

                    <button type="submit" id="btn-submit" class="btn-primary full-width">
                        ${btnText}
                    </button>
                </form>

                <div class="auth-toggle" id="btn-toggle-mode">
                    ${toggleText}
                </div>

                <div class="divider"><span>O</span></div>
                <button id="btn-guest" class="btn-secondary full-width">
                    Continuar como Invitado
                </button>
            </div>
        `;
    }

    addEventListeners() {
        const form = this.container.querySelector('#auth-form');
        const toggleBtn = this.container.querySelector('#btn-toggle-mode');
        const guestBtn = this.container.querySelector('#btn-guest');
        const submitBtn = this.container.querySelector('#btn-submit');

        // Submit Form
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = form.email.value;
            const password = form.password.value;
            const errorMsg = this.container.querySelector('#auth-error-msg');

            // Feedback visual de carga
            submitBtn.disabled = true;
            submitBtn.textContent = 'Procesando...';
            errorMsg.classList.add('hidden');

            try {
                let user;
                if (this.isLoginMode) {
                    user = await authService.login(email, password);
                } else {
                    user = await authService.register(email, password);
                }
                this.onLoginSuccess(user);
            } catch (error) {
                errorMsg.textContent = error.message;
                errorMsg.classList.remove('hidden');
                submitBtn.disabled = false;
                submitBtn.textContent = this.isLoginMode ? 'Entrar' : 'Registrarse';

                // Animación de "shake" (temblor) para error
                const card = this.container.querySelector('.auth-card');
                card.animate([
                    { transform: 'translateX(0)' },
                    { transform: 'translateX(-10px)' },
                    { transform: 'translateX(10px)' },
                    { transform: 'translateX(0)' }
                ], { duration: 300 });
            }
        });

        // Toggle Login / Register (CON ANIMACIÓN)
        toggleBtn.addEventListener('click', () => {
            this.switchMode(!this.isLoginMode);
        });

        // Guest Mode
        if (guestBtn) {
            guestBtn.addEventListener('click', () => {
                // Transición de salida antes de cambiar
                const card = this.container.querySelector('.auth-card');
                card.classList.add('fade-out');
                setTimeout(() => this.onSkip(), 300);
            });
        }
    }
}