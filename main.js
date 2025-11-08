/**
 * Lógica Principal de la Aplicación Passwordless Manager
 * Controla el flujo de usuario, estados y navegación
 */

class PasswordlessManager {
    constructor() {
        this.currentStep = 1;
        this.totalSteps = 3;
        this.userProgress = this.loadProgress();
        this.init();
    }

    init() {
        document.addEventListener('DOMContentLoaded', () => {
            this.initializeApp();
        });
    }

    async initializeApp() {
        try {
            // Verificar autenticación
            if (window.authManager && window.authManager.isAuthenticated) {
                await this.loadUserProgress();
                this.setupEventListeners();
                this.updateUI();
                this.initializeAnimations();
            } else {
                // Redirigir a autenticación si no está autenticado
                this.showAuthenticationRequired();
            }
        } catch (error) {
            console.error('Error inicializando aplicación:', error);
            this.showError('Error al inicializar la aplicación');
        }
    }

    async loadUserProgress() {
        try {
            // Verificar estado passwordless del usuario
            const passwordlessStatus = await window.authManager.checkPasswordlessStatus();
            
            // Determinar paso actual basado en el estado
            if (passwordlessStatus.hasPasswordless) {
                this.currentStep = 4; // Completado
                this.userProgress = {
                    step1: true,
                    step2: true,
                    step3: true,
                    passwordlessEnabled: true,
                    methods: passwordlessStatus.methods
                };
            } else {
                // Cargar progreso guardado o empezar desde el principio
                this.userProgress = this.loadProgress();
            }
        } catch (error) {
            console.error('Error cargando progreso:', error);
            this.userProgress = this.getDefaultProgress();
        }
    }

    getDefaultProgress() {
        return {
            step1: false,
            step2: false,
            step3: false,
            passwordlessEnabled: false,
            methods: []
        };
    }

    loadProgress() {
        try {
            const saved = localStorage.getItem('passwordlessProgress');
            return saved ? JSON.parse(saved) : this.getDefaultProgress();
        } catch (error) {
            console.error('Error cargando progreso desde localStorage:', error);
            return this.getDefaultProgress();
        }
    }

    saveProgress() {
        try {
            localStorage.setItem('passwordlessProgress', JSON.stringify(this.userProgress));
        } catch (error) {
            console.error('Error guardando progreso:', error);
        }
    }

    setupEventListeners() {
        // Botones de navegación del wizard
        const nextBtn = document.getElementById('nextStepBtn');
        const prevBtn = document.getElementById('prevStepBtn');
        const completeBtn = document.getElementById('completeSetupBtn');
        const generateTapBtn = document.getElementById('generateTapBtn');

        if (nextBtn) {
            nextBtn.addEventListener('click', () => this.nextStep());
        }

        if (prevBtn) {
            prevBtn.addEventListener('click', () => this.prevStep());
        }

        if (completeBtn) {
            completeBtn.addEventListener('click', () => this.completeSetup());
        }

        if (generateTapBtn) {
            generateTapBtn.addEventListener('click', () => this.navigateToTAP());
        }

        // Botones de acción específicos de cada paso
        this.setupStepSpecificListeners();
    }

    setupStepSpecificListeners() {
        // Paso 1: Información y verificación
        const verifyBtn = document.getElementById('verifyRequirementsBtn');
        if (verifyBtn) {
            verifyBtn.addEventListener('click', () => this.verifyRequirements());
        }

        // Paso 2: Configuración de métodos
        const setupMethodsBtn = document.getElementById('setupMethodsBtn');
        if (setupMethodsBtn) {
            setupMethodsBtn.addEventListener('click', () => this.setupAuthenticationMethods());
        }

        // Paso 3: Validación final
        const validateBtn = document.getElementById('validateSetupBtn');
        if (validateBtn) {
            validateBtn.addEventListener('click', () => this.validateSetup());
        }
    }

    updateUI() {
        this.updateProgressBar();
        this.updateStepIndicators();
        this.showCurrentStep();
        this.updateNavigationButtons();
    }

    updateProgressBar() {
        const progressBar = document.getElementById('progressBar');
        if (progressBar) {
            const progress = (this.currentStep / this.totalSteps) * 100;
            progressBar.style.width = `${progress}%`;
            
            // Animación de progreso
            anime({
                targets: progressBar,
                width: `${progress}%`,
                duration: 500,
                easing: 'easeOutQuad'
            });
        }

        // Actualizar texto de progreso
        const progressText = document.getElementById('progressText');
        if (progressText) {
            progressText.textContent = `Paso ${this.currentStep} de ${this.totalSteps}`;
        }
    }

    updateStepIndicators() {
        for (let i = 1; i <= this.totalSteps; i++) {
            const stepElement = document.getElementById(`step${i}Indicator`);
            if (stepElement) {
                stepElement.classList.remove('bg-blue-600', 'bg-green-600', 'bg-gray-300');
                
                if (i < this.currentStep) {
                    stepElement.classList.add('bg-green-600');
                } else if (i === this.currentStep) {
                    stepElement.classList.add('bg-blue-600');
                } else {
                    stepElement.classList.add('bg-gray-300');
                }
            }
        }
    }

