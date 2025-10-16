import 'aframe';
import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { gameServiceUser, PlayerStats } from '../services/GameServiceUser';

// Define las interfaces para tipar los datos
interface RecursoMultimediaData {
    id_recurso: number;
    tipo: 'imagen' | 'video' | 'audio' | 'transcripcion' | 'subtitulo' | 'interactive' | '3d_model';
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
}

interface RecompensaData {
    id_recompensa: number;
    nombre: string;
    valor: number;
    descripcion: string | null;
}

interface PersonajeData {
    id_personaje: number;
    nombre: string;
}

// Nueva interfaz para definir un Hotspot de Interacción
interface HotspotConfig {
    meshName: string; // El nombre de la malla dentro del GLB (ej: 'bidek')
    contentType: 'imagen' | 'video' | 'audio' | 'interactive'; // Tipo de contenido
    title: string;
    url: string; // URL del contenido (imagen, video, audio)
    recompensaId?: number; // Opcional: Recompensa asociada
    personajeId?: number; // Opcional: Personaje a conocer
    position?: {  // Opcional: Posición específica del hotspot
        x: number;
        y: number;
        z: number;
    };
    backgroundMusic?: string; // Opcional: URL del audio de fondo para el modelo 3D
}

const FlujoNarrativoUsuario: React.FC<{ onBack: () => void }> = ({ onBack }) => {
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
    
    const [showInventory, setShowInventory] = useState(false);
    const [showCharacters, setShowCharacters] = useState(false);
    const [showStories, setShowStories] = useState(false);
    const [lockedHistoryModal, setLockedHistoryModal] = useState<{ historia: HistoriaData, historiaMadre: HistoriaData } | null>(null);

    const [hotspotModal, setHotspotModal] = useState<HotspotConfig | null>(null);
    const [discoveredHotspots, setDiscoveredHotspots] = useState<number>(0);
    const totalHotspotsRef = useRef<number>(0);
    const discoveredHotspotIds = useRef<Set<string>>(new Set());
    
    const aframeContainerRef = useRef<HTMLDivElement>(null);

    const { user, loading: authLoading } = useAuth();

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
    
    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth < 768);
        };
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

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
                        init: function() {
                            const self = this;
                            const allHotspotConfigs = JSON.parse(this.data.hotspotData);
                            // Filtrar hotspots de tipo backgroundMusic
                            const hotspotConfigs = allHotspotConfigs.filter(h => h.contentType !== 'backgroundMusic');
                            
                            this.el.addEventListener('model-loaded', () => {
                                const obj = self.el.getObject3D('mesh');
                                if (!obj) return;
                                
                                // Recorrer todos los objetos del modelo
                                obj.traverse((child) => {
                                    if (child.isMesh) {
                                        // Buscar configuración del hotspot
                                        const config = hotspotConfigs.find(c => c.meshName === child.name);
                                        if (config) {
                                            child.userData.isHotspot = true;
                                            child.userData.hotspotConfig = config;
                                            child.userData.originalMaterial = child.material.clone();
                                            child.userData.isClicked = false;
                                            console.log('✅ Hotspot configurado en mesh:', child.name);
                                        }
                                    }
                                });
                                
                                console.log('✅ Interacción configurada en modelo GLB');
                            });
                        },
                        tick: function() {
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

    const handleHistoriaSelect = (historiaId: number) => {
        // Detener música de fondo al cambiar de historia
        if (backgroundAudioRef.current) {
            backgroundAudioRef.current.pause();
            backgroundAudioRef.current = null;
        }
        setBackgroundMusicUrl(null);
        
        setSelectedHistoriaId(historiaId);
        setCurrentStepIndex(0);
        setShowStepContent(false);
        setShowEndMessage(false);
    };

    // Función que maneja la apertura del modal de hotspot
    const handleHotspotClick = async (hotspot: HotspotConfig) => {
        if (!discoveredHotspotIds.current.has(hotspot.meshName)) {
            discoveredHotspotIds.current.add(hotspot.meshName);
            setDiscoveredHotspots(prev => prev + 1);

            if (hotspot.recompensaId) {
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
            backgroundAudioRef.current.pause();
        }

        // Mostrar el modal
        setHotspotModal(hotspot);
        setIsHotspotModalOpen(true);
        
        // Reproducir un sonido de click simulado
        new Audio('https://cdn.aframe.io/360-image-gallery-boilerplate/audio/click.ogg').play().catch(e => console.error("Error al reproducir audio:", e));
    };

    // Función para cerrar el modal de hotspot
    const closeHotspotModal = () => {
        setHotspotModal(null);
        setIsHotspotModalOpen(false);
        
        // Reanudar música de fondo al cerrar hotspot
        if (backgroundAudioRef.current && backgroundAudioRef.current.paused) {
            backgroundAudioRef.current.play().catch(e => console.error("Error al reanudar audio de fondo:", e));
        }
    };

    // Función de manejo de audio para el video/audio del modal (para evitar problemas de autoplay)
    const handleMediaAutoplay = (element: HTMLMediaElement) => {
        element.play().catch(e => console.error("Error al intentar autoplay de media:", e));
    };

    const handleAudioPlay = () => {
        if (audioRef.current) {
            audioRef.current.play().catch(e => console.error("Error al reproducir audio:", e));
        }
        setShowAudioOverlay(false);
    };
    
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
            width: 91%;
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

    useEffect(() => {
        const fetchHistorias = async () => {
            try {
                const { data, error } = await gameServiceUser.fetchHistorias();
                if (error) throw error;
                setHistorias(data || []);
                
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

    }, [selectedHistoriaId, user, authLoading]);
    
    useEffect(() => {
        const currentStep = flujoData[currentStepIndex];
        if (!currentStep) return;

        const recursoActual = getRecurso(currentStep.recursomultimedia_id);
        const isVideo = recursoActual?.tipo === 'video';
        const isAudio = recursoActual?.tipo === 'audio';
        const is3DModel = recursoActual?.tipo === '3d_model';

        // Oculta el contenido del paso al iniciar la carga o reproducción
        setShowStepContent(false);
        // Asegúrate de resetear el pop-up inicial cada vez que cambias de paso
        setShowInitial3DPopup(false);

        // Detener música de fondo si no es un modelo 3D
        if (!is3DModel) {
            if (backgroundAudioRef.current) {
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

    }, [currentStepIndex, flujoData, recursosData]);
    
    // useEffect para manejar la música de fondo
    useEffect(() => {
        if (backgroundMusicUrl && !isHotspotModalOpen) {
            if (!backgroundAudioRef.current) {
                backgroundAudioRef.current = new Audio(backgroundMusicUrl);
                backgroundAudioRef.current.loop = true;
                backgroundAudioRef.current.volume = backgroundMusicVolume;
            }
            
            backgroundAudioRef.current.play().catch(e => console.error("Error al reproducir música de fondo:", e));
            
            return () => {
                if (backgroundAudioRef.current) {
                    backgroundAudioRef.current.pause();
                    backgroundAudioRef.current = null;
                }
            };
        }
    }, [backgroundMusicUrl, isHotspotModalOpen]);
    
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
    }, [selectedHistoriaId, handleHotspotClick]);

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

 
   
    const getRecurso = (recursoId: number | null) => {
        if (!recursoId) return null;
        return recursosData.find(r => r.id_recurso === recursoId);
    };

    const handleNextStep = async (nextStepId: number | null) => {
        const currentStep = flujoData[currentStepIndex];

        if (currentStep.id_recompensa !== null) {
            const recompensa = recompensasData.find(r => r.id_recompensa === currentStep.id_recompensa);
            if (recompensa) {
                const message = `¡Has ganado ${recompensa.valor} XP por '${recompensa.nombre}'!`;
                setNotification(message);
                setTimeout(() => setNotification(null), 5000);
                // La función otorgarRecompensa espera historiaId como STRING
                await gameServiceUser.otorgarRecompensa(user?.id as string, recompensa.id_recompensa, String(selectedHistoriaId));
                await fetchPlayerStats();
            }
        }

        if (currentStep.id_personaje !== null) {
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

        if (!user || nextStepId === null) {
            setShowEndMessage(true);
            return;
        }

        // Para tipo_paso 'final', completar la historia actual
        if (currentStep.tipo_paso === 'final' && selectedHistoriaId !== null) {
            console.log('=== DEBUG: PASO FINAL ===');
            console.log('Tipo de paso:', currentStep.tipo_paso);
            console.log('Historia actual ID:', selectedHistoriaId);
            console.log('Historia actual ID (tipo):', typeof selectedHistoriaId);
            console.log('ID siguiente paso:', currentStep.id_siguiente_paso);
            console.log('Paso completo:', JSON.stringify(currentStep, null, 2));
            
            // La función completeStory espera un STRING
            const { error } = await gameServiceUser.completeStory(user.id, String(selectedHistoriaId));
            if (!error) {
                console.log(`✅ Historia ${selectedHistoriaId} completada para el usuario ${user.id}`);
            } else {
                console.error('❌ Error completando historia:', error);
            }

            // Si hay id_siguiente_paso, es el ID de la siguiente historia
            // Para tipo 'final', interpretamos id_siguiente_paso como el ID de la siguiente historia
            if (currentStep.id_siguiente_paso) {
                const siguienteHistoriaId = currentStep.id_siguiente_paso;
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
                setShowEndMessage(false);
                console.log('=========================');
                return;
            } else {
                console.log('📚 No hay siguiente historia. Mostrando mensaje final.');
                console.log('=========================');
                setShowEndMessage(true);
                return;
            }
        }
        
        // Para tipo_paso 'app', marcar como visitada al cerrar
        if (currentStep.tipo_paso === 'app' && selectedHistoriaId !== null && user) {
            console.log('=== DEBUG: PASO APP ===');
            console.log('Historia ID:', selectedHistoriaId, '(tipo:', typeof selectedHistoriaId, ')');
            
            // La función completeStory espera un STRING
            const { error } = await gameServiceUser.completeStory(user.id, String(selectedHistoriaId));
            if (!error) {
                console.log(`✅ Historia ${selectedHistoriaId} con app completada para el usuario ${user.id}`);
            } else {
                console.error('❌ Error completando historia con app:', error);
            }
            console.log('=======================');
            
            // Volver al menú de historias
            setSelectedHistoriaId(null);
            setCurrentStepIndex(0);
            return;
        }
        
        setShowStepContent(false);
        const nextIndex = flujoData.findIndex(p => p.id_flujo === nextStepId);
        if (nextIndex !== -1) {
            setCurrentStepIndex(nextIndex);
        } else {
            setShowEndMessage(true);
        }
    };
    
    const goBack = () => {
      if(currentStepIndex > 0) {
        setShowStepContent(false);
        setCurrentStepIndex(currentStepIndex - 1);
      }
    };

    const goNext = () => {
      if(currentStepIndex < flujoData.length - 1) {
        setShowStepContent(false);
        setCurrentStepIndex(currentStepIndex + 1);
      }
    };

    const fetchPlayerStats = async () => {
        if (!user) return;
        try {
            const stats = await gameServiceUser.getPlayerStats(user.id);
            setPlayerStats(stats);
            console.log("Estadísticas del jugador cargadas:", stats);
        } catch (error) {
            console.error("Error al refrescar las estadísticas del jugador:", error);
            setPlayerStats({
                resistencia: 0,
                inventario: [],
                personajes_conocidos: [],
                historias_visitadas: [],
            } as PlayerStats);
        }
    };

    const renderStepContent = () => {
        const step = flujoData[currentStepIndex];
        
        // Si no hay paso, no renderizar nada
        if (!step) return null;
        
        // --- Lógica para Tipo APP (NUEVO) ---
        if (step.tipo_paso === 'app') {
            const appUrl = step.app_url || '';
            return (
                <div className="fixed inset-0 z-50 bg-black">
                    <button
                        className="absolute top-4 right-4 z-[100] bg-red-600 hover:bg-red-700 text-white w-12 h-12 rounded-full flex items-center justify-center text-2xl font-bold shadow-2xl transition-all duration-300"
                        onClick={() => handleNextStep(null)}
                        title="Cerrar App"
                    >
                        ×
                    </button>
                    <iframe
                        src={appUrl}
                        className="w-full h-full border-0"
                        title="App Interactiva"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                    />
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
        else if (step.tipo_paso === 'narrativo' ) {

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
                <button
                    className="absolute top-4 right-4 bg-purple-600 hover:bg-purple-700 text-white py-2 px-4 rounded-lg transition-all duration-300 z-40 font-semibold text-sm shadow-lg"
                    onClick={onBack}
                >
                    ← Volver al Dashboard
                </button>
                <div className="max-w-7xl mx-auto mt-20">
                    <h1 className="text-5xl font-bold text-center mb-4 bg-gradient-to-r from-purple-400 to-pink-600 bg-clip-text text-transparent">Selecciona tu Aventura</h1>
                    <p className="text-center text-gray-400 mb-12">Explora mundos increíbles y desbloquea nuevas historias</p>
                    
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
                                    className={`relative rounded-xl overflow-hidden transition-all duration-500 transform ${
                                        historia.isLocked 
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

    const currentStep = flujoData[currentStepIndex];
    if (!currentStep) {
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
                        onClick={onBack}
                    >
                        Finalizar y Volver
                    </button>
                </div>
            </div>
        );
    }

    const recursoActual = getRecurso(currentStep.recursomultimedia_id);
    const mediaSrc = recursoActual?.archivo || '';
    const isDecisionStep = currentStep.tipo_paso === 'pregunta' || (currentStep.opciones_decision?.opciones_siguientes_json && currentStep.opciones_decision.opciones_siguientes_json.length > 0);
    const hasNext = currentStepIndex < flujoData.length - 1;
    const hasPrevious = currentStepIndex > 0;
    const is3DModel = recursoActual?.tipo === '3d_model';

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
                        <a-scene embedded vr-mode-ui="enabled: true" renderer="antialias: true">
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
                            <div className="p-8 bg-gray-800 rounded-xl max-w-2xl w-full">
                                <p className="mb-6 text-xl text-white">¡Interactúa aquí para continuar la historia!</p>
                                <button className="bg-blue-600 text-white py-3 px-8 rounded-lg font-semibold hover:bg-blue-700 text-lg"
                                    onClick={() => alert('Lógica interactiva ejecutada!')}>
                                    Completar Interacción
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
            
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
            <div id="charactersModal" className="modal" style={{ display: showCharacters ? 'flex' : 'none' }}>
                <div className="modal-content">
                    <span className="close-button" onClick={() => setShowCharacters(false)}>&times;</span>
                    <h3 className="text-2xl font-bold mb-4">Personajes Conocidos</h3>
                    <div id="characterItems" className="max-h-80 overflow-y-auto">
                        {playerStats?.personajes_conocidos && playerStats.personajes_conocidos.length > 0 ? (
                            playerStats.personajes_conocidos.map((char, index) => (
                                <div key={index} className="list-item">
                                    <p className="font-bold">{typeof char === 'string' ? char : char.nombre}</p>
                                </div>
                            ))
                        ) : (
                            <p className="text-center text-gray-400">Aún no has conocido personajes.</p>
                        )}
                    </div>
                </div>
            </div>
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
                                setSelectedHistoriaId(null);
                                setCurrentStepIndex(0);
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