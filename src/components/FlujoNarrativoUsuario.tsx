import 'aframe';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { gameServiceUser, PlayerStats } from '../services/GameServiceUser';
import MapaView from './MapaView';
//FICHA PERSONAJES
import { Personaje } from '../supabaseClient';
import { obtenerFichaPersonajePorId } from '../supabaseClient';
import { fail } from 'assert';
import { fetchAndConvertSubtitle } from '../utils/subtitleUtils';

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

// Type for historia with lock state computed
type HistoriaConEstado = HistoriaData & {
    isLocked: boolean;
};

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
    title_en?: string; // Título en inglés para localización
    url: string; // URL del contenido (imagen, video, audio)
    subtitlesUrl?: string; // Opcional: URL del archivo SRT
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
    recursos: RecursoMultimediaData[];
}

// --- DICCIONARIO DE TRADUCCIÓN ---
// Definir tipos para el diccionario
type TranslationKeys = {
    loading_stories: string;
    connect_db: string;
    access_mem: string;
    decrypting: string;
    buffer_status: string;
    sync_status: string;
    no_signal: string;
    no_stories_msg: string;
    await_trans: string;
    sys_failure: string;
    err_void: string;
    err_load: string;
    abort_retry: string;
    mission_complete: string;
    data_saved_msg: string;
    return_hub: string;
    hub_loading: string;

    // Hub Cards
    sec_prefix: string;
    completed: string;
    locked: string;
    req: string;
    execute: string;
    add_fav: string;
    remove_fav: string;

    // Step Content
    narrative_incoming: string;
    next: string;
    continue_adv: string;
    decision_crit: string;
    waiting_input: string;
    seq_completed: string;
    conn_terminated: string;
    data_saved: string;
    next_phase: string;
    end_sim: string;

    // 3D Instructions
    nav_proto: string;
    touch_iface: string;
    peripherals: string;
    online: string;
    instruct_text: string;
    nodes_interest: string;
    virt_joy: string;
    move: string;
    screen: string;
    swipe_tap: string;
    keyboard: string;
    movement: string;
    mouse: string;
    click_drag: string;
    start: string;

    // Modals & Bottom Bar
    map: string;
    inv: string;
    crew: string;
    logs: string;
    xp: string;
    nodes: string;
    vol: string;
    cam: string;

    res_storage: string;
    capacity: string;
    items_label: string;
    empty_storage: string;
    db_crew: string;
    select_subj: string;
    view_file: string;
    no_records: string;
    mission_logs: string;
    return_hub_btn: string;
    no_data_logs: string;

    file_title: string;
    access_lvl: string;
    psych_profile: string;
    tech_attr: string;

    hotspot_unknown: string;

    // Modals Extra
    locked_title: string;
    unlock_msg: string;
    must_complete_msg: string;
    go_req_story: string;
    cancel: string;
    prev_step: string;
    next_step: string;
    close_btn: string;
    total: string;
};

