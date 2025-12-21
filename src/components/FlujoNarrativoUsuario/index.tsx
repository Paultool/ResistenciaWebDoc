import 'aframe';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { gameServiceUser, PlayerStats } from '../../services/GameServiceUser';
import { fetchAndConvertSubtitle } from '../../utils/subtitleUtils';

// Import types from separate file
import type {
    FlujoNarrativoUsuarioProps,
    AppResult,
    RecursoMultimediaData,
    FlujoNarrativoData,
    HistoriaData,
    RecompensaData,
    PersonajeData,
    RentalAppConfig,
    HotspotConfig
} from './types';

// Import translations from separate file
import { flujoTranslations, getLocalizedContent } from './translations';

const FlujoNarrativoUsuario = ({ historiaId, onBack, onUpdateProfile }: FlujoNarrativoUsuarioProps) => {
    const { language } = useLanguage();
    const [historias, setHistorias] = useState<HistoriaData[]>([]);
    const [selectedHistoriaId, setSelectedHistoriaId] = useState<number | null>(null);
    const [flujoData, setFlujoData] = useState<FlujoNarrativoData[]>([]);
    const [recursosData, setRecursosData] = useState<RecursoMultimediaData[]>([]);
    const [recompensasData, setRecompensasData] = useState<RecompensaData[]>([]);
    const [personajesData, setPersonajesData] = useState<PersonajeData[]>([]);
    const [currentStepIndex, setCurrentStepIndex] = useState(0);
    const [showStepContent, setShowStepContent] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showEndMessage, setShowEndMessage] = useState(false);
    const [notification, setNotification] = useState<string | null>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    // --- LOCALIZATION HOOKS & SUBS PERSISTENCE ---

    const t = flujoTranslations[language];

    useEffect(() => {
        // Automatically enable subtitles if language is English, disable for Spanish
        if (language === 'en') {
            setSubtitlesEnabled(true);
        } else {
            setSubtitlesEnabled(false);
        }
    }, [language]);

    const [historiasVisitadas, setHistoriasVisitadas] = useState<number[]>([]);
    const [playerStats, setPlayerStats] = useState<PlayerStats | null>(null);
    const [showAudioOverlay, setShowAudioOverlay] = useState(false);
    const iframeRef = useRef<HTMLIFrameElement>(null);

    const [lockedHistoryModal, setLockedHistoryModal] = useState<{ historia: HistoriaData, historiaMadre: HistoriaData } | null>(null);
    const [hotspotModal, setHotspotModal] = useState<HotspotConfig | null>(null);
    const [discoveredHotspots, setDiscoveredHotspots] = useState<number>(0);
    const totalHotspotsRef = useRef<number>(0);
    const discoveredHotspotIds = useRef<Set<string>>(new Set());
    const { user, loading: authLoading } = useAuth();
    const [isHotspotModalOpen, setIsHotspotModalOpen] = useState(false);
    const [backgroundMusicUrl, setBackgroundMusicUrl] = useState<string | null>(null);
    const [backgroundMusicVolume, setBackgroundMusicVolume] = useState(0.3);
    const backgroundAudioRef = useRef<HTMLAudioElement | null>(null);
    const [showVolumeControl, setShowVolumeControl] = useState(false);
    const [showHeightControl, setShowHeightControl] = useState(false);
    const [cameraHeight, setCameraHeight] = useState(-0.8);
    const [isMobile, setIsMobile] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [showInitial3DPopup, setShowInitial3DPopup] = useState(false);
    const [subtitlesEnabled, setSubtitlesEnabled] = useState(false);
    const [subtitleUrl, setSubtitleUrl] = useState<string | null>(null);
    const [hotspotSubtitleUrl, setHotspotSubtitleUrl] = useState<string | null>(null);
    const [hotspotSubtitlesEnabled, setHotspotSubtitlesEnabled] = useState(false);
    const iframeAppRef = useRef<HTMLIFrameElement>(null);
    const aframeContainerRef = useRef<HTMLDivElement>(null);

    const isStoryCompleted = React.useMemo(() => {
        if (!selectedHistoriaId || !playerStats?.historias_visitadas) return false;
        return playerStats.historias_visitadas.includes(String(selectedHistoriaId));
    }, [selectedHistoriaId, playerStats?.historias_visitadas]);

    const getRecurso = useCallback((recursoId: number | null) => {
        if (!recursoId) return null;
        return recursosData.find(r => r.id_recurso === recursoId);
    }, [recursosData]);

    const fetchPlayerStats = React.useCallback(async () => {
        if (!user) return;
        try {
            const stats = await gameServiceUser.getPlayerStats(user.id);
            setPlayerStats(stats);
        } catch (error) {
            console.error("Error al refrescar las estadísticas del jugador:", error);
            setPlayerStats({
                id: '',
                user_id: user.id,
                nivel: 1,
                xp_total: 0,
                historias_completadas: 0,
                historias_visitadas: [],
                personajes_conocidos: [],
                ubicaciones_visitadas: [],
                logros_desbloqueados: [],
                inventario: [],
                fecha_ultimo_acceso: new Date().toISOString(),
                racha_dias_consecutivos: 1,
                historias_favoritas: []
            } as PlayerStats);
        }
    }, [user]);

    const goBack = useCallback(() => {
        if (currentStepIndex > 0) {
            setCurrentStepIndex(prev => prev - 1);
            setShowStepContent(false);
        }
    }, [currentStepIndex]);

    const goNext = useCallback(() => {
        if (currentStepIndex < flujoData.length - 1) {
            setCurrentStepIndex(prev => prev + 1);
            setShowStepContent(false);
        }
    }, [currentStepIndex, flujoData.length]);

    // --- CALLBACKS & LOGIC (UNCONDITIONAL HOOKS) ---

    // Move hooks up here to avoid conditional calls
    const closeHotspotModal = React.useCallback(() => {
        setHotspotModal(null);
        setIsHotspotModalOpen(false);
        if (iframeRef.current) {
            iframeRef.current.src = '';  // Reset iframe para prevenir mensajes residuales
        }

        const modelEl = document.querySelector('[gltf-hotspot-interaction]');
        if (modelEl) {
            const obj = (modelEl as any).getObject3D('mesh');
            if (obj) {
                obj.traverse((child: any) => {
                    if (child.isMesh && child.userData && child.userData.isHotspot && child.userData.isClicked) {
                        child.userData.isClicked = false;
                        if (child.userData.originalMaterial) {
                            child.material = child.userData.originalMaterial;
                            child.material.needsUpdate = true;
                        }
                    }
                });
            }
        }

        const cameraEl = document.querySelector('a-camera');
        if (cameraEl && (window as any).AFRAME) {
            const wasdControls = (cameraEl as any).components['wasd-controls'];
            if (wasdControls) {
                wasdControls.play();
            } else {
                (cameraEl as any).play();
            }
        }
    }, []);

    const handleRecompensa = useCallback(async (result: AppResult) => {
        if (!user?.id) return;



        // --- UNIFIED XP PROTOCOL ---
        // 1. Determinar el Delta Total de XP (Ganancia neta o costo neto)
        // Preferimos 'xpDelta'. Si no existe, usamos 'costoXP' (legacy support).
        let totalXpDelta = 0;
        if (result.xpDelta !== undefined) {
            totalXpDelta = result.xpDelta;
        } else if (result.costoXP !== undefined) {
            totalXpDelta = result.costoXP;
        }

        // 2. Aplicar el cambio de XP (si existe)
        if (totalXpDelta !== 0) {
            console.log(`[Unified XP] Aplicando Delta: ${totalXpDelta} XP desde ${result.source}`);
            const { data: newStats, error: costError } = await gameServiceUser.aplicarXPDirecto(
                user.id,
                totalXpDelta,
                `App: ${result.source}` // Motivo más descriptivo
            );

            if (!costError && newStats) {
                // Actualización optimista parcial (aunque fetchPlayerStats viene después)
                setPlayerStats(newStats);
                window.dispatchEvent(new Event('statsUpdated'));
            }
        }

        // 3. Otorgar recompensa (Item/Badge)
        // La App envía solo costos operacionales en xpDelta.
        // La recompensa tiene su propio valor de XP en la BD que se aplicará aquí.
        if (result?.recompensaId && typeof result.recompensaId === 'number' && result.recompensaId > 0) {
            console.log(`[Unified XP] Otorgando Recompensa ID: ${result.recompensaId} (XP from DB will be applied)`);
            await gameServiceUser.otorgarRecompensa(
                user.id,
                result.recompensaId,
                String(selectedHistoriaId),
                false, // marcarComoVisitada
                false  // CRITICAL: Allow DB to apply reward XP separately
            );

            // Refrescar stats finales para asegurar consistencia (inventario + xp)
            await fetchPlayerStats();
            window.dispatchEvent(new Event('statsUpdated'));
        }

        // 4. NAVEGACIÓN: Avanzar al siguiente paso
        const currentStep = flujoData[currentStepIndex];
        if (!currentStep) return;

        let options: any[] | undefined | null = null;

        if (currentStep.tipo_paso === 'app') {
            const recursoActual = recursosData.find(r => r.id_recurso === currentStep.recursomultimedia_id);
            if (recursoActual && recursoActual.metadatos) {
                try {
                    const parsedMetadata = JSON.parse(recursoActual.metadatos);
                    options = parsedMetadata?.flowConfig?.opciones_siguientes_json;
                } catch (e) {
                    console.error("Error parseando metadatos:", e);
                }
            }
        }

        const resultOption = options?.find(op => op.texto === result.status);

        if (resultOption) {
            // 5. RECOMPENSA DEL PASO DEL FLUJO (adicional a la recompensa de la app)
            // Los pasos del flujo pueden tener su propia recompensa definida en flowConfig
            if (resultOption.recompensaId && resultOption.recompensaId > 0) {
                console.log(`[Unified XP] Otorgando Recompensa del Paso: ${resultOption.recompensaId}`);
                await gameServiceUser.otorgarRecompensa(
                    user.id,
                    resultOption.recompensaId,
                    String(selectedHistoriaId),
                    false,
                    false
                );
                await fetchPlayerStats();
                window.dispatchEvent(new Event('statsUpdated'));
            }

            // 6. NAVEGACIÓN: Avanzar al siguiente paso
            console.log(`[Unified XP] Navegando a siguiente paso: ${resultOption.siguiente_paso_id}`);
            setShowStepContent(false);
            const nextIndex = flujoData.findIndex(p => p.id_flujo === resultOption.siguiente_paso_id);

            if (nextIndex !== -1) {
                console.log(`[Unified XP] ✅ Navegación exitosa. Index actual: ${currentStepIndex} -> Nuevo Index: ${nextIndex}`);
                setCurrentStepIndex(nextIndex);
            } else {
                console.warn(`[Unified XP] ⚠️ ID de paso siguiente (${resultOption.siguiente_paso_id}) no encontrado en flujo. Mostrando fin.`);
                console.log("IDs disponibles:", flujoData.map(f => f.id_flujo));
                setShowEndMessage(true);
            }
        } else {
            console.warn(`[Unified XP] ⚠️ No se encontró opción para status: ${result.status}`);
        }
    }, [user, selectedHistoriaId, fetchPlayerStats, flujoData, currentStepIndex, recursosData]);


    const handleAppCompletion = React.useCallback(async (status: 'success' | 'failure', message: string) => {
        const currentStep = flujoData[currentStepIndex];
        if (!user || !currentStep) return;

        let options: any[] | undefined | null = null;

        if (currentStep.tipo_paso === 'app') {
            const recursoActual = recursosData.find(r => r.id_recurso === currentStep.recursomultimedia_id);
            if (recursoActual && recursoActual.metadatos) {
                try {
                    const parsedMetadata = JSON.parse(recursoActual.metadatos);
                    options = parsedMetadata?.flowConfig?.opciones_siguientes_json;
                } catch (e) {
                    console.error("Error parseando metadatos:", e);
                }
            }
        } else {
            options = currentStep.opciones_decision?.opciones_siguientes_json;
            closeHotspotModal();
        }

        const resultOption = options?.find(op => op.texto === status);

        if (resultOption) {
            if (resultOption.recompensaId && resultOption.recompensaId > 0 && user) {
                await gameServiceUser.otorgarRecompensa(
                    user.id,
                    resultOption.recompensaId,
                    String(selectedHistoriaId)
                );
                await fetchPlayerStats();
            }

            setShowStepContent(false);
            const nextIndex = flujoData.findIndex(p => p.id_flujo === resultOption.siguiente_paso_id);

            if (nextIndex !== -1) {
                setCurrentStepIndex(nextIndex);
            } else {
                setShowEndMessage(true);
            }
        }
    }, [flujoData, currentStepIndex, user, closeHotspotModal, fetchPlayerStats, selectedHistoriaId, recursosData]);

    const handleHistoriaSelect = useCallback((historiaId: number) => {
        setShowEndMessage(false);
        setBackgroundMusicUrl(null);
        setSelectedHistoriaId(historiaId);
        setCurrentStepIndex(0);
        setShowStepContent(false);
        setDiscoveredHotspots(0);
        totalHotspotsRef.current = 0;
        discoveredHotspotIds.current.clear();
    }, []);

    const handleHotspotClick = useCallback(async (hotspot: HotspotConfig) => {
        if (!hotspot.contentType) return;

        if (!discoveredHotspotIds.current.has(hotspot.meshName)) {
            discoveredHotspotIds.current.add(hotspot.meshName);
            setDiscoveredHotspots(prev => prev + 1);

            if (hotspot.recompensaId && hotspot.contentType !== 'interactive') {
                const recompensa = recompensasData.find(r => r.id_recompensa === hotspot.recompensaId);
                if (recompensa && user?.id) {
                    setNotification(`¡XP Ganado!`);
                    setTimeout(() => setNotification(null), 5000);
                    await gameServiceUser.otorgarRecompensa(user.id, recompensa.id_recompensa, String(selectedHistoriaId));
                    await fetchPlayerStats();
                }
            }

            if (hotspot.personajeId && user?.id) {
                const personaje = personajesData.find(p => p.id_personaje === hotspot.personajeId);
                if (personaje) {
                    const { error } = await gameServiceUser.knowCharacter(user.id, personaje.nombre);
                    if (!error) {
                        await fetchPlayerStats();
                        setNotification(`Ficha: ${personaje.nombre}`);
                        setTimeout(() => setNotification(null), 3000);
                    }
                }
            }
        }

        setHotspotModal(hotspot);
        setIsHotspotModalOpen(true);
        new Audio('https://cdn.aframe.io/360-image-gallery-boilerplate/audio/click.ogg').play().catch(() => { });
    }, [user, selectedHistoriaId, recompensasData, personajesData, fetchPlayerStats]);

    const handleReturnToMenu = useCallback(() => {
        console.log("🎵 Deteniendo música de fondo y volviendo al menú.");
        setBackgroundMusicUrl(null);
        setSelectedHistoriaId(null);
        setFlujoData([]);
        setCurrentStepIndex(0);
        setShowEndMessage(false);
    }, []);

    const handleNextStep = useCallback(async (nextStepId: number | null) => {
        const currentStep = flujoData[currentStepIndex];
        if (!currentStep) return;

        // Validar si el paso actual tiene recompensa por conocer personaje (Lógica existente)
        if (currentStep.id_recompensa !== null && !isStoryCompleted) {
            const personaje = personajesData.find(p => p.id_personaje === currentStep.id_personaje);
            if (personaje && user) {
                const { error } = await gameServiceUser.knowCharacter(user.id, personaje.nombre);
                if (!error) {
                    await fetchPlayerStats();
                    const message = `Has conocido a ${personaje.nombre}. ¡Añadido a tus estadísticas!`;
                    setNotification(message);
                    setTimeout(() => setNotification(null), 3000);
                }
            }
        }

        // --- LÓGICA DE PASO FINAL Y REDIRECCIÓN DE HISTORIA ---
        if (currentStep.tipo_paso === 'final' && selectedHistoriaId !== null && user) {
            console.log("🏁 Completando historia actual:", selectedHistoriaId);
            try {
                await gameServiceUser.completeStory(user.id, String(selectedHistoriaId));
            } catch (error) {
                console.error('❌ Error completando historia:', error);
            }

            // Determinar el ID de la siguiente HISTORIA (no paso)
            let nextStoryId = nextStepId;

            // Si no viene por argumento, intentar extraerlo de las opciones del paso actual
            if (!nextStoryId) {
                // Intentar sacar de opciones_siguientes_json
                let opts: any[] = [];
                const rawOpts = currentStep.opciones_decision; // Usamos el campo crudo o el localizado
                // Nota: getLocalizedContent ya se usó para renderizar, aquí accedemos a data cruda es mejor si la estructura es constante

                if (rawOpts && typeof rawOpts === 'object' && (rawOpts as any).opciones_siguientes_json) {
                    opts = (rawOpts as any).opciones_siguientes_json;
                } else if (typeof rawOpts === 'string') {
                    try {
                        const parsed = JSON.parse(rawOpts);
                        opts = parsed.opciones_siguientes_json || (Array.isArray(parsed) ? parsed : []);
                    } catch (e) {
                        // ignore
                    }
                }

                if (opts.length > 0 && opts[0].siguiente_paso_id) {
                    nextStoryId = opts[0].siguiente_paso_id;
                    console.log("🔗 ID de siguiente historia extraído de opciones:", nextStoryId);
                }
            }

            if (nextStoryId) {
                console.log("🔄 Redirigiendo a siguiente historia ID:", nextStoryId);
                // EVITAR ERROR "No se encontró un paso actual": 
                // 1. Poner loading en true INMEDIATAMENTE para bloquear renderizado de pasos.
                setLoading(true);
                // 2. Limpiar flujo anterior para que no exista "paso actual" viejo.
                setFlujoData([]);
                // 3. Cambiar ID para disparar el useEffect de carga.
                setSelectedHistoriaId(nextStoryId);
                setCurrentStepIndex(0);
                setShowStepContent(false);
                setShowEndMessage(false);
                return;
            } else {
                console.log("⏹️ No hay siguiente historia definida. Volviendo al menú.");
                handleReturnToMenu();
                return;
            }
        }

        // --- LÓGICA DE PASO NORMAL (Mismo Flujo) ---
        if (!user || nextStepId === null) {
            setShowEndMessage(true);
            return;
        }

        setShowStepContent(false);
        const nextIndex = flujoData.findIndex(p => p.id_flujo === nextStepId);
        if (nextIndex !== -1) {
            setCurrentStepIndex(nextIndex);
        } else {
            // Si el paso siguiente no existe en el flujo actual, ¿podría ser un salto a otra historia?
            // Por ahora asumimos fin de flujo.
            console.warn("⚠️ Paso siguiente no encontrado en flujo actual. Mostrando fin.");
            setShowEndMessage(true);
        }
    }, [flujoData, currentStepIndex, isStoryCompleted, personajesData, user, selectedHistoriaId, fetchPlayerStats, handleReturnToMenu]);



    // --- MEDIA & AUTOPLAY ---

    // Función de manejo de audio para el video/audio del modal (para evitar problemas de autoplay)
    const handleMediaAutoplay = (element: HTMLMediaElement) => {
        element.play().catch(e => console.error("Error al intentar autoplay de media:", e));
    };

    // Manejador para reproducir audio cuando el usuario interactúa
    const handleAudioPlay = () => {
        if (audioRef.current) {
            audioRef.current.play().catch(e => console.error("Error al reproducir audio:", e));
        }
        setShowAudioOverlay(false);
    };

    // ✅ Sincronizar la prop externa con el estado interno
    useEffect(() => {
        // Si recibimos un historiaId por props (desde el mapa), iniciamos esa historia
        if (historiaId) {
            console.log("🚀 [FlujoNarrativo] Prop recibida. Iniciando historia ID:", historiaId);
            // Usamos la función que ya tienes para resetear contadores y pasos
            handleHistoriaSelect(historiaId);
        }
    }, [historiaId, handleHistoriaSelect]); // Se ejecuta cuando cambia historiaId


    // ====================================================================
    // ✅ SOLUCIÓN: useEffect para forzar el ocultamiento del modal final
    // ====================================================================
    useEffect(() => {
        // Si hay una historia seleccionada, garantizamos que el mensaje final esté oculto.
        if (selectedHistoriaId !== null) {
            if (showEndMessage) {
                console.log("🐛 [FIX] showEndMessage estaba en true al iniciar la historia. Forzando a false.");
                setShowEndMessage(false);
            }
        }
    }, [selectedHistoriaId, showEndMessage]); // Se dispara cada vez que se selecciona una historia.

    // Detectar si es móvil
    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth < 768);
        };
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);


    // ---------------------------------------------------------------------
    // useEffect para manejar la comunicación con el iFrame de la aplicación
    // ---------------------------------------------------------------------
    useEffect(() => {
        const processedMessages = new Set<string>();  // Trackear IDs de mensajes procesados

        const handleIframeMessage = (event: MessageEvent) => {
            console.log('[Flujo] Mensaje recibido del iframe:', event.data);


            // --- PROTOCOLO UNIFICADO DE APPS (ResistenciaApp) ---
            if (event.data && event.data.source === 'ResistenciaApp') {
                const appName = event.data.appName || 'UnknownApp';
                console.log(`[Flujo] 📩 Mensaje recibido de ${appName} (${event.data.type})`);

                if (event.data.type === 'app-result') {
                    const result = event.data as AppResult;

                    // Deduplicación de mensajes
                    const messageId = `${appName}-${result.status}-${result.recompensaId}-${Date.now()}`;
                    if (processedMessages.has(messageId)) {
                        console.warn(`[Flujo] ⚠️ Mensaje duplicado de ${appName} ignorado.`);
                        return;
                    }
                    processedMessages.add(messageId);

                    // 1. Cerrar Modal (Limpieza UI)
                    closeHotspotModal();
                    console.log(`[Flujo] Modal cerrado tras resultado de ${appName}.`);

                    // 2. Procesar Lógica Unificada (XP + Recompensa + Navegación)
                    handleRecompensa(result);
                }
                else if (event.data.action === 'close') {
                    console.log(`[Flujo] ❌ Cierre solicitado por ${appName}.`);
                    closeHotspotModal();
                    // Opcional: Manejar como fallo si se cierra sin terminar
                    // handleAppCompletion('failure', 'Cierre por usuario');
                }
            }
        };

        window.addEventListener('message', handleIframeMessage);

        return () => {
            window.removeEventListener('message', handleIframeMessage);
        };
    }, [handleRecompensa, handleAppCompletion, closeHotspotModal]);  // Quita isHotspotModalOpen si causa remociones prematuras


    // --- NUEVO useEffect para enviar data al iframe de la app de renta ---
    // Se dispara cuando el modal se abre y es de tipo 'interactive'
    useEffect(() => {
        // Asegurarse de que tenemos todo lo necesario para actuar
        if (!isHotspotModalOpen || hotspotModal?.contentType !== 'interactive' || !hotspotModal.rentalAppConfig || !playerStats || !iframeRef.current) {
            return; // No hacer nada si no es el modal interactivo
        }

        // Obtener la referencia al iframe actual
        const currentIframe = iframeRef.current;

        const handleLoad = () => {
            if (currentIframe.contentWindow) {
                const payload = {
                    source: 'FlujoNarrativoUsuario',
                    appData: JSON.stringify(hotspotModal.rentalAppConfig),
                    playerStats: {
                        inventario: playerStats.inventario,
                        puntuacion: playerStats.xp_total
                    },
                    successRecompensaId: hotspotModal.successRecompensaId,
                    failureRecompensaId: hotspotModal.failureRecompensaId,
                    cc: language
                };
                console.log("[POST MESSAGE] Enviando configuración de App de Renta al Iframe (después de 'load'):", payload);
                currentIframe.contentWindow.postMessage(payload, '*');
            } else {
                console.error("[POST MESSAGE] No se pudo acceder a contentWindow después de 'load'.");
            }
        };

        // Escucha el evento 'load'
        // Es más seguro siempre usar el listener que confiar en 'iframe.complete'
        console.log("[POST MESSAGE] Añadiendo listener 'load' al iframe.");
        currentIframe.addEventListener('load', handleLoad);

        // Cleanup: Esta función se ejecuta cuando el modal se cierra (o las dependencias cambian)
        return () => {
            console.log("[CLEANUP] Removiendo listener 'load' del iframe.");
            // Siempre remueve el listener del iframe que referenciamos
            currentIframe.removeEventListener('load', handleLoad);
        };

    }, [isHotspotModalOpen, hotspotModal, playerStats, language]); // Mantén las dependencias

    // ====================================================================
    // ✅ NUEVO: useEffect para enviar data (metadatos) al iframe de TIPO_PASO 'app'
    // ====================================================================
    useEffect(() => {
        const currentStep = flujoData[currentStepIndex];

        // 1. Asegurarse de que estamos en un paso 'app' y el iframe ref existe
        if (currentStep?.tipo_paso !== 'app' || !iframeAppRef.current) {
            return;
        }

        const currentIframe = iframeAppRef.current;

        // 2. Función que envía el mensaje (se ejecutará en el 'load' del iframe)
        const sendConfigToApp = () => {
            const recursoActual = getRecurso(currentStep.recursomultimedia_id);

            if (!recursoActual || !recursoActual.metadatos) {
                console.error("[POST MESSAGE App] No se encontró el recurso o metadatos para el paso 'app'.");
                return;
            }

            let parsedMetadata: any;
            try {
                // 1. Parsear el JSON unificado
                parsedMetadata = JSON.parse(recursoActual.metadatos);
            } catch (e) {
                console.error("[POST MESSAGE App] Error al parsear JSON de metadatos:", e, recursoActual.metadatos);
                return;
            }

            // 2. Extraer SÓLO la configuración de la app
            // ¡IMPORTANTE! La app (index.html) espera que appData sea un STRING JSON
            const appData = parsedMetadata.appConfig ? JSON.stringify(parsedMetadata.appConfig) : "{}";

            // 3. Obtener stats del jugador
            if (!playerStats) {
                console.error("[POST MESSAGE App] Stats del jugador no cargados. Abortando envío.");
                return;
            }

            // ✅ FIX: Extraer los IDs de recompensa del flowConfig para enviarlos al simulador
            let successRecompensaId: number | undefined = undefined;
            let failureRecompensaId: number | undefined = undefined;

            if (parsedMetadata.flowConfig?.opciones_siguientes_json) {
                const opciones = parsedMetadata.flowConfig.opciones_siguientes_json;
                const successOption = opciones.find((op: any) => op.texto === 'success');
                const failureOption = opciones.find((op: any) => op.texto === 'failure');

                if (successOption?.recompensaId) successRecompensaId = successOption.recompensaId;
                if (failureOption?.recompensaId) failureRecompensaId = failureOption.recompensaId;

                console.log("[POST MESSAGE App] Recompensas extraídas del flowConfig:", { successRecompensaId, failureRecompensaId });
            }

            if (currentIframe.contentWindow) {
                const payload = {
                    source: 'FlujoNarrativoUsuario',
                    appData: appData, // ¡AQUÍ VAN LOS PARÁMETROS DE appConfig!
                    playerStats: {
                        inventario: playerStats.inventario,
                        puntuacion: playerStats.xp_total
                    },
                    successRecompensaId: successRecompensaId,
                    failureRecompensaId: failureRecompensaId,
                    cc: language
                };
                console.log("[POST MESSAGE App] Enviando 'appConfig' (metadatos) al Iframe:", payload);
                currentIframe.contentWindow.postMessage(payload, '*');
            } else {
                console.error("[POST MESSAGE App] No se pudo acceder a contentWindow después de 'load'.");
            }
        };

        console.log("[POST MESSAGE App] Añadiendo listener 'load' al iframe de tipo_paso: 'app'.");
        currentIframe.addEventListener('load', sendConfigToApp);

        // 5. Cleanup
        return () => {
            console.log("[CLEANUP App] Removiendo listener 'load' del iframe de tipo_paso: 'app'.");
            if (currentIframe) {
                currentIframe.removeEventListener('load', sendConfigToApp);
            }
        };
    }, [flujoData, currentStepIndex, getRecurso, playerStats, language]);

    // Escuchar cambios de fullscreen
    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };

        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
    }, []);

    // Registrar componente A-Frame para interacción con mallas GLB (basado en HTML funcional)
    useEffect(() => {
        const registerComponent = () => {
            if (typeof window !== 'undefined' && (window as any).AFRAME) {
                // Componente para interacción con meshes del GLB
                if (!(window as any).AFRAME.components['gltf-hotspot-interaction']) {
                    (window as any).AFRAME.registerComponent('gltf-hotspot-interaction', {
                        schema: {
                            hotspotMeshes: { type: 'array', default: [] },
                            hotspotData: { type: 'string' },
                            visitedMeshes: { type: 'array', default: [] } // ✅ NUEVO: Recibir lista de visitados
                        },

                        setupHotspots: function () {
                            const obj = this.el.getObject3D('mesh');
                            if (!obj) {
                                setTimeout(this.setupHotspots, 500);
                                return;
                            }

                            const allHotspotConfigs = JSON.parse(this.data.hotspotData);
                            const hotspotConfigs = allHotspotConfigs.filter((h: any) => h.contentType !== 'backgroundMusic');
                            const visitedSet = new Set(this.data.visitedMeshes); // Optimizar búsqueda

                            obj.traverse((child: any) => {
                                if (child.isMesh) {
                                    const config = hotspotConfigs.find((c: any) => c.meshName === child.name);

                                    if (config) {
                                        child.userData.isHotspot = true;
                                        child.userData.hotspotConfig = config;

                                        // Guardar material original si no existe
                                        if (!child.userData.originalMaterial) {
                                            child.userData.originalMaterial = child.material.clone();
                                        }

                                        // ✅ LÓGICA HACKER: Si está visitado, aplicar Wireframe Verde
                                        const isVisited = visitedSet.has(child.name);
                                        child.userData.isVisited = isVisited;

                                        if (isVisited) {
                                            if (!child.userData.visitedMaterial) {
                                                child.userData.visitedMaterial = new (window as any).THREE.MeshBasicMaterial({
                                                    color: 0x33ff00,
                                                    wireframe: true,
                                                    transparent: true,
                                                    opacity: 0.8
                                                });
                                            }
                                            child.material = child.userData.visitedMaterial;
                                        } else {
                                            child.material = child.userData.originalMaterial;
                                        }

                                        child.userData.isClicked = false;
                                        child.userData.isHovered = false;
                                    }
                                }
                            });
                        },

                        init: function () {
                            this.setupHotspots = this.setupHotspots.bind(this);
                            this.el.addEventListener('model-loaded', this.setupHotspots);
                        },

                        update: function (oldData: any) {
                            // Re-ejecutar si cambia la data o la lista de visitados
                            if (this.data.hotspotData !== oldData.hotspotData ||
                                JSON.stringify(this.data.visitedMeshes) !== JSON.stringify(oldData.visitedMeshes)) {
                                setTimeout(this.setupHotspots, 100);
                            }
                        },

                        remove: function () {
                            this.el.removeEventListener('model-loaded', this.setupHotspots);
                        },

                        tick: function () {
                            const cursor = document.querySelector('a-cursor');
                            if (!cursor) return;

                            const raycaster = (cursor as any).components?.raycaster;
                            if (!raycaster || !raycaster.intersections || raycaster.intersections.length === 0) {
                                const obj = this.el.getObject3D('mesh');
                                if (obj) {
                                    obj.traverse((child: any) => {
                                        if (child.isMesh && child.userData.isHotspot && child.userData.isHovered) {
                                            // Restaurar al material correcto (Visitado o Original)
                                            child.material = child.userData.isVisited
                                                ? child.userData.visitedMaterial
                                                : child.userData.originalMaterial;

                                            child.material.needsUpdate = true;
                                            child.userData.isHovered = false;
                                        }
                                    });
                                }
                                return;
                            }

                            const intersection = raycaster.intersections[0];
                            const mesh = intersection.object;

                            if (mesh && mesh.userData && mesh.userData.isHotspot) {
                                // Crear materiales de hover si no existen
                                if (!mesh.userData.hoverMaterial) {
                                    mesh.userData.hoverMaterial = mesh.userData.originalMaterial.clone();
                                    mesh.userData.hoverMaterial.emissive = new (window as any).THREE.Color(0xFFFF00);
                                    mesh.userData.hoverMaterial.emissiveIntensity = 0.9;
                                }

                                // ✅ Hover especial para nodos hackers (Sólido verde brillante)
                                if (!mesh.userData.hoverVisitedMaterial) {
                                    mesh.userData.hoverVisitedMaterial = new (window as any).THREE.MeshBasicMaterial({
                                        color: 0xccffcc, // Verde muy claro casi blanco
                                        wireframe: true, // Mantener wireframe pero más brillante? O sólido? Probemos wireframe + fill effect visual
                                    });
                                    // O mejor: simplemente un verde más brillante sólido para destaque
                                    mesh.userData.hoverVisitedMaterial = new (window as any).THREE.MeshBasicMaterial({
                                        color: 0x33ff00,
                                        wireframe: false,
                                        transparent: true,
                                        opacity: 0.3
                                    });
                                }

                                if (!mesh.userData.isClicked && !mesh.userData.isHovered) {
                                    // Elegir material según estado
                                    mesh.material = mesh.userData.isVisited
                                        ? mesh.userData.hoverVisitedMaterial
                                        : mesh.userData.hoverMaterial;

                                    mesh.material.needsUpdate = true;
                                    mesh.userData.isHovered = true;
                                }

                                // Limpiar otros hovers
                                const obj = this.el.getObject3D('mesh');
                                if (obj) {
                                    obj.traverse((child: any) => {
                                        if (child.isMesh && child.userData.isHotspot && child !== mesh && child.userData.isHovered) {
                                            child.material = child.userData.isVisited
                                                ? child.userData.visitedMaterial
                                                : child.userData.originalMaterial;
                                            child.material.needsUpdate = true;
                                            child.userData.isHovered = false;
                                        }
                                    });
                                }
                            }
                        }
                    });
                }
                console.log('✅ Componente gltf-hotspot-interaction registrado');
            } else {
                setTimeout(registerComponent, 100);
            }
        };

        registerComponent();
    }, []);




    const styles = `
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
        html, body {
            height: 100%;
            width: 100%;
            margin: 0;
            padding: 0;
           
        }
        body {
            font-family: 'Inter', sans-serif;
            background-color: #1a202c;
            color: #e2e8f0;
        }
        .container {
            position: relative;
            width: 100vw;
            height: 100vh;
            overflow: hidden;
            display: flex;
            justify-content: center;
            align-items: center;
        }
        .step-content {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            box-sizing: border-box;
            text-align: center;
            transition: opacity 1s ease-in-out;
        }
        .step-content.fade-in {
            opacity: 1;
        }
        .step-content.fade-out {
            opacity: 0;
        }
        .full-media-container {
            width: 100%;
            height: 100%;
            display: flex;
            justify-content: center;
            position: absolute;
            top: 0;
            left: 0;
            z-index: 10;
        }
        .full-media-container video, .full-media-container img {
            width: 100%;
            height: 100%;
            
            object-fit: cover;
            position: absolute;
        }
        #interactiveCanvas, #audioVisualizerCanvas {
            width: 100%;
            height: 100%;
            position: relative;
            z-index: 20;
        }
        .nav-button {
            position: absolute;
            top: 50%;
            transform: translateY(-50%);
            font-size: 2.5rem;
            font-weight: bold;
            color: rgba(255, 255, 255, 0.2);
            background: none;
            border: none;
            cursor: pointer;
            transition: color 0.2s, opacity 0.3s;
            z-index: 50;
            padding: 10px 20px;
            line-height: 0;
            opacity: 0;
            pointer-events: none;
        }
        .nav-button.visible {
            opacity: 1;
            pointer-events: auto;
        }
        .nav-button.left {
            left: 1rem;
        }
        .nav-button.right {
            right: 1rem;
        }
        .nav-button:hover {
            color: rgba(255, 255, 255, 0.8);
            transform: translateY(-50%) scale(1.1);
        }
        .top-left-button {
            position: absolute;
            top: 1rem;
            left: 1rem;
        background: rgba(10, 10, 10, 0.95);
        border-top: 1px solid #333;
            padding: 0.5rem 1rem;
            border-radius: 0.5rem;
            color: #e2e8f0;
            font-weight: 600;
            cursor: pointer;
            transition: background-color 0.2s, transform 0.2s;
            z-index: 40;
            border: 2px solid transparent;
        }
        .top-left-button:hover {
            background-color: rgba(45, 55, 72, 0.9);
            transform: translateY(-2px);
            border-color: #63b3ed;
        }
        .modal {
            display: none;
            position: fixed;
            z-index: 100;
            left: 0;
            top: 0;
            width: 100%;
            height: 100%;
            overflow: auto;
            background-color: rgba(0,0,0,0.8);
            backdrop-filter: blur(5px);
            justify-content: center;
            align-items: center;
        }
        .modal-content {
            background-color: #1a202c;
            padding: 2rem;
            border-radius: 1rem;
            width: 90%;
            max-width: 500px;
            box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
            position: relative;
            color: #e2e8f0;
        }
        .close-button {
            position: absolute;
            top: 1rem;
            right: 1.5rem;
            color: #aaa;
            font-size: 2rem;
            font-weight: bold;
            cursor: pointer;
        }
        .close-button:hover, .close-button:focus {
            color: #e2e8f0;
        }
        .decision-container {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            z-index: 50;
            padding: 2rem;
            background-color: rgba(0, 0, 0, 0.6);
            backdrop-filter: blur(5px);
        }
        .decision-options {
            display: flex;
            flex-direction: column;
            gap: 1rem;
            margin-top: 2rem;
            width: 100%;
            max-width: 400px;
        }
        .decision-button {
            background-color: #4a5568;
            padding: 1rem;
            border-radius: 0.5rem;
            font-weight: 600;
            transition: background-color 0.2s, transform 0.2s;
            cursor: pointer;
            text-align: center;
        }
        .decision-button:hover {
            background-color: #63b3ed;
            transform: translateY(-2px);
        }
        .step-transition-enter {
            opacity: 0;
        }
        .step-transition-enter-active {
            opacity: 1;
            transition: opacity 500ms ease-in;
        }
        .step-transition-exit {
            opacity: 1;
        }
        .step-transition-exit-active {
            opacity: 0;
            transition: opacity 500ms ease-in;
        }

 
        
    `;

    // Efecto para cargar las historias disponibles al inicio
    useEffect(() => {
        const fetchHistorias = async () => {
            try {
                const { data, error } = await gameServiceUser.fetchHistorias();
                if (error) throw error;

                // PUNTO DE DEPURACIÓN
                console.log("Historias cargadas desde el servicio:", data);

                // --- INICIO MODIFICACIÓN: ORDENAR POR CAMPO 'ORDEN' ---
                const historiasOrdenadas = data ? [...data].sort((a, b) => {
                    // Asumiendo que es orden ascendente (1, 2, 3...)
                    // Usamos (a.orden || 0) para manejar casos donde sea null/undefined
                    return (a.orden || 0) - (b.orden || 0);
                }) : [];
                // --- FIN MODIFICACIÓN ---


                setHistorias(historiasOrdenadas);

                // Pre-cargar recursos multimedia para las imágenes de historias
                const { data: recursos, error: recursosError } = await gameServiceUser.fetchMultimediaResources();
                if (!recursosError && recursos) {
                    setRecursosData(recursos);
                }
            } catch (err: any) {
                console.error("Error al cargar las historias:", err.message);
                setError("No se pudieron cargar las historias disponibles.");
            } finally {
                setLoading(false);
            }
        };

        if (!selectedHistoriaId) {
            fetchHistorias();
        }
    }, [selectedHistoriaId]);

    // Efecto para cargar todos los datos necesarios cuando se selecciona una historia
    useEffect(() => {
        const fetchAllData = async () => {
            if (!selectedHistoriaId || authLoading || !user) return;
            setLoading(true);
            try {
                const { data: flujo, error: flujoError } = await gameServiceUser.fetchNarrativeFlowByHistoriaId(selectedHistoriaId);
                if (flujoError) throw flujoError;
                setFlujoData(flujo || []);

                const { data: recursos, error: recursosError } = await gameServiceUser.fetchMultimediaResources();
                if (recursosError) throw recursosError;
                setRecursosData(recursos || []);

                const { data: recompensas, error: recompensasError } = await gameServiceUser.fetchRewards();
                if (recompensasError) throw recompensasError;
                setRecompensasData(recompensas || []);

                const { data: personajes, error: personajesError } = await gameServiceUser.fetchCharacters();
                if (personajesError) throw personajesError;
                setPersonajesData(personajes || []);

                await fetchPlayerStats();

            } catch (err: any) {
                console.error("Error al cargar datos de Supabase:", err.message);
                setError("No se pudieron cargar los datos de la historia. Por favor, verifica tu conexión.");
            } finally {
                setLoading(false);
            }
        };
        fetchAllData();

        if (user) {
            gameServiceUser.getPlayerStats(user.id).then(stats => {
                setPlayerStats(stats);

                if (stats && stats.historias_visitadas) {
                    let visitedIds: number[] = [];
                    if (Array.isArray(stats.historias_visitadas)) {
                        visitedIds = stats.historias_visitadas.map((id: string) => parseInt(id.trim(), 10));
                    } else if (typeof stats.historias_visitadas === 'string') {
                        visitedIds = (stats.historias_visitadas as string).split(',').map(id => parseInt(id.trim(), 10));
                    }
                    setHistoriasVisitadas(visitedIds);
                } else {
                    setHistoriasVisitadas([]);
                }
            });
        }

    }, [selectedHistoriaId, user, authLoading, fetchPlayerStats]);

    // useEffect para cargar subtítulos si existen en los metadatos
    useEffect(() => {
        let isMounted = true;
        let currentSubtitleUrl: string | null = null;

        const loadSubtitles = async () => {
            const currentStep = flujoData[currentStepIndex];
            if (!currentStep) return;

            const recursoActual = getRecurso(currentStep.recursomultimedia_id);

            if (recursoActual?.tipo === 'video' && recursoActual.metadatos) {
                try {
                    const meta = JSON.parse(recursoActual.metadatos);
                    if (meta.subtitlesUrl) {
                        console.log("Cargando subtítulos desde:", meta.subtitlesUrl);
                        const url = await fetchAndConvertSubtitle(meta.subtitlesUrl);
                        if (isMounted && url) {
                            currentSubtitleUrl = url;
                            setSubtitleUrl(url);
                            console.log("Subtítulos convertidos y cargados.");
                        }
                    } else {
                        if (isMounted) setSubtitleUrl(null);
                    }
                } catch (e) {
                    console.error("Error al parsear metadatos para subtítulos:", e);
                    if (isMounted) setSubtitleUrl(null);
                }
            } else {
                if (isMounted) setSubtitleUrl(null);
            }
        };

        loadSubtitles();

        return () => {
            isMounted = false;
            if (currentSubtitleUrl) {
                URL.revokeObjectURL(currentSubtitleUrl);
            }
        };
    }, [currentStepIndex, flujoData, recursosData, getRecurso]); // Dependencias similares al efecto de media

    // useEffect para convertir subtítulos del hotspot
    useEffect(() => {
        let currentSubtitleUrl: string | null = null;

        if (hotspotModal?.subtitlesUrl) {
            fetchAndConvertSubtitle(hotspotModal.subtitlesUrl)
                .then(url => {
                    currentSubtitleUrl = url;
                    setHotspotSubtitleUrl(url);
                })
                .catch(() => setHotspotSubtitleUrl(null));
        } else {
            setHotspotSubtitleUrl(null);
        }
        return () => {
            if (currentSubtitleUrl) {
                URL.revokeObjectURL(currentSubtitleUrl);
            }
        };
    }, [hotspotModal, getRecurso]);

    // useEffect para manejar la carga y reproducción de recursos multimedia al cambiar de paso
    // Ref para evitar resetear estados si el efecto corre por actualización de datos (no cambio de paso)
    const lastStepIndexRef = useRef<number | null>(null);

    // useEffect para manejar la carga y reproducción de recursos multimedia al cambiar de paso
    useEffect(() => {
        // --- INICIO DE LA SOLUCIÓN ---
        if (!selectedHistoriaId) {
            lastStepIndexRef.current = null; // Reset ref on exit
            return;
        }
        // --- FIN DE LA SOLUCIÓN ---

        const currentStep = flujoData[currentStepIndex];
        if (!currentStep) return;

        // Detectar si es un cambio de paso real
        const isStepChange = lastStepIndexRef.current !== currentStepIndex;

        if (isStepChange) {
            console.log(`[Media Effect] Cambio de paso detectado (${lastStepIndexRef.current} -> ${currentStepIndex}). Reseteando estados.`);
            // Oculta el contenido del paso al iniciar la carga o reproducción
            setShowStepContent(false);
            // Asegúrate de resetear el pop-up inicial cada vez que cambias de paso
            setShowInitial3DPopup(false);

            lastStepIndexRef.current = currentStepIndex;
        }

        const recursoActual = getRecurso(currentStep.recursomultimedia_id);
        const isVideo = recursoActual?.tipo === 'video';
        const isAudio = recursoActual?.tipo === 'audio';
        const is3DModel = recursoActual?.tipo === '3d_model';


        // Detener música de fondo si no es un modelo 3D
        if (!is3DModel) {
            // Detener música de fondo si está sonando
            if (backgroundAudioRef.current) {
                console.log("⏸️ Deteniendo música de fondo al cambiar de paso.");
                backgroundAudioRef.current.pause();
                backgroundAudioRef.current = null;
            }
            setBackgroundMusicUrl(null);
        }

        if (recursoActual && recursoActual.tipo === '3d_model') {
            console.log("Metadata CRUDA del Recurso 3D:", recursoActual.metadatos);

            const hotspotConfigs = recursoActual.metadatos ? JSON.parse(recursoActual.metadatos) as HotspotConfig[] : [];

            // Filtrar hotspots que no son de tipo backgroundMusic para el conteo
            const interactiveHotspots = hotspotConfigs.filter(h => h.contentType !== 'backgroundMusic');

            console.log("Hotspot Configs cargadas:", hotspotConfigs);
            totalHotspotsRef.current = interactiveHotspots.length;
            console.log("Número total de Hotspots interactivos:", totalHotspotsRef.current);

            // Cargar música de fondo si está configurada
            const musicConfig = hotspotConfigs.find(h => h.contentType === 'backgroundMusic');
            if (musicConfig && musicConfig.url) {
                setBackgroundMusicUrl(musicConfig.url);
                console.log("🎵 Música de fondo configurada:", musicConfig.url);
            } else {
                setBackgroundMusicUrl(null);
            }
        }

        if (recursoActual && (isVideo || isAudio)) {
            if (isVideo && videoRef.current) {
                videoRef.current.play().catch(e => console.error("Error al reproducir video:", e));
            }
            if (isAudio) {
                setShowAudioOverlay(true);
            }
        }
        else if (!recursoActual || (!isVideo && !isAudio && !is3DModel)) {
            setShowStepContent(true);
        }
        else if (is3DModel) {
            if (!recursoActual || !recursoActual.metadatos) {
                console.log("Esperando datos del recurso...");
                return;
            }

            // SOLO activar popup si es cambio de paso (para que no reaparezca en updates)
            if (isStepChange) {
                setShowInitial3DPopup(true);
                // setShowStepContent(false); <--- REMOVED (Redundant, handled at start of effect)
            }

            const hotspotConfigs = recursoActual.metadatos ? JSON.parse(recursoActual.metadatos) as HotspotConfig[] : [];
            const interactiveHotspots = hotspotConfigs.filter(h => h.contentType !== 'backgroundMusic');
            totalHotspotsRef.current = interactiveHotspots.length;

            console.log("Hotspot Configs cargadas:", hotspotConfigs);
            console.log("Número total de Hotspots interactivos:", totalHotspotsRef.current);

            // FORCE UPDATE via timeout to break race condition
            setTimeout(() => {
                console.log("[Media Effect] ⏰ Forcing ShowStepContent = TRUE via Timeout");
                setShowStepContent(true);
            }, 100);
        }

    }, [currentStepIndex, flujoData, recursosData, selectedHistoriaId, getRecurso]); // <-- AÑADIR selectedHistoriaId

    // --- Efecto 1: Maneja la lógica de Play/Pause ---
    useEffect(() => {
        // No hacer nada si no hay URL de música
        if (!backgroundMusicUrl) {
            if (backgroundAudioRef.current) {
                backgroundAudioRef.current.pause();
            }
            return;
        }

        // Crear el objeto de audio si no existe
        if (!backgroundAudioRef.current) {
            console.log("🎵 Creando nueva instancia de Audio:", backgroundMusicUrl);
            backgroundAudioRef.current = new Audio(backgroundMusicUrl);
            backgroundAudioRef.current.loop = true;
        }

        // Aplicar volumen actual
        backgroundAudioRef.current.volume = backgroundMusicVolume;

        // Lógica de reproducción/pausa
        // QUEREMOS QUE SUENE SI:
        // 1. El modal NO está abierto
        // 2. O, el modal SÍ está abierto y es de tipo 'interactive'
        const shouldPlay = !isHotspotModalOpen || (isHotspotModalOpen && hotspotModal?.contentType === 'interactive');

        if (shouldPlay) {
            // Esto cumple tu requisito: si no es interactivo, 'shouldPlay' será false y se pausará.
            console.log("🎵 Reproduciendo música.", { isOpen: isHotspotModalOpen, type: hotspotModal?.contentType });
            backgroundAudioRef.current.play().catch(e => console.error("Error al reproducir música de fondo:", e));
        } else {
            // Esto se activa si isHotspotModalOpen es true Y el tipo NO es 'interactive'
            console.log("⏸️ Pausando música (Modal no interactivo abierto).", { type: hotspotModal?.contentType });
            backgroundAudioRef.current.pause();
        }

        // Este efecto se ejecuta cada vez que cambia el estado del modal o el volumen
    }, [backgroundMusicUrl, isHotspotModalOpen, hotspotModal, backgroundMusicVolume]);

    // --- Efecto 2: Maneja la limpieza profunda ---
    useEffect(() => {
        // Guarda la referencia actual del audio
        const audio = backgroundAudioRef.current;

        // Retorna una función de limpieza que se ejecutará solo si 
        // 'backgroundMusicUrl' cambia o si el componente se desmonta.
        return () => {
            if (audio) {
                console.log("🧹 Limpieza (desmontaje o cambio de URL): Deteniendo música.");
                audio.pause();
                backgroundAudioRef.current = null;
            }
        };
    }, [backgroundMusicUrl]); // <-- ¡Solo depende de la URL!

    // useEffect para actualizar el volumen de la música de fondo
    useEffect(() => {
        if (backgroundAudioRef.current) {
            backgroundAudioRef.current.volume = backgroundMusicVolume;
        }
    }, [backgroundMusicVolume]);

    // useEffect para actualizar la altura de la cámara en tiempo real
    useEffect(() => {
        const updateCameraHeight = () => {
            const playerRig = document.getElementById('player-rig');
            if (playerRig) {
                playerRig.setAttribute('position', `0 ${cameraHeight} 3`);
            }
        };

        // Esperar un poco para que el elemento exista
        const timeout = setTimeout(updateCameraHeight, 500);

        return () => clearTimeout(timeout);
    }, [cameraHeight]);

    // Listener para clicks del cursor en el modelo 3D
    useEffect(() => {
        if (!selectedHistoriaId) return;

        const handleCursorClick = (e: Event) => {
            // ✅ CRITICAL FIX: Don't process hotspot clicks if a modal is already open
            if (hotspotModal || isHotspotModalOpen) {
                console.log('🚫 Hotspot click blocked - modal already open');
                return;
            }

            const cursor = document.querySelector('a-cursor');

            if (!cursor) return;

            const raycaster = (cursor as any).components?.raycaster;
            if (raycaster && raycaster.intersections && raycaster.intersections.length > 0) {
                const intersection = raycaster.intersections[0];
                const obj = intersection.object;

                if (obj && obj.userData && obj.userData.isHotspot) {
                    console.log('🖱️ Click en hotspot:', obj.name);

                    // Cambiar color del hotspot al hacer click (rojo)
                    if (!obj.userData.clickMaterial) {
                        obj.userData.clickMaterial = obj.userData.originalMaterial.clone();
                        obj.userData.clickMaterial.emissive = new (window as any).THREE.Color(0xFF0000); // Rojo al hacer click
                        obj.userData.clickMaterial.emissiveIntensity = 1.0;
                    }
                    obj.material = obj.userData.clickMaterial;
                    obj.material.needsUpdate = true;
                    obj.userData.isClicked = true;

                    handleHotspotClick(obj.userData.hotspotConfig);
                }
            }
        };

        // Usar timeout para esperar que la escena cargue
        const timeout = setTimeout(() => {
            document.addEventListener('click', handleCursorClick);
            console.log('✅ Listener de click agregado');
        }, 1000);

        return () => {
            clearTimeout(timeout);
            document.removeEventListener('click', handleCursorClick);
            console.log('❌ Listener de click removido');
        };
    }, [selectedHistoriaId, handleHotspotClick, hotspotModal, isHotspotModalOpen]); // 'handleHotspotClick' es ahora una dependencia

    // Controles de movimiento para móvil con joystick virtual mejorado
    useEffect(() => {
        // Obtenemos recursoActual aquí para usarlo en dependencias
        const recursoActual = recursosData.find(r => r.id_recurso === flujoData[currentStepIndex]?.recursomultimedia_id);
        const is3DModel = recursoActual?.tipo === '3d_model';

        if (!isMobile || !selectedHistoriaId || !is3DModel) return;

        const currentKeys: Set<string> = new Set();

        // Referencias a los event listeners para poder removerlos
        const listeners: Map<HTMLElement, Array<{ event: string, handler: EventListener }>> = new Map();

        const simulateKeyPress = (key: string, press: boolean) => {
            const camera = document.querySelector('a-camera');
            if (camera) {
                const wasdControls = (camera as any).components['wasd-controls'];
                if (wasdControls) {
                    wasdControls.keys[key] = press;
                }
            }

            // FEEDBACK VISUAL MANUAL (Porque preventDefault anula :active)
            let btnId = '';
            if (key === 'KeyW') btnId = 'mobile-btn-up';
            if (key === 'KeyS') btnId = 'mobile-btn-down';
            if (key === 'KeyA') btnId = 'mobile-btn-left';
            if (key === 'KeyD') btnId = 'mobile-btn-right';

            const btn = document.getElementById(btnId);
            if (btn) {
                if (press) {
                    btn.classList.add('bg-[#33ff00]', 'text-black', 'shadow-[0_0_15px_#33ff00]');
                    btn.classList.remove('text-[#33ff00]', 'bg-black/60');
                } else {
                    btn.classList.remove('bg-[#33ff00]', 'text-black', 'shadow-[0_0_15px_#33ff00]');
                    btn.classList.add('text-[#33ff00]', 'bg-black/60');
                }
            }
        };

        const startMoving = (key: string) => {
            currentKeys.add(key);
            simulateKeyPress(key, true);
        };

        const stopMoving = (key: string) => {
            currentKeys.delete(key);
            simulateKeyPress(key, false);
        };

        const stopAll = () => {
            currentKeys.forEach(key => simulateKeyPress(key, false));
            currentKeys.clear();
        };

        const preventDefaults = (e: Event) => {
            if (e.cancelable) {
                e.preventDefault();
                e.stopPropagation();
            }
        };

        // Función helper para agregar listeners y guardar referencia
        const addListener = (btn: HTMLElement, eventName: string, handler: EventListener, options?: any) => {
            btn.addEventListener(eventName, handler, options);
            if (!listeners.has(btn)) {
                listeners.set(btn, []);
            }
            listeners.get(btn)!.push({ event: eventName, handler });
        };

        // Esperar a que la escena cargue
        const timeout = setTimeout(() => {
            const btnUp = document.getElementById('mobile-btn-up');
            const btnDown = document.getElementById('mobile-btn-down');
            const btnLeft = document.getElementById('mobile-btn-left');
            const btnRight = document.getElementById('mobile-btn-right');

            console.log("📱 Intentando vincular controles móviles...", {
                up: !!btnUp, down: !!btnDown, left: !!btnLeft, right: !!btnRight
            });

            if (btnUp) {
                addListener(btnUp, 'touchstart', (e) => { preventDefaults(e); startMoving('KeyW'); }, { passive: false });
                addListener(btnUp, 'touchend', (e) => { preventDefaults(e); stopMoving('KeyW'); }, { passive: false });
                addListener(btnUp, 'touchcancel', (e) => { preventDefaults(e); stopMoving('KeyW'); }, { passive: false });
                addListener(btnUp, 'mousedown', (e) => { startMoving('KeyW'); }, { passive: false });
                addListener(btnUp, 'mouseup', (e) => { stopMoving('KeyW'); }, { passive: false });
            }
            if (btnDown) {
                addListener(btnDown, 'touchstart', (e) => { preventDefaults(e); startMoving('KeyS'); }, { passive: false });
                addListener(btnDown, 'touchend', (e) => { preventDefaults(e); stopMoving('KeyS'); }, { passive: false });
                addListener(btnDown, 'touchcancel', (e) => { preventDefaults(e); stopMoving('KeyS'); }, { passive: false });
                addListener(btnDown, 'mousedown', (e) => { startMoving('KeyS'); }, { passive: false });
                addListener(btnDown, 'mouseup', (e) => { stopMoving('KeyS'); }, { passive: false });
            }
            if (btnLeft) {
                addListener(btnLeft, 'touchstart', (e) => { preventDefaults(e); startMoving('KeyA'); }, { passive: false });
                addListener(btnLeft, 'touchend', (e) => { preventDefaults(e); stopMoving('KeyA'); }, { passive: false });
                addListener(btnLeft, 'touchcancel', (e) => { preventDefaults(e); stopMoving('KeyA'); }, { passive: false });
                addListener(btnLeft, 'mousedown', (e) => { startMoving('KeyA'); }, { passive: false });
                addListener(btnLeft, 'mouseup', (e) => { stopMoving('KeyA'); }, { passive: false });
            }
            if (btnRight) {
                addListener(btnRight, 'touchstart', (e) => { preventDefaults(e); startMoving('KeyD'); }, { passive: false });
                addListener(btnRight, 'touchend', (e) => { preventDefaults(e); stopMoving('KeyD'); }, { passive: false });
                addListener(btnRight, 'touchcancel', (e) => { preventDefaults(e); stopMoving('KeyD'); }, { passive: false });
                addListener(btnRight, 'mousedown', (e) => { startMoving('KeyD'); }, { passive: false });
                addListener(btnRight, 'mouseup', (e) => { stopMoving('KeyD'); }, { passive: false });
            }

            console.log(`✅ ${listeners.size} botones vinculados con ${Array.from(listeners.values()).reduce((sum, arr) => sum + arr.length, 0)} listeners totales`);
        }, 1000);

        return () => {
            clearTimeout(timeout);
            stopAll();

            // 🔥 CRÍTICO: Remover TODOS los event listeners
            listeners.forEach((eventList, btn) => {
                eventList.forEach(({ event, handler }) => {
                    btn.removeEventListener(event, handler);
                });
            });
            listeners.clear();
            console.log('🧹 Listeners de joystick removidos');
        };
    }, [isMobile, selectedHistoriaId, currentStepIndex, recursosData, flujoData]); // ✅ Dependencia crítica agregada

    // ==================================================================
    // --- NUEVA FUNCIÓN PARA VOLVER AL MENÚ (ACTUALIZADA) ---
    // ==================================================================
    // Movida al inicio del componente para hoist




    // Función para renderizar el contenido del paso actual
    const renderStepContent = () => {
        const step = flujoData[currentStepIndex];

        // Si no hay paso, no renderizar nada
        if (!step) return null;

        // --- Lógica para Pasos de Aplicación (App) ---
        if (step.tipo_paso === 'app') {
            const recursoActual = getRecurso(step.recursomultimedia_id);

            // Log 7: Verifica que el paso 'app' se está renderizando y con qué recurso
            console.log(`[DEBUG 7 - RENDER APP] Rendering App Step. Recurso ID: ${step.recursomultimedia_id}, File: ${recursoActual?.archivo}`);

            // Si no hay recurso o URL en el recurso, no podemos mostrar la app.
            if (!recursoActual || !recursoActual.archivo) {
                return (
                    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 p-4 text-center bg-red-800 text-white rounded-lg z-30">
                        Error: Recurso tipo 'app' no encontrado o sin URL (archivo).
                    </div>
                );
            }

            // El iframe que carga la app
            return (
                <div className="full-media-container z-50 bg-black">
                    {/* IMPORTANTÍSIMO: Usar la URL de 'recursoActual.archivo'
                    y darle el 100% de alto y ancho para que ocupe toda la pantalla.
                    */}
                    <iframe
                        ref={iframeAppRef}
                        src={recursoActual.archivo}
                        title="Simulador Narrativo"
                        style={{ width: '100%', height: '100%', border: 'none' }}
                        allowFullScreen

                    ></iframe>
                </div>
            );
        }

        const contentText = getLocalizedContent(step, 'contenido', language);
        const rawOptions = getLocalizedContent(step, 'opciones_decision', language) || step.opciones_decision;
        const isDecisionStep = step.tipo_paso === 'pregunta' || (rawOptions?.opciones_siguientes_json && rawOptions.opciones_siguientes_json.length > 0);

        console.log(`[DEBUG] Rendering Step ID: ${step.id_flujo}, Tipo: ${step.tipo_paso}, Decision Step: ${isDecisionStep}`);
        console.log(`[DEBUG] Step Content: ${contentText}`);

        // Obtener información del recurso
        const recursoActual = getRecurso(step.recursomultimedia_id);
        const isVideoOrAudio = recursoActual?.tipo === 'video' || recursoActual?.tipo === 'audio';
        const is3DModel = recursoActual?.tipo === '3d_model';

        // --- Lógica para Pasos de Decisión ---
        if (isDecisionStep) {
            // Normalización de datos (Misma lógica de seguridad)
            let opciones = [];
            // rawOptions ya fue obtenido arriba (localizado o fallback)

            if (Array.isArray(rawOptions)) {
                opciones = rawOptions;
            } else if (rawOptions?.opciones_siguientes_json) {
                opciones = rawOptions.opciones_siguientes_json;
            } else if (typeof rawOptions === 'string') {
                try {
                    const parsed = JSON.parse(rawOptions);
                    opciones = Array.isArray(parsed) ? parsed : parsed.opciones_siguientes_json || [];
                } catch (e) {
                    console.error("Error parseando opciones:", e);
                }
            }

            return (
                <div className="fixed inset-0 z-40 flex flex-col items-center justify-center pt-24 pb-10 px-4 font-mono selection:bg-red-500 selection:text-white overflow-y-auto">

                    {/* 1. FONDO OSCURO (Para que resalte sobre el video/imagen de fondo) */}
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm z-0"></div>

                    {/* Scanlines sutiles */}
                    <div className="absolute inset-0 pointer-events-none opacity-10 z-0"
                        style={{ backgroundImage: 'linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.06))', backgroundSize: '100% 2px, 3px 100%' }}>
                    </div>

                    {/* 2. CONTENEDOR PRINCIPAL (Compacto) */}
                    <div className="relative z-10 w-full max-w-5xl bg-black/90 border border-[#33ff00] shadow-[0_0_50px_rgba(51,255,0,0.1)] flex flex-col p-6 rounded-sm">

                        {/* Decoración Esquinas */}
                        <div className="absolute top-0 left-0 w-2 h-2 bg-[#33ff00]"></div>
                        <div className="absolute top-0 right-0 w-2 h-2 bg-[#33ff00]"></div>
                        <div className="absolute bottom-0 left-0 w-2 h-2 bg-[#33ff00]"></div>
                        <div className="absolute bottom-0 right-0 w-2 h-2 bg-[#33ff00]"></div>

                        {/* A. HEADER COMPACTO (Barra de estado) */}
                        <div className="flex items-center justify-between border-b border-[#33ff00]/30 pb-3 mb-6">
                            <div className="flex items-center gap-2 text-red-500 animate-pulse">
                                <span className="text-xl">⚠️</span>
                                <span className="font-bold tracking-widest text-sm md:text-base">{t.decision_crit}</span>
                            </div>
                            <div className="text-[10px] text-[#33ff00]/60">
                                {t.waiting_input}
                            </div>
                        </div>

                        {/* B. PREGUNTA (Clara y visible) */}
                        <div className="mb-8 text-center">
                            <h3 className="text-xl md:text-2xl text-white font-bold leading-tight">
                                {contentText}
                            </h3>
                        </div>

                        {/* C. GRID DE OPCIONES (Horizontal en PC, Vertical en Móvil) */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                            {opciones.length > 0 ? (
                                opciones.map((opcion, index) => (
                                    <button
                                        key={index}
                                        className="group relative w-full p-4 border border-[#33ff00] bg-black/80 text-left 
                                        transition-all duration-300 ease-out
                                        hover:border-red-500 hover:bg-red-900/10 hover:shadow-[0_0_20px_rgba(220,38,38,0.4)]"
                                        onClick={() => handleNextStep(opcion.siguiente_paso_id)}
                                    >
                                        <div className="flex items-center justify-between gap-3">
                                            <div className="flex items-center gap-3">
                                                {/* Índice */}
                                                <span className="font-mono text-xs text-[#33ff00] group-hover:text-red-500 transition-colors border border-current px-1.5 py-0.5 rounded-sm">
                                                    0{index + 1}
                                                </span>
                                                {/* Texto */}
                                                <span className="text-sm md:text-base font-bold text-gray-200 group-hover:text-red-500 uppercase tracking-wide transition-colors">
                                                    {opcion.texto}
                                                </span>
                                            </div>

                                            {/* Icono Flecha (Cambia de color) */}
                                            <span className="text-[#33ff00] group-hover:text-red-500 group-hover:translate-x-1 transition-all text-xl">
                                                »
                                            </span>
                                        </div>
                                    </button>
                                ))
                            ) : (
                                <div className="col-span-2 border border-dashed border-red-500 text-red-500 p-4 text-center text-sm">
                                    [ ! ] ERROR: RUTAS NO ENCONTRADAS.
                                </div>
                            )}
                        </div>

                    </div>
                </div>
            );
        }

        // --- Lógica para Pasos Narrativos ---
        if (step.tipo_paso === 'narrativo') {

            // 1. Caso Video/Audio: Avance automático. No se necesita pop-up de "Siguiente →".
            if (isVideoOrAudio) {
                return null;
            }

            // Lógica de validación para el avance en 3D
            const allHotspotsDiscovered = is3DModel && totalHotspotsRef.current > 0 && discoveredHotspots === totalHotspotsRef.current;

            // Define cuándo mostrar el pop-up de avance final (Imagen, Texto, o 3D completado)
            // Se requiere que showStepContent esté en true (modelo/contenido cargado)
            // Si es 3D, requiere que allHotspotsDiscovered sea true Y que el pop-up inicial haya sido cerrado.
            const showFinalAdvancePopup = is3DModel
                ? showStepContent && allHotspotsDiscovered && !showInitial3DPopup
                : showStepContent; // Para Imagen/Texto


            // 2. Manejo del Pop-up de Instrucción Inicial para 3D (Temporal y Cerrable)
            if (is3DModel && showInitial3DPopup) {
                return (
                    <div className={`
                        fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-[9999]
                        w-[95%] max-w-[600px] max-h-[90vh] overflow-y-auto
                        bg-black/95 backdrop-blur-md 
                        border border-[#33ff00] shadow-[0_0_30px_rgba(51,255,0,0.15)]
                        text-[#a8a8a8] font-mono
                        p-6 md:p-8 rounded-sm
                    `}>
                        {/* Encabezado estilo Terminal */}
                        <div className="border-b border-[#33ff00]/30 pb-4 mb-6 flex justify-between items-center">
                            <div>
                                <h2 className="text-[#33ff00] text-lg md:text-xl tracking-widest uppercase font-bold">
                                    {'>'} {t.nav_proto}
                                </h2>
                                <p className="text-[10px] text-[#33ff00]/60 uppercase mt-1">
                                    SISTEMA: {isMobile ? t.touch_iface : t.peripherals}
                                </p>
                            </div>
                            <span className="text-[10px] animate-pulse text-[#33ff00] border border-[#33ff00] px-2 py-1 hidden sm:block">
                                [ {t.online} ]
                            </span>
                        </div>

                        {/* Cuerpo de Texto */}
                        <p className="text-sm md:text-base leading-relaxed mb-8 text-center md:text-left">
                            {t.instruct_text} <strong className="text-white bg-[#33ff00]/20 px-1">{t.nodes_interest}</strong>
                        </p>

                        {/* --- DIAGRAMA DE CONTROLES (ADAPTATIVO) --- */}
                        <div className="flex flex-col md:flex-row justify-center items-center gap-6 md:gap-10 mb-8 bg-white/5 p-6 rounded border border-white/10">

                            {isMobile ? (
                                /* === MÓVIL: JOYSTICK + GESTOS === */
                                <>
                                    <div className="flex flex-col items-center">
                                        {/* Icono Joystick CSS */}
                                        <div className="relative w-14 h-14 rounded-full border-2 border-[#33ff00] flex items-center justify-center mb-2">
                                            <div className="w-6 h-6 bg-[#33ff00] rounded-full shadow-[0_0_10px_#33ff00] transform translate-y-2 translate-x-2 opacity-80"></div>
                                            {/* Flechas decorativas */}
                                            <div className="absolute top-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-[#33ff00]"></div>
                                            <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-[#33ff00]"></div>
                                            <div className="absolute left-1 top-1/2 -translate-y-1/2 w-1 h-1 bg-[#33ff00]"></div>
                                            <div className="absolute right-1 top-1/2 -translate-y-1/2 w-1 h-1 bg-[#33ff00]"></div>
                                        </div>
                                        <span className="text-[10px] text-[#33ff00] font-bold uppercase tracking-wider">{t.virt_joy}</span>
                                        <span className="text-[9px] text-gray-500">{t.move}</span>
                                    </div>

                                    <div className="h-[1px] w-full md:h-10 md:w-[1px] bg-[#33ff00]/30"></div>

                                    <div className="flex flex-col items-center">
                                        {/* Icono Touch/Swipe CSS */}
                                        <div className="relative w-14 h-14 border border-dashed border-[#33ff00]/50 rounded-lg flex items-center justify-center mb-2 overflow-hidden">
                                            <div className="w-4 h-4 bg-white/80 rounded-full animate-ping absolute"></div>
                                            <div className="text-2xl">👆</div>
                                        </div>
                                        <span className="text-[10px] text-[#33ff00] font-bold uppercase tracking-wider">{t.screen}</span>
                                        <span className="text-[9px] text-gray-500">{t.swipe_tap}</span>
                                    </div>
                                </>
                            ) : (
                                /* === ESCRITORIO: WASD + MOUSE === */
                                <>
                                    <div className="flex flex-col items-center">
                                        <div className="w-8 h-8 border border-[#33ff00] flex items-center justify-center text-[#33ff00] font-bold mb-1 rounded-sm text-xs">W</div>
                                        <div className="flex gap-1">
                                            <div className="w-8 h-8 border border-[#33ff00] flex items-center justify-center text-[#33ff00] font-bold rounded-sm text-xs">A</div>
                                            <div className="w-8 h-8 border border-[#33ff00] flex items-center justify-center text-[#33ff00] font-bold rounded-sm text-xs">S</div>
                                            <div className="w-8 h-8 border border-[#33ff00] flex items-center justify-center text-[#33ff00] font-bold rounded-sm text-xs">D</div>
                                        </div>
                                        <span className="text-[10px] mt-2 uppercase tracking-wider text-[#33ff00]">{t.keyboard}</span>
                                        <span className="text-[9px] text-gray-500">{t.movement}</span>
                                    </div>

                                    <div className="h-[1px] w-full md:h-10 md:w-[1px] bg-[#33ff00]/30"></div>

                                    <div className="flex flex-col items-center">
                                        <div className="relative w-10 h-14 border border-[#33ff00] rounded-full flex justify-center pt-3">
                                            <div className="w-1 h-3 bg-[#33ff00] rounded-full animate-bounce"></div>
                                            <div className="absolute top-0 w-full h-1/2 border-b border-[#33ff00]/30"></div>
                                        </div>
                                        <span className="text-[10px] mt-2 uppercase tracking-wider text-[#33ff00]">{t.mouse}</span>
                                        <span className="text-[9px] text-gray-500">{t.click_drag}</span>
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Botón de Acción */}
                        <button
                            className="w-full group relative py-4 px-5 border border-[#33ff00] text-[#33ff00] font-bold tracking-widest uppercase text-sm md:text-base
                            transition-all duration-300 hover:bg-[#33ff00] hover:text-black hover:shadow-[0_0_20px_rgba(51,255,0,0.4)] active:scale-95"
                            onClick={(e) => {
                                e.stopPropagation(); // 🔴 FIX: Evitar que el click se propague al documento y cause efectos secundarios
                                setShowInitial3DPopup(false);
                            }}
                        >
                            <span className="absolute inset-0 w-full h-full bg-[#33ff00]/10 transform scale-x-0 group-hover:scale-x-100 transition-transform origin-left duration-300"></span>
                            <span className="relative flex items-center justify-center gap-2">
                                [ {t.start} ]
                            </span>
                        </button>
                    </div>
                );
            }

            // 3. Manejo del Pop-up de Contenido Narrativo y/o Avance Final (Imagen, Texto, o 3D Finalizado)
            if (!showFinalAdvancePopup) {
                // No mostrar nada si no es el momento del pop-up de instrucción ni del pop-up de avance.
                return null;
            }

            // Define el texto y si el botón debe estar habilitado (solo relevante para 3D no completado, pero esto ya está filtrado por showFinalAdvancePopup)
            let buttonText = t.next + " →";

            if (is3DModel) {
                buttonText = t.continue_adv + " →";
            }
            // Render del pop-up final
            return (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm font-mono">

                    {/* Estilos para scrollbar personalizado (Solo para este componente) */}
                    <style>{`
                                .tech - scroll::-webkit-scrollbar {width: 4px; }
                        .tech-scroll::-webkit-scrollbar-track {background: #111; }
                        .tech-scroll::-webkit-scrollbar-thumb {background: #33ff00; border-radius: 2px; }
                    `}</style>

                    <div className={`
                        relative w-full max-w-[650px] 
                        bg-black/95 border border-[#33ff00]/60 
                        shadow-[0_0_50px_rgba(51,255,0,0.2)]
                        flex flex-col
                        animate-in zoom-in-95 duration-300
                    `}>

                        {/* --- DECORACIÓN DE ESQUINAS (HUD) --- */}
                        <div className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-[#33ff00] z-10"></div>
                        <div className="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-[#33ff00] z-10"></div>
                        <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-[#33ff00] z-10"></div>
                        <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-[#33ff00] z-10"></div>

                        {/* --- HEADER --- */}
                        <div className="flex justify-between items-center p-6 border-b border-[#33ff00]/20 bg-[#33ff00]/5">
                            <div className="flex items-center gap-2">
                                <span className="w-2 h-2 bg-[#33ff00] animate-pulse"></span>
                                <span className="text-[#33ff00] text-xs md:text-sm tracking-[0.2em] uppercase font-bold">
                                    {t.narrative_incoming}
                                </span>
                            </div>

                            {/* Decoración visual de bits */}
                            <div className="flex gap-1 opacity-50">
                                <div className="w-1 h-4 bg-[#33ff00]"></div>
                                <div className="w-1 h-3 bg-[#33ff00]"></div>
                                <div className="w-1 h-2 bg-[#33ff00]"></div>
                            </div>
                        </div>

                        {/* --- CONTENIDO SCROLLABLE --- */}
                        <div className="p-6 md:p-10 max-h-[60vh] overflow-y-auto tech-scroll">
                            <div className="border-l-2 border-[#33ff00] pl-4 md:pl-6">
                                <p className="text-base md:text-xl leading-relaxed text-gray-200 font-medium drop-shadow-sm whitespace-pre-line">
                                    {contentText}
                                </p>
                            </div>
                        </div>

                        {/* --- FOOTER / ACCIONES --- */}
                        <div className="p-6 border-t border-[#33ff00]/20 bg-black">
                            {step.id_siguiente_paso && (
                                <button
                                    className="w-full group relative py-4 px-6 border border-[#33ff00] bg-transparent text-[#33ff00] font-bold text-base md:text-lg tracking-widest uppercase
                                    transition-all duration-300 hover:bg-[#33ff00] hover:text-black shadow-[0_0_15px_rgba(51,255,0,0.1)] hover:shadow-[0_0_30px_rgba(51,255,0,0.5)]"
                                    onClick={() => handleNextStep(step.id_siguiente_paso as number)}
                                >
                                    {/* Efecto de barrido al hacer hover */}
                                    <span className="absolute inset-0 w-0 bg-[#33ff00] transition-all duration-[250ms] ease-out group-hover:w-full opacity-10"></span>

                                    <span className="relative z-10 flex items-center justify-center gap-3">
                                        {buttonText}
                                        <span className="group-hover:translate-x-2 transition-transform duration-300">{'>>'}</span>
                                    </span>
                                </button>
                            )}

                            {/* Metadata inferior derecha */}
                            <div className="absolute bottom-2 right-3 text-[8px] md:text-[10px] text-[#33ff00]/40 font-mono tracking-wider">
                                PACKET_ID: {Date.now().toString().slice(-6)} // EOP
                            </div>
                        </div>

                    </div>
                </div>
            );
        }

        // --- Lógica para Pasos Finales ---
        if (step.tipo_paso === 'final') {
            const isChapterEnd = step.id_siguiente_paso !== null;
            return (
                <div className={`
                    absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-30
                    w-[95%] md:w-[90%] max-w-lg 
                    bg-black/95 backdrop-blur-md border border-[#33ff00] shadow-[0_0_50px_rgba(51,255,0,0.2)]
                    p-6 md:p-10 font-mono text-center
                    transition-all duration-500 ease-in-out
                    ${showStepContent ? 'visible opacity-100 scale-100' : 'opacity-0 pointer-events-none scale-95'}
                `}>
                    {/* Decoración Superior */}
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#33ff00] to-transparent opacity-50"></div>

                    {/* Encabezado de Estado */}
                    <div className="mb-6 md:mb-8 border-b border-[#33ff00]/30 pb-4">
                        <div className="text-3xl md:text-4xl mb-2">
                            {isChapterEnd ? '💾' : '🏁'}
                        </div>

                        {/* Título Responsivo: Letra más pequeña y menos espacio en móvil */}
                        <h2 className="text-[#33ff00] text-lg md:text-2xl font-bold tracking-wide md:tracking-widest uppercase animate-pulse break-words leading-tight">
                            {isChapterEnd ? "> " + t.seq_completed : "> " + t.conn_terminated}
                        </h2>

                        <p className="text-[8px] md:text-[10px] text-[#33ff00]/50 mt-2 tracking-[0.1em] md:tracking-[0.2em]">
                            {t.data_saved}
                        </p>
                    </div>

                    {/* Cuerpo del Texto */}
                    <p className="text-sm md:text-lg text-gray-300 leading-relaxed mb-8 md:mb-10">
                        {contentText}
                    </p>

                    {/* Botón de Acción Táctico */}
                    <div className="flex justify-center">
                        <button
                            className="group relative w-full py-3 md:py-4 px-4 border border-[#33ff00] text-[#33ff00] font-bold text-xs md:text-lg tracking-wide md:tracking-widest uppercase
                            transition-all duration-300 hover:bg-[#33ff00] hover:text-black hover:shadow-[0_0_20px_rgba(51,255,0,0.5)]"
                            onClick={() => handleNextStep(step.id_siguiente_paso as number)}
                        >
                            <span className="flex items-center justify-center gap-2 relative z-10">
                                {/* Texto ligeramente acortado o ajustado */}
                                {isChapterEnd ? `[ ${t.next_phase} ]` : `[ ${t.end_sim} ]`}
                                <span className="group-hover:translate-x-2 transition-transform">{'>>'}</span>
                            </span>
                        </button>
                    </div>

                    {/* Decoración de Esquinas */}
                    <div className="absolute top-2 left-2 w-2 h-2 border-t border-l border-[#33ff00]"></div>
                    <div className="absolute top-2 right-2 w-2 h-2 border-t border-r border-[#33ff00]"></div>
                    <div className="absolute bottom-2 left-2 w-2 h-2 border-b border-l border-[#33ff00]"></div>
                    <div className="absolute bottom-2 right-2 w-2 h-2 border-b border-r border-[#33ff00]"></div>
                </div>
            );
        }

        return null;
    };





    // --- LÓGICA DE RENDERIZADO CORREGIDA ---

    if (!user?.id) return null;

    // 1. Si estamos cargando datos, mostrar un loader.
    // Esto previene la condición de carrera (race condition).
    if (loading) {
        return (
            <div className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center font-mono p-4">

                {/* Estilos de animación inline */}
                <style>{`
                    @keyframes scan-bar {
                        0% { transform: translateX(-100%); }
                        50% { transform: translateX(100%); }
                        100% { transform: translateX(-100%); }
                    }
                    .animate-scan {
                        animation: scan-bar 2s ease-in-out infinite;
                    }
                `}</style>

                {/* Fondo Scanlines */}
                <div className="absolute inset-0 pointer-events-none opacity-20"
                    style={{ backgroundImage: 'linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.06))', backgroundSize: '100% 2px, 3px 100%' }}>
                </div>

                {/* Contenedor Central Adaptativo */}
                <div className="relative w-[95%] md:w-[90%] max-w-md p-6 md:p-8 border-x border-[#33ff00]/30 bg-black/50 backdrop-blur-sm text-center">

                    {/* Decoración Superior e Inferior */}
                    <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-[#33ff00] to-transparent"></div>
                    <div className="absolute bottom-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-[#33ff00] to-transparent"></div>

                    {/* Texto Principal: Tamaño y espaciado dinámicos */}
                    <h2 className="text-[#33ff00] text-lg md:text-xl font-bold tracking-[0.1em] md:tracking-[0.2em] mb-2 animate-pulse break-words">
                        {'>'} ACCEDIENDO_MEMORIA
                    </h2>

                    {/* Subtítulo */}
                    <p className="text-[#33ff00]/60 text-[10px] md:text-xs uppercase tracking-widest mb-6 md:mb-8">
                        Desencriptando fragmentos narrativos...
                    </p>

                    {/* Barra de Carga Hacker */}
                    <div className="relative w-full h-1 bg-[#33ff00]/20 overflow-hidden mb-2">
                        <div className="absolute top-0 left-0 w-full h-full bg-[#33ff00] animate-scan shadow-[0_0_10px_#33ff00]"></div>
                    </div>

                    {/* Datos ficticios de carga */}
                    <div className="flex justify-between text-[9px] md:text-[10px] text-[#33ff00]/40 font-mono mt-2">
                        <span>BUFFER: 64KB</span>
                        <span>ESTADO: SYNC</span>
                    </div>

                </div>
            </div>
        );
    }

    // 2. Si se nos dijo explícitamente que mostremos el mensaje final, hacerlo.
    if (showEndMessage) {
        return (
            <div className="relative min-h-screen bg-black flex flex-col items-center justify-center p-4 font-mono z-[100]">

                {/* Fondo de Scanlines (Opcional, para consistencia) */}
                <div className="absolute inset-0 pointer-events-none opacity-20"
                    style={{ backgroundImage: 'linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.06))', backgroundSize: '100% 2px, 3px 100%' }}>
                </div>

                {/* Contenedor Principal */}
                <div className="relative w-full max-w-lg bg-black/90 border border-[#33ff00] p-10 shadow-[0_0_50px_rgba(51,255,0,0.2)] text-center">

                    {/* Decoración de esquinas */}
                    <div className="absolute top-0 left-0 w-3 h-3 bg-[#33ff00]"></div>
                    <div className="absolute top-0 right-0 w-3 h-3 bg-[#33ff00]"></div>
                    <div className="absolute bottom-0 left-0 w-3 h-3 bg-[#33ff00]"></div>
                    <div className="absolute bottom-0 right-0 w-3 h-3 bg-[#33ff00]"></div>

                    {/* Icono de Éxito */}
                    <div className="text-6xl mb-6 animate-bounce">
                        🏁
                    </div>

                    {/* Título */}
                    <h2 className="text-[#33ff00] text-4xl font-bold mb-2 tracking-widest uppercase">
                        MISIÓN COMPLETADA
                    </h2>
                    <div className="h-[1px] w-20 bg-[#33ff00] mx-auto mb-6"></div>

                    {/* Texto de Cuerpo */}
                    <p className="text-[#a8a8a8] text-lg leading-relaxed mb-8">
                        Los datos han sido recuperados exitosamente.<br />
                        Tu contribución a la memoria colectiva ha sido registrada.
                    </p>

                    {/* Botón de Acción */}
                    <button
                        className="... transition-transform duration-300 ..."
                        style={{ willChange: 'transform' }}
                        onClick={handleReturnToMenu}
                    >
                        <span className="absolute inset-0 w-full h-full bg-[#33ff00]/10 transform scale-x-0 group-hover:scale-x-100 transition-transform origin-left duration-300"></span>
                        <span className="relative">[ FINALIZAR Y VOLVER AL HUB ]</span>
                    </button>

                    {/* Footer Técnico */}
                    <div className="mt-6 text-[10px] text-[#33ff00]/40 uppercase tracking-widest">
                        SESSION_ID: END_OF_LINE
                    </div>
                </div>
            </div>
        );
    }

    // 3. Obtener el paso actual.
    const stepActual = flujoData[currentStepIndex];

    // 4. Si NO estamos cargando, y NO es el fin, pero AÚN ASÍ no hay un paso
    //    (ej. flujoData vino vacío de la DB o estamos en transición), validamos:
    if (!stepActual) {
        // Si hay una historia seleccionada pero no hay datos, probablemente es una transición rápida
        // o un lag en el estado 'loading'. Mostramos cargando en lugar de error.
        if (selectedHistoriaId) {
            return (
                <div className="fixed inset-0 bg-black z-[100] flex flex-col items-center justify-center font-mono">
                    <h2 className="text-[#33ff00] animate-pulse text-xl">
                        {'>'} ACCEDIENDO A MEMORIA...
                    </h2>
                    {/* DEBUG INFO: Mostrar por qué está trabado */}
                    <div className="mt-4 text-[10px] text-gray-500 font-mono text-center">
                        <div>ID Historia: {selectedHistoriaId}</div>
                        <div>Paso Index: {currentStepIndex} / {flujoData.length}</div>
                        <div>Datos Flujo: {flujoData.length > 0 ? "CARGADOS" : "VACÍOS"}</div>
                    </div>
                </div>
            );
        }

        // Si NO hay historia seleccionada (y por lógica anterior no estamos en el menú??)
        // O realmente falló todo.
        console.error("Error: No se encontró un paso actual (currentStep), pero 'loading' es false. Mostrando fin.");
        return (
            <div className="fixed inset-0 bg-black z-[100] flex flex-col items-center justify-center p-4 font-mono text-red-500 select-none">

                {/* Fondo de Scanlines Rojo (Efecto de Alerta) */}
                <div className="absolute inset-0 pointer-events-none opacity-10"
                    style={{ backgroundImage: 'linear-gradient(rgba(50, 0, 0, 0) 50%, rgba(50, 0, 0, 0.25) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(255, 0, 0, 0.02), rgba(255, 0, 0, 0.06))', backgroundSize: '100% 2px, 3px 100%' }}>
                </div>

                {/* Contenedor de Error */}
                <div className="relative w-full max-w-lg bg-black border-2 border-red-600 p-8 shadow-[0_0_50px_rgba(255,0,0,0.15)]">

                    {/* Decoración de esquinas (Brackets de error) */}
                    <div className="absolute -top-1 -left-1 w-4 h-4 border-t-4 border-l-4 border-red-600"></div>
                    <div className="absolute -top-1 -right-1 w-4 h-4 border-t-4 border-r-4 border-red-600"></div>
                    <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-4 border-l-4 border-red-600"></div>
                    <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-4 border-r-4 border-red-600"></div>

                    {/* Encabezado */}
                    <div className="flex items-center gap-4 mb-6 border-b border-red-900/50 pb-4">
                        <div className="text-4xl animate-pulse">⚠️</div>
                        <div>
                            <h2 className="text-2xl font-bold tracking-widest uppercase text-white">
                                {t.sys_failure}
                            </h2>
                            <p className="text-xs text-red-500 opacity-70">{t.err_void}</p>
                        </div>
                    </div>

                    {/* Cuerpo del mensaje (Estilo Consola) */}
                    <div className="bg-red-900/10 p-4 mb-8 border-l-2 border-red-600 font-mono text-sm leading-relaxed">
                        <p className="mb-2">{'>'} INITIATING DIAGNOSTIC...</p>
                        <p className="mb-2 text-white">ERROR: {t.err_load}</p>
                        <p className="opacity-70">{'>'} DETALLE: currentStep is null.</p>
                        <span className="inline-block w-2 h-4 bg-red-600 animate-pulse mt-2"></span>
                    </div>

                    {/* Botón de Acción */}
                    <button
                        className="w-full group relative py-3 px-6 border border-red-600 text-red-600 font-bold uppercase tracking-widest
                        transition-all duration-300 hover:bg-red-600 hover:text-white hover:shadow-[0_0_20px_rgba(255,0,0,0.6)]"
                        onClick={onBack}
                    >
                        <span className="absolute inset-0 w-full h-full bg-red-600/10 transform scale-x-0 group-hover:scale-x-100 transition-transform origin-left duration-300"></span>
                        <span className="relative flex items-center justify-center gap-2">
                            <span>{'<<'}</span> {t.abort_retry}
                        </span>
                    </button>
                </div>
            </div>
        );
    }

    // --- FIN DE LA LÓGICA CORREGIDA ---

    // Obtener recurso multimedia del paso actual
    const recursoActual = getRecurso(stepActual?.recursomultimedia_id);
    const mediaSrc = recursoActual?.archivo || '';
    // Determinar si el paso es de decisión
    const isDecisionStep = stepActual?.tipo_paso === 'pregunta' || (stepActual?.opciones_decision?.opciones_siguientes_json && stepActual.opciones_decision.opciones_siguientes_json.length > 0);
    const hasNext = currentStepIndex < flujoData.length - 1;
    const hasPrevious = currentStepIndex > 0;
    const is3DModel = recursoActual?.tipo === '3d_model';


    // Renderizado del componente principal
    return (
        <div className="relative min-h-screen bg-black text-white">
            <style>{styles}</style>

            <div className="full-media-container">

                {recursoActual?.tipo === 'imagen' && (
                    <img src={mediaSrc} alt="Fondo de la historia" className="w-full h-full object-cover" />
                )}
                {/* CAMBIO CLAVE para avance automático */}
                {recursoActual?.tipo === 'audio' && (
                    <audio
                        ref={audioRef}
                        key={mediaSrc}
                        src={mediaSrc}
                        autoPlay
                        onEnded={() => { handleNextStep(stepActual?.id_siguiente_paso || null); }}
                    />
                )}

                {recursoActual?.tipo === 'video' && (
                    <video
                        ref={videoRef}
                        key={mediaSrc}
                        src={mediaSrc}
                        autoPlay
                        onEnded={() => { handleNextStep(stepActual?.id_siguiente_paso || null); }}
                    >
                        {subtitleUrl && subtitlesEnabled && (
                            <track kind="subtitles" src={subtitleUrl} srcLang="en" label="English" default />
                        )}
                    </video>
                )}
                {recursoActual?.tipo === 'interactive' && (
                    <canvas id="interactiveCanvas"></canvas>
                )}
                {is3DModel && recursoActual && (
                    <div ref={aframeContainerRef} style={{ width: '100%', height: '100%', position: 'relative' }}>
                        <a-scene embedded vr-mode-ui="disabled: true" renderer="antialias: true">
                            {/* Modelo GLB con componente de interacción */}
                            {(() => {
                                const hotspotConfigs = recursoActual.metadatos ? JSON.parse(recursoActual.metadatos) as HotspotConfig[] : [];
                                const meshNames = hotspotConfigs.map(h => h.meshName);

                                return (
                                    <a-entity
                                        id="gltf-model-entity"
                                        gltf-model={recursoActual.archivo}
                                        position="0 0 0"
                                        gltf-hotspot-interaction={`hotspotMeshes: ${meshNames.join(', ')}; hotspotData: ${JSON.stringify(hotspotConfigs)}; visitedMeshes: ${Array.from(discoveredHotspotIds.current).join(',')}`}
                                    />
                                );
                            })()}

                            {/* Cámara ajustada más baja con altura dinámica */}
                            <a-entity id="player-rig" position={`0 ${cameraHeight} 3`}>
                                <a-camera
                                    wasd-controls="acceleration: 15"
                                    look-controls="pointerLockEnabled: false; touchEnabled: true; magicWindowTrackingEnabled: true"
                                >
                                    <a-cursor
                                        fuse="false"
                                        raycaster="objects: #gltf-model-entity; far: 100; interval: 100"
                                        color="#FFFFFF"
                                        opacity="0.9"
                                    />
                                </a-camera>
                            </a-entity>

                            {/* Iluminación */}
                            <a-light type="ambient" color="#FFF" intensity="0.8" />
                            <a-light type="directional" position="2 3 1" intensity="0.6" />
                            <a-light type="point" position="-2 2 2" intensity="0.4" color="#88CCFF" />
                        </a-scene>
                    </div>
                )}


            </div>


            <div id="stepContent" className="step-content">
                {renderStepContent()}
            </div>
            {/* Fin del div principal */}



            {/* HUD Minimalista Flotante (Solo para escenarios 3D) */}
            {is3DModel && (
                <div className="fixed bottom-2 right-2 z-[100] flex flex-col gap-1.5 items-end">

                    {/* Contador de Nodos */}
                    <div className="bg-black/95 border border-[#33ff00]/80 px-2 py-1 flex flex-col items-center min-w-[45px] shadow-[0_0_10px_rgba(51,255,0,0.1)] backdrop-blur-sm">
                        <span className="text-[7px] text-[#33ff00]/70 font-mono uppercase tracking-[0.05em] mb-0.5">{t.nodes}</span>
                        <span className="text-white font-mono text-[11px] font-bold leading-none">
                            {discoveredHotspots}<span className="text-[#33ff00]/30 mx-0.5">/</span>{totalHotspotsRef.current}
                        </span>
                    </div>

                    <div className="flex gap-1.5">
                        {/* Control de Volumen */}
                        {backgroundMusicUrl && (
                            <div className="relative">
                                <button
                                    onClick={() => {
                                        setShowVolumeControl(!showVolumeControl);
                                        setShowHeightControl(false);
                                    }}
                                    className={`w-6 h-6 bg-black/95 border border-[#33ff00]/80 flex items-center justify-center transition-all hover:bg-[#33ff00]/20 ${showVolumeControl ? 'bg-[#33ff00]/30' : ''}`}
                                    title={t.vol}
                                >
                                    <span className="text-[11px]">🔊</span>
                                </button>
                                {showVolumeControl && (
                                    <div className="absolute bottom-8 right-0 bg-black/98 border border-[#33ff00] p-2 flex flex-col items-center gap-1.5 animate-in fade-in slide-in-from-bottom-1 shadow-[0_0_15px_rgba(51,255,0,0.2)]">
                                        <div className="h-24 flex items-center justify-center py-1">
                                            <input
                                                type="range" min="0" max="1" step="0.1"
                                                value={backgroundMusicVolume}
                                                onChange={(e) => setBackgroundMusicVolume(parseFloat(e.target.value))}
                                                className="h-20 accent-[#33ff00] cursor-pointer"
                                                style={{ writingMode: 'vertical-lr', direction: 'rtl', WebkitAppearance: 'slider-vertical' }}
                                            />
                                        </div>
                                        <span className="text-[8px] text-white font-mono border-t border-[#33ff00]/20 pt-1 w-full text-center">
                                            {Math.round(backgroundMusicVolume * 100)}%
                                        </span>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Control de Cámara */}
                        <div className="relative">
                            <button
                                onClick={() => {
                                    setShowHeightControl(!showHeightControl);
                                    setShowVolumeControl(false);
                                }}
                                className={`w-6 h-6 bg-black/95 border border-[#33ff00]/80 flex items-center justify-center transition-all hover:bg-[#33ff00]/20 ${showHeightControl ? 'bg-[#33ff00]/30' : ''}`}
                                title={t.cam}
                            >
                                <span className="text-[11px]">📷</span>
                            </button>
                            {showHeightControl && (
                                <div className="absolute bottom-8 right-0 bg-black/98 border border-[#33ff00] p-2 flex flex-col items-center gap-1.5 animate-in fade-in slide-in-from-bottom-1 shadow-[0_0_15px_rgba(51,255,0,0.2)]">
                                    <div className="h-24 flex items-center justify-center py-1">
                                        <input
                                            type="range" min="-3" max="2" step="0.1"
                                            value={cameraHeight}
                                            onChange={(e) => setCameraHeight(parseFloat(e.target.value))}
                                            className="h-20 accent-[#33ff00] cursor-pointer"
                                            style={{ writingMode: 'vertical-lr', direction: 'rtl', WebkitAppearance: 'slider-vertical' }}
                                        />
                                    </div>
                                    <span className="text-[8px] text-white font-mono border-t border-[#33ff00]/20 pt-1 w-full text-center">
                                        {cameraHeight.toFixed(1)}m
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
            {is3DModel && !showStepContent && (
                <div className="absolute top-0 left-0 w-full h-full z-50 bg-black/90 backdrop-blur-sm flex flex-col items-center justify-center font-mono">

                    {/* Definimos la animación CSS aquí mismo para que funcione al copiar/pegar */}
                    <style>{`
                        @keyframes slide-stripes {
                            0% { background-position: 0 0; }
                            100% { background-position: 30px 0; }
                        }
                        .loading-stripes {
                            background-image: linear-gradient(
                                45deg, 
                                rgba(51, 255, 0, 0.15) 25%, 
                                transparent 25%, 
                                transparent 50%, 
                                rgba(51, 255, 0, 0.15) 50%, 
                                rgba(51, 255, 0, 0.15) 75%, 
                                transparent 75%, 
                                transparent
                            );
                            background-size: 30px 30px;
                            animation: slide-stripes 1s linear infinite;
                        }
                    `}</style>

                    {/* Contenedor de la Tarjeta de Carga */}
                    <div className="w-[90%] max-w-[400px] border border-[#33ff00] p-6 bg-black shadow-[0_0_40px_rgba(51,255,0,0.15)] relative overflow-hidden">

                        {/* Decoración de esquina (Corner brackets) */}
                        <div className="absolute top-0 left-0 w-2 h-2 bg-[#33ff00]"></div>
                        <div className="absolute top-0 right-0 w-2 h-2 bg-[#33ff00]"></div>
                        <div className="absolute bottom-0 left-0 w-2 h-2 bg-[#33ff00]"></div>
                        <div className="absolute bottom-0 right-0 w-2 h-2 bg-[#33ff00]"></div>

                        {/* Encabezado */}
                        <div className="flex justify-between items-end mb-2 text-[#33ff00]">
                            <span className="text-lg font-bold tracking-widest animate-pulse">{'>'} CARGANDO_ENTORNO</span>
                            <span className="text-xs opacity-70">v.2.5</span>
                        </div>

                        {/* Barra de Progreso */}
                        <div className="h-6 w-full border border-[#33ff00]/50 p-1 relative">
                            {/* Fondo animado (Stripes) */}
                            <div className="h-full w-full bg-[#33ff00]/10 loading-stripes absolute top-0 left-0 z-0"></div>

                            {/* Barra sólida que se mueve (Indeterminada) */}
                            <div className="h-full bg-[#33ff00] relative z-10 w-full opacity-80 animate-pulse"></div>
                        </div>

                        {/* Texto de estado inferior */}
                        <div className="mt-3 flex justify-between text-xs font-mono text-[#33ff00]/70">
                            <span>PROCESANDO GEOMETRÍA...</span>
                            <span className="animate-bounce">...</span>
                        </div>

                    </div>
                </div>
            )}



            {/* Joystick Virtual para Móvil */}
            {isMobile && is3DModel && (
                <div
                    className={`
                        fixed z-40 select-none touch-none 
                        transition-all duration-500 ease-in-out
                        left-2  /* Más a la izquierda */
                        bottom-6 /* Posición fija sin barra inferior */
                        ${showInitial3DPopup ? 'opacity-0 pointer-events-none' : 'opacity-100 pointer-events-auto'}
                    `}
                    style={{ width: '150px', height: '150px' }}
                >
                    {/* Base del Joystick (Círculo decorativo) */}
                    <div className="absolute inset-0 rounded-full border border-[#33ff00]/30 bg-black/20 backdrop-blur-sm shadow-[0_0_15px_rgba(51,255,0,0.1)] pointer-events-none">
                        {/* Mira central decorativa */}
                        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-2 h-2 bg-[#33ff00] rounded-full opacity-50"></div>
                        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[100px] h-[1px] bg-[#33ff00]/10"></div>
                        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[1px] h-[100px] bg-[#33ff00]/10"></div>
                    </div>

                    {/* Contenedor de Botones (Grid 3x3) */}
                    <div className="relative w-full h-full grid grid-cols-3 grid-rows-3">

                        {/* Fila 1: ARRIBA */}
                        <div className="col-start-2 row-start-1 flex items-end justify-center pb-1">
                            <button
                                id="mobile-btn-up"
                                className="w-12 h-12 rounded-t-lg rounded-b-sm bg-black/60 border border-[#33ff00]/50 text-[#33ff00] 
                                active:bg-[#33ff00] active:text-black active:shadow-[0_0_15px_#33ff00] transition-all
                                flex items-center justify-center text-xl font-bold"
                                style={{ touchAction: 'none' }}
                            // AGREGA AQUÍ TUS EVENTOS onPointerDown SI LOS TIENES CENTRALIZADOS
                            >
                                ▲
                            </button>
                        </div>

                        {/* Fila 2: IZQUIERDA - CENTRO - DERECHA */}
                        <div className="col-start-1 row-start-2 flex items-center justify-end pr-1">
                            <button
                                id="mobile-btn-left"
                                className="w-12 h-12 rounded-l-lg rounded-r-sm bg-black/60 border border-[#33ff00]/50 text-[#33ff00] 
                                active:bg-[#33ff00] active:text-black active:shadow-[0_0_15px_#33ff00] transition-all
                                flex items-center justify-center text-xl font-bold"
                                style={{ touchAction: 'none' }}
                            >
                                ◀
                            </button>
                        </div>

                        {/* Centro Decorativo */}
                        <div className="col-start-2 row-start-2 flex items-center justify-center pointer-events-none">
                            <div className="w-8 h-8 rounded-full border border-[#33ff00]/30 flex items-center justify-center"></div>
                        </div>

                        <div className="col-start-3 row-start-2 flex items-center justify-start pl-1">
                            <button
                                id="mobile-btn-right"
                                className="w-12 h-12 rounded-r-lg rounded-l-sm bg-black/60 border border-[#33ff00]/50 text-[#33ff00] 
                                active:bg-[#33ff00] active:text-black active:shadow-[0_0_15px_#33ff00] transition-all
                                flex items-center justify-center text-xl font-bold"
                                style={{ touchAction: 'none' }}
                            >
                                ▶
                            </button>
                        </div>

                        {/* Fila 3: ABAJO */}
                        <div className="col-start-2 row-start-3 flex items-start justify-center pt-1">
                            <button
                                id="mobile-btn-down"
                                className="w-12 h-12 rounded-b-lg rounded-t-sm bg-black/60 border border-[#33ff00]/50 text-[#33ff00] 
                                active:bg-[#33ff00] active:text-black active:shadow-[0_0_15px_#33ff00] transition-all
                                flex items-center justify-center text-xl font-bold"
                                style={{ touchAction: 'none' }}
                            >
                                ▼
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Hotspot - Fullscreen con botón X */}
            <div
                id="hotspotModal"
                className="fixed inset-0 bg-black/95 backdrop-blur-xl flex flex-col z-[999999] font-mono"
                style={{ display: hotspotModal ? 'flex' : 'none' }}
            >
                {/* Fondo de Scanlines */}
                <div className="absolute inset-0 pointer-events-none z-0 opacity-20"
                    style={{ backgroundImage: 'linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.06))', backgroundSize: '100% 2px, 3px 100%' }}>
                </div>

                {/* --- ENCABEZADO COMPACTO (Fijo arriba, sin robar mucho espacio) --- */}
                <div className="relative z-50 flex justify-between items-center px-4 py-2 border-b border-[#33ff00]/30 bg-[#33ff00]/5 shrink-0 h-12">
                    <div className="flex items-center gap-3 overflow-hidden">
                        <span className="w-2 h-2 bg-[#33ff00] animate-pulse shrink-0"></span>
                        <div className="flex flex-col">
                            <h3 className="text-[#33ff00] text-xs md:text-base font-bold tracking-widest uppercase truncate max-w-[200px] md:max-w-md leading-none">
                                {getLocalizedContent(hotspotModal, 'title', language) || t.hotspot_unknown}
                            </h3>
                        </div>
                    </div>

                    <button
                        className="flex items-center justify-center bg-black border border-[#33ff00]/50 hover:bg-[#33ff00] w-8 h-8 transition-all duration-300 shrink-0 group"
                        onClick={closeHotspotModal}
                    >
                        <span className="text-[#33ff00] text-sm font-bold group-hover:text-black">X</span>
                    </button>
                </div>

                {/* --- ÁREA DE CONTENIDO (FULL SCREEN REAL) --- */}
                {/* Quitamos cualquier padding (p-8) y usamos flex-col para llenar */}
                <div className="relative flex-1 w-full h-full bg-black overflow-hidden flex flex-col">

                    {/* Esquinas decorativas (Flotantes, no empujan contenido) */}
                    <div className="absolute top-2 left-2 w-4 h-4 border-t-2 border-l-2 border-[#33ff00] pointer-events-none z-50 opacity-50"></div>
                    <div className="absolute top-2 right-2 w-4 h-4 border-t-2 border-r-2 border-[#33ff00] pointer-events-none z-50 opacity-50"></div>
                    <div className="absolute bottom-2 left-2 w-4 h-4 border-b-2 border-l-2 border-[#33ff00] pointer-events-none z-50 opacity-50"></div>
                    <div className="absolute bottom-2 right-2 w-4 h-4 border-b-2 border-r-2 border-[#33ff00] pointer-events-none z-50 opacity-50"></div>

                    <div className="w-full h-full relative flex items-center justify-center">

                        {/* IMAGEN */}
                        {hotspotModal?.contentType === 'imagen' && (
                            <img
                                src={hotspotModal.url}
                                alt={hotspotModal.title}
                                className="w-full h-full object-contain" // Imagen mantiene proporción para no deformarse
                            />
                        )}

                        {/* VIDEO */}
                        {hotspotModal?.contentType === 'video' && (
                            <div className="relative w-full h-full">
                                <video
                                    src={hotspotModal.url}
                                    controls
                                    autoPlay
                                    className="w-full h-full object-cover hotspot-video"
                                    onCanPlay={(e) => { handleMediaAutoplay(e.currentTarget); }}
                                >
                                    {hotspotSubtitleUrl && subtitlesEnabled && (
                                        <track kind="subtitles" src={hotspotSubtitleUrl} srcLang="en" label="English" default />
                                    )}
                                </video>
                                {hotspotModal.subtitlesUrl && (
                                    <button
                                        className={`absolute bottom-4 right-4 z-50 px-2 py-1 text-xs font-bold uppercase transition-colors ${subtitlesEnabled ? 'bg-[#33ff00] text-black' : 'bg-black/70 text-gray-400 border border-gray-600'}`}
                                        onClick={() => setSubtitlesEnabled(!subtitlesEnabled)}
                                    >
                                        CC
                                    </button>
                                )}
                            </div>
                        )}

                        {/* AUDIO (Centrado) */}
                        {hotspotModal?.contentType === 'audio' && (
                            <div className="w-full max-w-md p-6 border border-[#33ff00]/30 bg-black/80 flex flex-col items-center gap-6 m-4 relative z-10">
                                <div className="text-[#33ff00] text-6xl animate-pulse">🔊</div>
                                <div className="w-full h-8 flex items-center justify-center gap-1">
                                    {[...Array(15)].map((_, i) => (
                                        <div key={i} className="w-1 bg-[#33ff00]" style={{
                                            height: `${Math.random() * 100}%`,
                                            animation: `pulse 0.5s infinite ${Math.random()}s`
                                        }}></div>
                                    ))}
                                </div>
                                <audio
                                    src={hotspotModal.url}
                                    controls
                                    autoPlay
                                    className="w-full filter invert hue-rotate-180 contrast-150 opacity-90"
                                    onCanPlay={(e) => { handleMediaAutoplay(e.currentTarget); }}
                                />
                            </div>
                        )}

                        {/* INTERACTIVE / IFRAME (APP - Full Screen Absoluto) */}
                        {hotspotModal?.contentType === 'interactive' && (
                            <iframe
                                ref={iframeRef}
                                id="interactive-iframe"
                                src={hotspotModal.url}
                                title={hotspotModal.title}
                                className="absolute inset-0 w-full h-full block" // 'absolute inset-0' fuerza a pegar los bordes
                                style={{ border: 'none', background: '#000' }}
                                allowFullScreen
                            ></iframe>
                        )}
                    </div>
                </div>
            </div>

            {notification && (
                <div className="absolute top-8 left-1/2 transform -translate-x-1/2 z-50 bg-green-500 text-white py-3 px-6 rounded-full shadow-lg transition-all duration-500 ease-in-out animate-fade-in-down">
                    {notification}
                </div>
            )}



            {/* Modal de Historia Bloqueada */}
            {lockedHistoryModal && (
                <div className="fixed inset-0 bg-black bg-opacity-80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-gray-900 rounded-xl p-8 max-w-md w-full shadow-2xl border-2 border-red-600">
                        <div className="text-center">
                            <div className="text-6xl mb-4">🔒</div>
                            <h3 className="text-2xl font-bold mb-4 text-white">{t.locked_title}</h3>
                            <p className="text-gray-300 mb-6">
                                {t.unlock_msg} <span className="font-bold text-purple-400">"{getLocalizedContent(lockedHistoryModal.historia, 'titulo', language)}"</span>,
                                {t.must_complete_msg}
                            </p>
                            <div className="bg-purple-900 bg-opacity-50 p-4 rounded-lg mb-6">
                                <p className="font-bold text-xl text-purple-300">
                                    {getLocalizedContent(lockedHistoryModal.historiaMadre, 'titulo', language)}
                                </p>
                            </div>
                            <div className="flex gap-3">
                                <button
                                    className="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-3 px-4 rounded-lg font-semibold transition-all duration-300"
                                    onClick={() => {
                                        setLockedHistoryModal(null);
                                        handleHistoriaSelect(lockedHistoryModal.historiaMadre.id_historia);
                                    }}
                                >
                                    {t.go_req_story}
                                </button>
                                <button
                                    className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-3 px-4 rounded-lg font-semibold transition-all duration-300"
                                    onClick={() => setLockedHistoryModal(null)}
                                >
                                    {t.cancel}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {/* Botones de Navegación Manual (Solo para historias completadas) */}
            {isStoryCompleted && selectedHistoriaId && (
                <>
                    <button
                        onClick={goBack}
                        disabled={currentStepIndex === 0}
                        className="fixed left-4 top-1/2 transform -translate-y-1/2 z-50 bg-black/70 hover:bg-black/90 text-[#33ff00] border border-[#33ff00] p-3 rounded-full transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                        title={t.prev_step}
                    >
                        ◀
                    </button>
                    <button
                        onClick={goNext}
                        disabled={currentStepIndex === flujoData.length - 1}
                        className="fixed right-4 top-1/2 transform -translate-y-1/2 z-50 bg-black/70 hover:bg-black/90 text-[#33ff00] border border-[#33ff00] p-3 rounded-full transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                        title={t.next_step}
                    >
                        ▶
                    </button>
                </>
            )}
        </div>
    );
};

export default FlujoNarrativoUsuario;