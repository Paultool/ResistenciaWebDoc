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
      .bottom-bar {
            position: fixed;
            bottom: 0;
            left: 0;
            width: 100%;
            
            /* Estilo Terminal Hacker */
            background: rgba(10, 10, 10, 0.95);
            border-top: 1px solid #333;
            padding: 10px 20px;
            
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 1.5rem;
            z-index: 60;
            
            box-shadow: 0 -10px 20px rgba(0, 0, 0, 0.8);
            font-family: 'Courier New', monospace;
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
              // buscamos el personaje en el arreglo de personajes cargados
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
                <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black p-6 font-mono selection:bg-[#33ff00] selection:text-black">
                    
                    {/* 1. Fondo Scanlines (Para continuidad atmosférica) */}
                    <div className="absolute inset-0 pointer-events-none opacity-20" 
                        style={{ backgroundImage: 'linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.06))', backgroundSize: '100% 2px, 3px 100%' }}>
                    </div>

                    {/* 2. Contenedor Principal (La Terminal de Decisión) */}
                    <div className="relative w-full max-w-5xl bg-black/90 border-2 border-[#33ff00] p-8 md:p-12 shadow-[0_0_100px_rgba(51,255,0,0.15)]">
                        
                        {/* Decoración de Esquinas (Brackets) */}
                        <div className="absolute -top-2 -left-2 w-8 h-8 border-t-4 border-l-4 border-[#33ff00]"></div>
                        <div className="absolute -top-2 -right-2 w-8 h-8 border-t-4 border-r-4 border-[#33ff00]"></div>
                        <div className="absolute -bottom-2 -left-2 w-8 h-8 border-b-4 border-l-4 border-[#33ff00]"></div>
                        <div className="absolute -bottom-2 -right-2 w-8 h-8 border-b-4 border-r-4 border-[#33ff00]"></div>

                        {/* Encabezado de Alerta */}
                        <div className="text-center mb-10">
                            <div className="inline-block border-b border-[#33ff00] pb-2 mb-6">
                                <h2 className="text-3xl md:text-5xl font-bold text-[#33ff00] tracking-tighter uppercase animate-pulse">
                                    {'>'} INTERVENCIÓN REQUERIDA
                                </h2>
                            </div>
                            
                            {/* Texto de la Pregunta / Contexto */}
                            <p className="text-lg md:text-2xl text-white leading-relaxed max-w-3xl mx-auto border-l-4 border-[#33ff00]/50 pl-6 text-left">
                                {contentText}
                            </p>
                        </div>

                        {/* 3. Opciones de Decisión (Grid de Comandos) */}
                        <div className="grid gap-6 md:grid-cols-1 max-w-3xl mx-auto">
                            {step.opciones_decision?.opciones_siguientes_json?.map((opcion, index) => (
                                <button
                                    key={index}
                                    className="group relative w-full py-6 px-8 border border-[#33ff00] bg-black text-left transition-all duration-200 
                                    hover:bg-[#33ff00] hover:text-black hover:shadow-[0_0_30px_rgba(51,255,0,0.6)] hover:-translate-y-1"
                                    onClick={() => handleNextStep(opcion.siguiente_paso_id)}
                                >
                                    {/* Efecto de 'Llenado' al hover (opcional, o usar bg directo) */}
                                    <div className="flex items-center justify-between">
                                        <span className="text-xl md:text-2xl font-bold tracking-wide uppercase">
                                            <span className="mr-4 opacity-50 group-hover:opacity-100 font-mono">
                                                0{index + 1}.
                                            </span>
                                            {opcion.texto}
                                        </span>
                                        
                                        {/* Flecha reactiva */}
                                        <span className="text-2xl font-bold opacity-0 group-hover:opacity-100 transform -translate-x-4 group-hover:translate-x-0 transition-all duration-300">
                                            {'<<'} EJECUTAR
                                        </span>
                                    </div>
                                </button>
                            ))}
                        </div>

                        {/* Footer Técnico */}
                        <div className="mt-12 text-center">
                            <p className="text-[#33ff00]/40 text-xs uppercase tracking-[0.3em] animate-pulse">
                                ESPERANDO INPUT DEL USUARIO...
                            </p>
                        </div>

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
                        absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50
                        w-[90%] max-w-[600px] 
                        bg-black/95 backdrop-blur-md 
                        border border-[#33ff00] shadow-[0_0_30px_rgba(51,255,0,0.15)]
                        text-[#a8a8a8] p-8 font-mono
                    `}>
                        {/* Encabezado estilo Terminal */}
                        <div className="border-b border-[#33ff00]/30 pb-4 mb-6 flex justify-between items-center">
                            <h2 className="text-[#33ff00] text-xl tracking-widest uppercase font-bold">
                                {'>'} PROTOCOLO DE NAVEGACIÓN
                            </h2>
                            <span className="text-xs animate-pulse text-[#33ff00]">[ ONLINE ]</span>
                        </div>

                        {/* Cuerpo de Texto */}
                        <p className="text-base leading-relaxed mb-8">
                            Para avanzar en la simulación, debes localizar y descifrar todos los <strong className="text-white bg-[#33ff00]/20 px-1">NODOS DE INTERÉS</strong> ocultos en la estructura.
                        </p>

                        {/* Diagrama de Controles (Visualización de Teclas) */}
                        <div className="flex flex-col sm:flex-row justify-center items-center gap-8 mb-8 bg-white/5 p-4 rounded border border-white/10">

                            {/* Teclas WASD */}
                            <div className="flex flex-col items-center">
                                <div className="w-10 h-10 border border-[#33ff00] flex items-center justify-center text-[#33ff00] font-bold mb-1 rounded-sm">W</div>
                                <div className="flex gap-1">
                                    <div className="w-10 h-10 border border-[#33ff00] flex items-center justify-center text-[#33ff00] font-bold rounded-sm">A</div>
                                    <div className="w-10 h-10 border border-[#33ff00] flex items-center justify-center text-[#33ff00] font-bold rounded-sm">S</div>
                                    <div className="w-10 h-10 border border-[#33ff00] flex items-center justify-center text-[#33ff00] font-bold rounded-sm">D</div>
                                </div>
                                <span className="text-xs mt-2 uppercase tracking-wider">Movimiento</span>
                            </div>

                            <div className="h-10 w-[1px] bg-[#33ff00]/30 hidden sm:block"></div>

                            {/* Mouse */}
                            <div className="flex flex-col items-center">
                                <div className="relative w-12 h-16 border border-[#33ff00] rounded-full flex justify-center pt-3">
                                    <div className="w-1 h-3 bg-[#33ff00] rounded-full animate-bounce"></div>
                                </div>
                                <span className="text-xs mt-3 uppercase tracking-wider">Mirar / Clic</span>
                            </div>
                        </div>

                        {/* Botón de Acción */}
                        <button
                            className="w-full group relative py-3 px-5 border border-[#33ff00] text-[#33ff00] font-bold tracking-widest uppercase
                            transition-all duration-300 hover:bg-[#33ff00] hover:text-black hover:shadow-[0_0_20px_rgba(51,255,0,0.4)]"
                            onClick={() => setShowInitial3DPopup(false)}
                        >
                            <span className="absolute inset-0 w-full h-full bg-[#33ff00]/10 transform scale-x-0 group-hover:scale-x-100 transition-transform origin-left duration-300"></span>
                            <span className="relative">[ INICIAR RECONOCIMIENTO ]</span>
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
            // Render del pop-up
            return (
                <div className={`
                    absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-30
                    w-[90%] max-w-[650px] 
                    bg-black/95 backdrop-blur-md 
                    border border-[#33ff00] shadow-[0_0_40px_rgba(51,255,0,0.15)]
                    p-8 md:p-12 font-mono
                `}>
                    {/* Decoración de Encabezado (Header Táctico) */}
                    <div className="flex justify-between items-center mb-8 border-b border-[#33ff00]/30 pb-2">
                        <span className="text-[#33ff00] text-xs tracking-[0.2em] uppercase animate-pulse">
                            {'>'} NARRATIVA_ENTRANTE
                        </span>
                        <div className="flex gap-1">
                            <div className="w-2 h-2 bg-[#33ff00]"></div>
                            <div className="w-2 h-2 bg-[#33ff00]/50"></div>
                            <div className="w-2 h-2 bg-[#33ff00]/20"></div>
                        </div>
                    </div>

                    {/* Cuerpo del Texto */}
                    <p className="text-lg md:text-xl leading-relaxed mb-10 text-gray-200 border-l-2 border-[#33ff00] pl-6">
                        {contentText}
                    </p>

                    {/* Botón Siguiente */}
                    {step.id_siguiente_paso && (
                        <button
                            className="w-full group relative py-4 px-6 border border-[#33ff00] text-[#33ff00] font-bold text-lg tracking-widest uppercase
                            transition-all duration-300 hover:bg-[#33ff00] hover:text-black hover:shadow-[0_0_20px_rgba(51,255,0,0.4)]"
                            onClick={() => handleNextStep(step.id_siguiente_paso as number)}
                        >
                            <span className="relative z-10 flex items-center justify-center gap-3">
                                {buttonText} <span className="group-hover:translate-x-2 transition-transform">{'>>'}</span>
                            </span>
                        </button>
                    )}
                    
                    {/* Decoración de esquina inferior */}
                    <div className="absolute bottom-2 right-2 text-[9px] text-[#33ff00]/30">
                        END_OF_PACKET
                    </div>
                </div>
            );
        }

        // --- Lógica para Pasos Finales ---
        else if (step.tipo_paso === 'final') {
            const isChapterEnd = step.id_siguiente_paso !== null;
            return (
                <div className={`
                    absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-30
                    w-[90%] max-w-lg 
                    bg-black/95 backdrop-blur-md border border-[#33ff00] shadow-[0_0_50px_rgba(51,255,0,0.2)]
                    p-10 font-mono text-center
                    transition-all duration-500 ease-in-out
                    ${showStepContent ? 'visible opacity-100 scale-100' : 'opacity-0 pointer-events-none scale-95'}
                `}>
                    {/* Decoración Superior */}
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#33ff00] to-transparent opacity-50"></div>

                    {/* Encabezado de Estado */}
                    <div className="mb-8 border-b border-[#33ff00]/30 pb-4">
                        <div className="text-4xl mb-2">
                            {isChapterEnd ? '💾' : '🏁'}
                        </div>
                        <h2 className="text-[#33ff00] text-2xl font-bold tracking-widest uppercase animate-pulse">
                            {isChapterEnd ? "> SECUENCIA_COMPLETADA" : "> CONEXIÓN_FINALIZADA"}
                        </h2>
                        <p className="text-[10px] text-[#33ff00]/50 mt-1 tracking-[0.2em]">
                            DATOS GUARDADOS CORRECTAMENTE
                        </p>
                    </div>

                    {/* Cuerpo del Texto */}
                    <p className="text-lg text-gray-300 leading-relaxed mb-10">
                        {contentText}
                    </p>

                    {/* Botón de Acción Táctico */}
                    <div className="flex justify-center">
                        <button
                            className="group relative w-full py-4 px-6 border border-[#33ff00] text-[#33ff00] font-bold text-lg tracking-widest uppercase
                            transition-all duration-300 hover:bg-[#33ff00] hover:text-black hover:shadow-[0_0_20px_rgba(51,255,0,0.5)]"
                            onClick={() => handleNextStep(step.id_siguiente_paso as number)}
                        >
                            <span className="flex items-center justify-center gap-3 relative z-10">
                                {isChapterEnd ? "[ INICIAR SIGUIENTE FASE ]" : "[ TERMINAR SIMULACIÓN ]"}
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

    // Renderizado principal
    if (!selectedHistoriaId) {
        if (loading) {
            return (
                <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center font-mono text-[#33ff00]">

                    {/* Fondo Scanlines */}
                    <div className="absolute inset-0 pointer-events-none opacity-20"
                        style={{ backgroundImage: 'linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.06))', backgroundSize: '100% 2px, 3px 100%' }}>
                    </div>

                    {/* Loader Visual (Anillos Giratorios) */}
                    <div className="relative w-24 h-24 mb-8">
                        {/* Anillo Exterior */}
                        <div className="absolute inset-0 border-t-2 border-[#33ff00] rounded-full animate-spin shadow-[0_0_15px_#33ff00]"></div>

                        {/* Anillo Interior (Gira al revés y más lento - simulación visual) */}
                        <div className="absolute inset-4 border-b-2 border-[#33ff00]/50 rounded-full animate-pulse"></div>

                        {/* Icono Central */}
                        <div className="absolute inset-0 flex items-center justify-center text-3xl animate-bounce">
                            📂
                        </div>
                    </div>

                    {/* Texto de Estado */}
                    <div className="text-center space-y-2 relative z-10">
                        <h2 className="text-xl font-bold tracking-[0.3em] uppercase">
                            RECUPERANDO_HISTORIAS
                        </h2>

                        <div className="flex justify-center gap-1 text-xs opacity-70">
                            <span>CONECTANDO BASE DE DATOS</span>
                            <span className="animate-[ping_1.5s_infinite]">.</span>
                            <span className="animate-[ping_1.5s_infinite_0.2s]">.</span>
                            <span className="animate-[ping_1.5s_infinite_0.4s]">.</span>
                        </div>
                    </div>

                    {/* Footer Decorativo */}
                    <div className="absolute bottom-10 text-[10px] text-[#33ff00]/30 tracking-widest">
                        SYSTEM_ID: RESISTENCIA_CORE_v2.5
                    </div>

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
                <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center font-mono select-none">
    
                    {/* Fondo Scanlines */}
                    <div className="absolute inset-0 pointer-events-none opacity-20" 
                        style={{ backgroundImage: 'linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.06))', backgroundSize: '100% 2px, 3px 100%' }}>
                    </div>

                    {/* Contenedor Central */}
                    <div className="relative p-12 border border-dashed border-[#33ff00]/30 bg-black/50 backdrop-blur-sm text-center max-w-md">
                        
                        {/* Icono de Señal Perdida */}
                        <div className="text-6xl mb-6 opacity-50 animate-pulse filter grayscale hover:grayscale-0 transition-all duration-500">
                            📡
                        </div>

                        {/* Título Técnico */}
                        <h2 className="text-[#33ff00] text-2xl font-bold tracking-[0.2em] uppercase mb-4">
                            NO_SIGNAL_DETECTED
                        </h2>

                        {/* Mensaje Humano (Estilizado) */}
                        <p className="text-[#a8a8a8] text-sm leading-relaxed mb-8">
                            No se han encontrado historias disponibles en este sector de la memoria.
                        </p>

                        {/* Decoración de Estado */}
                        <div className="flex flex-col items-center gap-2">
                            <div className="w-24 h-1 bg-[#33ff00]/20 overflow-hidden">
                                <div className="h-full w-1/2 bg-[#33ff00] animate-[ping_2s_linear_infinite]"></div>
                            </div>
                            <span className="text-[10px] text-[#33ff00]/40 uppercase tracking-widest">
                                ESPERANDO TRANSMISIÓN...
                            </span>
                        </div>

                        {/* Esquinas Decorativas */}
                        <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-[#33ff00]"></div>
                        <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-[#33ff00]"></div>
                        <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-[#33ff00]"></div>
                        <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-[#33ff00]"></div>

                    </div>
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

        //MENU PRINCIPAL DE HISTORIAS
        return (
    <div className="relative min-h-screen bg-black text-[#a8a8a8] p-4 md:p-8 overflow-y-auto font-mono selection:bg-[#33ff00] selection:text-black">

        {/* Fondo Scanlines */}
        <div className="absolute inset-0 pointer-events-none z-0 opacity-20 fixed"
            style={{ backgroundImage: 'linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.06))', backgroundSize: '100% 2px, 3px 100%' }}>
        </div>

        <div className="relative z-10 max-w-7xl mx-auto">

            {/* --- ENCABEZADO --- */}
            <div className="border-b border-[#33ff00]/30 pb-6 mb-10 flex flex-col md:flex-row justify-between items-end gap-4">
                <div>
                    <h1 className="text-4xl md:text-6xl font-bold text-white tracking-tighter mb-2 uppercase glitch-text">
                        SELECTOR_DE_MISIONES
                    </h1>
                    <p className="text-[#33ff00] text-xs md:text-sm tracking-widest uppercase">
                        {'>'} ACCESO A MEMORIA COLECTIVA. SELECCIONE NODO.
                    </p>
                </div>
                <div className="text-right text-[10px] text-[#33ff00]/50 font-mono border-l border-[#33ff00]/30 pl-4">
                    STATUS: ONLINE<br />
                    SECURE_CONN: TRUE
                </div>
            </div>

            {/* --- GRID DE TARJETAS --- */}
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 pb-12">
                {historiasConEstado.map((historia, index) => {
                    const imagenFondo = historia.id_imagen_historia
                        ? recursosData.find(r => r.id_recurso === historia.id_imagen_historia)?.archivo
                        : null;

                    const isCompleted = historiasVisitadas.includes(historia.id_historia);

                    const handleHistoriaClick = () => {
                        if (historia.isLocked) {
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
                            className={`
                                group relative border-2 bg-black overflow-hidden flex flex-col
                                transition-all duration-300
                                ${historia.isLocked
                                    ? 'border-red-900/50 opacity-70 cursor-not-allowed grayscale'
                                    : 'border-[#33ff00]/30 hover:border-[#33ff00] cursor-pointer hover:shadow-[0_0_25px_rgba(51,255,0,0.15)] hover:-translate-y-1'
                                }
                            `}
                            onClick={handleHistoriaClick}
                            style={{ height: '520px' }} // Altura fija alta
                        >
                            {/* 1. IMAGEN (Ocupa la mitad superior) */}
                            <div className="h-[55%] relative overflow-hidden">
                                {imagenFondo ? (
                                    <img
                                        src={imagenFondo}
                                        alt={historia.titulo}
                                        className={`w-full h-full object-cover transition-transform duration-700 
                                            ${historia.isLocked ? 'blur-sm' : 'group-hover:scale-110 group-hover:contrast-110'}
                                        `}
                                    />
                                ) : (
                                    <div className="w-full h-full bg-[#111] flex items-center justify-center">
                                        <span className="text-[#33ff00]/20 font-bold">NO_IMG</span>
                                    </div>
                                )}
                                {/* Overlay scanlines sobre imagen */}
                                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20"></div>
                                
                                {/* Badges Flotantes sobre la imagen */}
                                <div className="absolute top-3 left-3 right-3 flex justify-between z-10">
                                    <span className="bg-black/80 border border-[#33ff00]/50 text-[#33ff00] text-[9px] px-1.5 py-0.5 font-bold backdrop-blur-sm">
                                        0{index + 1}
                                    </span>
                                    {isCompleted && (
                                        <span className="bg-[#33ff00] text-black text-[9px] px-1.5 py-0.5 font-bold animate-pulse">
                                            COMPLETADO
                                        </span>
                                    )}
                                    {historia.isLocked && (
                                        <span className="bg-red-600 text-white text-[9px] px-1.5 py-0.5 font-bold flex items-center gap-1">
                                            🔒 BLOQUEADO
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* 2. PANEL DE DATOS (Siempre visible abajo) */}
                            <div className="h-[45%] bg-black border-t border-[#33ff00]/30 p-5 flex flex-col relative z-20">
                                
                                {/* Título */}
                                <h2 className={`text-2xl font-bold mb-2 uppercase tracking-tighter leading-none ${historia.isLocked ? 'text-red-500' : 'text-white group-hover:text-[#33ff00]'}`}>
                                    {historia.titulo}
                                </h2>

                                {/* Línea separadora */}
                                <div className="w-full h-[1px] bg-[#33ff00]/20 mb-3"></div>

                                {/* Descripción (Siempre visible) */}
                                <p className="text-xs text-gray-300 font-sans leading-relaxed line-clamp-3 mb-4 flex-grow">
                                    {historia.descripcion}
                                </p>

                                {/* Mensaje de Error si está bloqueado */}
                                {historia.isLocked && historia.id_historia_dependencia && (
                                    <div className="mb-3 text-[9px] text-red-400 font-mono border border-red-900/50 p-1 bg-red-900/10">
                                        REQ: {historias.find(h => h.id_historia === historia.id_historia_dependencia)?.titulo}
                                    </div>
                                )}

                                {/* BOTONERA (Siempre visible si no está bloqueado) */}
                                {!historia.isLocked && (
                                    <div className="mt-auto flex gap-2">
                                        <button className="flex-1 bg-[#33ff00]/10 border border-[#33ff00] text-[#33ff00] py-2 px-3 text-[10px] font-bold uppercase tracking-widest hover:bg-[#33ff00] hover:text-black transition-all flex justify-between items-center group/btn">
                                            <span>EJECUTAR</span>
                                            <span className="group-hover/btn:translate-x-1 transition-transform">{'>>'}</span>
                                        </button>
                                        
                                        <button 
                                            className="w-10 border border-[#33ff00]/50 text-[#33ff00] hover:bg-[#33ff00] hover:text-black flex items-center justify-center transition-colors"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                console.log("Like");
                                            }}
                                        >
                                            ♥
                                        </button>
                                    </div>
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
            <div className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center font-mono">

                {/* Estilos de animación inline para no depender de config externa */}
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

                {/* Contenedor Central */}
                <div className="relative w-[90%] max-w-md p-8 border-x border-[#33ff00]/30 bg-black/50 backdrop-blur-sm text-center">

                    {/* Decoración Superior e Inferior */}
                    <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-[#33ff00] to-transparent"></div>
                    <div className="absolute bottom-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-[#33ff00] to-transparent"></div>

                    {/* Texto Principal */}
                    <h2 className="text-[#33ff00] text-xl font-bold tracking-[0.2em] mb-2 animate-pulse">
                        {'>'} ACCEDIENDO_MEMORIA
                    </h2>

                    <p className="text-[#33ff00]/60 text-xs uppercase tracking-widest mb-8">
                        Desencriptando fragmentos narrativos...
                    </p>

                    {/* Barra de Carga Hacker */}
                    <div className="relative w-full h-1 bg-[#33ff00]/20 overflow-hidden mb-2">
                        <div className="absolute top-0 left-0 w-full h-full bg-[#33ff00] animate-scan shadow-[0_0_10px_#33ff00]"></div>
                    </div>

                    {/* Datos ficticios de carga */}
                    <div className="flex justify-between text-[10px] text-[#33ff00]/40 font-mono mt-2">
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
                        className="w-full group relative py-4 px-6 border border-[#33ff00] text-[#33ff00] font-bold text-lg tracking-widest uppercase
                        transition-all duration-300 hover:bg-[#33ff00] hover:text-black hover:shadow-[0_0_30px_rgba(51,255,0,0.4)]"
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
    const currentStep = flujoData[currentStepIndex];

    // 4. Si NO estamos cargando, y NO es el fin, pero AÚN ASÍ no hay un paso
    //    (ej. flujoData vino vacío de la DB), ahora sí mostramos el fin.
    if (!currentStep) {
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
                                SYSTEM FAILURE
                            </h2>
                            <p className="text-xs text-red-500 opacity-70">ERR_CODE: NARRATIVE_VOID</p>
                        </div>
                    </div>

                    {/* Cuerpo del mensaje (Estilo Consola) */}
                    <div className="bg-red-900/10 p-4 mb-8 border-l-2 border-red-600 font-mono text-sm leading-relaxed">
                        <p className="mb-2">{'>'} INITIATING DIAGNOSTIC...</p>
                        <p className="mb-2 text-white">ERROR: No se pudo cargar el flujo narrativo.</p>
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
                            <span>{'<<'}</span> ABORTAR Y REINICIAR
                        </span>
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
            {/* Fin del div principal */}

           {playerStats && (
                <div
                    id="bottomBar"
                    className={`
                        fixed bottom-6 left-1/2 transform -translate-x-1/2 z-40
                        transition-all duration-500 ease-in-out
                        ${!showBottomBar ? 'translate-y-[200%] opacity-0' : 'translate-y-0 opacity-100'}
                    `}
                >
                    {/* Contenedor Principal del HUD */}
                    <div className="bg-black/90 backdrop-blur-md border border-[#33ff00] shadow-[0_0_20px_rgba(51,255,0,0.2)] flex items-stretch rounded-sm overflow-hidden">

                        {/* Botón Cerrar (Estilo Terminal) */}
                        <button
                            className="bg-[#33ff00]/10 hover:bg-[#33ff00] text-[#33ff00] hover:text-black px-3 py-2 transition-colors border-r border-[#33ff00]/30 flex items-center justify-center font-mono font-bold"
                            onClick={() => setShowBottomBar(false)}
                            title="Minimizar HUD"
                        >
                            ✕
                        </button>

                        {/* Módulo XP (Estadística Principal) */}
                        <div className="flex items-center gap-3 px-5 py-2 border-r border-[#33ff00]/30 min-w-[100px] justify-center">
                            <span className="text-xl filter grayscale contrast-125">⚡</span>
                            <div className="flex flex-col leading-none">
                                <span className="text-[10px] text-[#33ff00] font-mono tracking-widest uppercase opacity-70">XP_TOTAL</span>
                                <span className="text-white font-mono text-lg font-bold tabular-nums">
                                    {playerStats.xp_total || 0}
                                </span>
                            </div>
                        </div>

                        {/* Iconos de Herramientas (Grid Interactiva) */}
                        <div className="flex">

                            {/* Mapa */}
                            <div
                                className="group flex flex-col items-center justify-center px-5 py-2 cursor-pointer hover:bg-[#33ff00]/10 transition-all border-r border-[#33ff00]/20 min-w-[70px]"
                                onClick={handleOpenMap}
                                title="Acceder a Geolocalización"
                            >
                                <span className="text-lg mb-1 group-hover:scale-110 transition-transform filter grayscale group-hover:grayscale-0">🗺️</span>
                                <span className="text-[9px] text-[#33ff00] font-mono tracking-wider group-hover:text-white">MAPA</span>
                            </div>

                            {/* Inventario */}
                            <div
                                className="group flex flex-col items-center justify-center px-5 py-2 cursor-pointer hover:bg-[#33ff00]/10 transition-all border-r border-[#33ff00]/20 min-w-[70px]"
                                onClick={() => setShowInventory(true)}
                                title="Ver Inventario"
                            >
                                <div className="relative">
                                    <span className="text-lg mb-1 block group-hover:scale-110 transition-transform filter grayscale group-hover:grayscale-0">📦</span>
                                    {(playerStats.inventario?.length || 0) > 0 && (
                                        <span className="absolute -top-1 -right-2 bg-[#33ff00] text-black text-[9px] font-bold px-1 rounded-sm">
                                            {playerStats.inventario?.length}
                                        </span>
                                    )}
                                </div>
                                <span className="text-[9px] text-[#33ff00] font-mono tracking-wider group-hover:text-white">INV</span>
                            </div>

                            {/* Personajes */}
                            <div
                                className="group flex flex-col items-center justify-center px-5 py-2 cursor-pointer hover:bg-[#33ff00]/10 transition-all border-r border-[#33ff00]/20 min-w-[70px]"
                                onClick={() => setShowCharacters(true)}
                                title="Personajes Conocidos"
                            >
                                <div className="relative">
                                    <span className="text-lg mb-1 block group-hover:scale-110 transition-transform filter grayscale group-hover:grayscale-0">👥</span>
                                    <span className="absolute -top-1 -right-2 bg-[#33ff00] text-black text-[9px] font-bold px-1 rounded-sm">
                                        {playerStats.personajes_conocidos?.length || 0}
                                    </span>
                                </div>
                                <span className="text-[9px] text-[#33ff00] font-mono tracking-wider group-hover:text-white">CREW</span>
                            </div>

                            {/* Historias (Nota: Agregué border-r aquí para separar del Fullscreen) */}
                            <div
                                className="group flex flex-col items-center justify-center px-5 py-2 cursor-pointer hover:bg-[#33ff00]/10 transition-all border-r border-[#33ff00]/20 min-w-[70px]"
                                onClick={() => setShowStories(true)}
                                title="Historias Desbloqueadas"
                            >
                                <div className="relative">
                                    <span className="text-lg mb-1 block group-hover:scale-110 transition-transform filter grayscale group-hover:grayscale-0">📚</span>
                                    <span className="absolute -top-1 -right-2 bg-[#33ff00] text-black text-[9px] font-bold px-1 rounded-sm">
                                        {playerStats.historias_visitadas?.length || 0}
                                    </span>
                                </div>
                                <span className="text-[9px] text-[#33ff00] font-mono tracking-wider group-hover:text-white">LOGS</span>
                            </div>

                            {/* NUEVO: Botón Fullscreen Integrado */}
                            <div
                                className="group flex flex-col items-center justify-center px-5 py-2 cursor-pointer hover:bg-[#33ff00]/10 transition-all min-w-[70px]"
                                onClick={toggleFullscreen}
                                title={isFullscreen ? 'Salir de Pantalla Completa' : 'Pantalla Completa'}
                            >
                                <span className="text-lg mb-1 group-hover:scale-110 transition-transform filter grayscale group-hover:grayscale-0 text-white">
                                    {isFullscreen ? '⇲' : '⛶'}
                                </span>
                                <span className="text-[9px] text-[#33ff00] font-mono tracking-wider group-hover:text-white">
                                    {isFullscreen ? 'EXIT' : 'VIEW'}
                                </span>
                            </div>

                        </div>

                        {/* Decoración Final (Línea de estado) */}
                        <div className="w-1 bg-[#33ff00] animate-pulse"></div>
                    </div>
                </div>
            )}

            {/* Botón flotante para mostrar barra (Estilo Icono de Sistema) */}
            {!showBottomBar && (
                <button
                    className="fixed bottom-6 left-6 z-50 
                    bg-black/90 text-[#33ff00] border border-[#33ff00] 
                    w-12 h-12 flex items-center justify-center
                    shadow-[0_0_15px_rgba(51,255,0,0.3)]
                    hover:bg-[#33ff00] hover:text-black hover:shadow-[0_0_25px_rgba(51,255,0,0.6)]
                    transition-all duration-300 group"
                    onClick={() => setShowBottomBar(true)}
                    title="Restaurar HUD"
                >
                    <span className="text-xl group-hover:rotate-90 transition-transform duration-300">⚙️</span>
                </button>
            )}

            {is3DModel && (
                <div className="absolute top-4 right-4 z-50 flex flex-col gap-3 font-mono select-none">

                    {/* 1. Contador de Hotspots (Estilo Display LCD) */}
                    <div className="bg-black/90 border border-[#33ff00]/50 backdrop-blur-sm py-2 px-4 rounded-sm shadow-[0_0_15px_rgba(51,255,0,0.1)] flex flex-col items-end">
                        <span className="text-[9px] text-[#33ff00] tracking-widest uppercase mb-1 opacity-70">NODOS ACTIVOS</span>
                        <div className="flex items-baseline gap-1">
                            <span className="text-white text-lg font-bold leading-none">{discoveredHotspots}</span>
                            <span className="text-[#33ff00] text-sm">/</span>
                            <span className="text-[#33ff00] text-sm leading-none">{totalHotspotsRef.current}</span>
                        </div>
                    </div>

                    {/* 2. Control de Volumen (Botón cuadrado + Menú lateral) */}
                    {backgroundMusicUrl && (
                        <div className="relative group">
                            <button
                                onClick={() => setShowVolumeControl(!showVolumeControl)}
                                className={`
                                    w-10 h-10 flex items-center justify-center rounded-sm border transition-all duration-300
                                    ${showVolumeControl
                                        ? 'bg-[#33ff00] text-black border-[#33ff00] shadow-[0_0_10px_rgba(51,255,0,0.5)]'
                                        : 'bg-black/80 text-[#33ff00] border-[#33ff00]/30 hover:border-[#33ff00] hover:bg-[#33ff00]/10'
                                    }
                                `}
                                title="Sistema de Audio"
                            >
                                🔊
                            </button>

                            {/* Panel Flotante a la Izquierda */}
                            {showVolumeControl && (
                                <div className="absolute top-0 right-12 bg-black/95 border border-[#33ff00] p-3 rounded-sm shadow-2xl flex items-center gap-3 min-w-[150px] animate-in fade-in slide-in-from-right-2 duration-200">
                                    <span className="text-[10px] text-[#33ff00] font-bold w-6">VOL</span>
                                    <input
                                        type="range"
                                        min="0"
                                        max="1"
                                        step="0.1"
                                        value={backgroundMusicVolume}
                                        onChange={(e) => setBackgroundMusicVolume(parseFloat(e.target.value))}
                                        className="w-full h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-[#33ff00]"
                                    />
                                    <span className="text-[10px] text-white w-8 text-right">{Math.round(backgroundMusicVolume * 100)}%</span>
                                </div>
                            )}
                        </div>
                    )}

                    {/* 3. Control de Cámara (Botón cuadrado + Menú lateral) */}
                    <div className="relative group">
                        <button
                            onClick={() => setShowHeightControl(!showHeightControl)}
                            className={`
                                w-10 h-10 flex items-center justify-center rounded-sm border transition-all duration-300
                                ${showHeightControl
                                    ? 'bg-[#33ff00] text-black border-[#33ff00] shadow-[0_0_10px_rgba(51,255,0,0.5)]'
                                    : 'bg-black/80 text-[#33ff00] border-[#33ff00]/30 hover:border-[#33ff00] hover:bg-[#33ff00]/10'
                                }
                            `}
                            title="Calibración de Cámara"
                        >
                            📷
                        </button>

                        {/* Panel Flotante a la Izquierda */}
                        {showHeightControl && (
                            <div className="absolute top-0 right-12 bg-black/95 border border-[#33ff00] p-3 rounded-sm shadow-2xl flex items-center gap-3 min-w-[150px] animate-in fade-in slide-in-from-right-2 duration-200">
                                <span className="text-[10px] text-[#33ff00] font-bold w-6">ALT</span>
                                <input
                                    type="range"
                                    min="-3"
                                    max="2"
                                    step="0.1"
                                    value={cameraHeight}
                                    onChange={(e) => setCameraHeight(parseFloat(e.target.value))}
                                    className="w-full h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-[#33ff00]"
                                />
                                <span className="text-[10px] text-white w-8 text-right">{cameraHeight.toFixed(1)}m</span>
                            </div>
                        )}
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
                <div className="absolute bottom-20 left-6 z-50 select-none touch-none" style={{ width: '150px', height: '150px' }}>

                    {/* Decoración de fondo (Mira Táctica) */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-30">
                        <div className="w-[80%] h-[1px] bg-[#33ff00]"></div>
                        <div className="h-[80%] w-[1px] bg-[#33ff00] absolute"></div>
                        <div className="w-2 h-2 border border-[#33ff00] rounded-full bg-black relative z-0"></div>
                    </div>

                    <div className="relative w-full h-full">
                        {/* Estilo común para los botones */}
                        {/* Nota: Usamos 'active:bg-[#33ff00]' para que se ilumine al tocar */}

                        {/* Botón Arriba (W) */}
                        <button
                            id="mobile-btn-up"
                            className="absolute top-0 left-1/2 transform -translate-x-1/2 
                            w-12 h-12 bg-black/80 border border-[#33ff00] text-[#33ff00] rounded-sm
                            shadow-[0_0_10px_rgba(51,255,0,0.2)] backdrop-blur-sm
                            active:bg-[#33ff00] active:text-black active:scale-95 active:shadow-[0_0_20px_rgba(51,255,0,0.6)]
                            transition-all duration-75 flex items-center justify-center font-bold text-xl"
                            style={{ touchAction: 'none' }}
                        >
                            ▲
                        </button>

                        {/* Botón Izquierda (A) */}
                        <button
                            id="mobile-btn-left"
                            className="absolute top-1/2 left-0 transform -translate-y-1/2 
                            w-12 h-12 bg-black/80 border border-[#33ff00] text-[#33ff00] rounded-sm
                            shadow-[0_0_10px_rgba(51,255,0,0.2)] backdrop-blur-sm
                            active:bg-[#33ff00] active:text-black active:scale-95 active:shadow-[0_0_20px_rgba(51,255,0,0.6)]
                            transition-all duration-75 flex items-center justify-center font-bold text-xl"
                            style={{ touchAction: 'none' }}
                        >
                            ◀
                        </button>

                        {/* Botón Derecha (D) */}
                        <button
                            id="mobile-btn-right"
                            className="absolute top-1/2 right-0 transform -translate-y-1/2 
                            w-12 h-12 bg-black/80 border border-[#33ff00] text-[#33ff00] rounded-sm
                            shadow-[0_0_10px_rgba(51,255,0,0.2)] backdrop-blur-sm
                            active:bg-[#33ff00] active:text-black active:scale-95 active:shadow-[0_0_20px_rgba(51,255,0,0.6)]
                            transition-all duration-75 flex items-center justify-center font-bold text-xl"
                            style={{ touchAction: 'none' }}
                        >
                            ▶
                        </button>

                        {/* Botón Abajo (S) */}
                        <button
                            id="mobile-btn-down"
                            className="absolute bottom-0 left-1/2 transform -translate-x-1/2 
                            w-12 h-12 bg-black/80 border border-[#33ff00] text-[#33ff00] rounded-sm
                            shadow-[0_0_10px_rgba(51,255,0,0.2)] backdrop-blur-sm
                            active:bg-[#33ff00] active:text-black active:scale-95 active:shadow-[0_0_20px_rgba(51,255,0,0.6)]
                            transition-all duration-75 flex items-center justify-center font-bold text-xl"
                            style={{ touchAction: 'none' }}
                        >
                            ▼
                        </button>
                    </div>
                </div>
            )}

            {/* Modal de Hotspot - Fullscreen con botón X */}
            <div
                id="hotspotModal"
                className="fixed inset-0 bg-black/95 backdrop-blur-xl flex flex-col z-[999999] font-mono"
                style={{ display: hotspotModal ? 'flex' : 'none' }}
            >
                {/* Fondo de Scanlines (Decorativo) */}
                <div className="absolute inset-0 pointer-events-none z-0 opacity-20"
                    style={{ backgroundImage: 'linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.06))', backgroundSize: '100% 2px, 3px 100%' }}>
                </div>

                {/* --- ENCABEZADO DEL VISOR --- */}
                <div className="relative z-50 flex justify-between items-start p-6 border-b border-[#33ff00]/30 bg-[#33ff00]/5">
                    <div>
                        <h3 className="text-[#33ff00] text-2xl font-bold tracking-widest uppercase flex items-center gap-3">
                            <span className="w-3 h-3 bg-[#33ff00] animate-pulse"></span>
                            {hotspotModal?.title || 'ARCHIVO SIN TÍTULO'}
                        </h3>
                        <p className="text-xs text-[#33ff00]/60 mt-1 pl-6 uppercase">
                            TIPO: {hotspotModal?.contentType} | ACCESO: AUTORIZADO
                        </p>
                    </div>

                    <button
                        className="group flex items-center gap-2 bg-black border border-[#33ff00]/50 hover:border-[#33ff00] hover:bg-[#33ff00] px-4 py-2 transition-all duration-300"
                        onClick={closeHotspotModal}
                        title="Cerrar Visualización"
                    >
                        <span className="text-[#33ff00] text-sm font-bold group-hover:text-black">[ ESC ] CERRAR CONEXIÓN</span>
                    </button>
                </div>

                {/* --- ÁREA DE CONTENIDO --- */}
                <div className="relative flex-1 w-full h-full p-8 flex items-center justify-center overflow-hidden">

                    {/* Decoración de esquinas del marco */}
                    <div className="absolute top-8 left-8 w-4 h-4 border-t-2 border-l-2 border-[#33ff00]"></div>
                    <div className="absolute top-8 right-8 w-4 h-4 border-t-2 border-r-2 border-[#33ff00]"></div>
                    <div className="absolute bottom-8 left-8 w-4 h-4 border-b-2 border-l-2 border-[#33ff00]"></div>
                    <div className="absolute bottom-8 right-8 w-4 h-4 border-b-2 border-r-2 border-[#33ff00]"></div>

                    <div className="relative z-10 w-full h-full flex justify-center items-center max-h-[80vh]">

                        {/* IMAGEN */}
                        {hotspotModal?.contentType === 'imagen' && (
                            <div className="relative border border-[#33ff00]/20 p-1 bg-black shadow-[0_0_30px_rgba(51,255,0,0.1)]">
                                <img
                                    src={hotspotModal.url}
                                    alt={hotspotModal.title}
                                    className="max-h-[75vh] max-w-full object-contain"
                                />
                                <div className="absolute bottom-2 right-2 text-[10px] bg-black/80 text-[#33ff00] px-2 border border-[#33ff00]/30">IMG_RENDER</div>
                            </div>
                        )}

                        {/* VIDEO */}
                        {hotspotModal?.contentType === 'video' && (
                            <div className="border border-[#33ff00]/30 bg-black p-1 shadow-2xl">
                                <video
                                    src={hotspotModal.url}
                                    controls
                                    autoPlay
                                    loop
                                    className="max-h-[75vh] max-w-full"
                                    onCanPlay={(e) => handleMediaAutoplay(e.currentTarget)}
                                />
                            </div>
                        )}

                        {/* AUDIO */}
                        {hotspotModal?.contentType === 'audio' && (
                            <div className="bg-black border border-[#33ff00] p-10 rounded-sm flex flex-col items-center shadow-[0_0_50px_rgba(51,255,0,0.2)] max-w-md w-full">
                                <div className="text-[#33ff00] text-6xl mb-6 animate-pulse">
                                    🔊
                                </div>
                                <div className="w-full mb-4 h-8 flex items-center justify-center gap-1">
                                    {/* Visualizador falso animado */}
                                    {[...Array(10)].map((_, i) => (
                                        <div key={i} className="w-1 bg-[#33ff00]" style={{
                                            height: `${Math.random() * 100}%`,
                                            animation: `pulse 0.5s infinite ${Math.random()}s`
                                        }}></div>
                                    ))}
                                </div>
                                <p className="text-[#33ff00] text-sm mb-4 tracking-widest">REPRODUCIENDO AUDIO...</p>

                                {/* Truco: Invertimos los colores del player nativo para que se vea oscuro/verde */}
                                <audio
                                    src={hotspotModal.url}
                                    controls
                                    autoPlay
                                    className="w-full min-w-[300px] filter invert hue-rotate-180 contrast-150 opacity-80"
                                    onCanPlay={(e) => handleMediaAutoplay(e.currentTarget)}
                                />
                            </div>
                        )}

                        {/* INTERACTIVE / IFRAME */}
                        {hotspotModal?.contentType === 'interactive' && (
                            <div className="w-full h-full border border-[#33ff00]/50 bg-black">
                                <iframe
                                    ref={iframeRef}
                                    id="interactive-iframe"
                                    src={hotspotModal.url}
                                    title={hotspotModal.title}
                                    className="w-full h-full"
                                    style={{ border: 'none' }}
                                    allowFullScreen
                                ></iframe>
                            </div>
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
            {/* Modal de Inventario */}
            <div
                id="inventoryModal"
                className={`
                    fixed inset-0 z-[60] flex items-center justify-center 
                    bg-black/85 backdrop-blur-sm font-mono
                    ${showInventory ? 'flex' : 'hidden'}
                `}
            >
                {/* Contenedor del Modal */}
                <div className="w-[90%] max-w-[600px] bg-black/95 border border-[#33ff00] shadow-[0_0_30px_rgba(51,255,0,0.15)] flex flex-col">

                    {/* Encabezado */}
                    <div className="flex justify-between items-center p-4 border-b border-[#33ff00]/30 bg-[#33ff00]/5">
                        <h3 className="text-[#33ff00] text-lg font-bold tracking-widest uppercase flex items-center gap-2">
                            <span className="animate-pulse">_</span> ALMACÉN DE RECURSOS
                        </h3>
                        <button
                            className="text-[#33ff00] hover:text-white hover:bg-[#33ff00]/20 px-2 py-1 transition-colors text-xl leading-none"
                            onClick={() => setShowInventory(false)}
                        >
                            [X]
                        </button>
                    </div>

                    <div className="p-6">

                        {/* Estadísticas rápidas (Header interno) */}
                        <div className="flex justify-between text-xs text-[#33ff00]/60 mb-4 border-b border-[#33ff00]/20 pb-2">
                            <span>CAPACIDAD: ILIMITADA</span>
                            <span>ITEMS: {playerStats?.inventario?.length || 0}</span>
                        </div>

                        {/* Lista de Items */}
                        <div id="inventoryItems" className="max-h-80 overflow-y-auto pr-2 space-y-3 custom-scrollbar">

                            {/* Estilos para scrollbar personalizado */}
                            <style>{`
                                .custom-scrollbar::-webkit-scrollbar { width: 6px; }
                                .custom-scrollbar::-webkit-scrollbar-track { background: #111; }
                                .custom-scrollbar::-webkit-scrollbar-thumb { background: #33ff00; border-radius: 2px; }
                            `}</style>

                            {playerStats?.inventario && playerStats.inventario.length > 0 ? (
                                playerStats.inventario.map((item, index) => (
                                    <div key={index} className="flex gap-3 border border-[#33ff00]/20 p-3 bg-white/5 hover:bg-[#33ff00]/10 transition-colors cursor-default group">

                                        {/* Icono / Placeholder Gráfico */}
                                        <div className="w-12 h-12 border border-[#33ff00]/30 flex items-center justify-center bg-black text-2xl group-hover:border-[#33ff00] transition-colors">
                                            📦
                                        </div>

                                        {/* Datos del Item */}
                                        <div className="flex-1">
                                            <div className="flex justify-between items-start mb-1">
                                                <p className="text-[#33ff00] font-bold text-sm uppercase group-hover:text-white transition-colors">
                                                    {item.nombre}
                                                </p>
                                                <span className="text-[9px] text-[#33ff00]/50 font-mono">
                                                    ID_{index + 100}
                                                </span>
                                            </div>
                                            <p className="text-xs text-gray-400 leading-tight group-hover:text-gray-300">
                                                {item.descripcion}
                                            </p>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-10 border border-dashed border-[#33ff00]/30 text-gray-500 text-sm">
                                    <p className="mb-2 text-2xl opacity-50">🚫</p>
                                    [ ! ] ALMACÉN VACÍO. RECOLECTA OBJETOS.
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
            {/* Modal de Personajes */}
            {showCharacters && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 backdrop-blur-sm font-mono">

                    {/* Contenedor del Modal */}
                    <div className="w-[90%] max-w-[500px] bg-black/95 border border-[#33ff00] shadow-[0_0_30px_rgba(51,255,0,0.15)] flex flex-col">

                        {/* Encabezado */}
                        <div className="flex justify-between items-center p-4 border-b border-[#33ff00]/30 bg-[#33ff00]/5">
                            <h3 className="text-[#33ff00] text-lg font-bold tracking-widest uppercase flex items-center gap-2">
                                <span className="animate-pulse">_</span> BASE DE DATOS: CREW
                            </h3>
                            <button
                                className="text-[#33ff00] hover:text-white hover:bg-[#33ff00]/20 px-2 py-1 transition-colors text-xl leading-none"
                                onClick={() => setShowCharacters(false)}
                            >
                                [X]
                            </button>
                        </div>

                        <div className="p-6">

                            {/* Instrucciones / Subtítulo técnico */}
                            <div className="flex justify-between items-end mb-4 border-b border-[#33ff00]/20 pb-2">
                                <p className="text-xs text-[#33ff00]/70">
                                    {'>'} SELECCIONE SUJETO PARA ANÁLISIS DETALLADO
                                </p>
                                <span className="text-[9px] bg-[#33ff00]/10 text-[#33ff00] px-1 rounded">
                                    TOTAL: {playerStats?.personajes_conocidos?.length || 0}
                                </span>
                            </div>

                            {/* Lista de Personajes */}
                            <div className="max-h-96 overflow-y-auto pr-2 space-y-3 custom-scrollbar">

                                {/* Estilos scrollbar */}
                                <style>{`
                                    .custom-scrollbar::-webkit-scrollbar { width: 6px; }
                                    .custom-scrollbar::-webkit-scrollbar-track { background: #111; }
                                    .custom-scrollbar::-webkit-scrollbar-thumb { background: #33ff00; border-radius: 2px; }
                                `}</style>

                                {(playerStats?.personajes_conocidos || []).length > 0 ? (
                                    (playerStats?.personajes_conocidos || []).map((name, index) => (
                                        <div
                                            key={index}
                                            className="group flex items-center gap-4 border border-[#33ff00]/20 p-3 bg-white/5 hover:bg-[#33ff00]/10 hover:border-[#33ff00]/50 transition-all cursor-pointer"
                                            onClick={() => handleCharacterClickInBar(name)}
                                        >
                                            {/* Icono de Avatar Genérico */}
                                            <div className="w-10 h-10 bg-black border border-[#33ff00]/30 flex items-center justify-center text-xl group-hover:border-[#33ff00] transition-colors">
                                                👤
                                            </div>

                                            {/* Datos del Personaje */}
                                            <div className="flex-1">
                                                <div className="flex justify-between items-center">
                                                    <p className="text-[#33ff00] font-bold text-sm uppercase group-hover:text-white transition-colors">
                                                        {name}
                                                    </p>
                                                    <span className="text-[8px] border border-[#33ff00]/30 text-[#33ff00]/70 px-1 group-hover:bg-[#33ff00] group-hover:text-black transition-colors">
                                                        VER EXPEDIENTE ↗
                                                    </span>
                                                </div>
                                                <p className="text-[10px] text-gray-500 font-mono mt-1">
                                                    ID_REF: {name.substring(0, 3).toUpperCase()}_{index + 1024}
                                                </p>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    // Estado Vacío
                                    <div className="text-center py-8 border border-dashed border-[#33ff00]/30 text-gray-500 text-sm">
                                        <p className="mb-2 text-2xl opacity-50">🚫</p>
                                        [ ! ] SIN REGISTROS. INTERACTÚA CON EL ENTORNO.
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {/* Modal de Historias */}
            <div
                id="storiesModal"
                className={`
                    fixed inset-0 z-[60] flex items-center justify-center 
                    bg-black/85 backdrop-blur-sm font-mono
                    ${showStories ? 'flex' : 'hidden'}
                `}
            >
                {/* Contenedor del Modal */}
                <div className="w-[90%] max-w-[600px] bg-black/95 border border-[#33ff00] shadow-[0_0_30px_rgba(51,255,0,0.15)] flex flex-col">

                    {/* Encabezado */}
                    <div className="flex justify-between items-center p-4 border-b border-[#33ff00]/30 bg-[#33ff00]/5">
                        <h3 className="text-[#33ff00] text-lg font-bold tracking-widest uppercase flex items-center gap-2">
                            <span className="animate-pulse">_</span> LOGS DE MISIÓN
                        </h3>
                        <button
                            className="text-[#33ff00] hover:text-white hover:bg-[#33ff00]/20 px-2 py-1 transition-colors text-xl leading-none"
                            onClick={() => setShowStories(false)}
                        >
                            [X]
                        </button>
                    </div>

                    <div className="p-6">

                        {/* Botón Volver (Estilo Táctico) */}
                        <button
                            className="w-full mb-6 group relative py-3 px-4 border border-[#33ff00]/50 text-[#33ff00] text-sm tracking-wider uppercase
                            transition-all duration-300 hover:bg-[#33ff00] hover:text-black hover:shadow-[0_0_15px_rgba(51,255,0,0.4)] flex items-center justify-center gap-3"
                            onClick={() => {
                                setShowStories(false);
                                handleReturnToMenu();
                            }}
                        >
                            <span>{'<<'} RETORNAR AL HUB</span>
                        </button>

                        {/* Lista de Items */}
                        <div id="storyItems" className="max-h-80 overflow-y-auto pr-2 space-y-3 custom-scrollbar">

                            {/* Estilos para scrollbar personalizado inline */}
                            <style>{`
                                .custom-scrollbar::-webkit-scrollbar { width: 6px; }
                                .custom-scrollbar::-webkit-scrollbar-track { background: #111; }
                                .custom-scrollbar::-webkit-scrollbar-thumb { background: #33ff00; border-radius: 2px; }
                            `}</style>

                            {playerStats?.historias_visitadas && historias.length > 0 ? (
                                playerStats.historias_visitadas.map((storyId, index) => {
                                    const story = historias.find(h => h.id_historia === parseInt(storyId));
                                    return story ? (
                                        <div key={index} className="border border-[#33ff00]/20 p-3 bg-white/5 hover:bg-[#33ff00]/10 transition-colors cursor-default group">
                                            <div className="flex justify-between items-start mb-1">
                                                <p className="text-[#33ff00] font-bold text-sm uppercase group-hover:text-white transition-colors">
                                                    {story.titulo}
                                                </p>
                                                <span className="text-[9px] bg-[#33ff00]/20 text-[#33ff00] px-1.5 py-0.5 rounded-sm">
                                                    FILE_{storyId}
                                                </span>
                                            </div>
                                            <p className="text-xs text-gray-400 group-hover:text-gray-300">{story.descripcion}</p>
                                        </div>
                                    ) : null;
                                })
                            ) : (
                                <div className="text-center py-10 border border-dashed border-[#33ff00]/30 text-gray-500 text-sm">
                                    <p className="mb-2 text-2xl opacity-50">📂</p>
                                    [ ! ] SIN DATOS. EXPLORACIÓN REQUERIDA.
                                </div>
                            )}
                        </div>
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
                <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/85 backdrop-blur-sm font-mono" style={{ display: 'flex' }}>
    
                    {/* Contenedor Principal del Expediente */}
                    <div className="relative w-[90%] max-w-lg bg-black/95 border border-[#33ff00] shadow-[0_0_40px_rgba(51,255,0,0.15)] flex flex-col max-h-[90vh] overflow-hidden">
                        
                        {/* Decoración de Esquinas */}
                        <div className="absolute top-0 left-0 w-3 h-3 bg-[#33ff00] z-10"></div>
                        <div className="absolute top-0 right-0 w-3 h-3 bg-[#33ff00] z-10"></div>
                        <div className="absolute bottom-0 left-0 w-3 h-3 bg-[#33ff00] z-10"></div>
                        <div className="absolute bottom-0 right-0 w-3 h-3 bg-[#33ff00] z-10"></div>

                        {/* ENCABEZADO */}
                        <div className="flex justify-between items-center p-5 border-b border-[#33ff00]/30 bg-[#33ff00]/5">
                            <div>
                                <h2 className="text-[#33ff00] text-xl font-bold tracking-widest uppercase flex items-center gap-2">
                                    EXPEDIENTE: {selectedCharacterForModal.nombre}
                                </h2>
                                <p className="text-[9px] text-[#33ff00]/60 mt-1">NIVEL DE ACCESO: CONFIDENCIAL</p>
                            </div>
                            <button 
                                className="text-[#33ff00] hover:bg-[#33ff00] hover:text-black border border-[#33ff00] w-8 h-8 flex items-center justify-center transition-colors font-bold"
                                onClick={closeCharacterModal}
                            >
                                X
                            </button>
                        </div>

                        {/* CONTENIDO SCROLLABLE */}
                        <div className="p-6 overflow-y-auto custom-scrollbar space-y-6">
                            
                            {/* Estilos Scrollbar */}
                            <style>{`
                                .custom-scrollbar::-webkit-scrollbar { width: 6px; }
                                .custom-scrollbar::-webkit-scrollbar-track { background: #111; }
                                .custom-scrollbar::-webkit-scrollbar-thumb { background: #33ff00; border-radius: 0px; }
                            `}</style>

                            {/* SECCIÓN 1: IDENTIFICACIÓN VISUAL */}
                            <div className="flex flex-col items-center">
                                {selectedCharacterForModal.imagen ? (
                                    <div className="relative group">
                                        {/* Marco de la foto */}
                                        <div className="absolute -top-2 -left-2 w-4 h-4 border-t-2 border-l-2 border-[#33ff00]"></div>
                                        <div className="absolute -bottom-2 -right-2 w-4 h-4 border-b-2 border-r-2 border-[#33ff00]"></div>
                                        
                                        <img
                                            src={selectedCharacterForModal.imagen}
                                            alt={selectedCharacterForModal.nombre}
                                            className="w-40 h-40 object-cover filter grayscale contrast-125 border border-[#33ff00]/50 group-hover:grayscale-0 transition-all duration-500"
                                        />
                                        
                                        {/* Overlay de escaneo */}
                                        <div className="absolute inset-0 bg-[linear-gradient(transparent_50%,rgba(51,255,0,0.1)_50%)] bg-[length:100%_4px] pointer-events-none"></div>
                                    </div>
                                ) : (
                                    <div className="w-32 h-32 border border-dashed border-[#33ff00]/50 flex items-center justify-center bg-black">
                                        <span className="text-[#33ff00]/30 text-4xl">?</span>
                                    </div>
                                )}
                            </div>

                            {/* SECCIÓN 2: DESCRIPCIÓN */}
                            <div className="border-l-2 border-[#33ff00] pl-4 bg-[#33ff00]/5 py-2">
                                <h4 className="text-[#33ff00] text-xs font-bold uppercase tracking-wider mb-2">
                                    {'>'} PERFIL PSICOLÓGICO / BIO
                                </h4>
                                <p className="text-sm text-gray-300 leading-relaxed font-sans">
                                    {selectedCharacterForModal.descripcion}
                                </p>
                            </div>

                            {/* SECCIÓN 3: METADATOS (GRID TÉCNICA) */}
                            {selectedCharacterForModal.metadata && (
                                <div>
                                    <h4 className="text-[#33ff00] text-xs font-bold uppercase tracking-wider mb-3 border-b border-[#33ff00]/20 pb-1">
                                        {'>'} ATRIBUTOS TÉCNICOS
                                    </h4>
                                    <div className="grid grid-cols-2 gap-3">
                                        {Object.entries(selectedCharacterForModal.metadata).map(([key, value]) => (
                                            <div key={key} className="bg-black border border-[#33ff00]/20 p-2 flex flex-col hover:border-[#33ff00]/60 transition-colors">
                                                <span className="text-[9px] text-[#33ff00]/60 uppercase tracking-widest mb-1">{key}</span>
                                                <span className="text-white text-sm font-bold truncate" title={String(value)}>
                                                    {String(value)}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* FOOTER / BOTÓN CIERRE */}
                        <div className="p-5 border-t border-[#33ff00]/30 bg-black">
                            <button
                                onClick={closeCharacterModal}
                                className="w-full group relative py-3 border border-[#33ff00] text-[#33ff00] font-bold text-sm tracking-[0.2em] uppercase
                                transition-all duration-300 hover:bg-[#33ff00] hover:text-black hover:shadow-[0_0_15px_rgba(51,255,0,0.4)]"
                            >
                                <span>[ CERRAR EXPEDIENTE ]</span>
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