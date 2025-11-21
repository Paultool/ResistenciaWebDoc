import 'aframe';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { gameServiceUser, PlayerStats } from '../services/GameServiceUser';
import MapaView from './MapaView';
//FICHA PERSONAJES
import { Personaje } from '../supabaseClient';
import { obtenerFichaPersonajePorId } from '../supabaseClient';
import { fail } from 'assert';

// 🔑 Acepta historiaId como prop
interface FlujoNarrativoUsuarioProps {
    historiaId: number; // ID de la historia a mostrar
    onBack: () => void;
    onUpdateProfile: (recompensaPositiva: number, recompensaNegativa: number, ubicacion: string) => void;
}

// Definición de la estructura del resultado de la aplicación (rental.html)
interface AppResult {
    source: 'RentalApp';
    type: 'app-result';
    status: 'success' | 'failure';
    // recompensaId aquí es la recompensa **positiva** o **negativa** definida en el Hotspot, no en la app
    recompensaId: number | undefined;
    // Ahora la app DEBE devolver el costo de XP si la operación fue exitosa
    costoXP?: number; // Valor de XP a aplicar (NEGATIVO para costos, POSITIVO para premios)
    message: string;
}

// Define las interfaces para tipar los datos
interface RecursoMultimediaData {
    id_recurso: number;
    tipo: 'imagen' | 'video' | 'audio' | 'transcripcion' | 'subtitulo' | 'interactive' | '3d_model' | 'app';
    archivo: string;
    metadatos: string | null;
}

interface FlujoNarrativoData {
    id_flujo: number;
    orden: number;
    tipo_paso: 'narrativo' | 'pregunta' | 'final' | 'app';
    contenido: string | null;
    id_recompensa: number | null;
    id_personaje: number | null;
    recursomultimedia_id: number | null;
    id_siguiente_paso: number | null;
    id_historia: number;
    opciones_decision: {
        opciones_siguientes_json: {
            texto: string;
            siguiente_paso_id: number;
        }[] | null;
    } | null;
    app_url?: string | null; // URL de la app para tipo_paso 'app'
}

interface HistoriaData {
    id_historia: number;
    titulo: string;
    descripcion: string;
    narrativa?: string;
    id_imagen_historia?: number;
    id_historia_dependencia?: number | null;
    estado?: 'bloqueado' | 'desbloqueado';
    id_ubicacion: { coordenadas: string } | null;
    orden?: number;
}

interface RecompensaData {
    id_recompensa: number;
    nombre: string;
    valor: number;
    descripcion: string | null;
}

// Interfaz para la data básica (la que ya usas en el estado 'personajesData')
interface PersonajeData {
    id_personaje: number;
    nombre: string;
}

// Nueva interfaz para la configuración de la App de Renta
interface RentalAppConfig {
    difficulty: "Facil" | "Medio" | "Dificil";
    price: number;
    requiredItem?: string; // Nombre del item requerido para éxito en STANDARD/HARD
}

// Interfaz para la Ficha Completa personaje (para el modal detallado )
interface PersonajeFicha {
    id_personaje: number;
    nombre: string;
    descripcion: string | null;
    imagen: string | null; // Tu campo se llama 'imagen'
    atributos_json: string | null; // Tu campo es un string JSON
    rol: string | null;
}

// Nueva interfaz para definir un Hotspot de Interacción
interface HotspotConfig {
    meshName: string; // El nombre de la malla dentro del GLB (ej: 'bidek')
    contentType: 'imagen' | 'video' | 'audio' | 'interactive' | 'backgroundMusic'; // Tipo de contenido
    title: string;
    url: string; // URL del contenido (imagen, video, audio)
    recompensaId?: number; // Opcional: Recompensa asociada
    personajeId?: number; // Opcional: Personaje a conocer
    successRecompensaId?: number; //app recompensa positiva
    failureRecompensaId?: number; //app recompensa negativa
    rentalAppConfig?: RentalAppConfig; // Configuración específica si contentType es 'interactive'
    position?: {  // Opcional: Posición específica del hotspot
        x: number;
        y: number;
        z: number;
    };
    backgroundMusic?: string; // Opcional: URL del audio de fondo para el modelo 3D
}

// Nueva interfaz para las props de MapaView
interface MapaViewProps {
    historias: HistoriaData[];
    historiasVisitadas: number[];
    onStartNarrativeFromMap: (historiaId: number) => void;
    onBack: () => void;
    initialCenter: [number, number]; // <-- ¡Añade la nueva prop!
}

