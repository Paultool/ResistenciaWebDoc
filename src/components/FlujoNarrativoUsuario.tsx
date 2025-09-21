import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { gameServiceUser, PlayerStats } from '../services/GameServiceUser';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';


// Define las interfaces para tipar los datos
interface RecursoMultimediaData {
    id_recurso: number;
    tipo: 'imagen' | 'video' | 'audio' | 'transcripcion' | 'subtitulo' | 'interactive' | '3d_model';
    archivo: string;
}

interface FlujoNarrativoData {
    id_flujo: number;
    orden: number;
    tipo_paso: 'narrativo' | 'pregunta' | 'final'  ;
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
}

interface HistoriaData {
    id_historia: number;
    titulo: string;
    descripcion: string;
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
    
    const mountRef = useRef<HTMLDivElement>(null);
    const sceneRef = useRef<THREE.Scene | null>(null);
    const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
    const modelRef = useRef<THREE.Object3D | null>(null);
    const controlsRef = useRef<OrbitControls | null>(null);
    const requestRef = useRef<number>();


    const handleHistoriaSelect = (historiaId: number) => {
        setSelectedHistoriaId(historiaId);
        setCurrentStepIndex(0);
        setShowStepContent(false);
        setShowEndMessage(false);
    };

    const { user, loading: authLoading } = useAuth();

    const threejsContainerRef = useRef<HTMLDivElement>(null);
    const threejsSceneRef = useRef<THREE.Scene | null>(null);
    const threejsCameraRef = useRef<THREE.PerspectiveCamera | null>(null);
    const threejsRendererRef = useRef<THREE.WebGLRenderer | null>(null);
    const threejsMeshRef = useRef<THREE.Mesh | null>(null);
    const threejsAnimationId = useRef<number | null>(null);

    
    const styles = `
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
        html, body {
            height: 100%;
            width: 100%;
            margin: 0;
            padding: 0;
            overflow: hidden;
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
            align-items: center;
            position: absolute;
            top: 0;
            left: 0;
            z-index: 10;
        }
        .full-media-container video, .full-media-container img {
            width: 100%;
            height: 100%;
            object-fit: cover;
        }
        #interactiveCanvas, #threejsCanvas, #audioVisualizerCanvas {
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
            z-index: 30;
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
        #threejsContainer {
            width: 100%;
            height: 100%;
        }

        
    `;

