/**
 * Módulo de Gestión de Temporary Access Pass (TAP)
 * Maneja la generación, visualización y gestión de TAPs
 */

class TAPManager {
    constructor() {
        this.currentTAP = null;
        this.tapHistory = [];
        this.init();
    }

    init() {
        // Cargar historial desde localStorage
        const savedHistory = localStorage.getItem('tapHistory');
        if (savedHistory) {
            try {
                this.tapHistory = JSON.parse(savedHistory);
            } catch (error) {
                console.error('Error cargando historial TAP:', error);
                this.tapHistory = [];
            }
        }
    }

    async generateTAP(config = {}) {
        try {
            // Verificar autenticación
            if (!window.authManager || !window.authManager.isAuthenticated) {
                throw new Error('Usuario no autenticado');
            }

            // Configuración por defecto
            const tapConfig = {
                lifetimeInMinutes: config.lifetimeInMinutes || 60,
                isUsableOnce: config.isUsableOnce || false,
                ...config
            };

            // Obtener token de acceso
            const token = await window.authManager.getAccessToken();
            
            // Preparar cuerpo de la solicitud
            const requestBody = {
                '@odata.type': '#microsoft.graph.temporaryAccessPassAuthenticationMethod',
                'lifetimeInMinutes': tapConfig.lifetimeInMinutes,
                'isUsableOnce': tapConfig.isUsableOnce
            };

            // Realizar solicitud a Microsoft Graph API
            const response = await fetch('https://graph.microsoft.com/v1.0/me/authentication/temporaryAccessPassMethods', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`Error Graph API: ${errorData.error?.message || response.statusText}`);
            }

            const result = await response.json();
            
            // Crear objeto TAP con información completa
            const tapData = {
                id: result.id,
                temporaryAccessPass: result.temporaryAccessPass,
                createdDateTime: result.createdDateTime,
                lifetimeInMinutes: result.lifetimeInMinutes,
                isUsableOnce: result.isUsableOnce,
                expiresDateTime: new Date(new Date(result.createdDateTime).getTime() + (result.lifetimeInMinutes * 60000)).toISOString(),
                createdBy: window.authManager.currentUser.username
            };

            // Almacenar TAP actual
            this.currentTAP = tapData;
            
            // Agregar al historial
            this.addToHistory(tapData);
            
            // Mostrar TAP generado
            this.displayGeneratedTAP(tapData);
            
            // Iniciar countdown
            this.startTAPCountdown(tapData);
            
            return tapData;

        } catch (error) {
            console.error('Error generando TAP:', error);
            this.showTAPError('Error al generar TAP: ' + error.message);
            throw error;
        }
    }

    async getTAPMethods() {
        try {
            if (!window.authManager || !window.authManager.isAuthenticated) {
                throw new Error('Usuario no autenticado');
            }

            const token = await window.authManager.getAccessToken();
            
            const response = await fetch('https://graph.microsoft.com/v1.0/me/authentication/temporaryAccessPassMethods', {
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
            console.error('Error obteniendo métodos TAP:', error);
            return { value: [] };
        }
    }

    async deleteTAP(tapId) {
        try {
            if (!window.authManager || !window.authManager.isAuthenticated) {
                throw new Error('Usuario no autenticado');
            }

            const token = await window.authManager.getAccessToken();
            
            const response = await fetch(`https://graph.microsoft.com/v1.0/me/authentication/temporaryAccessPassMethods/${tapId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok && response.status !== 204) {
                throw new Error(`Error Graph API: ${response.status}`);
            }

            // Remover del historial local
            this.tapHistory = this.tapHistory.filter(tap => tap.id !== tapId);
            this.saveHistory();
            
            this.showTAPSuccess('TAP eliminado exitosamente');
            this.refreshTAPList();
            
            return true;
        } catch (error) {
            console.error('Error eliminando TAP:', error);
            this.showTAPError('Error al eliminar TAP: ' + error.message);
            return false;
        }
    }

    addToHistory(tapData) {
        // Limitar historial a los últimos 10 TAPs
        if (this.tapHistory.length >= 10) {
            this.tapHistory = this.tapHistory.slice(-9);
        }
        
        this.tapHistory.push(tapData);
        this.saveHistory();
    }

    saveHistory() {
        try {
            localStorage.setItem('tapHistory', JSON.stringify(this.tapHistory));
        } catch (error) {
            console.error('Error guardando historial:', error);
        }
    }

    displayGeneratedTAP(tapData) {
        const tapContainer = document.getElementById('tapDisplayContainer');
        const tapCodeElement = document.getElementById('tapCode');
        const tapExpiresElement = document.getElementById('tapExpires');
        const tapCountdownElement = document.getElementById('tapCountdown');

        if (tapCodeElement) {
            tapCodeElement.textContent = tapData.temporaryAccessPass;
            tapCodeElement.classList.remove('hidden');
        }

        if (tapExpiresElement) {
            const expiresDate = new Date(tapData.expiresDateTime);
            tapExpiresElement.textContent = `Expira: ${expiresDate.toLocaleString()}`;
        }

        if (tapContainer) {
            tapContainer.classList.remove('hidden');
            // Animación de revelación
            anime({
                targets: tapContainer,
                opacity: [0, 1],
                translateY: [-20, 0],
                duration: 500,
                easing: 'easeOutQuad'
            });
        }

        // Mostrar botón de copiar
        const copyBtn = document.getElementById('copyTAPBtn');
        if (copyBtn) {
            copyBtn.classList.remove('hidden');
        }
    }

    startTAPCountdown(tapData) {
        const countdownElement = document.getElementById('tapCountdown');
        if (!countdownElement) return;

        const expiresTime = new Date(tapData.expiresDateTime).getTime();
        
        const updateCountdown = () => {
            const now = Date.now();
            const remaining = expiresTime - now;
            
            if (remaining <= 0) {
                countdownElement.textContent = 'TAP expirado';
                countdownElement.classList.add('text-red-600');
                this.hideTAPDisplay();
                return;
            }
            
            const minutes = Math.floor(remaining / 60000);
            const seconds = Math.floor((remaining % 60000) / 1000);
            
            countdownElement.textContent = `Tiempo restante: ${minutes}:${seconds.toString().padStart(2, '0')}`;
            
            // Cambiar color según tiempo restante
            if (minutes < 5) {
                countdownElement.classList.add('text-orange-600');
            } else if (minutes < 15) {
                countdownElement.classList.add('text-yellow-600');
            } else {
                countdownElement.classList.add('text-green-600');
            }
        };
        
        updateCountdown();
        const interval = setInterval(updateCountdown, 1000);
        
        // Limpiar intervalo cuando se oculte el TAP
        this.currentCountdownInterval = interval;
    }

    hideTAPDisplay() {
        const tapContainer = document.getElementById('tapDisplayContainer');
        const tapCodeElement = document.getElementById('tapCode');
        const copyBtn = document.getElementById('copyTAPBtn');

        if (tapContainer) {
            tapContainer.classList.add('hidden');
        }
        
        if (tapCodeElement) {
            tapCodeElement.classList.add('hidden');
        }
        
        if (copyBtn) {
            copyBtn.classList.add('hidden');
        }

        // Limpiar countdown
        if (this.currentCountdownInterval) {
            clearInterval(this.currentCountdownInterval);
            this.currentCountdownInterval = null;
        }

        this.currentTAP = null;
    }

    copyTAPToClipboard() {
        if (!this.currentTAP || !this.currentTAP.temporaryAccessPass) {
            this.showTAPError('No hay TAP para copiar');
            return;
        }

        navigator.clipboard.writeText(this.currentTAP.temporaryAccessPass).then(() => {
            this.showTAPSuccess('TAP copiado al portapapeles');
            
            // Efecto visual de copiado
            const copyBtn = document.getElementById('copyTAPBtn');
            if (copyBtn) {
                const originalText = copyBtn.innerHTML;
                copyBtn.innerHTML = '<i class="fas fa-check"></i> ¡Copiado!';
                copyBtn.classList.add('bg-green-600');
                
                setTimeout(() => {
                    copyBtn.innerHTML = originalText;
                    copyBtn.classList.remove('bg-green-600');
                }, 2000);
            }
        }).catch(error => {
            console.error('Error copiando TAP:', error);
            this.showTAPError('Error al copiar TAP');
        });
    }

    refreshTAPList() {
        const tapListContainer = document.getElementById('tapHistoryList');
        if (!tapListContainer) return;

        if (this.tapHistory.length === 0) {
            tapListContainer.innerHTML = '<p class="text-gray-500 text-center py-4">No hay TAPs generados</p>';
            return;
        }

        const tapListHTML = this.tapHistory.map(tap => {
            const createdDate = new Date(tap.createdDateTime).toLocaleString();
            const expiresDate = new Date(tap.expiresDateTime).toLocaleString();
            const isExpired = new Date(tap.expiresDateTime) < new Date();

            return `
                <div class="bg-white rounded-lg border p-4 mb-3 ${isExpired ? 'opacity-60' : ''}">
                    <div class="flex justify-between items-start">
                        <div class="flex-1">
                            <div class="flex items-center mb-2">
                                <span class="text-sm font-medium ${isExpired ? 'text-red-600' : 'text-green-600'}">
                                    ${isExpired ? 'EXPIRADO' : 'ACTIVO'}
                                </span>
                                ${tap.isUsableOnce ? '<span class="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">Uso Único</span>' : ''}
                            </div>
                            <p class="text-sm text-gray-600">Creado: ${createdDate}</p>
                            <p class="text-sm text-gray-600">Expira: ${expiresDate}</p>
                            <p class="text-sm text-gray-600">Duración: ${tap.lifetimeInMinutes} minutos</p>
                        </div>
                        <button 
                            onclick="tapManager.deleteTAP('${tap.id}')" 
                            class="text-red-600 hover:text-red-800 ml-4"
                            title="Eliminar TAP">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        tapListContainer.innerHTML = tapListHTML;
    }

    showTAPError(message) {
        const errorContainer = document.getElementById('tapErrorContainer');
        if (errorContainer) {
            errorContainer.innerHTML = `
                <div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
                    <strong>Error:</strong> ${message}
                </div>
            `;
            
            // Auto-ocultar después de 5 segundos
            setTimeout(() => {
                errorContainer.innerHTML = '';
            }, 5000);
        }
    }

    showTAPSuccess(message) {
        const successContainer = document.getElementById('tapSuccessContainer');
        if (successContainer) {
            successContainer.innerHTML = `
                <div class="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
                    <strong>Éxito:</strong> ${message}
                </div>
            `;
            
            // Auto-ocultar después de 3 segundos
            setTimeout(() => {
                successContainer.innerHTML = '';
            }, 3000);
        }
    }
}

// Instancia global del administrador TAP
window.tapManager = new TAPManager();

// Manejadores de eventos para el formulario TAP
document.addEventListener('DOMContentLoaded', function() {
    const generateTAPBtn = document.getElementById('generateTAPBtn');
    const copyTAPBtn = document.getElementById('copyTAPBtn');
    const refreshHistoryBtn = document.getElementById('refreshHistoryBtn');
    const tapForm = document.getElementById('tapForm');

    if (generateTAPBtn && tapForm) {
        generateTAPBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            
            if (!window.authManager || !window.authManager.isAuthenticated) {
                tapManager.showTAPError('Debe iniciar sesión primero');
                return;
            }

            const formData = new FormData(tapForm);
            const config = {
                lifetimeInMinutes: parseInt(formData.get('lifetime')) || 60,
                isUsableOnce: formData.get('usableOnce') === 'on'
            };

            try {
                generateTAPBtn.disabled = true;
                generateTAPBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generando...';
                
                await tapManager.generateTAP(config);
                
                generateTAPBtn.innerHTML = '<i class="fas fa-key"></i> Generar Nuevo TAP';
                generateTAPBtn.disabled = false;
            } catch (error) {
                generateTAPBtn.innerHTML = '<i class="fas fa-key"></i> Generar TAP';
                generateTAPBtn.disabled = false;
            }
        });
    }

    if (copyTAPBtn) {
        copyTAPBtn.addEventListener('click', () => {
            tapManager.copyTAPToClipboard();
        });
    }

    if (refreshHistoryBtn) {
        refreshHistoryBtn.addEventListener('click', () => {
            tapManager.refreshTAPList();
        });
    }

    // Cargar historial al iniciar
    setTimeout(() => {
        tapManager.refreshTAPList();
    }, 1000);
});