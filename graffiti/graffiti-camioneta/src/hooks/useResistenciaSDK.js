// Adaptador del SDK de Resistencia para React
// Este hook permite usar el SDK en componentes React

import { useEffect, useRef, useState } from 'react';

/**
 * Hook personalizado para integrar el SDK de Resistencia en React
 */
export const useResistenciaSDK = (config) => {
    const [initialized, setInitialized] = useState(false);
    const [playerStats, setPlayerStats] = useState(null);
    const [appData, setAppData] = useState(null);
    const [language, setLanguage] = useState('es');
    const resultSent = useRef(false);

    useEffect(() => {
        const handleMessage = (event) => {
            if (event.data && event.data.source === 'FlujoNarrativoUsuario') {
                console.log('📩 Mensaje recibido del orquestador', event.data);

                // Parsear datos
                try {
                    const parsedAppData = event.data.appData ? JSON.parse(event.data.appData) : {};
                    setAppData(parsedAppData);
                } catch (e) {
                    console.error('Error parseando appData', e);
                    setAppData({});
                }

                setPlayerStats(event.data.playerStats || {});
                setLanguage(event.data.cc || 'es');
                setInitialized(true);

                // Callback de inicialización
                if (config.onInit) {
                    config.onInit(event.data.appData ? JSON.parse(event.data.appData) : {}, event.data.playerStats || {});
                }
            }
        };

        window.addEventListener('message', handleMessage);
        console.log('🎮 SDK React: Esperando configuración del padre...');

        return () => {
            window.removeEventListener('message', handleMessage);
        };
    }, [config]);

    /**
     * Valida que el jugador tenga todos los items requeridos
     */
    const validateInventory = () => {
        if (!config.requiredItems || config.requiredItems.length === 0) {
            return { valid: true, missing: [] };
        }

        if (!playerStats || !playerStats.inventario) {
            return { valid: false, missing: config.requiredItems };
        }

        const inventory = playerStats.inventario;
        const inventoryNames = inventory.map(item =>
            typeof item === 'string' ? item : item.nombre
        );

        const missing = [];

        for (const requiredItem of config.requiredItems) {
            const hasItem = inventoryNames.some(name =>
                name.toLowerCase() === requiredItem.toLowerCase()
            );

            if (!hasItem) {
                missing.push(requiredItem);
            }
        }

        return { valid: missing.length === 0, missing };
    };

    /**
     * Envía el resultado al orquestador
     */
    const sendResult = (status, xpDelta = 0, message = '') => {
        if (resultSent.current) {
            console.warn('⚠️ Resultado ya enviado, ignorando duplicado');
            return;
        }

        const payload = {
            source: 'ResistenciaApp',
            appName: config.appName || 'GraffitiCamioneta',
            type: 'app-result',
            status: status,
            xpDelta: xpDelta,
            message: message || `App completada con status: ${status}`
        };

        console.log('📤 Enviando resultado al orquestador', payload);
        window.parent.postMessage(payload, '*');

        resultSent.current = true;

        // Callback de completado
        if (config.onComplete) {
            config.onComplete(status === 'success');
        }
    };

    /**
   * Gasta XP (para compras in-game)
   */
    const spendXP = (amount) => {
        if (!playerStats || !playerStats.xp) {
            console.warn('⚠️ No hay stats de jugador disponibles');
            return false;
        }

        if (playerStats.xp < amount) {
            console.warn(`⚠️ XP insuficiente. Tienes ${playerStats.xp}, necesitas ${amount}`);
            return false;
        }

        // Actualizar localmente
        setPlayerStats(prev => ({
            ...prev,
            xp: prev.xp - amount
        }));

        console.log(`💰 Gastados ${amount} XP. Nuevo balance: ${playerStats.xp - amount}`);
        return true;
    };

    return {
        initialized,
        playerStats,
        appData,
        language,
        validateInventory,
        sendResult,
        spendXP
    };
};