const flujoTranslations: Record<'es' | 'en', TranslationKeys> = {
    es: {
        loading_stories: "RECUPERANDO_HISTORIAS",
        connect_db: "CONECTANDO BASE DE DATOS",
        access_mem: "ACCEDIENDO_MEMORIA",
        decrypting: "Desencriptando fragmentos narrativos...",
        buffer_status: "BUFFER: 64KB",
        sync_status: "ESTADO: SYNC",
        no_signal: "NO_SIGNAL_DETECTED",
        no_stories_msg: "No se han encontrado historias disponibles en este sector de la memoria.",
        await_trans: "ESPERANDO TRANSMISIÓN...",
        sys_failure: "SYSTEM FAILURE",
        err_void: "ERR_CODE: NARRATIVE_VOID",
        err_load: "No se pudo cargar el flujo narrativo.",
        abort_retry: "ABORTAR Y REINICIAR",
        mission_complete: "MISIÓN COMPLETADA",
        data_saved_msg: "Los datos han sido recuperados exitosamente.\nTu contribución a la memoria colectiva ha sido registrada.",
        return_hub: "FINALIZAR Y VOLVER AL HUB",
        hub_loading: "CARGANDO...",

        // Hub Cards
        sec_prefix: "SEC_",
        completed: "COMPLETED", // Using English style for 'hacker' feel in ES too? No, keep localized.
        locked: "BLOQUEADO",
        req: "REQ:",
        execute: "EJECUTAR",
        add_fav: "Agregar a favoritos",
        remove_fav: "Remover de favoritos",

        // Step Content
        narrative_incoming: "NARRATIVA_ENTRANTE",
        next: "Siguiente",
        continue_adv: "Continuar Aventura",
        decision_crit: "DECISIÓN_CRÍTICA",
        waiting_input: "WAITING_INPUT...",
        seq_completed: "SECUENCIA_COMPLETADA",
        conn_terminated: "CONEXIÓN_FINALIZADA",
        data_saved: "DATOS GUARDADOS CORRECTAMENTE",
        next_phase: "SIGUIENTE FASE",
        end_sim: "TERMINAR SIMULACIÓN",

        // 3D Instructions
        nav_proto: "PROTOCOLO DE NAVEGACIÓN",
        touch_iface: "INTERFAZ TÁCTIL DETECTADA",
        peripherals: "PERIFÉRICOS DETECTADOS",
        online: "ONLINE",
        instruct_text: "Para avanzar en la simulación, localiza y descifra los Nodos de Interés ocultos.",
        nodes_interest: "NODOS DE INTERÉS",
        virt_joy: "JOYSTICK VIRTUAL",
        move: "Moverse",
        screen: "PANTALLA",
        swipe_tap: "Deslizar: Mirar / Tap: Interactuar",
        keyboard: "TECLADO",
        movement: "Desplazamiento",
        mouse: "MOUSE",
        click_drag: "Clic + Arrastrar: Mirar",
        start: "INICIAR",

        // Modals & Bottom Bar
        map: "MAPA",
        inv: "INV",
        crew: "CREW",
        logs: "LOGS",
        xp: "XP",
        nodes: "NODOS",
        vol: "VOL",
        cam: "CAM",

        res_storage: "ALMACÉN DE RECURSOS",
        capacity: "CAPACIDAD: ILIMITADA",
        items_label: "ITEMS",
        empty_storage: "ALMACÉN VACÍO. RECOLECTA OBJETOS.",
        db_crew: "BASE DE DATOS: CREW",
        select_subj: "SELECCIONE SUJETO PARA ANÁLISIS DETALLADO",
        view_file: "VER EXPEDIENTE",
        no_records: "SIN REGISTROS. INTERACTÚA CON EL ENTORNO.",
        mission_logs: "LOGS DE MISIÓN",
        return_hub_btn: "RETORNAR AL HUB",
        no_data_logs: "SIN DATOS. EXPLORACIÓN REQUERIDA.",

        file_title: "EXPEDIENTE:",
        access_lvl: "NIVEL DE ACCESO: CONFIDENCIAL",
        psych_profile: "PERFIL PSICOLÓGICO / BIO",
        tech_attr: "ATRIBUTOS TÉCNICOS",

        hotspot_unknown: "ARCHIVO_DESCONOCIDO",

        locked_title: "Historia Bloqueada",
        unlock_msg: "Para desbloquear",
        must_complete_msg: "primero debes completar la historia:",
        go_req_story: "Ir a Historia Requerida →",
        cancel: "Cancelar",
        prev_step: "Paso Anterior",
        next_step: "Siguiente Paso",
        close_btn: "[ CERRAR ]",
        total: "TOTAL"
    },
    en: {
        loading_stories: "RETRIEVING_STORIES",
        connect_db: "CONNECTING DATABASE",
        access_mem: "ACCESSING_MEMORY",
        decrypting: "Decrypting narrative fragments...",
        buffer_status: "BUFFER: 64KB",
        sync_status: "STATUS: SYNC",
        no_signal: "NO_SIGNAL_DETECTED",
        no_stories_msg: "No stories found in this memory sector.",
        await_trans: "AWAITING TRANSMISSION...",
        sys_failure: "SYSTEM FAILURE",
        err_void: "ERR_CODE: NARRATIVE_VOID",
        err_load: "Could not load narrative flow.",
        abort_retry: "ABORT AND RETRY",
        mission_complete: "MISSION COMPLETE",
        data_saved_msg: "Data successfully retrieved.\nYour contribution to the collective memory has been registered.",
        return_hub: "FINISH AND RETURN TO HUB",
        hub_loading: "LOADING...",

        // Hub Cards
        sec_prefix: "SEC_",
        completed: "COMPLETED",
        locked: "LOCKED",
        req: "REQ:",
        execute: "EXECUTE",
        add_fav: "Add to favorites",
        remove_fav: "Remove from favorites",

        // Step Content
        narrative_incoming: "INCOMING_NARRATIVE",
        next: "Next",
        continue_adv: "Continue Adventure",
        decision_crit: "CRITICAL_DECISION",
        waiting_input: "WAITING_INPUT...",
        seq_completed: "SEQUENCE_COMPLETED",
        conn_terminated: "CONNECTION_TERMINATED",
        data_saved: "DATA SAVED SUCCESSFULLY",
        next_phase: "NEXT PHASE",
        end_sim: "END SIMULATION",

        // 3D Instructions
        nav_proto: "NAVIGATION_PROTOCOL",
        touch_iface: "TOUCH INTERFACE DETECTED",
        peripherals: "PERIPHERALS DETECTED",
        online: "ONLINE",
        instruct_text: "To proceed, locate and decipher the hidden Interest Nodes.",
        nodes_interest: "INTEREST NODES",
        virt_joy: "VIRTUAL JOYSTICK",
        move: "Move",
        screen: "SCREEN",
        swipe_tap: "Swipe: Look / Tap: Interact",
        keyboard: "KEYBOARD",
        movement: "Movement",
        mouse: "MOUSE",
        click_drag: "Click + Drag: Look",
        start: "START",

        // Modals & Bottom Bar
        map: "MAP",
        inv: "INV",
        crew: "CREW",
        logs: "LOGS",
        xp: "XP",
        nodes: "NODES",
        vol: "VOL",
        cam: "CAM",

        res_storage: "RESOURCE STORAGE",
        capacity: "CAPACITY: UNLIMITED",
        items_label: "ITEMS",
        empty_storage: "STORAGE EMPTY. COLLECT OBJECTS.",
        db_crew: "DATABASE: CREW",
        select_subj: "SELECT SUBJECT FOR DETAILED ANALYSIS",
        view_file: "VIEW FILE",
        no_records: "NO RECORDS. INTERACT WITH ENVIRONMENT.",
        mission_logs: "MISSION LOGS",
        return_hub_btn: "RETURN TO HUB",
        no_data_logs: "NO DATA. EXPLORATION REQUIRED.",

        file_title: "FILE:",
        access_lvl: "ACCESS LEVEL: CONFIDENTIAL",
        psych_profile: "PSYCH PROFILE / BIO",
        tech_attr: "TECH ATTRIBUTES",

        hotspot_unknown: "UNKNOWN_FILE",

        locked_title: "Story Locked",
        unlock_msg: "To unlock",
        must_complete_msg: "you must first complete:",
        go_req_story: "Go to Required Story →",
        cancel: "Cancel",
        prev_step: "Previous Step",
        next_step: "Next Step",
        close_btn: "[ CLOSE ]",
        total: "TOTAL"
    }
};