const FlujoNarrativoUsuario = ({ historiaId, onBack, onUpdateProfile }: FlujoNarrativoUsuarioProps) => {
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
    const [historiasVisitadas, setHistoriasVisitadas] = useState<number[]>([]);
    const [playerStats, setPlayerStats] = useState<PlayerStats | null>(null);
    const [showAudioOverlay, setShowAudioOverlay] = useState(false);
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const [showInventory, setShowInventory] = useState(false);
    const [showCharacters, setShowCharacters] = useState(false);
    const [showStories, setShowStories] = useState(false);
    const [lockedHistoryModal, setLockedHistoryModal] = useState<{ historia: HistoriaData, historiaMadre: HistoriaData } | null>(null);
    const [selectedCharacterForModal, setSelectedCharacterForModal] = useState<Personaje | null>(null); const [hotspotModal, setHotspotModal] = useState<HotspotConfig | null>(null);
    const [loadingCharacter, setLoadingCharacter] = useState(false);
    const [discoveredHotspots, setDiscoveredHotspots] = useState<number>(0);
    const totalHotspotsRef = useRef<number>(0);
    const discoveredHotspotIds = useRef<Set<string>>(new Set());
    const [appConfig, setAppConfig] = useState<any>(null); // Configuración para la App (ej. RentalApp)
    const userId = useAuth().user?.id || null;
    const aframeContainerRef = useRef<HTMLDivElement>(null);
    const iframeAppRef = useRef<HTMLIFrameElement>(null);
    // Obtener el usuario autenticado
    const { user, loading: authLoading } = useAuth();
    // Coordenadas por defecto (ej. Zócalo de CDMX), por si no hay historia
    const [mapCenter, setMapCenter] = useState<[number, number]>([19.4326, -99.1332]);

    const fetchPlayerStats = React.useCallback(async () => {
        if (!user) return;
        try {
            const stats = await gameServiceUser.getPlayerStats(user.id);
            setPlayerStats(stats);
            console.log("Estadísticas del jugador cargadas:", stats);
        } catch (error) {
            console.error("Error al refrescar las estadísticas del jugador:", error);
            setPlayerStats({
                id: '',
                user_id: user.id,
                nivel: 1,
                xp_total: 0, // <--- ESTE ES EL IMPORTANTE
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
    }, [user]); // Añade 'user' como dependencia

    // ====================================================================
    // FUNCIÓN REEMPLAZADA: closeHotspotModal
    // ====================================================================
    const closeHotspotModal = React.useCallback(() => {
        setHotspotModal(null);
        setIsHotspotModalOpen(false);
        if (iframeRef.current) {
            iframeRef.current.src = '';  // Reset iframe para prevenir mensajes residuales
        }

        // =========================================================
        // ✅ SOLUCIÓN: Re-activar wasd-controls de A-Frame
        // =========================================================
        const cameraEl = document.querySelector('a-camera');
        // Aseguramos que A-Frame esté cargado y que la cámara exista
        if (cameraEl && (window as any).AFRAME) {
            const wasdControls = (cameraEl as any).components['wasd-controls'];

            if (wasdControls) {
                // wasdControls.play() fuerza al componente a reanudar su lógica de movimiento.
                wasdControls.play();
                console.log('✅ A-Frame: wasd-controls re-activado al cerrar el modal.');
            } else {
                // Plan de respaldo: reanudar el elemento completo
                (cameraEl as any).play();
                console.log('✅ A-Frame: Elemento a-camera re-activado al cerrar el modal.');
            }
        }

        // Reanuda audio...
        console.log('[closeHotspotModal] Modal cerrado y iframe reseteado.');
    }, []); // Se mantiene sin dependencias internas


    // Función de manejo centralizado de recompensas/costos, envuelta en useCallback
    const handleRecompensa = useCallback(async (result: AppResult) => {
        if (!userId) return;

        let costoXP = 0;

        // 1. Detectar si hay costo/ganancia de XP desde la App
        if (result.source === 'RentalApp' && result.costoXP != null) {
            costoXP = result.costoXP;
        }

        console.log(`[Flujo] Procesando XP: ${costoXP} | RecompensaID: ${result.recompensaId}`);

        // --- PARTE A: ACTUALIZAR XP VISUALMENTE ---
        if (costoXP !== 0) {
            // Llamamos al servicio
            const { data: newStats, error: costError } = await gameServiceUser.aplicarXPDirecto(
                userId,
                costoXP,
                "Interacción App"
            );

            if (costError) {
                console.error("🔴 Error actualizando XP:", costError);
            } else if (newStats) {
                // ¡AQUÍ ESTÁ LA CLAVE! 
                // newStats contiene el objeto actualizado que devolvió getPlayerStats
                console.log("✅ Actualizando UI con nuevo XP:", newStats.puntuacion || newStats.xp_total);
                setPlayerStats(newStats); // <--- ESTO ACTUALIZA EL CONTADOR
                // Notify other components (e.g., GameStats) to refresh stats
                window.dispatchEvent(new Event('statsUpdated'));
            }
        }

        // --- PARTE B: OTORGAR ITEM/RECOMPENSA ---
        let recompensaIdToApply: number | null = null;
        if (result.status === 'success' && result?.recompensaId) recompensaIdToApply = result.recompensaId;
        else if (result.status === 'failure' && result?.recompensaId) recompensaIdToApply = result.recompensaId;

        if (recompensaIdToApply && recompensaIdToApply > 0) {
            const { data: finalStats, error: recompensaError } = await gameServiceUser.otorgarRecompensa(
                userId,
                recompensaIdToApply,
                String(historiaId)
            );

            if (!recompensaError && finalStats) {
                // También actualizamos aquí por si ganaste un item
                setPlayerStats(finalStats);
            } else {
                // Respaldo por si acaso
                await fetchPlayerStats();
            }
        }
    }, [userId, historiaId, fetchPlayerStats]);


    // ==================================================================
    // --- ✅ FUNCIÓN MOVIDA Y ENVUELTA EN useCallback ---
    // ==================================================================
    // Función para obtener recurso multimedia por ID
    const getRecurso = useCallback((recursoId: number | null) => {
        if (!recursoId) return null;
        // Usamos recursosData del estado
        return recursosData.find(r => r.id_recurso === recursoId);
    }, [recursosData]); // Depende de recursosData

    // Función para manejar la finalización de una app integrada
    const handleAppCompletion = React.useCallback(async (status: 'success' | 'failure', message: string) => {

        const currentStep = flujoData[currentStepIndex];
        if (!user || !currentStep) return;

        console.log(`[handleAppCompletion] Iniciando con status: ${status}.`);

        // --- INICIO DE LA MODIFICACIÓN ---

        let options: { texto: string, siguiente_paso_id: number, recompensaId?: number }[] | undefined | null = null;
        let recompensaAppId: number | undefined | null = null;

        // 1. Determinar de dónde sacar las opciones
        if (currentStep.tipo_paso === 'app') {
            // Para 'tipo_paso: app', las leemos del RECURSO (metadatos)
            const recursoActual = getRecurso(currentStep.recursomultimedia_id);
            if (recursoActual && recursoActual.metadatos) {
                try {
                    const parsedMetadata = JSON.parse(recursoActual.metadatos);
                    // Leemos la navegación desde la nueva estructura unificada
                    options = parsedMetadata?.flowConfig?.opciones_siguientes_json;
                    console.log("[DEBUG APP] Opciones leídas desde metadatos (tipo_paso: app):", options);
                } catch (e) {
                    console.error("[DEBUG APP] Error al parsear metadatos para flowConfig:", e);
                }
            }
        } else {
            // Para 'contentType: interactive' (hotspot), mantenemos la lógica antigua.
            // Las opciones vienen del flujo_narrativo Y cerramos el modal.
            options = currentStep.opciones_decision?.opciones_siguientes_json;
            console.log("[DEBUG APP] Opciones leídas desde flujo_narrativo (hotspot/pregunta):", options);

            // Cierra el modal SÓLO si es un hotspot
            closeHotspotModal();
            console.log('[handleAppCompletion] Cierre de Hotspot Modal llamado.');
        }

        // 2. Encontrar la opción de decisión correspondiente
        const resultOption = options?.find(op => op.texto === status);

        // --- FIN DE LA MODIFICACIÓN ---

        // LOG CRÍTICO 1:
        console.log(`[DEBUG-APP] 1. Opciones de decisión (BD):`, options);

        if (resultOption) {
            console.log(`[DEBUG 5 - RESULT OPTION] Found option! Next Flow ID: ${resultOption.siguiente_paso_id}`);

            // 3. ¡IMPORTANTE! Aplicar la recompensa definida en la navegación
            // (Esto reemplaza la lógica de 'handleRecompensa' para 'tipo_paso: app')
            if (resultOption.recompensaId && resultOption.recompensaId > 0 && user) {
                console.log(`[DEBUG APP] Otorgando recompensa desde flowConfig: ${resultOption.recompensaId}`);
                await gameServiceUser.otorgarRecompensa(
                    user.id,
                    resultOption.recompensaId,
                    String(historiaId)
                );
                await fetchPlayerStats(); // Refrescar stats
            }

            // 4. Avanzar al siguiente paso narrativo
            setShowStepContent(false);
            const nextIndex = flujoData.findIndex(p => p.id_flujo === resultOption.siguiente_paso_id);

            if (nextIndex !== -1) {
                console.log(`Avanzando al flujo_id: ${resultOption.siguiente_paso_id}`);
                setCurrentStepIndex(nextIndex);
            } else {
                console.log('📚 Mostrando mensaje final.');
                setShowEndMessage(true);
            }

        } else {
            console.error(`[DEBUG 5 - ERROR] NO se encontró una opción de decisión para el estado: ${status}. JSON de Opciones:`, options);
            return;
        }
    }, [
        flujoData,
        currentStepIndex,
        user,
        closeHotspotModal,
        getRecurso, // <-- ¡AÑADE ESTA DEPENDENCIA!
        fetchPlayerStats, // <-- ¡AÑADE ESTA DEPENDENCIA!
        historiaId // <-- ¡AÑADE ESTA DEPENDENCIA!
    ]);

    // NUEVA FUNCIÓN para manejar la apertura del modal del mapa
    const handleOpenMap = () => {
        // 1. Definir coordenadas de fallback
        const DEFAULT_COORDS: [number, number] = [19.4326, -99.1332];

        // 2. Comprobar si hay una historia seleccionada
        if (selectedHistoriaId) {
            // 3. Encontrar la historia actual en el array de historias
            const currentStory = historias.find(h => h.id_historia === selectedHistoriaId);

            // 4. Comprobar si la historia y su ubicación existen
            if (currentStory && currentStory.id_ubicacion && currentStory.id_ubicacion.coordenadas) {

                // 5. Parsear el string de coordenadas "lat,lng" a un array [lat, lng]
                const coordsArray = currentStory.id_ubicacion.coordenadas
                    .split(',')
                    .map(coord => parseFloat(coord.trim()));

                // 6. Validar que las coordenadas sean correctas
                if (coordsArray.length === 2 && !isNaN(coordsArray[0]) && !isNaN(coordsArray[1])) {
                    // Si son válidas, establecerlas como el centro
                    setMapCenter([coordsArray[0], coordsArray[1]]);
                } else {
                    // Si el string es inválido, usar el fallback
                    console.warn(`Coordenadas inválidas para historia ${selectedHistoriaId}: ${currentStory.id_ubicacion.coordenadas}`);
                    setMapCenter(DEFAULT_COORDS);
                }
            } else {
                // Si la historia no tiene ubicación, usar el fallback
                setMapCenter(DEFAULT_COORDS);
            }
        } else {
            // Si no hay historia seleccionada (ej. menú principal), usar el fallback
            setMapCenter(DEFAULT_COORDS);
        }

        // 7. Finalmente, mostrar el modal del mapa
        setShowMap(true);
    };


    // Función para cerrar el modal de la ficha del personaje
    const closeCharacterModal = () => {
        setSelectedCharacterForModal(null);
    };

    // FUNCIÓN ACTUALIZADA para abrir la ficha del personaje con datos REALES
    const handleCharacterClickInBar = async (characterName: string) => {
        // 1. Cierra el modal de la lista
        setShowCharacters(false);

        // 2. Busca la información básica (necesitamos el ID)
        const basicCharacter = personajesData.find(p => p.nombre === characterName);

        if (!basicCharacter) {
            console.error(`Personaje '${characterName}' no encontrado en personajesData.`);
            return;
        }

        setLoadingCharacter(true); // <--- Muestra el loader
        setSelectedCharacterForModal(null); // Limpia el modal anterior

        try {
            // 3. ¡LLAMADA REAL! Llama a la nueva función de supabaseClient
            const fullDetails = await obtenerFichaPersonajePorId(basicCharacter.id_personaje);

            if (fullDetails) {
                // 4. Abre el modal de detalle con la data real
                setSelectedCharacterForModal(fullDetails);
            } else {
                alert(`No se pudo encontrar la ficha para ${characterName}.`);
            }
        } catch (error: any) {
            console.error('Error cargando ficha de personaje:', error);
            alert('Error al cargar la ficha: ' + error.message);
        } finally {
            setLoadingCharacter(false); // <--- Oculta el loader
        }
    };

    // ESTADO para el modal del mapa
    const [showMap, setShowMap] = useState(false);

    // NUEVA FUNCIÓN para manejar el inicio desde el mapa
    // Esta función será llamada por MapaView (a través de HistoriaDetail)
    const handleStartStoryFromMap = (historiaId: number) => {
        console.log("🎬 Padre: Iniciando historia desde mapa con ID:", historiaId);
        // 1. Ocultar el modal del mapa
        setShowMap(false);

        // 2. Iniciar la narrativa con la historia seleccionada
        // Reutilizamos la función que ya tienes
        handleHistoriaSelect(historiaId);
    };

    // Nuevo estado para el pop-up de instrucciones inicial del 3D
    const [showInitial3DPopup, setShowInitial3DPopup] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);

    // Nuevo estado para mostrar/ocultar la barra inferior
    const [showBottomBar, setShowBottomBar] = useState(true);

    // Detectar si es dispositivo móvil
    const [isMobile, setIsMobile] = useState(false);

    // Estado para controlar la altura de la cámara
    const [cameraHeight, setCameraHeight] = useState(-0.8);

    // Estado para música de fondo
    const backgroundAudioRef = useRef<HTMLAudioElement | null>(null);
    const [backgroundMusicVolume, setBackgroundMusicVolume] = useState(0.3);
    const [isHotspotModalOpen, setIsHotspotModalOpen] = useState(false);
    const [backgroundMusicUrl, setBackgroundMusicUrl] = useState<string | null>(null);
    const [showVolumeControl, setShowVolumeControl] = useState(false);
    const [showHeightControl, setShowHeightControl] = useState(false);


    // Manejador de fullscreen
    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().then(() => {
                setIsFullscreen(true);
            }).catch(err => {
                console.error('Error al entrar en fullscreen:', err);
            });
        } else {
            document.exitFullscreen().then(() => {
                setIsFullscreen(false);
            }).catch(err => {
                console.error('Error al salir de fullscreen:', err);
            });
        }
    };


    // Función para manejar la selección de historia desde el mapa o menú
    const handleHistoriaSelect = (historiaId: number) => {

        // 1. Resetear el estado de finalización del juego ✅ AÑADIR/ASEGURAR ESTA LÍNEA
        setShowEndMessage(false);

        // Detener música de fondo al cambiar de historia
        // SIMPLEMENTE actualiza el estado. Los useEffect se encargarán de pausar y limpiar.
        setBackgroundMusicUrl(null);

        setSelectedHistoriaId(historiaId);
        setCurrentStepIndex(0);
        setShowStepContent(false);
        setShowEndMessage(false);

        // ⬇️ --- ¡AÑADE ESTAS 3 LÍNEAS AQUÍ! --- ⬇️
        console.log("🔄 Reseteando contadores de hotspots para la nueva historia...");
        setDiscoveredHotspots(0);
        totalHotspotsRef.current = 0;
        discoveredHotspotIds.current.clear(); // Limpia el Set de IDs


    };

    // Función que maneja la apertura del modal de hotspot
    const handleHotspotClick = async (hotspot: HotspotConfig) => {
        // Log para depuración
        console.log('Hotspot clickeado:', hotspot);
        console.log('ContentType del hotspot:', hotspot.contentType);

        // Asegurar que el contentType existe antes de abrir el modal
        if (!hotspot.contentType) {
            console.error('Error: contentType no definido en el hotspot');
            return;
        }

        if (!discoveredHotspotIds.current.has(hotspot.meshName)) {
            discoveredHotspotIds.current.add(hotspot.meshName);
            setDiscoveredHotspots(prev => prev + 1);

            // Solo otorga la recompensa simple si NO es de tipo 'interactive'
            // Las recompensas 'interactive' se manejan al recibir el mensaje de la app
            if (hotspot.recompensaId && hotspot.contentType !== 'interactive') {

                const recompensa = recompensasData.find(r => r.id_recompensa === hotspot.recompensaId);
                if (recompensa) {
                    const message = `¡Has ganado ${recompensa.valor} XP por '${recompensa.nombre}'!`;
                    setNotification(message);
                    setTimeout(() => setNotification(null), 5000);
                    // La función otorgarRecompensa espera historiaId como STRING
                    await gameServiceUser.otorgarRecompensa(user?.id as string, recompensa.id_recompensa, String(selectedHistoriaId));
                    await fetchPlayerStats();
                }
            }

            if (hotspot.personajeId) {
                const personaje = personajesData.find(p => p.id_personaje === hotspot.personajeId);
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
        }

        // Silenciar música de fondo al abrir hotspot
        if (backgroundAudioRef.current && !backgroundAudioRef.current.paused) {

            console.log("🎵 Tipo de contenido del hotspot 0:", hotspot.contentType);
            /*
            if (hotspot.contentType !== 'interactive')  {
                console.log("🎵 Pausando música de fondo (no es interactive).");
                backgroundAudioRef.current.pause();
             }
                */
        }

        // Mostrar el modal
        setHotspotModal(hotspot);
        setIsHotspotModalOpen(true);

        // Reproducir un sonido de click simulado
        new Audio('https://cdn.aframe.io/360-image-gallery-boilerplate/audio/click.ogg').play().catch(e => console.error("Error al reproducir audio:", e));
    };


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
    }, [historiaId]); // Se ejecuta cuando cambia historiaId


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


            if (event.data && event.data.source === 'Simulador') {
                console.log('[Flujo] Source:', event.data.source);
                console.log('[Flujo] Type:', event.data.type);
                // CIERRA EL MODAL INMEDIATAMENTE (antes de procesar)
                closeHotspotModal();
                console.log('[Flujo] Modal cerrado inmediatamente tras recibir app-result.');
                // Luego procesa
                const result = event.data as AppResult;
                handleRecompensa(result);
                handleAppCompletion(result.status, result.message);
            }

            else if (event.data && event.data.source === 'RentalApp') {
                if (event.data.type === 'app-result') {
                    const result = event.data as AppResult;

                    // Genera un ID único basado en timestamp o contenido (para detectar duplicados)
                    const messageId = `${result.status}-${result.recompensaId}-${result.costoXP}-${Date.now()}`;
                    if (processedMessages.has(messageId)) {
                        console.log('[Flujo] Mensaje duplicado ignorado:', messageId);
                        return;
                    }
                    processedMessages.add(messageId);

                    // CIERRA EL MODAL INMEDIATAMENTE (antes de procesar)
                    closeHotspotModal();
                    console.log('[Flujo] Modal cerrado inmediatamente tras recibir app-result.');

                    // Luego procesa
                    handleRecompensa(result);
                    handleAppCompletion(result.status, result.message);
                } else if (event.data.action === 'close') {
                    // Similar guard si es necesario
                    closeHotspotModal();
                    handleAppCompletion('failure', 'Cierre por usuario');
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
                    failureRecompensaId: hotspotModal.failureRecompensaId
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

    }, [isHotspotModalOpen, hotspotModal, playerStats]); // Mantén las dependencias

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

            if (currentIframe.contentWindow) {
                const payload = {
                    source: 'FlujoNarrativoUsuario',
                    appData: appData, // ¡AQUÍ VAN LOS PARÁMETROS DE appConfig!
                    playerStats: {
                        inventario: playerStats.inventario,
                        puntuacion: playerStats.xp_total
                    },
                    // Estos son 'undefined' porque la recompensa y navegación
                    // se leerán desde 'flowConfig' en handleAppCompletion
                    successRecompensaId: undefined,
                    failureRecompensaId: undefined
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

    }, [currentStepIndex, flujoData, playerStats, recursosData, getRecurso]); // Depende de estos datos

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
                            hotspotData: { type: 'string' }
                        },

                        // --- LÓGICA DE LOS HOTSPOTS (REFACTORIZADA) ---
                        setupHotspots: function () {
                            const obj = this.el.getObject3D('mesh');
                            if (!obj) {
                                console.log('🟠 setupHotspots: Mesh no listo, reintentando en 500ms.');
                                // Reintentar si el mesh no está cargado (puede pasar en un 'update')
                                setTimeout(this.setupHotspots, 500);
                                return;
                            }

                            console.log('🔄 Ejecutando setupHotspots...');
                            const allHotspotConfigs = JSON.parse(this.data.hotspotData);
                            const hotspotConfigs = allHotspotConfigs.filter(h => h.contentType !== 'backgroundMusic');

                            // Recorrer todos los objetos del modelo
                            obj.traverse((child) => {
                                if (child.isMesh) {
                                    // Buscar configuración del hotspot
                                    const config = hotspotConfigs.find(c => c.meshName === child.name);

                                    if (config) {
                                        // APLICAR/RE-APLICAR CONFIGURACIÓN
                                        child.userData.isHotspot = true;
                                        child.userData.hotspotConfig = config;
                                        child.userData.originalMaterial = child.material.clone();
                                        child.userData.isClicked = false; // <-- CRÍTICO: Resetear estado
                                        child.userData.isHovered = false; // <-- CRÍTICO: Resetear estado
                                        console.log('✅ Hotspot configurado en mesh:', child.name);
                                    } else {
                                        // LIMPIAR MESHES QUE YA NO SON HOTSPOTS
                                        if (child.userData.isHotspot) {
                                            child.userData.isHotspot = false;
                                            child.userData.hotspotConfig = null;
                                        }
                                    }
                                }
                            });

                            console.log('✅ Interacción configurada en modelo GLB');
                        },

                        // --- INICIO: Se ejecuta 1 vez al crear ---
                        init: function () {
                            // Bindeamos la función para que 'this' funcione correctamente
                            this.setupHotspots = this.setupHotspots.bind(this);
                            this.el.addEventListener('model-loaded', this.setupHotspots);
                        },

                        // --- UPDATE: Se ejecuta CADA VEZ que la data (hotspotData) cambia ---
                        update: function (oldData) {
                            if (this.data.hotspotData !== oldData.hotspotData) {
                                console.log('🔄 Datos del componente actualizados. Re-configurando hotspots...');
                                // El modelo ya está cargado, solo necesitamos re-escanearlo
                                // Usamos un timeout corto para asegurar que el modelo (obj) esté accesible
                                setTimeout(this.setupHotspots, 100);
                            }
                        },

                        // --- REMOVE: Se ejecuta al destruir ---
                        remove: function () {
                            this.el.removeEventListener('model-loaded', this.setupHotspots);
                        },

                        // --- TICK: (Tu función 'tick' existente va aquí) ---
                        tick: function () {
                            // ... (tu código de 'tick' de la línea 889 va aquí sin cambios) ...
                            // Obtener el cursor y su raycaster
                            const cursor = document.querySelector('a-cursor');
                            if (!cursor) return;

                            const raycaster = (cursor as any).components?.raycaster;
                            if (!raycaster || !raycaster.intersections || raycaster.intersections.length === 0) {
                                // No hay intersecciones, restaurar todos los materiales que no estén clickeados
                                const obj = this.el.getObject3D('mesh');
                                if (obj) {
                                    obj.traverse((child) => {
                                        if (child.isMesh && child.userData.isHotspot && child.userData.isHovered && !child.userData.isClicked) {
                                            child.material = child.userData.originalMaterial;
                                            child.material.needsUpdate = true;
                                            child.userData.isHovered = false;
                                        }
                                    });
                                }
                                return;
                            }

                            const intersection = raycaster.intersections[0];
                            const mesh = intersection.object;

                            // Si el mesh intersectado es un hotspot
                            if (mesh && mesh.userData && mesh.userData.isHotspot) {
                                // Crear material de hover si no existe
                                if (!mesh.userData.hoverMaterial) {
                                    mesh.userData.hoverMaterial = mesh.userData.originalMaterial.clone();
                                    mesh.userData.hoverMaterial.emissive = new (window as any).THREE.Color(0xFFFF00); // Amarillo
                                    mesh.userData.hoverMaterial.emissiveIntensity = 0.9;
                                }

                                // Aplicar material de hover solo si no está clickeado
                                if (!mesh.userData.isClicked && !mesh.userData.isHovered) {
                                    mesh.material = mesh.userData.hoverMaterial;
                                    mesh.material.needsUpdate = true;
                                    mesh.userData.isHovered = true;
                                    console.log('👆 Hover en:', mesh.name);
                                }

                                // Restaurar otros meshes que no sean este y no estén clickeados
                                const obj = this.el.getObject3D('mesh');
                                if (obj) {
                                    obj.traverse((child) => {
                                        if (child.isMesh && child.userData.isHotspot && child !== mesh && child.userData.isHovered && !child.userData.isClicked) {
                                            child.material = child.userData.originalMaterial;
                                            child.material.needsUpdate = true;
                                            child.userData.isHovered = false;
                                        }
                                    });
                                }
                            }
                        }
                    });
                    console.log('✅ Componente gltf-hotspot-interaction registrado');
                }
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
            padding: 1rem;
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
        .bottom-bar {
            position: fixed;
            bottom: 0;
            left: 0;
            width: 100%;
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 1rem;
            background-color: rgba(26, 32, 44, 0.8);
            backdrop-filter: blur(5px);
            box-shadow: 0 -5px 10px rgba(0, 0, 0, 0.3);
            z-index: 60;
            transition: transform 0.3s ease-in-out;
        }
        .bottom-bar.hidden {
            transform: translateY(100%);
        }
        .story-timeline {
            flex-grow: 1;
            display: flex;
            justify-content: center;
            align-items: center;
            position: relative;
            padding: 0 1rem;
        }
        .story-timeline::before {
            content: '';
            position: absolute;
            width: calc(100% - 2rem);
            height: 2px;
            background-color: rgba(255, 255, 255, 0.3);
            z-index: 1;
        }
        .story-step {
            width: 1.5rem;
            height: 1.5rem;
            background-color: #4a5568;
            margin: 0.5rem 0.5rem;
            cursor: default;
            transition: background-color 0.3s, transform 0.2s;
            position: relative;
            z-index: 2;
            border-radius: 4px;
        }
        .story-step.active {
            background-color: #63b3ed;
            transform: scale(1.2);
            box-shadow: 0 0 8px #63b3ed;
        }
        .info-icons {
            display: flex;
            align-items: center;
            gap: 1.5rem;
        }
        .info-display {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            color: #e2e8f0;
            font-size: 1rem;
            white-space: nowrap;
        }
        .tool-icon {
            cursor: pointer;
            transition: color 0.2s;
            font-size: 1.5rem;
            display: flex;
            align-items: center;
            gap: 0.25rem;
        }
        .tool-icon:hover {
            color: #63b3ed;
        }
        .tool-icon span:first-child {
            font-size: 1.5rem;
        }
        .top-left-button {
            position: absolute;
            top: 1rem;
            left: 1rem;
            background-color: rgba(26, 32, 44, 0.8);
            backdrop-filter: blur(5px);
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
        .list-item {
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
            margin-bottom: 1rem;
            background-color: #2d3748;
            padding: 0.75rem;
            border-radius: 0.5rem;
            border-left: 4px solid #63b3ed;
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
                if (stats && stats.historias_visitadas) {
                    let visitedIds: number[] = [];
                    if (Array.isArray(stats.historias_visitadas)) {
                        visitedIds = stats.historias_visitadas.map((id: string) => parseInt(id.trim(), 10));
                    } else if (typeof stats.historias_visitadas === 'string') {
                        visitedIds = stats.historias_visitadas.split(',').map(id => parseInt(id.trim(), 10));
                    }
                    setHistoriasVisitadas(visitedIds);
                } else {
                    setHistoriasVisitadas([]);
                }
            });
        }

    }, [selectedHistoriaId, user, authLoading, fetchPlayerStats]);

    // useEffect para manejar la carga y reproducción de recursos multimedia al cambiar de paso
    useEffect(() => {
        // --- INICIO DE LA SOLUCIÓN ---
        // Si no hay historia seleccionada (estamos en el menú), no procesar ningún paso.
        // Esto previene que el useEffect se dispare con datos antiguos (flujoData) 
        // mientras selectedHistoriaId ya es null, lo que causaba que la música se reiniciara.
        if (!selectedHistoriaId) {
            return;
        }
        // --- FIN DE LA SOLUCIÓN ---

        const currentStep = flujoData[currentStepIndex];
        if (!currentStep) return;

        const recursoActual = getRecurso(currentStep.recursomultimedia_id);
        const isVideo = recursoActual?.tipo === 'video';
        const isAudio = recursoActual?.tipo === 'audio';
        const is3DModel = recursoActual?.tipo === '3d_model';
        const isApp = recursoActual?.tipo === 'app';


        // Oculta el contenido del paso al iniciar la carga o reproducción
        setShowStepContent(false);
        // Asegúrate de resetear el pop-up inicial cada vez que cambias de paso
        setShowInitial3DPopup(false);

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

            setShowInitial3DPopup(true);
            setShowStepContent(false);

            const hotspotConfigs = recursoActual.metadatos ? JSON.parse(recursoActual.metadatos) as HotspotConfig[] : [];
            const interactiveHotspots = hotspotConfigs.filter(h => h.contentType !== 'backgroundMusic');
            totalHotspotsRef.current = interactiveHotspots.length;

            console.log("Hotspot Configs cargadas:", hotspotConfigs);
            console.log("Número total de Hotspots interactivos:", totalHotspotsRef.current);

            setShowStepContent(true);
        }

    }, [currentStepIndex, flujoData, recursosData, selectedHistoriaId]); // <-- AÑADIR selectedHistoriaId

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
    }, [selectedHistoriaId, handleHotspotClick]); // 'handleHotspotClick' es ahora una dependencia

    // Controles de movimiento para móvil con joystick virtual mejorado
    useEffect(() => {
        if (!isMobile || !selectedHistoriaId) return;

        let moveInterval: NodeJS.Timeout | null = null;
        let currentKeys: Set<string> = new Set();

        const simulateKeyPress = (key: string, press: boolean) => {
            const camera = document.querySelector('a-camera');
            if (!camera) return;

            const wasdControls = (camera as any).components['wasd-controls'];
            if (!wasdControls) return;

            if (press) {
                wasdControls.keys[key] = true;
            } else {
                wasdControls.keys[key] = false;
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

        // Esperar a que la escena cargue
        const timeout = setTimeout(() => {
            // Vincular botones
            const btnUp = document.getElementById('mobile-btn-up');
            const btnDown = document.getElementById('mobile-btn-down');
            const btnLeft = document.getElementById('mobile-btn-left');
            const btnRight = document.getElementById('mobile-btn-right');

            const preventDefaults = (e: Event) => {
                e.preventDefault();
                e.stopPropagation();
            };

            if (btnUp) {
                btnUp.addEventListener('touchstart', (e) => { preventDefaults(e); startMoving('KeyW'); }, { passive: false });
                btnUp.addEventListener('touchend', (e) => { preventDefaults(e); stopMoving('KeyW'); }, { passive: false });
                btnUp.addEventListener('touchcancel', (e) => { preventDefaults(e); stopMoving('KeyW'); }, { passive: false });
            }
            if (btnDown) {
                btnDown.addEventListener('touchstart', (e) => { preventDefaults(e); startMoving('KeyS'); }, { passive: false });
                btnDown.addEventListener('touchend', (e) => { preventDefaults(e); stopMoving('KeyS'); }, { passive: false });
                btnDown.addEventListener('touchcancel', (e) => { preventDefaults(e); stopMoving('KeyS'); }, { passive: false });
            }
            if (btnLeft) {
                btnLeft.addEventListener('touchstart', (e) => { preventDefaults(e); startMoving('KeyA'); }, { passive: false });
                btnLeft.addEventListener('touchend', (e) => { preventDefaults(e); stopMoving('KeyA'); }, { passive: false });
                btnLeft.addEventListener('touchcancel', (e) => { preventDefaults(e); stopMoving('KeyA'); }, { passive: false });
            }
            if (btnRight) {
                btnRight.addEventListener('touchstart', (e) => { preventDefaults(e); startMoving('KeyD'); }, { passive: false });
                btnRight.addEventListener('touchend', (e) => { preventDefaults(e); stopMoving('KeyD'); }, { passive: false });
                btnRight.addEventListener('touchcancel', (e) => { preventDefaults(e); stopMoving('KeyD'); }, { passive: false });
            }
        }, 1500);

        return () => {
            clearTimeout(timeout);
            stopAll();
        };
    }, [isMobile, selectedHistoriaId]);


    // ==================================================================
    // --- NUEVA FUNCIÓN PARA VOLVER AL MENÚ (ACTUALIZADA) ---
    // ==================================================================
    const handleReturnToMenu = () => {
        console.log("🎵 Deteniendo música de fondo y volviendo al menú.");

        // 1. Detener la música
        setBackgroundMusicUrl(null);

        // 2. Volver al menú
        setSelectedHistoriaId(null);

        // 3. (SOLUCIÓN) Limpiar los datos de la historia anterior para evitar condiciones de carrera
        setFlujoData([]);
        setCurrentStepIndex(0); // Reset index
        setShowEndMessage(false); // Ensure end message is hidden
    };

    // ==================================================================
    // --- FUNCIÓN handleNextStep (CORREGIDA) ---
    // ==================================================================
    // Función para manejar el avance al siguiente paso
    const handleNextStep = async (nextStepId: number | null) => {
        const currentStep = flujoData[currentStepIndex];

        // 1. Otorgar recompensas/personajes del paso ACTUAL (esto está bien aquí)
        if (currentStep.id_recompensa !== null) {
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

        // --- INICIO DE LA SOLUCIÓN ---
        // 2. Comprobar PRIMERO si el paso actual es 'final'.
        // Esta lógica debe ejecutarse ANTES del guard "nextStepId === null".
        if (currentStep.tipo_paso === 'final' && selectedHistoriaId !== null && user) {
            console.log('=== DEBUG: PASO FINAL (Lógica Corregida) ===');
            console.log('Tipo de paso:', currentStep.tipo_paso);
            console.log('Historia actual ID:', selectedHistoriaId);
            console.log('Paso completo:', JSON.stringify(currentStep, null, 2));

            // *** ¡AQUÍ ES DONDE SE GUARDA LA HISTORIA! ***
            const { error } = await gameServiceUser.completeStory(user.id, String(selectedHistoriaId));
            if (!error) {
                console.log(`✅ Historia ${selectedHistoriaId} completada para el usuario ${user.id}`);
            } else {
                console.error('❌ Error completando historia:', error);
            }

            // 'nextStepId' (que es 'currentStep.id_siguiente_paso')
            // aquí se interpreta como el ID de la *siguiente historia*.
            if (nextStepId) {
                const siguienteHistoriaId = nextStepId;
                console.log(`📖 Cambiando a la siguiente historia con ID: ${siguienteHistoriaId}`);

                // Buscar el primer paso de la siguiente historia
                const { data: siguienteFlujo, error: flujoError } = await gameServiceUser.fetchNarrativeFlowByHistoriaId(siguienteHistoriaId);
                if (flujoError) {
                    console.error('❌ Error cargando flujo de la siguiente historia:', flujoError);
                } else if (siguienteFlujo && siguienteFlujo.length > 0) {
                    console.log('✅ Primer paso de la siguiente historia encontrado:', siguienteFlujo[0]);
                    console.log('Total de pasos en la siguiente historia:', siguienteFlujo.length);
                } else {
                    console.warn('⚠️ No se encontraron pasos para la historia:', siguienteHistoriaId);
                }

                setSelectedHistoriaId(siguienteHistoriaId);
                setCurrentStepIndex(0);
                setShowStepContent(false);
                setShowEndMessage(false); // Asegurarse de que no se muestre el mensaje final
                console.log('=========================');
                return; // Salir de la función
            } else {
                // No hay siguiente historia, mostrar mensaje final
                console.log('📚 No hay siguiente historia. Volviendo al menú.');
                console.log('=========================');
                handleReturnToMenu(); // <--- SOLUCIÓN: Volver al menú
                return; // Salir de la función
            }
        }
        // --- FIN DE LA SOLUCIÓN ---


        // 3. Comprobación de guardia (Guard check)
        // Si no es un paso 'final', ahora sí podemos comprobar si el siguiente paso es nulo.
        if (!user || nextStepId === null) {
            console.log('📚 No hay siguiente paso o usuario inválido. Mostrando mensaje final.');
            setShowEndMessage(true);
            return;
        }


        // 4. Lógica para tipo_paso 'app'
        if (currentStep.tipo_paso === 'app' && selectedHistoriaId !== null && user) {
            console.log('=== DEBUG: PASO APP ===');
            console.log('Historia ID:', selectedHistoriaId, '(tipo:', typeof selectedHistoriaId, ')');

            console.log('=======================');

            // Volver al menú de historias
            setSelectedHistoriaId(null);
            setCurrentStepIndex(0);
            return;
        }

        // 5. Lógica de avance normal (para pasos 'narrativo' y 'pregunta')
        setShowStepContent(false);
        const nextIndex = flujoData.findIndex(p => p.id_flujo === nextStepId);
        if (nextIndex !== -1) {
            setCurrentStepIndex(nextIndex);
        }
        // Si no se encuentra el siguiente paso, mostrar mensaje de fin
        else {
            console.log('📚 Siguiente paso no encontrado. Mostrando mensaje final.');
            setShowEndMessage(true);
        }
    };
    // ==================================================================
    // --- FIN DE LA FUNCIÓN handleNextStep (CORREGIDA) ---
    // ==================================================================


    // Función para retroceder al paso anterior
    const goBack = () => {
        if (currentStepIndex > 0) {
            setShowStepContent(false);
            setCurrentStepIndex(currentStepIndex - 1);
        }
    };

    // Función para avanzar al siguiente paso
    const goNext = () => {
        if (currentStepIndex < flujoData.length - 1) {
            setShowStepContent(false);
            setCurrentStepIndex(currentStepIndex + 1);
        }
    };

    // Función para renderizar el contenido del paso actual
    const renderStepContent = () => {
        const step = flujoData[currentStepIndex];

        // Si no hay paso, no renderizar nada
        if (!step) return null;

        // --- Lógica para Pasos de Aplicación (App) ---
        else if (step.tipo_paso === 'app') {
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

        const contentText = step.contenido || "";
        const isDecisionStep = step.tipo_paso === 'pregunta' || (step.opciones_decision?.opciones_siguientes_json && step.opciones_decision.opciones_siguientes_json.length > 0);

        // Obtener información del recurso
        const recursoActual = getRecurso(step.recursomultimedia_id);
        const isVideoOrAudio = recursoActual?.tipo === 'video' || recursoActual?.tipo === 'audio';
        const is3DModel = recursoActual?.tipo === '3d_model';

        // --- Lógica para Pasos de Decisión ---
        if (isDecisionStep) {
            return (
                <div className="decision-container">
                    <div className="text-center">
                        <h2 className="text-3xl md:text-5xl font-bold mb-4">¡Toma una decisión!</h2>
                        <p className="text-lg mb-8">{contentText}</p>
                    </div>
                    <div className="decision-options">
                        {step.opciones_decision?.opciones_siguientes_json?.map((opcion, index) => (
                            <button
                                key={index}
                                className="decision-button"
                                onClick={() => handleNextStep(opcion.siguiente_paso_id)}
                            >
                                {opcion.texto}
                            </button>
                        ))}
                    </div>
                </div>
            );
        }

        // --- Lógica para Pasos Narrativos ---
        else if (step.tipo_paso === 'narrativo') {

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
                        absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-30
                        w-[90%] max-w-[650px] bg-white bg-opacity-95 backdrop-blur-sm text-gray-800 shadow-2xl
                        visible opacity-100 p-10 rounded-xl
                    `}>
                        <p className="text-lg font-semibold mb-4">¡Explora el entorno!</p>
                        <p className="text-base leading-relaxed mb-6">
                            Para continuar tu aventura, debes descubrir todos los **puntos de interés** marcados en el modelo 3D.
                        </p>

                        <button
                            className="bg-blue-600 text-white py-3 px-5 rounded-lg font-semibold text-md cursor-pointer
                            transition-all duration-300 hover:bg-blue-700"
                            onClick={() => setShowInitial3DPopup(false)} // <--- CIERRA EL POP-UP INICIAL
                        >
                            Entendido, ¡a explorar!
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
            let buttonText = "Siguiente →";

            if (is3DModel) {
                buttonText = "Continuar Aventura →";
            }

            return (
                <div className={`
                    absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-30
                    w-[90%] max-w-[650px] bg-white bg-opacity-85 backdrop-blur-md text-gray-800 shadow-2xl
                    visible opacity-100 p-10 rounded-xl
                `}>
                    <p className="text-base leading-relaxed mb-6">{contentText}</p>

                    {/* El botón de siguiente solo se muestra si el paso tiene un ID de siguiente paso (siempre debería ser el caso aquí) */}
                    {step.id_siguiente_paso && (
                        <button
                            className="bg-blue-600 text-white py-4 px-6 rounded-lg font-semibold text-lg cursor-pointer
                            transition-all duration-300 ease-in-out hover:bg-blue-700 hover:scale-105"
                            onClick={() => handleNextStep(step.id_siguiente_paso as number)}
                        >
                            {buttonText}
                        </button>
                    )}
                </div>
            );
        }

        // --- Lógica para Pasos Finales ---
        else if (step.tipo_paso === 'final') {
            const isChapterEnd = step.id_siguiente_paso !== null;
            return (
                <div className={`
                    absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-30
                    p-10 rounded-xl max-w-lg w-[90%]
                    bg-white bg-opacity-85 backdrop-blur-md text-gray-800 shadow-2xl
                    ${showStepContent ? 'visible opacity-100' : 'opacity-0 pointer-events-none'}
                `}>
                    <h2 className="text-2xl font-bold mb-4 text-center">
                        {isChapterEnd ? "Fin del Capítulo" : "Fin de la aventura"}
                    </h2>
                    <p className="text-base leading-relaxed mb-6 text-center">{contentText}</p>
                    <div className="flex justify-center">
                        <button
                            className="bg-green-600 text-white py-4 px-6 rounded-lg font-semibold text-lg cursor-pointer
                            transition-all duration-300 ease-in-out hover:bg-green-700 hover:scale-105"
                            onClick={() => handleNextStep(step.id_siguiente_paso as number)}
                        >
                            {isChapterEnd ? "Siguiente Capítulo →" : "Finalizar y Volver"}
                        </button>
                    </div>
                </div>
            );
        }

        return null;
    };

    // Renderizado principal
    if (!selectedHistoriaId) {
        if (loading) {
            return (
                <div className="flex items-center justify-center min-h-screen bg-black text-white">
                    <p>Cargando historias disponibles...</p>
                </div>
            );
        }

        if (error) {
            return (
                <div className="flex items-center justify-center min-h-screen bg-black text-red-500">
                    <p>{error}</p>
                </div>
            );
        }

        if (historias.length === 0) {
            return (
                <div className="flex items-center justify-center min-h-screen bg-black text-white">
                    <p>No hay historias disponibles en este momento.</p>
                </div>
            );
        }

        // Determinar qué historias están desbloqueadas
        const historiasConEstado = historias.map(historia => {
            let isLocked = false;

            // Si tiene dependencia, verificar si la historia madre fue visitada
            if (historia.id_historia_dependencia) {
                isLocked = !historiasVisitadas.includes(historia.id_historia_dependencia);
            }

            return {
                ...historia,
                isLocked
            };
        });

        // LOG DE DEPURACIÓN
        console.log("=== DEBUG BLOQUEO DE HISTORIAS ===");
        console.log("Historias visitadas por el usuario:", historiasVisitadas);
        console.log("Estado de cada historia:");
        historiasConEstado.forEach(h => {
            console.log(`  - Historia ID ${h.id_historia}: "${h.titulo}"`);
            console.log(`    Depende de: ${h.id_historia_dependencia || 'Ninguna'}`);
            console.log(`    Estado: ${h.isLocked ? '🔒 BLOQUEADA' : '✅ DESBLOQUEADA'}`);
        });
        console.log("===================================");

        return (
            <div className="relative min-h-screen bg-gradient-to-b from-gray-900 via-black to-gray-900 text-white p-4 md:p-8 overflow-y-auto">

                <div className="max-w-7xl mx-auto ">
                    <h1 className="text-5xl font-bold text-center mb-3 bg-gradient-to-r from-purple-400 to-pink-600 bg-clip-text text-transparent">Selecciona tu Aventura</h1>
                    <p className="text-center text-gray-400 mb-3">Explora mundos increíbles y desbloquea nuevas historias</p>

                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {historiasConEstado.map(historia => {
                            const imagenFondo = historia.id_imagen_historia
                                ? recursosData.find(r => r.id_recurso === historia.id_imagen_historia)?.archivo
                                : null;

                            const handleHistoriaClick = () => {
                                if (historia.isLocked) {
                                    // Mostrar modal con opción de ir a historia madre
                                    const historiaMadre = historias.find(h => h.id_historia === historia.id_historia_dependencia);
                                    if (historiaMadre) {
                                        setLockedHistoryModal({ historia, historiaMadre });
                                    }
                                } else {
                                    handleHistoriaSelect(historia.id_historia);
                                }
                            };

                            return (
                                <div
                                    key={historia.id_historia}
                                    className={`relative rounded-xl overflow-hidden transition-all duration-500 transform ${historia.isLocked
                                        ? 'opacity-70 cursor-pointer grayscale hover:opacity-90'
                                        : 'cursor-pointer hover:scale-105 hover:shadow-2xl hover:shadow-purple-500/50'
                                        }`}
                                    onClick={handleHistoriaClick}
                                    style={{ minHeight: '400px' }}
                                >
                                    {/* Imagen de fondo */}
                                    {imagenFondo ? (
                                        <img
                                            src={imagenFondo}
                                            alt={historia.titulo}
                                            className="absolute inset-0 w-full h-full object-cover"
                                        />
                                    ) : (
                                        <div className="absolute inset-0 bg-gradient-to-br from-purple-900 to-blue-900"></div>
                                    )}

                                    {/* Overlay oscuro */}
                                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/70 to-transparent"></div>

                                    {/* Indicador de visitada */}
                                    {historiasVisitadas.includes(historia.id_historia) && (
                                        <div className="absolute top-4 right-4 bg-purple-600 text-white px-3 py-1 rounded-full text-xs font-bold z-10">
                                            ✓ Completada
                                        </div>
                                    )}

                                    {/* Indicador de bloqueada */}
                                    {historia.isLocked && (
                                        <div className="absolute top-4 left-4 bg-red-600 text-white p-3 rounded-full z-10">
                                            🔒
                                        </div>
                                    )}

                                    {/* Contenido */}
                                    <div className="absolute bottom-0 left-0 right-0 p-6 z-10">
                                        <h2 className="text-3xl font-bold mb-2 text-white drop-shadow-lg">{historia.titulo}</h2>
                                        <p className="text-sm text-gray-300 mb-2 line-clamp-2">{historia.descripcion}</p>
                                        {historia.narrativa && (
                                            <p className="text-xs text-gray-400 italic line-clamp-3 mt-2">{historia.narrativa}</p>
                                        )}

                                        {historia.isLocked && historia.id_historia_dependencia && (
                                            <div className="mt-3 bg-red-900/50 backdrop-blur-sm px-3 py-2 rounded-lg text-xs">
                                                🔒 Desbloquea completando: {historias.find(h => h.id_historia === historia.id_historia_dependencia)?.titulo}
                                            </div>
                                        )}

                                        {!historia.isLocked && (
                                            <button className="mt-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white py-2 px-6 rounded-lg font-semibold transition-all duration-300 transform hover:scale-105">
                                                Jugar Ahora →
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        );
    }

    // --- LÓGICA DE RENDERIZADO CORREGIDA ---

    // 1. Si estamos cargando datos, mostrar un loader.
    // Esto previene la condición de carrera (race condition).
    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-black text-white">
                <p>Cargando datos de la historia...</p>
            </div>
        );
    }

    // 2. Si se nos dijo explícitamente que mostremos el mensaje final, hacerlo.
    if (showEndMessage) {
        return (
            <div className="relative min-h-screen bg-black text-white p-8 flex flex-col items-center justify-center text-center">
                <div className="bg-white bg-opacity-10 backdrop-blur-md p-10 rounded-xl max-w-lg w-[90%]">
                    <h2 className="text-3xl font-bold mb-4">Fin de la aventura</h2>
                    <p className="text-lg leading-relaxed mb-6">
                        ¡Has completado esta historia! Gracias por jugar.
                    </p>
                    <button
                        className="bg-green-600 text-white py-4 px-6 rounded-lg font-semibold text-lg cursor-pointer
                        transition-all duration-300 ease-in-out hover:bg-green-700 hover:scale-105"
                        onClick={handleReturnToMenu} // <--- SOLUCIÓN: Volver al menú
                    >
                        Finalizar y Volver
                    </button>
                </div>
            </div>
        );
    }

    // 3. Obtener el paso actual.
    const currentStep = flujoData[currentStepIndex];

    // 4. Si NO estamos cargando, y NO es el fin, pero AÚN ASÍ no hay un paso
    //    (ej. flujoData vino vacío de la DB), ahora sí mostramos el fin.
    if (!currentStep) {
        console.error("Error: No se encontró un paso actual (currentStep), pero 'loading' es false. Mostrando fin.");
        return (
            <div className="relative min-h-screen bg-black text-white p-8 flex flex-col items-center justify-center text-center">
                <div className="bg-white bg-opacity-10 backdrop-blur-md p-10 rounded-xl max-w-lg w-[90%]">
                    <h2 className="text-3xl font-bold mb-4">Error de la Historia</h2>
                    <p className="text-lg leading-relaxed mb-6">
                        No se pudo cargar el flujo narrativo. (currentStep es nulo).
                    </p>
                    <button
                        className="bg-red-600 text-white py-4 px-6 rounded-lg font-semibold text-lg cursor-pointer"
                        onClick={onBack}
                    >
                        Volver
                    </button>
                </div>
            </div>
        );
    }

    // --- FIN DE LA LÓGICA CORREGIDA ---

    // Obtener recurso multimedia del paso actual
    const recursoActual = getRecurso(currentStep.recursomultimedia_id);
    const mediaSrc = recursoActual?.archivo || '';
    // Determinar si el paso es de decisión
    const isDecisionStep = currentStep.tipo_paso === 'pregunta' || (currentStep.opciones_decision?.opciones_siguientes_json && currentStep.opciones_decision.opciones_siguientes_json.length > 0);
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
                        onEnded={() => currentStep.id_siguiente_paso && handleNextStep(currentStep.id_siguiente_paso)}
                    />
                )}

                {/* CAMBIO CLAVE para avance automático */}
                {recursoActual?.tipo === 'video' && (
                    <video
                        ref={videoRef}
                        key={mediaSrc}
                        src={mediaSrc}
                        autoPlay
                        onEnded={() => currentStep.id_siguiente_paso && handleNextStep(currentStep.id_siguiente_paso)}
                    />
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
                                        gltf-hotspot-interaction={`hotspotMeshes: ${meshNames.join(', ')}; hotspotData: ${JSON.stringify(hotspotConfigs)}`}
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

            {playerStats && (
                <div id="bottomBar" className={`bottom-bar ${!showBottomBar ? 'hidden' : ''}`} style={{ fontSize: '0.8rem' }}>
                    {/* Botón para ocultar barra en esquina inferior izquierda */}
                    <button
                        className="bg-gray-800 bg-opacity-80 text-white px-2 py-1 rounded-lg shadow-lg hover:bg-gray-700 transition text-sm"
                        onClick={() => setShowBottomBar(false)}
                        title="Ocultar barra"
                    >
                        ✕
                    </button>

                    <div className="info-display">
                        <span className="text-xl">💪</span>
                        <span id="resistanceValue" style={{ fontSize: '0.8rem' }}>{playerStats.xp_total || 0}</span>
                    </div>

                    <div id="storyTimeline" className="story-timeline">
                        {flujoData.map((step, index) => (
                            <div
                                key={step.id_flujo}
                                className={`story-step ${index === currentStepIndex ? 'active' : ''}`}
                            ></div>
                        ))}
                    </div>

                    <div className="info-icons">
                        <div className="tool-icon" onClick={handleOpenMap}>
                            <span style={{ fontSize: '1.2rem' }}>🗺️</span>
                            <span id="mapCount" style={{ fontSize: '0.75rem' }}></span>
                        </div>
                        <div className="tool-icon" onClick={() => setShowInventory(true)}>
                            <span style={{ fontSize: '1.2rem' }}>📦</span>
                            <span id="inventoryCount" style={{ fontSize: '0.75rem' }}>{playerStats.inventario?.length || 0}</span>
                        </div>
                        <div className="tool-icon" onClick={() => setShowCharacters(true)}>
                            <span style={{ fontSize: '1.2rem' }}>👥</span>
                            <span id="characterCount" style={{ fontSize: '0.75rem' }}>{playerStats.personajes_conocidos?.length || 0}</span>
                        </div>
                        <div className="tool-icon" onClick={() => setShowStories(true)}>
                            <span style={{ fontSize: '1.2rem' }}>📚</span>
                            <span id="storyCount" style={{ fontSize: '0.75rem' }}>{playerStats.historias_visitadas?.length || 0}</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Botón flotante para mostrar barra cuando está oculta */}
            {!showBottomBar && (
                <button
                    className="absolute bottom-4 left-4 z-50 bg-gray-800 bg-opacity-80 text-white p-3 rounded-full shadow-lg hover:bg-gray-700 transition"
                    onClick={() => setShowBottomBar(true)}
                    title="Mostrar barra"
                >
                    📊
                </button>
            )}

            {is3DModel && (
                <div className="absolute top-4 right-4 z-50 flex flex-col gap-2">
                    {/* Contador de hotspots */}
                    <div className="bg-gray-800 bg-opacity-80 text-white py-1 px-3 rounded-lg text-sm">
                        Descubiertos: {discoveredHotspots} / {totalHotspotsRef.current}
                    </div>

                    {/* Control de volumen de música de fondo - MÁS COMPACTO */}
                    {backgroundMusicUrl && (
                        <div className="bg-gray-800 bg-opacity-90 text-white rounded-lg">
                            <button
                                onClick={() => setShowVolumeControl(!showVolumeControl)}
                                className="text-lg hover:text-yellow-400 transition px-2 py-1 w-full"
                                title="Control de volumen"
                            >
                                🔊
                            </button>
                            {showVolumeControl && (
                                <div className="flex flex-col items-center gap-1 p-2 pt-0">
                                    <input
                                        type="range"
                                        min="0"
                                        max="1"
                                        step="0.1"
                                        value={backgroundMusicVolume}
                                        onChange={(e) => setBackgroundMusicVolume(parseFloat(e.target.value))}
                                        className="w-20"
                                    />
                                    <span className="text-xs">{Math.round(backgroundMusicVolume * 100)}%</span>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Control de altura de cámara - MÁS COMPACTO */}
                    <div className="bg-gray-800 bg-opacity-90 text-white rounded-lg">
                        <button
                            onClick={() => setShowHeightControl(!showHeightControl)}
                            className="text-lg hover:text-blue-400 transition px-2 py-1 w-full"
                            title="Altura de cámara"
                        >
                            📷
                        </button>
                        {showHeightControl && (
                            <div className="flex flex-col items-center gap-1 p-2 pt-0">
                                <input
                                    type="range"
                                    min="-3"
                                    max="2"
                                    step="0.1"
                                    value={cameraHeight}
                                    onChange={(e) => setCameraHeight(parseFloat(e.target.value))}
                                    className="w-20"
                                />
                                <span className="text-xs">{cameraHeight.toFixed(1)}m</span>
                            </div>
                        )}
                    </div>
                </div>
            )}



            {is3DModel && !showStepContent && (
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 text-white text-2xl">
                    Cargando modelo 3D...
                </div>
            )}

            {/* Botón de Fullscreen en esquina superior izquierda */}
            <button
                className="absolute top-4 left-4 z-50 bg-gray-800 bg-opacity-80 text-white p-3 rounded-lg shadow-lg hover:bg-gray-700 transition flex items-center gap-2"
                onClick={toggleFullscreen}
                title={isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
            >
                {isFullscreen ? '⊡' : '⛶'}
            </button>

            {/* Joystick Virtual para Móvil */}
            {isMobile && is3DModel && (
                <div className="absolute bottom-20 left-4 z-50" style={{ width: '120px', height: '120px' }}>
                    <div className="relative w-full h-full">
                        {/* Botón Arriba (W) */}
                        <button
                            id="mobile-btn-up"
                            className="absolute top-0 left-1/2 transform -translate-x-1/2 bg-gray-800 bg-opacity-80 text-white w-10 h-10 rounded-lg shadow-lg active:bg-gray-600 flex items-center justify-center font-bold"
                            style={{ touchAction: 'none' }}
                        >
                            ▲
                        </button>
                        {/* Botón Izquierda (A) */}
                        <button
                            id="mobile-btn-left"
                            className="absolute top-1/2 left-0 transform -translate-y-1/2 bg-gray-800 bg-opacity-80 text-white w-10 h-10 rounded-lg shadow-lg active:bg-gray-600 flex items-center justify-center font-bold"
                            style={{ touchAction: 'none' }}
                        >
                            ◀
                        </button>
                        {/* Botón Derecha (D) */}
                        <button
                            id="mobile-btn-right"
                            className="absolute top-1/2 right-0 transform -translate-y-1/2 bg-gray-800 bg-opacity-80 text-white w-10 h-10 rounded-lg shadow-lg active:bg-gray-600 flex items-center justify-center font-bold"
                            style={{ touchAction: 'none' }}
                        >
                            ▶
                        </button>
                        {/* Botón Abajo (S) */}
                        <button
                            id="mobile-btn-down"
                            className="absolute bottom-0 left-1/2 transform -translate-x-1/2 bg-gray-800 bg-opacity-80 text-white w-10 h-10 rounded-lg shadow-lg active:bg-gray-600 flex items-center justify-center font-bold"
                            style={{ touchAction: 'none' }}
                        >
                            ▼
                        </button>
                    </div>
                </div>
            )}

            {/* Modal de Hotspot - Fullscreen con botón X */}
            <div id="hotspotModal" className="fixed inset-0 bg-black" style={{ display: hotspotModal ? 'flex' : 'none', zIndex: 999999 }}>
                <button
                    className="absolute top-6 right-6 z-[1000000] bg-red-600 hover:bg-red-700 text-white w-12 h-12 rounded-full flex items-center justify-center text-2xl font-bold shadow-2xl transition-all duration-300"
                    onClick={closeHotspotModal}
                    title="Cerrar"
                >
                    ×
                </button>

                <div className="w-full h-full flex flex-col items-center justify-center p-4">
                    <h3 className="text-3xl font-bold mb-6 text-white text-center">{hotspotModal?.title}</h3>
                    <div className="w-full h-full max-h-[85vh] flex justify-center items-center">
                        {hotspotModal?.contentType === 'imagen' && (
                            <img src={hotspotModal.url} alt={hotspotModal.title} className="max-h-full max-w-full object-contain" />
                        )}
                        {hotspotModal?.contentType === 'video' && (
                            <video
                                src={hotspotModal.url}
                                controls
                                autoPlay
                                loop
                                className="max-h-full max-w-full"
                                onCanPlay={(e) => handleMediaAutoplay(e.currentTarget)}
                            />
                        )}
                        {hotspotModal?.contentType === 'audio' && (
                            <div className="bg-gray-800 p-8 rounded-xl">
                                <audio
                                    src={hotspotModal.url}
                                    controls
                                    autoPlay
                                    className="w-full min-w-[400px]"
                                    onCanPlay={(e) => handleMediaAutoplay(e.currentTarget)}
                                />
                            </div>
                        )}
                        {hotspotModal?.contentType === 'interactive' && (
                            <iframe
                                ref={iframeRef}
                                id="interactive-iframe" // ¡CRUCIAL! Añadir el ID para poder seleccionarlo en el useEffect
                                src={hotspotModal.url}
                                title={hotspotModal.title}
                                className="w-full h-full"
                                style={{ border: 'none' }}
                                allowFullScreen
                            ></iframe>
                        )}
                    </div>
                </div>
            </div>
            {/* Modal del mapa*/}
            {showMap && (
                <div
                    className="modal"
                    style={{
                        display: 'flex',
                        zIndex: 101, // Aseguramos que esté sobre otros modales si es necesario
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}
                >
                    <div
                        className="modal-content"
                        style={{
                            width: '95vw',
                            height: '90vh',
                            maxWidth: '1200px',
                            padding: '0', // MapaView manejará su propio padding
                            overflow: 'hidden', // Evita que el mapa se desborde
                            position: 'relative'
                        }}
                    >
                        {/* Botón de cerrar el modal del mapa */}
                        <span
                            className="close-button"
                            onClick={() => setShowMap(false)}
                            style={{ zIndex: 1000, color: '#fff', background: 'rgba(0,0,0,0.5)', borderRadius: '50%', padding: '0 0.5rem' }}
                        >
                            &times;
                        </span>

                        <MapaView
                            // Pasamos las historias que ya cargamos en este componente
                            historias={historias}
                            // Pasamos las historias visitadas para los colores de pines
                            historiasVisitadas={historiasVisitadas}
                            // Pasamos la nueva función de "arranque"
                            onStartNarrativeFromMap={handleStartStoryFromMap}
                            // Pasamos la función para cerrar (que es la misma)
                            onBack={() => setShowMap(false)}
                            // Centro inicial del mapa
                            initialCenter={mapCenter}
                            recursos={recursosData} // <--- ¡AÑADE ESTA LÍNEA!
                        />
                    </div>
                </div>
            )}

            <div id="inventoryModal" className="modal" style={{ display: showInventory ? 'flex' : 'none' }}>
                <div className="modal-content">
                    <span className="close-button" onClick={() => setShowInventory(false)}>&times;</span>
                    <h3 className="text-2xl font-bold mb-4">Inventario</h3>
                    <div id="inventoryItems" className="max-h-80 overflow-y-auto">
                        {playerStats?.inventario && playerStats.inventario.length > 0 ? (
                            playerStats.inventario.map((item, index) => (
                                <div key={index} className="list-item">
                                    <p className="font-bold">{item.nombre}</p>
                                    <p className="text-sm text-gray-400">{item.descripcion}</p>
                                </div>
                            ))
                        ) : (
                            <p className="text-center text-gray-400">Tu inventario está vacío.</p>
                        )}
                    </div>
                </div>
            </div>

            {showCharacters && (
                <div className="modal" style={{ display: 'flex' }}>
                    <div className="modal-content">
                        <span className="close-button" onClick={() => setShowCharacters(false)}>&times;</span>
                        <h2>👤 Personajes Conocidos</h2>
                        <p className="mb-4 text-sm text-gray-400">
                            Haz clic en el nombre para ver la ficha completa.
                        </p>
                        <div className="list-container max-h-96 overflow-y-auto pr-2">
                            {(playerStats?.personajes_conocidos || []).map((name: string, index: number) => (
                                // ¡AQUÍ ESTÁ EL CAMBIO CLAVE!
                                <div
                                    key={index}
                                    className="list-item hover:bg-gray-700 cursor-pointer transition-all"
                                    onClick={() => handleCharacterClickInBar(name)} // <--- Llama a la nueva función
                                >
                                    <p className="font-semibold">{name}</p>
                                </div>
                            ))}
                        </div>
                        {/* ... otros elementos del modal ... */}
                    </div>
                </div>
            )}
            <div id="storiesModal" className="modal" style={{ display: showStories ? 'flex' : 'none' }}>
                <div className="modal-content">
                    <span className="close-button" onClick={() => setShowStories(false)}>&times;</span>
                    <h3 className="text-2xl font-bold mb-4">Historias Visitadas</h3>
                    <div id="storyItems" className="max-h-80 overflow-y-auto">
                        {/* Botón para volver al menú de historias */}
                        <button
                            className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white py-3 px-4 rounded-lg font-semibold mb-4 transition-all duration-300 flex items-center justify-center gap-2"
                            onClick={() => {
                                setShowStories(false);
                                handleReturnToMenu(); // <--- SOLUCIÓN: Volver al menú
                            }}
                        >
                            ← Volver al Menú de Historias
                        </button>

                        {playerStats?.historias_visitadas && historias.length > 0 ? (
                            playerStats.historias_visitadas.map((storyId, index) => {
                                const story = historias.find(h => h.id_historia === parseInt(storyId));
                                return story ? (
                                    <div key={index} className="list-item">
                                        <p className="font-bold">{story.titulo}</p>
                                        <p className="text-sm text-gray-400">{story.descripcion}</p>
                                    </div>
                                ) : null;
                            })
                        ) : (
                            <p className="text-center text-gray-400">Aún no has visitado historias.</p>
                        )}
                    </div>
                </div>
            </div>

            {notification && (
                <div className="absolute top-8 left-1/2 transform -translate-x-1/2 z-50 bg-green-500 text-white py-3 px-6 rounded-full shadow-lg transition-all duration-500 ease-in-out animate-fade-in-down">
                    {notification}
                </div>
            )}

            {/* Modal de la FICHA del Personaje (Ficha del PersonajeView) */}
            {selectedCharacterForModal && (
                <div className="modal" style={{ display: 'flex' }}>
                    <div className="modal-content max-w-lg">
                        <span className="close-button" onClick={closeCharacterModal}>&times;</span>
                        <h2 className="text-2xl font-bold mb-4 border-b pb-2 text-blue-400">
                            Ficha de {selectedCharacterForModal.nombre}
                        </h2>

                        <div className="flex flex-col gap-4">
                            {/* Imagen del personaje (si está disponible) */}
                            {selectedCharacterForModal.imagen && (
                                <div className="text-center">
                                    <img
                                        src={selectedCharacterForModal.imagen}
                                        alt={`Imagen de ${selectedCharacterForModal.nombre}`}
                                        className="w-32 h-32 object-cover rounded-full mx-auto border-4 border-blue-400"
                                    />
                                </div>
                            )}

                            {/* Descripción */}
                            <div className="info-section">
                                <h4 className="font-semibold text-lg text-gray-300">📝 Descripción</h4>
                                <p className="text-sm">{selectedCharacterForModal.descripcion}</p>
                            </div>

                            {/* Metadatos/Atributos */}
                            {selectedCharacterForModal.metadata && (
                                <div className="info-section mt-2">
                                    <h4 className="font-semibold text-lg text-gray-300">📋 Atributos</h4>
                                    <div className="grid grid-cols-2 gap-2 text-sm">
                                        {Object.entries(selectedCharacterForModal.metadata).map(([key, value]) => (
                                            <div key={key} className="p-2 bg-gray-700 rounded-md">
                                                <span className="font-medium text-blue-300">{key}:</span>{' '}
                                                <span className="text-white">{String(value)}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="modal-actions mt-6">
                            <button
                                onClick={closeCharacterModal}
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg font-semibold transition-all duration-300"
                            >
                                Cerrar Ficha
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Historia Bloqueada */}
            {lockedHistoryModal && (
                <div className="fixed inset-0 bg-black bg-opacity-80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-gray-900 rounded-xl p-8 max-w-md w-full shadow-2xl border-2 border-red-600">
                        <div className="text-center">
                            <div className="text-6xl mb-4">🔒</div>
                            <h3 className="text-2xl font-bold mb-4 text-white">Historia Bloqueada</h3>
                            <p className="text-gray-300 mb-6">
                                Para desbloquear <span className="font-bold text-purple-400">"{lockedHistoryModal.historia.titulo}"</span>,
                                primero debes completar la historia:
                            </p>
                            <div className="bg-purple-900 bg-opacity-50 p-4 rounded-lg mb-6">
                                <p className="font-bold text-xl text-purple-300">
                                    {lockedHistoryModal.historiaMadre.titulo}
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
                                    Ir a Historia Requerida →
                                </button>
                                <button
                                    className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-3 px-4 rounded-lg font-semibold transition-all duration-300"
                                    onClick={() => setLockedHistoryModal(null)}
                                >
                                    Cancelar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FlujoNarrativoUsuario;