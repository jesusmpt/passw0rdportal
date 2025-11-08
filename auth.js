/**
 * Módulo de Autenticación Microsoft Entra ID
 * Implementa MSAL.js para autenticación OAuth 2.0
 */

class AuthManager {
    constructor() {
        this.msalConfig = {
            auth: {
                clientId: '8dcec823-8928-41f7-a9b5-e85db1dc6c12', // Reemplazar con Client ID real
                authority: 'https://login.microsoftonline.com/9ff87f7c-8358-46b5-88bc-d73c09ce789f', // Reemplazar con Tenant ID
                redirectUri: window.location.origin,
                postLogoutRedirectUri: window.location.origin
            },
            cache: {
                cacheLocation: 'sessionStorage',
                storeAuthStateInCookie: false
            },
            system: {
                loggerOptions: {
                    loggerCallback: (level, message, containsPii) => {
                        if (containsPii) {
                            return;
                        }
                        switch (level) {
                            case msal.LogLevel.Error:
                                console.error(message);
                                return;
                            case msal.LogLevel.Info:
                                console.info(message);
                                return;
                            case msal.LogLevel.Verbose:
                                console.debug(message);
                                return;
                            case msal.LogLevel.Warning:
                                console.warn(message);
                                return;
                        }
                    }
                }
            }
        };

        this.loginRequest = {
            scopes: ['User.Read', 'UserAuthenticationMethod.ReadWrite.All']
        };

        this.msalInstance = null;
        this.currentUser = null;
        this.isAuthenticated = false;

        this.init();
    }

    async init() {
        try {
            // Inicializar MSAL
            this.msalInstance = new msal.PublicClientApplication(this.msalConfig);
            
            // Manejar redirección de login
            await this.msalInstance.initialize();
            
            // Verificar si hay una sesión activa
            const accounts = this.msalInstance.getAllAccounts();
            if (accounts.length > 0) {
                this.msalInstance.setActiveAccount(accounts[0]);
                this.currentUser = accounts[0];
                this.isAuthenticated = true;
                this.updateUI();
            }

            // Manejar redirecciones
            this.msalInstance.handleRedirectPromise().then(response => {
                if (response) {
                    this.msalInstance.setActiveAccount(response.account);
                    this.currentUser = response.account;
                    this.isAuthenticated = true;
                    this.updateUI();
                    window.location.href = 'index.html';
                }
            }).catch(error => {
                console.error('Error en handleRedirectPromise:', error);
                this.showError('Error de autenticación: ' + error.message);
            });

        } catch (error) {
            console.error('Error inicializando MSAL:', error);
            this.showError('Error al inicializar la aplicación');
        }
    }

    async login() {
        try {
            if (!this.msalInstance) {
                await this.init();
            }
            
            await this.msalInstance.loginRedirect(this.loginRequest);
        } catch (error) {
            console.error('Error en login:', error);
            this.showError('Error al iniciar sesión: ' + error.message);
        }
    }

    async logout() {
        try {
            if (this.msalInstance) {
                await this.msalInstance.logoutRedirect();
            }
        } catch (error) {
            console.error('Error en logout:', error);
            this.showError('Error al cerrar sesión');
        }
    }

    async getAccessToken() {
        try {
            if (!this.msalInstance || !this.currentUser) {
                throw new Error('No hay sesión activa');
            }

            const response = await this.msalInstance.acquireTokenSilent({
                scopes: this.loginRequest.scopes,
                account: this.currentUser
            });

            return response.accessToken;
        } catch (error) {
            console.error('Error obteniendo token:', error);
            
            // Intentar con redirección interactiva
            if (error instanceof msal.InteractionRequiredAuthError) {
                try {
                    const response = await this.msalInstance.acquireTokenRedirect({
                        scopes: this.loginRequest.scopes
                    });
                    return response.accessToken;
                } catch (redirectError) {
                    console.error('Error en redirección:', redirectError);
                    throw redirectError;
                }
            }
            throw error;
        }
    }

    async getUserProfile() {
        try {
            const token = await this.getAccessToken();
            
            const response = await fetch('https://graph.microsoft.com/v1.0/me', {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`Error Graph API: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Error obteniendo perfil:', error);
            throw error;
        }
    }

    async checkPasswordlessStatus() {
        try {
            const token = await this.getAccessToken();
            
            // Verificar métodos de autenticación del usuario
            const response = await fetch('https://graph.microsoft.com/v1.0/me/authentication/methods', {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`Error Graph API: ${response.status}`);
            }

            const methods = await response.json();
            
            // Analizar métodos passwordless habilitados
            const passwordlessMethods = methods.value.filter(method => 
                method['@odata.type'] === '#microsoft.graph.fido2AuthenticationMethod' ||
                method['@odata.type'] === '#microsoft.graph.windowsHelloForBusinessAuthenticationMethod' ||
                method['@odata.type'] === '#microsoft.graph.microsoftAuthenticatorAuthenticationMethod'
            );

            return {
                hasPasswordless: passwordlessMethods.length > 0,
                methods: passwordlessMethods,
                allMethods: methods.value
            };
        } catch (error) {
            console.error('Error verificando estado passwordless:', error);
            return {
                hasPasswordless: false,
                methods: [],
                allMethods: [],
                error: error.message
            };
        }
    }

    updateUI() {
        // Actualizar elementos de UI con información del usuario
        const userNameElement = document.getElementById('userName');
        const userEmailElement = document.getElementById('userEmail');
        
        if (userNameElement && this.currentUser) {
            userNameElement.textContent = this.currentUser.name || 'Usuario';
        }
        
        if (userEmailElement && this.currentUser) {
            userEmailElement.textContent = this.currentUser.username || '';
        }
    }

    showError(message) {
        // Mostrar mensaje de error al usuario
        const errorContainer = document.getElementById('errorContainer');
        if (errorContainer) {
            errorContainer.innerHTML = `
                <div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
                    <strong>Error:</strong> ${message}
                </div>
            `;
        }
        
        // También mostrar en consola
        console.error('AuthManager Error:', message);
    }

    showSuccess(message) {
        // Mostrar mensaje de éxito al usuario
        const successContainer = document.getElementById('successContainer');
        if (successContainer) {
            successContainer.innerHTML = `
                <div class="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
                    <strong>Éxito:</strong> ${message}
                </div>
            `;
        }
    }
}

// Instancia global del administrador de autenticación
window.authManager = new AuthManager();

// Funciones auxiliares para UI
window.showLoginModal = function() {
    const modal = document.getElementById('loginModal');
    if (modal) {
        modal.classList.remove('hidden');
    }
};

window.hideLoginModal = function() {
    const modal = document.getElementById('loginModal');
    if (modal) {
        modal.classList.add('hidden');
    }
};

// Manejadores de eventos para botones de autenticación
document.addEventListener('DOMContentLoaded', function() {
    const loginBtn = document.getElementById('loginBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    
    if (loginBtn) {
        loginBtn.addEventListener('click', () => {
            window.authManager.login();
        });
    }
    
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            window.authManager.logout();
        });
    }
});