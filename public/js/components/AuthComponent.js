import { authService } from '../services/authService.js';

export class AuthComponent {
    constructor(container, onLoginSuccess, onSkip) {
        this.container = container;
        this.onLoginSuccess = onLoginSuccess;
        this.onSkip = onSkip;
        this.isLoginMode = true;
        this.render();
    }

    async switchMode(targetMode) {
        const card = this.container.querySelector('.auth-card');
        card.classList.add('fade-out');
        card.classList.remove('fade-in');
        await new Promise(r => setTimeout(r, 300));
        this.isLoginMode = targetMode;
        this.container.innerHTML = this.getHTML();
        this.addEventListeners();
        const newCard = this.container.querySelector('.auth-card');
        newCard.classList.remove('fade-out');
        newCard.classList.add('fade-in');
    }

    render() {
        this.container.innerHTML = this.getHTML();
        this.addEventListeners();
        const card = this.container.querySelector('.auth-card');
        if (card) card.classList.add('fade-in');
    }

    getHTML() {
        const title = this.isLoginMode ? 'Iniciar Sesión' : 'Crear Cuenta';
        const btnText = this.isLoginMode ? 'Entrar' : 'Registrarse';
        const toggleText = this.isLoginMode
            ? '¿No tienes cuenta? <span class="link-highlight">Regístrate</span>'
            : '¿Ya tienes cuenta? <span class="link-highlight">Inicia sesión</span>';
        const loginPlaceholder = this.isLoginMode ? "Correo o Usuario" : "Correo electrónico";

        const registerFields = !this.isLoginMode ? `
            <div class="input-group fade-in">
                <span class="material-icons">person</span>
                <input type="text" id="username" placeholder="Nombre de usuario" required minlength="3" autocomplete="username">
            </div>
        ` : '';

        const confirmPassField = !this.isLoginMode ? `
            <div class="input-group fade-in">
                <span class="material-icons">lock_clock</span>
                <input type="password" id="confirm-password" placeholder="Confirmar contraseña" required autocomplete="new-password">
            </div>
        ` : '';

        // Link de "Olvidé contraseña" solo en Login
        const forgotPassLink = this.isLoginMode ? `
            <div style="text-align: right; margin-bottom: 20px; margin-top: -15px;">
                <a href="#" id="btn-forgot-pass" style="color: #888; font-size: 0.8rem; text-decoration: none;">¿Olvidaste tu contraseña?</a>
            </div>
        ` : '';

        return `
            <div class="auth-card">
                <div class="auth-header">
                    <h2>AudioSplitter <span class="accent">AI</span></h2>
                    <p class="auth-subtitle">${title}</p>
                </div>

                <form id="auth-form">
                    ${registerFields}

                    <div class="input-group">
                        <span class="material-icons">email</span>
                        <input type="text" id="email" placeholder="${loginPlaceholder}" required autocomplete="email">
                    </div>
                    
                    <div class="input-group">
                        <span class="material-icons">lock</span>
                        <input type="password" id="password" placeholder="Contraseña" required autocomplete="current-password">
                    </div>

                    ${confirmPassField}
                    ${forgotPassLink}

                    <div id="auth-error-msg" class="auth-error hidden"></div>

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
        const forgotBtn = this.container.querySelector('#btn-forgot-pass');

        // LÓGICA OLVIDÉ CONTRASEÑA
        if (forgotBtn) {
            forgotBtn.addEventListener('click', async (e) => {
                e.preventDefault();

                // Usamos SweetAlert para pedir el correo
                const { value: email } = await Swal.fire({
                    title: 'Recuperar contraseña',
                    input: 'email',
                    inputLabel: 'Ingresa tu correo registrado',
                    inputPlaceholder: 'tu@correo.com',
                    showCancelButton: true,
                    confirmButtonText: 'Enviar enlace',
                    cancelButtonText: 'Cancelar',
                    background: '#1a1a1a',
                    color: '#fff',
                    confirmButtonColor: '#7c4dff'
                });

                if (email) {
                    try {
                        await authService.sendPasswordReset(email);
                        Swal.fire({
                            icon: 'success',
                            title: '¡Enviado!',
                            text: 'Revisa tu bandeja de entrada para restablecer tu contraseña.',
                            background: '#1a1a1a',
                            color: '#fff',
                            timer: 3000,
                            showConfirmButton: false
                        });
                    } catch (error) {
                        Swal.fire({
                            icon: 'error',
                            title: 'Error',
                            text: typeof error === 'string' ? error : 'No se pudo enviar el correo.',
                            background: '#1a1a1a',
                            color: '#fff'
                        });
                    }
                }
            });
        }

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            this.container.querySelector('#auth-error-msg').classList.add('hidden');

            const emailOrUser = form.email.value.trim();
            const password = form.password.value;

            if (!this.isLoginMode) {
                const username = form.querySelector('#username').value.trim();
                const confirmPass = form.querySelector('#confirm-password').value;

                if (password !== confirmPass) return this.showError("Las contraseñas no coinciden.");
                if (username.length < 3) return this.showError("El usuario debe tener al menos 3 caracteres.");
                if (!emailOrUser.includes('@')) return this.showError("Por favor ingresa un correo válido.");
            }

            submitBtn.disabled = true;
            submitBtn.textContent = 'Procesando...';

            try {
                let user;
                if (this.isLoginMode) {
                    user = await authService.login(emailOrUser, password);
                } else {
                    const username = form.querySelector('#username').value.trim();
                    user = await authService.register(emailOrUser, password, username);
                }
                this.onLoginSuccess(user);
            } catch (error) {
                const message = typeof error === 'string' ? error : (error.message || "Error desconocido");
                this.showError(message);
                submitBtn.disabled = false;
                submitBtn.textContent = this.isLoginMode ? 'Entrar' : 'Registrarse';
            }
        });

        toggleBtn.addEventListener('click', () => this.switchMode(!this.isLoginMode));

        if (guestBtn) {
            guestBtn.addEventListener('click', () => {
                this.container.querySelector('.auth-card').classList.add('fade-out');
                setTimeout(() => this.onSkip(), 300);
            });
        }
    }

    showError(msg) {
        const errorMsg = this.container.querySelector('#auth-error-msg');
        errorMsg.textContent = msg;
        errorMsg.classList.remove('hidden');
        if (this.container.querySelector('.auth-card').animate) {
            this.container.querySelector('.auth-card').animate([
                { transform: 'translateX(0)' }, { transform: 'translateX(-10px)' },
                { transform: 'translateX(10px)' }, { transform: 'translateX(0)' }
            ], { duration: 300 });
        }
    }
}