    useEffect(() => {
        const fetchHistorias = async () => {
            try {
                const { data, error } = await gameServiceUser.fetchHistorias();
                if (error) throw error;
                setHistorias(data || []);
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

        const cleanupThreeJS = () => {
            if (threejsAnimationId.current) {
                cancelAnimationFrame(threejsAnimationId.current);
                threejsAnimationId.current = null;
            }
            if (threejsRendererRef.current) {
                threejsRendererRef.current.dispose();
                const container = threejsContainerRef.current;
                if (container) {
                    container.innerHTML = '';
                }
            }
        };

        // Oculta el contenido del paso al iniciar la carga o reproducción
        setShowStepContent(false);

        if (isVideo) {
            // La visibilidad se maneja en el evento 'onEnded' del video
            if (videoRef.current) {
                videoRef.current.play().catch(e => console.error("Error al reproducir video:", e));
            }
        } else if (isAudio) {
            // La visibilidad se maneja en el evento 'onEnded' del audio
            if (audioRef.current) {
                audioRef.current.play().catch(e => console.error("Error al reproducir audio:", e));
            }
        }// Si el paso actual es un modelo 3D, inicializa Three.js
        if (is3DModel) {
            cleanupThreeJS(); // Limpia cualquier renderizador anterior antes de crear uno nuevo.
            setShowStepContent(false);

            const container = threejsContainerRef.current;
            if (!container) return;

            const width = container.clientWidth;
            const height = container.clientHeight;

            const scene = new THREE.Scene();
            const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
            const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
            
            renderer.setSize(width, height);
            container.appendChild(renderer.domElement);

            threejsSceneRef.current = scene;
            threejsCameraRef.current = camera;
            threejsRendererRef.current = renderer;
            
            // Añadir luces
            const ambientLight = new THREE.AmbientLight(0xffffff, 1);
            scene.add(ambientLight);
            const directionalLight = new THREE.DirectionalLight(0xffffff, 2);
            directionalLight.position.set(0, 5, 5);
            scene.add(directionalLight);

            // Posicionar la cámara
            camera.position.z = 2.5;

            // Cargar el modelo
            const loader = new GLTFLoader();
            loader.load(
                recursoActual.archivo,
                (gltf) => {
                    const model = gltf.scene;
                    const box = new THREE.Box3().setFromObject(model);
                    const center = box.getCenter(new THREE.Vector3());
                    model.position.sub(center);
                    scene.add(model);
                    threejsMeshRef.current = model;
                },
                (xhr) => {
                    console.log((xhr.loaded / xhr.total * 100) + '% cargado');
                },
                (error) => {
                    console.error('Error al cargar el modelo GLB:', error);
                    setShowStepContent(true);
                }
            );

            const animate = () => {
                if (threejsMeshRef.current) {
                    threejsMeshRef.current.rotation.y += 0.005;
                }
                if (threejsRendererRef.current && threejsCameraRef.current) {
                    threejsRendererRef.current.render(threejsSceneRef.current, threejsCameraRef.current);
                }
                threejsAnimationId.current = requestAnimationFrame(animate);
            };

            animate();
            
        } else {
            // Para otros tipos de pasos, el contenido puede mostrarse de inmediato
            cleanupThreeJS();
            setShowStepContent(true);
        }

        return cleanupThreeJS;
    }, [currentStepIndex, flujoData, recursosData]);
 
   
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
                await gameServiceUser.otorgarRecompensa(user?.id as string, recompensa.id_recompensa, selectedHistoriaId as number);
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

        if (currentStep.tipo_paso === 'final' && selectedHistoriaId !== null) {
            const { error } = await gameServiceUser.completeStory(user.id, selectedHistoriaId);
            if (!error) {
                console.log(`Historia ${selectedHistoriaId} completada para el usuario ${user.id}`);
            }

            if (currentStep.id_siguiente_paso) {
                setSelectedHistoriaId(currentStep.id_siguiente_paso);
                setCurrentStepIndex(0);
                setShowStepContent(false);
                setShowEndMessage(false);
            } else {
                setShowEndMessage(true);
            }
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
        const contentText = step.contenido || "";
        const isDecisionStep = step.tipo_paso === 'pregunta' || (step.opciones_decision?.opciones_siguientes_json && step.opciones_decision.opciones_siguientes_json.length > 0);

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
        } else if (step.tipo_paso === 'narrativo' ) {
            return (
                <div className={`
                    absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-30
                    w-[90%] max-w-[650px] bg-white bg-opacity-85 backdrop-blur-md text-gray-800 shadow-2xl
                    ${showStepContent ? 'visible opacity-100 p-10 rounded-xl' : 'opacity-0 pointer-events-none'}
                `}>
                    <p className="text-base leading-relaxed mb-6">{contentText}</p>
                    
                    <button
                        className="bg-blue-600 text-white py-4 px-6 rounded-lg font-semibold text-lg cursor-pointer
                        transition-all duration-300 ease-in-out hover:bg-blue-700 hover:scale-105"
                        onClick={() => handleNextStep(step.id_siguiente_paso as number)}
                    >
                        Siguiente →
                    </button>
                </div>
            );
        } else if (step.tipo_paso === 'final') {
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

        return (
            <div className="relative min-h-screen bg-black text-white p-8">
                <button
                    className="absolute top-8 right-8 bg-white bg-opacity-20 hover:bg-opacity-30 text-white py-2 px-4 rounded-full transition-all duration-300 z-40"
                    onClick={onBack}
                >
                    Volver al Dashboard
                </button>
                <div className="max-w-4xl mx-auto mt-20">
                    <h1 className="text-4xl font-bold text-center mb-8">Selecciona tu Aventura</h1>
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {historias.map(historia => (
                            <div
                                key={historia.id_historia}
                                className={`p-6 rounded-lg cursor-pointer transition-all duration-300 ease-in-out
                                ${historiasVisitadas.includes(historia.id_historia)
                                        ? 'bg-purple-800 bg-opacity-30'
                                        : 'bg-white bg-opacity-10 hover:bg-opacity-20 hover:scale-105'
                                    }`}
                                onClick={() => handleHistoriaSelect(historia.id_historia)}
                            >
                                <h2 className="text-2xl font-semibold">{historia.titulo}</h2>
                                <p className="text-sm mt-2 text-gray-300">{historia.descripcion}</p>
                            </div>
                        ))}
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

    return (
        <div className="relative min-h-screen bg-black text-white">
            <style>{styles}</style>
            
            <div className="full-media-container">
                {recursoActual?.tipo === 'video' && (
                    <video
                        key={mediaSrc}
                        ref={videoRef}
                        id="introVideo"
                        autoPlay
                        muted
                        playsInline
                        disablePictureInPicture
                        onContextMenu={() => false}
                        onEnded={() => setShowStepContent(true)}
                    >
                        <source src={mediaSrc} type="video/mp4" />
                    </video>
                )}
                {recursoActual?.tipo === 'imagen' && (
                    <img src={mediaSrc} alt="Fondo de la historia" className="w-full h-full object-cover" />
                )}
                {recursoActual?.tipo === 'audio' && (
                    <audio ref={audioRef} key={mediaSrc} src={mediaSrc} onEnded={() => setShowStepContent(true)}/>
                )}
                {recursoActual?.tipo === 'interactive' && (
                    <canvas id="interactiveCanvas"></canvas>
                )}
                {recursoActual?.tipo === '3d_model' && (
                   <div id="threejsContainer" ref={threejsContainerRef}></div>
                )}

               
            </div>

            {showAudioOverlay && (
                <div className="fixed inset-0 bg-black bg-opacity-70 flex flex-col justify-center items-center z-50">
                    <h2 className="text-xl md:text-3xl font-bold mb-4 text-center">
                        Toca para iniciar tu viaje...
                    </h2>
                    <p className="text-sm md:text-base text-gray-300 mb-8 text-center">
                        (El audio se reproducirá al continuar)
                    </p>
                    <button
                        onClick={handleAudioPlay}
                        className="bg-blue-600 text-white py-3 px-6 rounded-lg font-semibold text-lg cursor-pointer
                        transition-all duration-300 ease-in-out hover:bg-blue-700 hover:scale-105"
                    >
                        Tocar para continuar
                    </button>
                </div>
            )}
            
            <div className="absolute inset-0 bg-black opacity-40 z-20"></div>

            <button
                id="backButton"
                className={`nav-button left ${!isDecisionStep && hasPrevious ? 'visible' : ''}`}
                onClick={goBack}
            >
                &lt;
            </button>
            <button
                id="nextButton"
                className={`nav-button right ${!isDecisionStep && hasNext ? 'visible' : ''}`}
                onClick={goNext}
            >
                &gt;
            </button>

            <div id="stepContent" className="step-content">
                {renderStepContent()}
            </div>
            
            {playerStats && (
                <div id="bottomBar" className={`bottom-bar`}>
                    <div className="info-display">
                        <span className="text-2xl">💪</span>
                        <span id="resistanceValue">{playerStats.xp_total || 0}</span>
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
                            <span>📦</span>
                            <span id="inventoryCount">{playerStats.inventario?.length || 0}</span>
                        </div>
                        <div className="tool-icon" onClick={() => setShowCharacters(true)}>
                            <span>👥</span>
                            <span id="characterCount">{playerStats.personajes_conocidos?.length || 0}</span>
                        </div>
                        <div className="tool-icon" onClick={() => setShowStories(true)}>
                            <span>📚</span>
                            <span id="storyCount">{playerStats.historias_visitadas?.length || 0}</span>
                        </div>
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
        </div>
    );
};

export default FlujoNarrativoUsuario;