    showCurrentStep() {
        // Ocultar todos los pasos
        for (let i = 1; i <= this.totalSteps; i++) {
            const stepElement = document.getElementById(`step${i}Content`);
            if (stepElement) {
                stepElement.classList.add('hidden');
            }
        }

        // Mostrar paso actual
        const currentStepElement = document.getElementById(`step${this.currentStep}Content`);
        if (currentStepElement) {
            currentStepElement.classList.remove('hidden');
            
            // Animación de entrada
            anime({
                targets: currentStepElement,
                opacity: [0, 1],
                translateX: [50, 0],
                duration: 400,
                easing: 'easeOutQuad'
            });
        }

        // Si está completado, mostrar pantalla de éxito
        if (this.currentStep > this.totalSteps) {
            this.showCompletionScreen();
        }
    }

    updateNavigationButtons() {
        const nextBtn = document.getElementById('nextStepBtn');
        const prevBtn = document.getElementById('prevStepBtn');
        const completeBtn = document.getElementById('completeSetupBtn');

        if (prevBtn) {
            prevBtn.style.display = this.currentStep > 1 ? 'inline-block' : 'none';
        }

        if (nextBtn && completeBtn) {
            if (this.currentStep === this.totalSteps) {
                nextBtn.style.display = 'none';
                completeBtn.style.display = 'inline-block';
            } else {
                nextBtn.style.display = 'inline-block';
                completeBtn.style.display = 'none';
            }
        }
    }

    async nextStep() {
        if (this.currentStep < this.totalSteps) {
            // Validar paso actual antes de avanzar
            const isValid = await this.validateCurrentStep();
            if (!isValid) {
                return;
            }

            this.currentStep++;
            this.updateUI();
            this.saveProgress();
        }
    }

    prevStep() {
        if (this.currentStep > 1) {
            this.currentStep--;
            this.updateUI();
        }
    }

    async validateCurrentStep() {
        switch (this.currentStep) {
            case 1:
                return this.userProgress.step1;
            case 2:
                return this.userProgress.step2;
            case 3:
                return this.userProgress.step3;
            default:
                return true;
        }
    }

    async verifyRequirements() {
        try {
            const verifyBtn = document.getElementById('verifyRequirementsBtn');
            const loadingSpinner = document.getElementById('verifyLoading');

            // Mostrar estado de carga
            verifyBtn.disabled = true;
            if (loadingSpinner) loadingSpinner.classList.remove('hidden');

            // Simular verificación de requisitos
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Verificar requisitos (mock)
            const requirements = {
                hasDevice: true,
                hasAuthenticator: true,
                hasPermissions: true,
                hasSupportedBrowser: true
            };

            // Actualizar UI con resultados
            this.displayVerificationResults(requirements);

            // Marcar paso como completado
            this.userProgress.step1 = true;
            this.saveProgress();

            // Mostrar mensaje de éxito
            this.showSuccess('Requisitos verificados correctamente');

        } catch (error) {
            console.error('Error verificando requisitos:', error);
            this.showError('Error al verificar requisitos');
        } finally {
            const verifyBtn = document.getElementById('verifyRequirementsBtn');
            const loadingSpinner = document.getElementById('verifyLoading');
            if (verifyBtn) verifyBtn.disabled = false;
            if (loadingSpinner) loadingSpinner.classList.add('hidden');
        }
    }

    displayVerificationResults(requirements) {
        const resultsContainer = document.getElementById('verificationResults');
        if (!resultsContainer) return;

        const resultsHTML = Object.entries(requirements).map(([key, value]) => {
            const statusIcon = value ? 'fa-check text-green-600' : 'fa-times text-red-600';
            const statusText = value ? 'Cumple' : 'No cumple';
            const requirementNames = {
                hasDevice: 'Dispositivo compatible',
                hasAuthenticator: 'Aplicación Microsoft Authenticator',
                hasPermissions: 'Permisos de administrador',
                hasSupportedBrowser: 'Navegador compatible'
            };

            return `
                <div class="flex items-center justify-between py-2">
                    <span>${requirementNames[key]}</span>
                    <span class="flex items-center">
                        <i class="fas ${statusIcon} mr-2"></i>
                        ${statusText}
                    </span>
                </div>
            `;
        }).join('');

        resultsContainer.innerHTML = `
            <div class="bg-white rounded-lg border p-4 mt-4">
                <h4 class="font-semibold mb-3">Resultados de Verificación:</h4>
                ${resultsHTML}
                <div class="mt-4 text-center">
                    <span class="text-green-600 font-semibold">
                        <i class="fas fa-check-circle mr-2"></i>
                        Todos los requisitos cumplidos
                    </span>
                </div>
            </div>
        `;

        // Animar resultados
        anime({
            targets: resultsContainer,
            opacity: [0, 1],
            translateY: [20, 0],
            duration: 500,
            easing: 'easeOutQuad'
        });
    }