// Helper para contenido localizado desde DB
const getLocalizedContent = (obj: any, field: string, lang: 'es' | 'en') => {
    if (!obj) return '';
    // Intentar buscar campo con sufijo _en si el idioma es inglés
    if (lang === 'en') {
        return obj[`${field}_en`] || obj[field] || '';
    }
    // Por defecto devolver el campo original (asumido español)
    return obj[field] || '';
};

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

    // --- LOCALIZATION HOOKS & SUBS PERSISTENCE ---
    const { language } = useLanguage();
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
    // Subtitles
    const [subtitleUrl, setSubtitleUrl] = useState<string | null>(null);
    const [subtitlesEnabled, setSubtitlesEnabled] = useState(false);
    // Hotspot Subtitles
    const [hotspotSubtitleUrl, setHotspotSubtitleUrl] = useState<string | null>(null);
    const [hotspotSubtitlesEnabled, setHotspotSubtitlesEnabled] = useState(false);
    // Check if current story is completed
    const isStoryCompleted = React.useMemo(() => {
        if (!selectedHistoriaId || !playerStats?.historias_visitadas) return false;
        return playerStats.historias_visitadas.includes(String(selectedHistoriaId));
    }, [selectedHistoriaId, playerStats?.historias_visitadas]);

    // Referencia para el contenedor del carrusel
    const scrollContainerRef = React.useRef(null);

    // Función para mover el carrusel con los botones
    const scroll = (direction) => {
        if (scrollContainerRef.current) {
            const { current } = scrollContainerRef;
            const scrollAmount = 350; // Cantidad de desplazamiento
            if (direction === 'left') {
                current.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
            } else {
                current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
            }
        }
    };

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

    // Estado para el favorito
    const [favoritingHistoriaId, setFavoritingHistoriaId] = useState<number | null>(null);

    // Función para marcar una historia como favorita
    const handleToggleFavorite = async (historiaId: number, e: React.MouseEvent) => {
        e.stopPropagation();

        if (!user?.id || favoritingHistoriaId === historiaId) return;
        try {
            setFavoritingHistoriaId(historiaId);
            const historiaIdStr = String(historiaId);
            await gameServiceUser.toggleFavoriteStory(user.id, historiaIdStr);

            // CRÍTICO: Recargar stats INMEDIATAMENTE para actualizar la UI
            await fetchPlayerStats();

            console.log(`Historia ${historiaId} favorito actualizado`);
        } catch (error: any) {
            console.error('Error toggling favorite:', error);
        } finally {
            setFavoritingHistoriaId(null);
        }
    };

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
        // ✅ CRITICAL FIX: Reset isClicked state for all hotspots
        // =========================================================
        const modelEl = document.querySelector('[gltf-hotspot-interaction]');
        if (modelEl) {
            const obj = (modelEl as any).getObject3D('mesh');
            if (obj) {
                obj.traverse((child: any) => {
                    if (child.isMesh && child.userData && child.userData.isHotspot && child.userData.isClicked) {
                        // Reset the clicked state
                        child.userData.isClicked = false;
                        // Restore original material
                        if (child.userData.originalMaterial) {
                            child.material = child.userData.originalMaterial;
                            child.material.needsUpdate = true;
                        }
                    }
                });
                console.log('✅ Hotspot clicked states reset');
            }
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
                String(selectedHistoriaId)
            );

            if (!recompensaError && finalStats) {
                // También actualizamos aquí por si ganaste un item
                setPlayerStats(finalStats);
            } else {
                // Respaldo por si acaso
                await fetchPlayerStats();
            }
        }
    }, [userId, selectedHistoriaId, fetchPlayerStats]);


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
        const recompensaAppId: number | undefined | null = null;

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
                    String(selectedHistoriaId)
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
        getRecurso,
        fetchPlayerStats,
        selectedHistoriaId
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
    const handleHistoriaSelect = useCallback((historiaId: number) => {

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

    }, []);

    // Función que maneja la apertura del modal de hotspot
    const handleHotspotClick = useCallback(async (hotspot: HotspotConfig) => {
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
    }, [user, selectedHistoriaId, recompensasData, personajesData, fetchPlayerStats]);


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
        if (hotspotModal?.subtitlesUrl) {
            fetchAndConvertSubtitle(hotspotModal.subtitlesUrl)
                .then(url => setHotspotSubtitleUrl(url))
                .catch(() => setHotspotSubtitleUrl(null));
        } else {
            setHotspotSubtitleUrl(null);
        }
        return () => {
            if (hotspotSubtitleUrl) {
                URL.revokeObjectURL(hotspotSubtitleUrl);
            }
        };
    }, [hotspotModal, getRecurso, hotspotSubtitleUrl]);

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
        if (!isMobile || !selectedHistoriaId) return;

        const currentKeys: Set<string> = new Set();

        // Referencias a los event listeners para poder removerlos
        const listeners: Map<HTMLElement, Array<{ event: string, handler: EventListener }>> = new Map();

        const simulateKeyPress = (key: string, press: boolean) => {
            const camera = document.querySelector('a-camera');
            if (!camera) {
                console.warn('⚠️ Cámara A-Frame no encontrada');
                return;
            }

            const wasdControls = (camera as any).components['wasd-controls'];
            if (!wasdControls) {
                console.warn('⚠️ wasd-controls no encontrado en la cámara');
                return;
            }

            if (press) {
                wasdControls.keys[key] = true;
                console.log(`🎮 Tecla ${key} presionada`);
            } else {
                wasdControls.keys[key] = false;
                console.log(`🎮 Tecla ${key} liberada`);
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
            }
            if (btnDown) {
                addListener(btnDown, 'touchstart', (e) => { preventDefaults(e); startMoving('KeyS'); }, { passive: false });
                addListener(btnDown, 'touchend', (e) => { preventDefaults(e); stopMoving('KeyS'); }, { passive: false });
                addListener(btnDown, 'touchcancel', (e) => { preventDefaults(e); stopMoving('KeyS'); }, { passive: false });
            }
            if (btnLeft) {
                addListener(btnLeft, 'touchstart', (e) => { preventDefaults(e); startMoving('KeyA'); }, { passive: false });
                addListener(btnLeft, 'touchend', (e) => { preventDefaults(e); stopMoving('KeyA'); }, { passive: false });
                addListener(btnLeft, 'touchcancel', (e) => { preventDefaults(e); stopMoving('KeyA'); }, { passive: false });
            }
            if (btnRight) {
                addListener(btnRight, 'touchstart', (e) => { preventDefaults(e); startMoving('KeyD'); }, { passive: false });
                addListener(btnRight, 'touchend', (e) => { preventDefaults(e); stopMoving('KeyD'); }, { passive: false });
                addListener(btnRight, 'touchcancel', (e) => { preventDefaults(e); stopMoving('KeyD'); }, { passive: false });
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
    }, [isMobile, selectedHistoriaId, currentStepIndex]);

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
        // Otorgar recompensa si existe (SOLO si la historia NO está completada)
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

        // --- INICIO DE LA SOLUCIÓN ---
        // 2. Comprobar PRIMERO si el paso actual es 'final'.
        // Esta lógica debe ejecutarse ANTES del guard "nextStepId === null".
        if (currentStep.tipo_paso === 'final' && selectedHistoriaId !== null && user) {
            console.log('=== DEBUG: PASO FINAL (Lógica Corregida) ===');
            console.log('Tipo de paso:', currentStep.tipo_paso);
            console.log('Historia actual ID:', selectedHistoriaId);
            console.log('Paso completo:', JSON.stringify(currentStep, null, 2));

            // *** ¡AQUÍ ES DONDE SE GUARDA LA HISTORIA! ***
            try {
                await gameServiceUser.completeStory(user.id, String(selectedHistoriaId));
                console.log(`✅ Historia ${selectedHistoriaId} completada para el usuario ${user.id}`);
            } catch (error) {
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


    // Función para retroceder al paso anterior (solo para historias completadas)
    const goBack = () => {
        if (currentStepIndex > 0) {
            setShowStepContent(false);
            setCurrentStepIndex(currentStepIndex - 1);
        }
    };
    // Función para avanzar al siguiente paso (solo para historias completadas)
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
                            onClick={() => setShowInitial3DPopup(false)}
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
        else if (step.tipo_paso === 'final') {
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

    // Crear un mapa de imágenes una sola vez
    const imagenesMap = React.useMemo(() => {
        const map = new Map();
        recursosData.forEach(r => {
            map.set(r.id_recurso, r.archivo);
        });
        return map;
    }, [recursosData]);

    //  Crear una factory para manejar el clic en historias
    const handleHistoriaClickFactory = React.useCallback((historia: HistoriaConEstado) => {
        return () => {
            if (historia.isLocked) {
                const historiaMadre = historias.find(h => h.id_historia === historia.id_historia_dependencia);
                if (historiaMadre) {
                    setLockedHistoryModal({ historia, historiaMadre });
                }
            } else {
                handleHistoriaSelect(historia.id_historia);
            }
        };
    }, [historias, handleHistoriaSelect]);

    // Renderizado principal
    if (!selectedHistoriaId) {
        if (loading) {
            return (
                <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center font-mono text-[#33ff00] p-4">

                    {/* Fondo Scanlines */}
                    <div className="absolute inset-0 pointer-events-none opacity-20"
                        style={{ backgroundImage: 'linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.06))', backgroundSize: '100% 2px, 3px 100%' }}>
                    </div>

                    {/* Loader Visual (Anillos Giratorios) */}
                    {/* Ajuste: w-20 h-20 en móvil, w-24 h-24 en escritorio (md) */}
                    <div className="relative w-20 h-20 md:w-24 md:h-24 mb-6 md:mb-8 flex-shrink-0">
                        {/* Anillo Exterior */}
                        <div className="absolute inset-0 border-t-2 border-[#33ff00] rounded-full animate-spin shadow-[0_0_15px_#33ff00]"></div>

                        {/* Anillo Interior */}
                        <div className="absolute inset-4 border-b-2 border-[#33ff00]/50 rounded-full animate-pulse"></div>

                        {/* Icono Central */}
                        <div className="absolute inset-0 flex items-center justify-center text-2xl md:text-3xl animate-bounce">
                            📂
                        </div>
                    </div>

                    {/* Texto de Estado */}
                    <div className="text-center space-y-2 relative z-10 w-full max-w-md">
                        {/* Ajuste: Texto más pequeño y menos espaciado en móvil para evitar desborde */}
                        <h2 className="text-lg md:text-xl font-bold tracking-[0.15em] md:tracking-[0.3em] uppercase break-words leading-tight">
                            {t.loading_stories}
                        </h2>

                        <div className="flex justify-center gap-1 text-[10px] md:text-xs opacity-70">
                            <span>{t.connect_db}</span>
                            <span className="animate-[ping_1.5s_infinite]">.</span>
                            <span className="animate-[ping_1.5s_infinite_0.2s]">.</span>
                            <span className="animate-[ping_1.5s_infinite_0.4s]">.</span>
                        </div>
                    </div>

                    {/* Footer Decorativo */}
                    {/* Ajuste: Subirlo un poco en móvil (bottom-6) para que no lo tape la UI del navegador */}
                    <div className="absolute bottom-6 md:bottom-10 text-[9px] md:text-[10px] text-[#33ff00]/30 tracking-widest text-center px-4">
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
                            {t.no_signal}
                        </h2>

                        {/* Mensaje Humano (Estilizado) */}
                        <p className="text-[#a8a8a8] text-sm leading-relaxed mb-8">
                            {t.no_stories_msg}
                        </p>

                        {/* Decoración de Estado */}
                        <div className="flex flex-col items-center gap-2">
                            <div className="w-24 h-1 bg-[#33ff00]/20 overflow-hidden">
                                <div className="h-full w-1/2 bg-[#33ff00] animate-[ping_2s_linear_infinite]"></div>
                            </div>
                            <span className="text-[10px] text-[#33ff00]/40 uppercase tracking-widest">
                                {t.await_trans}
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



        //MENU PRINCIPAL LISTADO DE HISTORIAS
        return (
            <div className="relative min-h-screen bg-black text-[#a8a8a8] font-mono selection:bg-[#33ff00] selection:text-black overflow-hidden flex flex-col">

                {/* Fondo Scanlines */}
                <div className="absolute inset-0 pointer-events-none z-0 opacity-20 fixed"
                    style={{ backgroundImage: 'linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.06))', backgroundSize: '100% 2px, 3px 100%' }}>
                </div>


                {/* --- ÁREA PRINCIPAL (CARRUSEL) --- */}
                <div className="relative z-10 flex-grow flex items-center w-full">

                    {/* Botón Navegación Izquierda (Solo Desktop) */}
                    <button
                        onClick={() => scroll('left')}
                        className="flex absolute left-4 z-50 w-12 h-12 border border-[#33ff00]/50 bg-black/50 text-[#33ff00] items-center justify-center hover:bg-[#33ff00] hover:text-black transition-all rounded-full backdrop-blur-md"
                    >
                        {'<'}
                    </button>

                    {/* Botón Navegación Derecha (Solo Desktop) */}
                    <button
                        onClick={() => scroll('right')}
                        className="flex absolute right-4 z-50 w-12 h-12 border border-[#33ff00]/50 bg-black/50 text-[#33ff00] items-center justify-center hover:bg-[#33ff00] hover:text-black transition-all rounded-full backdrop-blur-md"
                    >
                        {'>'}
                    </button>

                    {/* --- CONTENEDOR DE SCROLL HORIZONTAL --- */}
                    <div
                        ref={scrollContainerRef}
                        className="w-full h-full flex items-center gap-6 overflow-x-auto px-6 md:px-16 snap-x snap-mandatory no-scrollbar py-8"
                        style={{
                            scrollBehavior: 'smooth',
                            WebkitOverflowScrolling: 'touch',
                            transform: 'translateZ(0)',
                            backfaceVisibility: 'hidden'
                        }}
                    >
                        {historiasConEstado.map((historia, index) => {
                            const imagenFondo = historia.id_imagen_historia
                                ? imagenesMap.get(historia.id_imagen_historia) || null
                                : null;

                            const isCompleted = historiasVisitadas.includes(historia.id_historia);



                            return (

                                <div
                                    key={historia.id_historia}
                                    className={`
                                            relative shrink-0 snap-center
                                            
                                            /* MÓVIL: 85% del alto visible real del dispositivo */
                                            w-[85vw] h-[66dvh]
                                            
                                            /* ESCRITORIO */
                                            md:w-[300px] md:h-[500px]

                                            border-2 bg-black overflow-hidden flex flex-col transition-all duration-300
                                       
                                        `}
                                    onClick={handleHistoriaClickFactory(historia)}
                                >
                                    {/* 1. IMAGEN FULL (Fondo) */}
                                    <div className="absolute inset-0 w-full h-full z-0">
                                        {imagenFondo ? (
                                            <img
                                                src={imagenFondo}
                                                alt={historia.titulo}
                                                className="w-full h-full object-cover"
                                                loading="lazy"
                                                decoding="async"
                                            />
                                        ) : (
                                            <div className="w-full h-full bg-[#111] flex items-center justify-center">
                                                <span className="text-[#33ff00]/20 font-bold">NO_SIGNAL</span>
                                            </div>
                                        )}
                                        {/* Overlay de ruido */}
                                        <div className="absolute inset-0 opacity-20" style={{
                                            backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.03) 2px, rgba(255,255,255,0.03) 4px)'
                                        }}></div>
                                        {/* GRADIENTE DE LEGIBILIDAD (Crucial) */}
                                        {/* Empieza transparente arriba y se vuelve negro sólido abajo para el texto */}
                                        <div className="absolute inset-0 bg-gradient-to-t from-black to-transparent"></div>
                                    </div>

                                    {/* 2. BADGES SUPERIORES */}
                                    <div className="absolute top-4 left-4 right-4 flex justify-between z-20 pointer-events-none">
                                        <span className="bg-black/80 border border-[#33ff00]/50 text-[#33ff00] text-[10px] px-2 py-1 uppercase font-bold backdrop-blur-md">
                                            {t.sec_prefix}0{index + 1}
                                        </span>
                                        {isCompleted && (
                                            <span className="bg-[#33ff00] text-black text-[10px] px-2 py-1 font-bold uppercase animate-pulse shadow-[0_0_10px_#33ff00]">
                                                {t.completed}
                                            </span>
                                        )}
                                        {historia.isLocked && (
                                            <span className="bg-red-600 text-white text-[10px] px-2 py-1 font-bold uppercase flex items-center gap-2">
                                                🔒 {t.locked}
                                            </span>
                                        )}
                                    </div>

                                    {/* 3. CONTENIDO DE TEXTO (Overlay Inferior) */}
                                    <div className="absolute bottom-0 left-0 right-0 p-6 z-20 flex flex-col">

                                        {/* Título */}
                                        <h2 className={`text-2xl md:text-3xl font-bold mb-2 uppercase tracking-tighter leading-none drop-shadow-xl ${historia.isLocked ? 'text-red-500' : 'text-white'}`}>
                                            {getLocalizedContent(historia, 'titulo', language)}
                                        </h2>

                                        {/* Línea Separadora */}
                                        <div className={`h-[2px] w-12 mb-3 ${historia.isLocked ? 'bg-red-900' : 'bg-[#33ff00]'}`}></div>

                                        {/* Descripción */}
                                        <p className="text-sm text-gray-300 font-sans leading-relaxed line-clamp-3 mb-4 drop-shadow-md">
                                            {getLocalizedContent(historia, 'narrativa', language)}
                                        </p>

                                        {/* Mensaje de Bloqueo */}
                                        {historia.isLocked && historia.id_historia_dependencia && (
                                            <div className="mb-3 text-[10px] text-red-400 font-mono border border-red-900/50 p-2 bg-red-900/20">
                                                ⚠️ {t.req} {getLocalizedContent(historias.find(h => h.id_historia === historia.id_historia_dependencia), 'titulo', language)}
                                            </div>
                                        )}

                                        {/* Botones */}
                                        {!historia.isLocked && (
                                            <div className="flex gap-3 pt-2">
                                                <button className="flex-1 bg-[#33ff00]/10 border border-[#33ff00] text-[#33ff00] py-3 px-4 text-xs font-bold uppercase tracking-widest hover:bg-[#33ff00] hover:text-black transition-all flex justify-between items-center group/btn">
                                                    <span>{t.execute}</span>
                                                    <span className="group-hover/btn:translate-x-1 transition-transform">{'>>'}</span>
                                                </button>

                                                <button
                                                    className="w-12 flex items-center justify-center border border-[#33ff00]/50 text-[#33ff00] hover:bg-[#33ff00] hover:text-black transition-all disabled:opacity-50"
                                                    onClick={(e) => handleToggleFavorite(historia.id_historia, e)}
                                                    disabled={favoritingHistoriaId === historia.id_historia}
                                                    title={playerStats?.historias_favoritas?.includes(String(historia.id_historia)) ? t.remove_fav : t.add_fav}
                                                >
                                                    {favoritingHistoriaId === historia.id_historia ? '...' : (playerStats?.historias_favoritas?.includes(String(historia.id_historia)) ? '♥' : '♡')}
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}

                        {/* Espacio extra al final para que la última carta no quede pegada */}
                        <div className="w-4 shrink-0"></div>
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
                        onEnded={() => {
                            // SIEMPRE llamar handleNextStep - la función ya maneja casos de final con siguiente historia
                            handleNextStep(currentStep.id_siguiente_paso);
                        }}
                    />
                )}

                {/* CAMBIO CLAVE para avance automático */}
                {recursoActual?.tipo === 'video' && (
                    <video ref={videoRef} key={mediaSrc} src={mediaSrc} autoPlay onEnded={() => {
                        // SIEMPRE llamar handleNextStep - la función ya maneja casos de final con siguiente historia
                        handleNextStep(currentStep.id_siguiente_paso);
                    }}>{subtitleUrl && subtitlesEnabled && (<track kind="subtitles" src={subtitleUrl} srcLang="en" label="English" default />)}</video>
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



            {/*-- BOTTOM HUD BAR --*/}
            {/* 1. BOTÓN RESTAURAR (Solo si está oculta) */}
            {!showBottomBar && (
                <button
                    onClick={() => setShowBottomBar(true)}
                    className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50 
                    bg-black/90 border border-[#33ff00] text-[#33ff00] 
                    w-10 h-10 flex items-center justify-center rounded-full shadow-[0_0_15px_rgba(51,255,0,0.4)] 
                    hover:bg-[#33ff00] hover:text-black transition-all animate-in slide-in-from-bottom-10"
                    title="Abrir HUD"
                >
                    ▲
                </button>
            )}

            {/* 2. BARRA INFERIOR COMPACTA */}
            {playerStats && (
                <div
                    id="bottomBar"
                    className={`
                        fixed bottom-4 left-1/2 transform -translate-x-1/2 z-40
                        w-[95%] md:w-auto max-w-4xl transition-all duration-500 ease-in-out
                        ${!showBottomBar ? 'translate-y-[200%] opacity-0 pointer-events-none' : 'translate-y-0 opacity-100 pointer-events-auto'}
                    `}
                >
                    <div className="bg-black/95 backdrop-blur-md border border-[#33ff00] shadow-[0_0_15px_rgba(51,255,0,0.2)] flex items-stretch rounded-sm overflow-visible h-12">

                        {/* A. SECCIÓN FIJA IZQUIERDA (Controles Sistema + Stats) */}
                        <div className="flex flex-shrink-0 border-r border-[#33ff00]/30 bg-black/60">

                            {/* Minimizar */}

                            <button
                                className="w-8 hover:bg-[#33ff00] text-[#33ff00] hover:text-black transition-colors flex items-center justify-center font-bold text-xs border-r border-[#33ff00]/20"
                                onClick={() => setShowBottomBar(false)}
                            >
                                ▼
                            </button>
                            {/* Subtítulos */}
                            {recursoActual?.tipo === 'video' && (
                                <button
                                    className={`w-10 hover:bg-[#33ff00] hover:text-black transition-colors flex items-center justify-center font-bold text-xs border-r border-[#33ff00]/20 ${subtitlesEnabled ? 'text-[#33ff00]' : 'text-gray-500'}`}
                                    onClick={() => setSubtitlesEnabled(!subtitlesEnabled)}
                                    title={subtitlesEnabled ? 'Desactivar Subtítulos' : 'Activar Subtítulos'}
                                >
                                    CC
                                </button>
                            )}

                            {/* Fullscreen (Movido aquí) */}
                            <button
                                className="w-8 hover:bg-[#33ff00] text-white hover:text-black transition-colors flex items-center justify-center text-sm border-r border-[#33ff00]/20"
                                onClick={toggleFullscreen}
                                title="Pantalla Completa"
                            >
                                {isFullscreen ? '⇲' : '⛶'}
                            </button>


                            {/* XP Compacto */}
                            <div className="flex flex-col justify-center px-3 min-w-[60px] text-center">
                                <span className="text-[8px] text-[#33ff00] tracking-wider leading-none mb-0.5">XP</span>
                                <span className="text-white font-mono text-xs font-bold leading-none">{playerStats.xp_total}</span>
                            </div>

                            {/* Nodos (Solo 3D) */}
                            {is3DModel && (
                                <div className="flex flex-col justify-center px-3 border-l border-[#33ff00]/20 min-w-[60px] text-center animate-in fade-in">
                                    <span className="text-[8px] text-[#33ff00] tracking-wider leading-none mb-0.5">{t.nodes}</span>
                                    <span className="text-white font-mono text-xs font-bold leading-none">
                                        {discoveredHotspots}/{totalHotspotsRef.current}
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* B. SECCIÓN DERECHA SCROLLABLE (Herramientas) */}
                        <div className="flex overflow-x-auto no-scrollbar flex-grow items-stretch">

                            {/* Item Generador (Mapa, Inv, Crew, Logs) */}
                            {[
                                { icon: '🗺️', label: t.map, action: handleOpenMap },
                                { icon: '📦', label: t.inv, action: () => setShowInventory(true), badge: playerStats.inventario?.length },
                                { icon: '👥', label: t.crew, action: () => setShowCharacters(true), badge: playerStats.personajes_conocidos?.length },
                                { icon: '📚', label: t.logs, action: () => setShowStories(true), badge: playerStats.historias_visitadas?.length }
                            ].map((btn, idx) => (
                                <div
                                    key={idx}
                                    className="group relative flex flex-col items-center justify-center px-3 cursor-pointer hover:bg-[#33ff00]/10 transition-all border-r border-[#33ff00]/10 min-w-[55px] flex-shrink-0"
                                    onClick={btn.action}
                                >
                                    {/* Badge si existe */}
                                    {btn.badge ? (
                                        <span className="absolute top-1 right-1 bg-[#33ff00] text-black text-[8px] font-bold px-1 rounded-[2px] leading-tight">
                                            {btn.badge}
                                        </span>
                                    ) : null}

                                    <span className="text-base mb-0.5 grayscale group-hover:grayscale-0 transition-all">{btn.icon}</span>
                                    <span className="text-[8px] text-[#33ff00] font-mono tracking-wider group-hover:text-white">{btn.label}</span>
                                </div>
                            ))}

                            {/* --- CONTROLES 3D (Audio y Cámara) --- */}

                            {/* Audio Control */}
                            {is3DModel && backgroundMusicUrl && (
                                <div className="relative flex flex-col items-center justify-center px-3 cursor-pointer hover:bg-[#33ff00]/10 transition-all border-r border-[#33ff00]/10 min-w-[55px] flex-shrink-0 group">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setShowVolumeControl(!showVolumeControl);
                                            setShowHeightControl(false);
                                        }}
                                        className="flex flex-col items-center w-full h-full justify-center outline-none"
                                    >
                                        <span className={`text-base mb-0.5 transition-colors ${showVolumeControl ? 'text-[#33ff00]' : 'text-gray-400 group-hover:text-white'}`}>🔊</span>
                                        <span className="text-[8px] text-[#33ff00] font-mono tracking-wider">{t.vol}</span>
                                    </button>

                                    {/* Slider Popup */}
                                    {showVolumeControl && (
                                        <div className="fixed bottom-16 left-1/2 transform -translate-x-1/2 z-[100] bg-black border border-[#33ff00] shadow-[0_0_30px_rgba(51,255,0,0.5)] w-[50px] h-[160px] flex flex-col items-center rounded-sm animate-in slide-in-from-bottom-2">
                                            {/* Header con Cerrar */}
                                            <div className="w-full flex justify-center border-b border-[#33ff00]/30 py-1 mb-2 bg-[#33ff00]/10 cursor-pointer hover:bg-red-900/50 group/close" onClick={() => setShowVolumeControl(false)}>
                                                <span className="text-[10px] text-[#33ff00] group-hover/close:text-red-500">▼</span>
                                            </div>

                                            {/* Slider Wrapper */}
                                            <div className="h-[90px] flex items-center justify-center w-full">
                                                <input
                                                    type="range"
                                                    min="0"
                                                    max="1"
                                                    step="0.1"
                                                    value={backgroundMusicVolume}
                                                    onChange={(e) => setBackgroundMusicVolume(parseFloat(e.target.value))}
                                                    className="h-[80px] w-1.5 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-[#33ff00]"
                                                    style={{ writingMode: 'vertical-lr', direction: 'rtl', WebkitAppearance: 'slider-vertical' }}
                                                />
                                            </div>
                                            <span className="text-[9px] text-white font-mono mt-2">{Math.round(backgroundMusicVolume * 100)}%</span>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Camara Control */}
                            {is3DModel && (
                                <div className="relative flex flex-col items-center justify-center px-3 cursor-pointer hover:bg-[#33ff00]/10 transition-all min-w-[55px] flex-shrink-0 group">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setShowHeightControl(!showHeightControl);
                                            setShowVolumeControl(false);
                                        }}
                                        className="flex flex-col items-center w-full h-full justify-center outline-none"
                                    >
                                        <span className={`text-base mb-0.5 transition-colors ${showHeightControl ? 'text-[#33ff00]' : 'text-gray-400 group-hover:text-white'}`}>📷</span>
                                        <span className="text-[8px] text-[#33ff00] font-mono tracking-wider">{t.cam}</span>
                                    </button>

                                    {/* Slider Popup */}
                                    {showHeightControl && (
                                        <div className="fixed bottom-16 left-1/2 transform -translate-x-1/2 z-[100] bg-black border border-[#33ff00] shadow-[0_0_30px_rgba(51,255,0,0.5)] w-[50px] h-[160px] flex flex-col items-center rounded-sm animate-in slide-in-from-bottom-2">
                                            {/* Header con Cerrar */}
                                            <div className="w-full flex justify-center border-b border-[#33ff00]/30 py-1 mb-2 bg-[#33ff00]/10 cursor-pointer hover:bg-red-900/50 group/close" onClick={() => setShowHeightControl(false)}>
                                                <span className="text-[10px] text-[#33ff00] group-hover/close:text-red-500">▼</span>
                                            </div>

                                            {/* Slider Wrapper */}
                                            <div className="h-[90px] flex items-center justify-center w-full">
                                                <input
                                                    type="range"
                                                    min="-3"
                                                    max="2"
                                                    step="0.1"
                                                    value={cameraHeight}
                                                    onChange={(e) => setCameraHeight(parseFloat(e.target.value))}
                                                    className="h-[80px] w-1.5 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-[#33ff00]"
                                                    style={{ writingMode: 'vertical-lr', direction: 'rtl', WebkitAppearance: 'slider-vertical' }}
                                                />
                                            </div>
                                            <span className="text-[9px] text-white font-mono mt-2">{cameraHeight.toFixed(1)}m</span>
                                        </div>
                                    )}
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
                        ${showInitial3DPopup ? 'opacity-0 pointer-events-none' : 'opacity-100 pointer-events-auto'}
                        ${showBottomBar ? 'bottom-20' : 'bottom-4'} /* Dinámico: Sube si hay barra, baja si no */
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
                                    onCanPlay={(e) => handleMediaAutoplay(e.currentTarget)}
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
                                    onCanPlay={(e) => handleMediaAutoplay(e.currentTarget)}
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
                            <span className="animate-pulse">_</span> {t.res_storage}
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
                            <span>{t.capacity}</span>
                            <span>{t.items_label}: {playerStats?.inventario?.length || 0}</span>
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
                                    [ ! ] {t.empty_storage}
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
                                <span className="animate-pulse">_</span> {t.db_crew}
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
                                    {'>'} {t.select_subj}
                                </p>
                                <span className="text-[9px] bg-[#33ff00]/10 text-[#33ff00] px-1 rounded">
                                    {t.total}: {playerStats?.personajes_conocidos?.length || 0}
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
                                                        {t.view_file} ↗
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
                                        [ ! ] {t.no_records}
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
                            <span className="animate-pulse">_</span> {t.mission_logs}
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
                            <span>{'<<'} {t.return_hub_btn}</span>
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
                                                    {getLocalizedContent(story, 'titulo', language)}
                                                </p>
                                                <span className="text-[9px] bg-[#33ff00]/20 text-[#33ff00] px-1.5 py-0.5 rounded-sm">
                                                    FILE_{storyId}
                                                </span>
                                            </div>
                                            <p className="text-xs text-gray-400 group-hover:text-gray-300">{getLocalizedContent(story, 'descripcion', language)}</p>
                                        </div>
                                    ) : null;
                                })
                            ) : (
                                <div className="text-center py-10 border border-dashed border-[#33ff00]/30 text-gray-500 text-sm">
                                    <p className="mb-2 text-2xl opacity-50">📂</p>
                                    [ ! ] {t.no_data_logs}
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
                                    {t.file_title} {getLocalizedContent(selectedCharacterForModal, 'nombre', language)}
                                </h2>
                                <p className="text-[9px] text-[#33ff00]/60 mt-1">{t.access_lvl}</p>
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
                                    {'>'} {t.psych_profile}
                                </h4>
                                <p className="text-sm text-gray-300 leading-relaxed font-sans">
                                    {getLocalizedContent(selectedCharacterForModal, 'descripcion', language)}
                                </p>
                            </div>

                            {/* SECCIÓN 3: METADATOS (GRID TÉCNICA) */}
                            {selectedCharacterForModal.metadata && (
                                <div>
                                    <h4 className="text-[#33ff00] text-xs font-bold uppercase tracking-wider mb-3 border-b border-[#33ff00]/20 pb-1">
                                        {'>'} {t.tech_attr}
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
                                <span>{t.close_btn}</span>
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