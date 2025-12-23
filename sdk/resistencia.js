/**
 * Resistencia SDK v1.0.0
 * SDK para desarrollo de mini-aplicaciones en el ecosistema "La Resistencia"
 * 
 * @license MIT
 * @author La Resistencia Team
 */

(function (window) {
    'use strict';

    /**
     * Clase principal del SDK
     */
    class ResistenciaApp {
        constructor(config) {
            // Validación de configuración
            if (!config.appName) {
                throw new Error('[ResistenciaSDK] appName es requerido');
            }

            // Configuración
            this.appName = config.appName;
            this.onInit = config.onInit || (() => { });
            this.onComplete = config.onComplete || (() => { });
            this.requiredItems = config.requiredItems || [];
            this.debug = config.debug || false;

            // Estado interno
            this.language = 'es';
            this.playerStats = null;
            this.appData = null;
            this.initialized = false;
            this.resultSent = false;

            // Setup
            this._setupMessageListener();
            this.log('SDK inicializado', 'info');
        }

        /**
         * Inicializa la app y espera mensaje del padre
         */
        init() {
            this.log('Esperando configuración del padre...', 'info');

            // Timeout de seguridad
            setTimeout(() => {
                if (!this.initialized) {
                    this.log('⚠️ No se recibió configuración del padre en 5s', 'warn');
                }
            }, 5000);
        }

        /**
         * Configura el listener de mensajes del padre
         * @private
         */
        _setupMessageListener() {
            window.addEventListener('message', (event) => {
                if (event.data && event.data.source === 'FlujoNarrativoUsuario') {
                    this.log('📩 Mensaje recibido del padre', 'info', event.data);

                    // Parsear datos
                    try {
                        this.appData = event.data.appData ? JSON.parse(event.data.appData) : {};
                    } catch (e) {
                        this.log('Error parseando appData', 'error', e);
                        this.appData = {};
                    }

                    this.playerStats = event.data.playerStats || {};
                    this.language = event.data.cc || 'es';
                    this.successRecompensaId = event.data.successRecompensaId;
                    this.failureRecompensaId = event.data.failureRecompensaId;

                    // Marcar como inicializado
                    this.initialized = true;

                    // Callback de inicialización
                    try {
                        this.onInit(this.appData, this.playerStats);
                    } catch (e) {
                        this.log('Error en onInit callback', 'error', e);
                    }
                }
            });
        }

        /**
         * Envía el resultado al padre
         * @param {string} status - 'success' o 'failure'
         * @param {number} xpDelta - Cambio en XP (negativo para costos)
         * @param {string} message - Mensaje opcional para el log
         */
        sendResult(status, xpDelta = 0, message = '') {
            // Prevenir envíos duplicados
            if (this.resultSent) {
                this.log('⚠️ Resultado ya enviado, ignorando duplicado', 'warn');
                return;
            }

            // Validar status
            const validStatuses = ['success', 'failure', 'failure_normal', 'failure_exhaustive'];
            if (!validStatuses.includes(status)) {
                this.log(`⚠️ Status inválido: ${status}. Usando 'failure'`, 'warn');
                status = 'failure';
            }

            const payload = {
                source: 'ResistenciaApp',
                appName: this.appName,
                type: 'app-result',
                status: status,
                xpDelta: xpDelta,
                message: message || `App ${this.appName} completada con status: ${status}`
            };

            // Añadir recompensaId si está disponible
            if (status === 'success' && this.successRecompensaId) {
                payload.recompensaId = this.successRecompensaId;
            } else if (status.startsWith('failure') && this.failureRecompensaId) {
                payload.recompensaId = this.failureRecompensaId;
            }

            this.log('📤 Enviando resultado al padre', 'info', payload);
            window.parent.postMessage(payload, '*');

            this.resultSent = true;

            // Callback de completado
            try {
                this.onComplete(status === 'success');
            } catch (e) {
                this.log('Error en onComplete callback', 'error', e);
            }
        }

        /**
         * Valida que el jugador tenga todos los items requeridos
         * @returns {Object} { valid: boolean, missing: string[] }
         */
        validateInventory() {
            if (!this.requiredItems || this.requiredItems.length === 0) {
                return { valid: true, missing: [] };
            }

            if (!this.playerStats || !this.playerStats.inventario) {
                this.log('⚠️ No hay inventario del jugador', 'warn');
                return { valid: false, missing: this.requiredItems };
            }

            const inventory = this.playerStats.inventario;
            const inventoryNames = inventory.map(item =>
                typeof item === 'string' ? item : item.nombre
            );

            const missing = [];

            for (const requiredItem of this.requiredItems) {
                const hasItem = inventoryNames.some(name =>
                    name.toLowerCase() === requiredItem.toLowerCase()
                );

                if (!hasItem) {
                    missing.push(requiredItem);
                }
            }

            const valid = missing.length === 0;

            if (!valid) {
                this.log(`❌ Items faltantes: ${missing.join(', ')}`, 'warn');
            } else {
                this.log('✅ Inventario validado correctamente', 'info');
            }

            return { valid, missing };
        }

        /**
         * Traduce una clave según el idioma actual
         * @param {string} key - Clave de traducción
         * @returns {string} Texto traducido
         */
        translate(key) {
            const translations = ResistenciaApp.translations[this.language] || ResistenciaApp.translations.es;
            return translations[key] || key;
        }

        /**
         * Logger con niveles
         * @param {string} message - Mensaje a loggear
         * @param {string} type - 'info', 'warn', 'error'
         * @param {*} data - Datos adicionales
         */
        log(message, type = 'info', data = null) {
            if (!this.debug && type === 'info') return;

            const prefix = `[ResistenciaSDK:${this.appName}]`;
            const styles = {
                info: 'color: #00ff00',
                warn: 'color: #ffc107',
                error: 'color: #ff3333'
            };

            if (data) {
                console[type === 'error' ? 'error' : 'log'](`%c${prefix} ${message}`, styles[type], data);
            } else {
                console[type === 'error' ? 'error' : 'log'](`%c${prefix} ${message}`, styles[type]);
            }
        }
    }

    /**
     * Helpers estáticos
     */
    ResistenciaApp.helpers = {
        /**
         * Verifica si un item existe en el inventario
         */
        hasItem(inventory, itemName) {
            if (!inventory || !Array.isArray(inventory)) return false;

            return inventory.some(item => {
                const name = typeof item === 'string' ? item : item.nombre;
                return name.toLowerCase() === itemName.toLowerCase();
            });
        },

        /**
         * Verifica si todos los items existen
         */
        hasAllItems(inventory, itemList) {
            return itemList.every(item => this.hasItem(inventory, item));
        },

        /**
         * Muestra un mensaje de error
         */
        showError(message, containerId = 'app-message') {
            const container = document.getElementById(containerId);
            if (!container) return;

            container.innerHTML = `
        <div class="resistencia-message resistencia-error">
          <div class="resistencia-glitch">${message}</div>
        </div>
      `;
            container.style.display = 'block';
        },

        /**
         * Muestra un mensaje de éxito
         */
        showSuccess(message, containerId = 'app-message') {
            const container = document.getElementById(containerId);
            if (!container) return;

            container.innerHTML = `
        <div class="resistencia-message resistencia-success">
          ${message}
        </div>
      `;
            container.style.display = 'block';
        },

        /**
         * Muestra/oculta loading
         */
        showLoading(show, containerId = 'app-loading') {
            const container = document.getElementById(containerId);
            if (!container) return;

            container.style.display = show ? 'flex' : 'none';
        },

        /**
         * Formatea moneda
         */
        formatCurrency(amount) {
            return new Intl.NumberFormat('es-MX', {
                style: 'currency',
                currency: 'MXN'
            }).format(amount);
        },

        /**
         * Formatea XP
         */
        formatXP(xp) {
            return `${xp >= 0 ? '+' : ''}${xp} XP`;
        },

        /**
         * Efecto glitch en un elemento
         */
        glitchEffect(elementId) {
            const element = document.getElementById(elementId);
            if (!element) return;

            element.classList.add('resistencia-glitch-active');
            setTimeout(() => {
                element.classList.remove('resistencia-glitch-active');
            }, 500);
        },

        /**
         * Efecto pulse en un elemento
         */
        pulseEffect(elementId) {
            const element = document.getElementById(elementId);
            if (!element) return;

            element.classList.add('resistencia-pulse');
            setTimeout(() => {
                element.classList.remove('resistencia-pulse');
            }, 1000);
        }
    };

    /**
     * Traducciones
     */
    ResistenciaApp.translations = {
        es: {
            success: 'Éxito',
            failure: 'Fallo',
            missingItems: 'Te faltan los siguientes items',
            insufficientXP: 'XP insuficiente',
            loading: 'Cargando...',
            close: 'Cerrar',
            continue: 'Continuar',
            cancel: 'Cancelar',
            confirm: 'Confirmar'
        },
        en: {
            success: 'Success',
            failure: 'Failure',
            missingItems: 'You are missing the following items',
            insufficientXP: 'Insufficient XP',
            loading: 'Loading...',
            close: 'Close',
            continue: 'Continue',
            cancel: 'Cancel',
            confirm: 'Confirm'
        }
    };

    /**
     * Versión del SDK
     */
    ResistenciaApp.version = '1.0.0';

    // Exportar
    window.ResistenciaApp = ResistenciaApp;

    // Log de carga
    console.log('%c[ResistenciaSDK] v' + ResistenciaApp.version + ' cargado', 'color: #00ff00; font-weight: bold');

})(window);