    async setupAuthenticationMethods() {
        try {
            // Simular configuración de métodos de autenticación
            this.showInfo('Configurando métodos de autenticación...');

            // Mock de configuración exitosa
            await new Promise(resolve => setTimeout(resolve, 3000));

            // Marcar paso como completado
            this.userProgress.step2 = true;
            this.saveProgress();

            this.showSuccess('Métodos de autenticación configurados correctamente');
            
            // Actualizar UI
            const setupContainer = document.getElementById('setupMethodsContainer');
            if (setupContainer) {
                setupContainer.innerHTML = `
                    <div class="bg-green-50 border border-green-200 rounded-lg p-4">
                        <div class="flex items-center">
                            <i class="fas fa-check-circle text-green-600 text-xl mr-3"></i>
                            <div>
                                <h4 class="font-semibold text-green-800">Configuración Completada</h4>
                                <p class="text-green-700 text-sm">Los métodos de autenticación han sido configurados exitosamente.</p>
                            </div>
                        </div>
                    </div>
                `;
            }

        } catch (error) {
            console.error('Error configurando métodos:', error);
            this.showError('Error al configurar métodos de autenticación');
        }
    }

    async validateSetup() {
        try {
            this.showInfo('Validando configuración...');

            // Simular validación
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Marcar paso como completado
            this.userProgress.step3 = true;
            this.userProgress.passwordlessEnabled = true;
            this.saveProgress();

            this.showSuccess('Configuración validada correctamente');
            
            // Avanzar a pantalla de completación
            setTimeout(() => {
                this.currentStep = this.totalSteps + 1;
                this.updateUI();
            }, 1500);

        } catch (error) {
            console.error('Error validando configuración:', error);
            this.showError('Error al validar la configuración');
        }
    }

    showCompletionScreen() {
        const completionContainer = document.getElementById('completionScreen');
        if (completionContainer) {
            completionContainer.classList.remove('hidden');
            
            // Animación de celebración
            anime({
                targets: completionContainer,
                opacity: [0, 1],
                scale: [0.8, 1],
                duration: 600,
                easing: 'easeOutBack'
            });

            // Animar icono de éxito
            const successIcon = document.getElementById('successIcon');
            if (successIcon) {
                anime({
                    targets: successIcon,
                    scale: [0, 1.2, 1],
                    duration: 800,
                    delay: 300,
                    easing: 'easeOutBack'
                });
            }
        }

        // Ocultar wizard
        const wizardContainer = document.getElementById('wizardContainer');
        if (wizardContainer) {
            wizardContainer.classList.add('hidden');
        }
    }

    navigateToTAP() {
        window.location.href = 'tap.html';
    }

    initializeAnimations() {
        // Animaciones iniciales
        const heroSection = document.getElementById('heroSection');
        if (heroSection) {
            anime({
                targets: heroSection,
                opacity: [0, 1],
                translateY: [-30, 0],
                duration: 800,
                easing: 'easeOutQuad'
            });
        }

        // Animar tarjetas de pasos
        const stepCards = document.querySelectorAll('.step-card');
        if (stepCards.length > 0) {
            anime({
                targets: stepCards,
                opacity: [0, 1],
                translateY: [20, 0],
                duration: 600,
                delay: anime.stagger(100),
                easing: 'easeOutQuad'
            });
        }
    }

    showAuthenticationRequired() {
        const authModal = document.getElementById('authRequiredModal');
        if (authModal) {
            authModal.classList.remove('hidden');
        }
    }

    // Utilidades para mensajes
    showSuccess(message) {
        this.showMessage(message, 'success');
    }

    showError(message) {
        this.showMessage(message, 'error');
    }

    showInfo(message) {
        this.showMessage(message, 'info');
    }

    showMessage(message, type = 'info') {
        const messageContainer = document.getElementById('messageContainer');
        if (!messageContainer) return;

        const colors = {
            success: 'bg-green-100 border-green-400 text-green-700',
            error: 'bg-red-100 border-red-400 text-red-700',
            info: 'bg-blue-100 border-blue-400 text-blue-700'
        };

        const icons = {
            success: 'fa-check-circle',
            error: 'fa-exclamation-circle',
            info: 'fa-info-circle'
        };

        const messageHTML = `
            <div class="${colors[type]} border px-4 py-3 rounded mb-4 flex items-center">
                <i class="fas ${icons[type]} mr-3"></i>
                <span>${message}</span>
                <button onclick="this.parentElement.remove()" class="ml-auto text-lg">&times;</button>
            </div>
        `;

        messageContainer.innerHTML = messageHTML;

        // Auto-remover después de 5 segundos
        setTimeout(() => {
            const messageElement = messageContainer.firstElementChild;
            if (messageElement) {
                messageElement.remove();
            }
        }, 5000);

        // Animar entrada
        anime({
            targets: messageContainer.firstElementChild,
            opacity: [0, 1],
            translateY: [-20, 0],
            duration: 300,
            easing: 'easeOutQuad'
        });
    }
}

// Instancia global del administrador principal
window.passwordlessManager = new PasswordlessManager();