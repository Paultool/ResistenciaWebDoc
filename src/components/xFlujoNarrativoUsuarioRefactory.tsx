import 'aframe';
import React, { useState, useEffect, useRef, useCallback } from 'react'; 
import { useAuth } from '../contexts/AuthContext';
import { gameServiceUser, PlayerStats } from '../services/GameServiceUser';
import MapaView from './MapaView';
import { obtenerFichaPersonajePorId, Personaje } from '../supabaseClient'; 
import Scene3D from './Scene3D'; 
import { 
    HistoriaData, FlujoNarrativoData, RecursoMultimediaData, 
    RecompensaData, PersonajeData, HotspotConfig, PersonajeFicha 
} from './types';

interface FlujoNarrativoUsuarioProps {
    historiaId: number;
    onBack: () => void;
    onUpdateProfile: (recompensaPositiva: number, recompensaNegativa: number, ubicacion: string) => void; 
}

const FlujoNarrativoUsuario = ({ historiaId, onBack }: FlujoNarrativoUsuarioProps) => {    
    
    // --- ESTADOS ---
    const [historias, setHistorias] = useState<HistoriaData[]>([]);
    const [selectedHistoriaId, setSelectedHistoriaId] = useState<number | null>(null);
    const [flujoData, setFlujoData] = useState<FlujoNarrativoData[]>([]);
    const [recursosData, setRecursosData] = useState<RecursoMultimediaData[]>([]);
    const [recompensasData, setRecompensasData] = useState<RecompensaData[]>([]);
    const [personajesData, setPersonajesData] = useState<PersonajeData[]>([]);
    
    const [currentStepIndex, setCurrentStepIndex] = useState(0);
    const [showStepContent, setShowStepContent] = useState(false);
    const [loading, setLoading] = useState(true);
    const [showEndMessage, setShowEndMessage] = useState(false);
    const [notification, setNotification] = useState<string | null>(null);
    
    const [playerStats, setPlayerStats] = useState<PlayerStats | null>(null);
    const [historiasVisitadas, setHistoriasVisitadas] = useState<number[]>([]);
    const [isFullscreen, setIsFullscreen] = useState(false);
    
    // UI
    const [showBottomBar, setShowBottomBar] = useState(true);
    const [showInventory, setShowInventory] = useState(false);
    const [showCharacters, setShowCharacters] = useState(false);
    const [showStories, setShowStories] = useState(false);
    const [showMap, setShowMap] = useState(false);
    const [mapCenter, setMapCenter] = useState<[number, number]>([19.4326, -99.1332]);

    // Modales
    const [lockedHistoryModal, setLockedHistoryModal] = useState<any>(null);
    const [selectedCharacterForModal, setSelectedCharacterForModal] = useState<Personaje | null>(null);
    const [hotspotModal, setHotspotModal] = useState<HotspotConfig | null>(null);
    const [isHotspotModalOpen, setIsHotspotModalOpen] = useState(false);

    // 3D Logic
    const [discoveredHotspots, setDiscoveredHotspots] = useState<number>(0);
    const totalHotspotsRef = useRef<number>(0);
    const discoveredHotspotIds = useRef<Set<string>>(new Set());
    const [showInitial3DPopup, setShowInitial3DPopup] = useState(false);
    const [cameraHeight, setCameraHeight] = useState(-0.8);
    
    // AUDIO LOGIC (Variables Estrictas)
    const [backgroundMusicVolume, setBackgroundMusicVolume] = useState(0.4);
    const [backgroundMusicUrl, setBackgroundMusicUrl] = useState<string | null>(null);
    const [showVolumeControl, setShowVolumeControl] = useState(false);
    const [showHeightControl, setShowHeightControl] = useState(false);
    const backgroundAudioRef = useRef<HTMLAudioElement | null>(null);

    const iframeRef = useRef<HTMLIFrameElement>(null);
    const iframeAppRef = useRef<HTMLIFrameElement>(null);
    const { user } = useAuth();

    // ==================================================================
    // ESTILOS CSS (Z-INDEX ARREGLADO Y MODALES NEGROS)
    // ==================================================================
    const styles = `
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
        html, body { height: 100%; width: 100%; margin: 0; padding: 0; overflow: hidden; background: #000; font-family: 'Inter', sans-serif; }
        
        /* Contenedor Global Fijo */
        .app-container { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; z-index: 1; }
        
        /* Capa de Medios (Atrás) */
        .media-background { position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 0; }
        .full-cover { width: 100%; height: 100%; object-fit: cover; }
        
        /* UI Layer (Adelante) - Pointer events controlados */
        .ui-foreground { position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 100; pointer-events: none; }
        .ui-foreground > * { pointer-events: auto; } /* Reactivar click en hijos */

        /* Botones Superiores */
        .top-nav { position: absolute; top: 1rem; left: 1rem; display: flex; gap: 0.5rem; z-index: 200; }
        .nav-btn { background: rgba(0,0,0,0.7); color: white; padding: 0.5rem 1rem; border: 1px solid #4a5568; border-radius: 0.5rem; cursor: pointer; font-weight: bold; backdrop-filter: blur(5px); }
        .nav-btn:hover { background: #2d3748; border-color: #63b3ed; }

        /* Stats Derecha (3D) */
        .stats-panel { position: absolute; top: 1rem; right: 1rem; display: flex; flex-direction: column; align-items: flex-end; gap: 0.5rem; z-index: 200; }
        .stat-pill { background: rgba(0,0,0,0.8); color: white; padding: 0.3rem 0.8rem; border-radius: 999px; border: 1px solid #718096; font-size: 0.9rem; }
        .control-group { background: rgba(0,0,0,0.8); padding: 0.3rem; border-radius: 0.5rem; display: flex; align-items: center; gap: 0.5rem; border: 1px solid #4a5568; }

        /* Popup Central (Instrucciones/Texto) */
        .modal-center { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); background: rgba(20,20,20,0.95); padding: 2.5rem; border-radius: 1rem; text-align: center; width: 90%; max-width: 500px; box-shadow: 0 25px 50px rgba(0,0,0,0.9); border: 1px solid #4a5568; color: white; z-index: 500; }
        .action-btn { background: #3182ce; color: white; padding: 0.8rem 2rem; border-radius: 2rem; font-weight: bold; font-size: 1.1rem; margin-top: 1.5rem; transition: transform 0.2s; }
        .action-btn:hover { transform: scale(1.05); background: #2b6cb0; }

        /* Barra Inferior */
        .hud-bar { position: absolute; bottom: 0; left: 0; width: 100%; height: 70px; background: rgba(26, 32, 44, 0.95); display: flex; justify-content: space-between; align-items: center; padding: 0 1.5rem; border-top: 1px solid #4a5568; pointer-events: auto; z-index: 300; }
        .hud-icons { display: flex; gap: 1.5rem; font-size: 1.5rem; }
        .icon-btn { cursor: pointer; position: relative; transition: transform 0.2s; }
        .icon-btn:hover { transform: scale(1.15); color: #90cdf4; }
        
        /* Menú Tarjetas */
        .menu-wrapper { height: 100vh; overflow-y: auto; background: linear-gradient(to bottom, #1a202c 0%, #000000 100%); padding: 2rem; box-sizing: border-box; }
        .story-container { max-width: 1200px; margin: 0 auto; display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 2rem; padding-bottom: 3rem; }
        .story-card { position: relative; height: 380px; border-radius: 1rem; overflow: hidden; border: 2px solid #2d3748; transition: transform 0.3s, border-color 0.3s; cursor: default; }
        .story-card:hover { transform: translateY(-8px); border-color: #63b3ed; box-shadow: 0 10px 30px rgba(66, 153, 225, 0.3); }
        .story-text { position: absolute; bottom: 0; left: 0; width: 100%; background: linear-gradient(to top, rgba(0,0,0,1) 20%, rgba(0,0,0,0) 100%); padding: 1.5rem; box-sizing: border-box; }

        /* Modales (Pantalla completa negra) */
        .overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.9); z-index: 5000; display: flex; justify-content: center; align-items: center; backdrop-filter: blur(4px); }
        .modal-window { background: #171923; width: 90%; max-width: 600px; padding: 2rem; border-radius: 1rem; border: 1px solid #4a5568; max-height: 85vh; overflow-y: auto; position: relative; color: #e2e8f0; }
        .x-btn { position: absolute; top: 1rem; right: 1rem; font-size: 1.5rem; cursor: pointer; line-height: 1; padding: 0.5rem; }
        
        .list-row { padding: 1rem; border-bottom: 1px solid #2d3748; display: flex; justify-content: space-between; align-items: center; cursor: pointer; transition: background 0.2s; }
        .list-row:hover { background: #2d3748; }
        .list-row:last-child { border-bottom: none; }
    `;

    // ==================================================================
    // DATOS INICIALES
    // ==================================================================
    useEffect(() => {
        const fetchInit = async () => {
            try {
                const { data: h } = await gameServiceUser.fetchHistorias();
                const sorted = (h || []).sort((a: HistoriaData, b: HistoriaData) => (a.orden ?? 9999) - (b.orden ?? 9999));
                setHistorias(sorted);

                const { data: res } = await gameServiceUser.fetchMultimediaResources();
                setRecursosData(res || []);
                const { data: per } = await gameServiceUser.fetchCharacters();
                setPersonajesData(per || []);
                const { data: rew } = await gameServiceUser.fetchRewards();
                setRecompensasData(rew || []);

                if(user) await fetchPlayerStats();
            } catch (e) { console.error(e); } finally { setLoading(false); }
        };
        fetchInit();
    }, [user]);

    const fetchPlayerStats = async () => {
        if(!user) return;
        const s = await gameServiceUser.getPlayerStats(user.id);
        setPlayerStats(s);
        if(s?.historias_visitadas) {
            const arr = Array.isArray(s.historias_visitadas) ? s.historias_visitadas : String(s.historias_visitadas).split(',');
            setHistoriasVisitadas(arr.map((id: any) => parseInt(id)).filter((n: number) => !isNaN(n)));
        }
    };

    // ==================================================================
    // AUDIO CONTROLLER (CRUCIAL FIX)
    // ==================================================================
    
    // Función ejecutada SOLAMENTE al dar click en "Entendido"
    const initAudioAndPlay = () => {
        // 1. Validar URL
        if (!backgroundMusicUrl || backgroundMusicUrl.length < 5) return;

        // 2. Crear o Actualizar Referencia
        if (!backgroundAudioRef.current) {
            backgroundAudioRef.current = new Audio(backgroundMusicUrl);
            backgroundAudioRef.current.loop = true;
        } else {
            if (backgroundAudioRef.current.src !== backgroundMusicUrl) {
                backgroundAudioRef.current.src = backgroundMusicUrl;
            }
        }

        // 3. Configurar volumen
        backgroundAudioRef.current.volume = backgroundMusicVolume;

        // 4. CARGAR Y REPRODUCIR (Síncrono en evento click)
        // El .load() a veces ayuda en móviles/Edge para resetear buffer
        backgroundAudioRef.current.load();
        
        const promise = backgroundAudioRef.current.play();
        if (promise !== undefined) {
            promise
            .then(() => console.log("🔊 Audio playing successfully"))
            .catch(error => console.warn("🔇 Audio blocked:", error));
        }
    };

    // Efecto para actualizar volumen en tiempo real
    useEffect(() => {
        if(backgroundAudioRef.current) backgroundAudioRef.current.volume = backgroundMusicVolume;
    }, [backgroundMusicVolume]);

    // Efecto para pausar si se cierra la historia
    useEffect(() => {
        if(!selectedHistoriaId && backgroundAudioRef.current) {
            backgroundAudioRef.current.pause();
            backgroundAudioRef.current = null;
        }
    }, [selectedHistoriaId]);

    // ==================================================================
    // LOGICA PASOS
    // ==================================================================
    useEffect(() => {
        if(!selectedHistoriaId) return;
        setLoading(true);
        gameServiceUser.fetchNarrativeFlowByHistoriaId(selectedHistoriaId).then(({ data }) => {
            setFlujoData(data || []);
            setDiscoveredHotspots(0);
            totalHotspotsRef.current = 0;
            discoveredHotspotIds.current.clear();
            setLoading(false);
        });
    }, [selectedHistoriaId]);

    useEffect(() => {
        const step = flujoData[currentStepIndex];
        if(!step) return;
        const recurso = recursosData.find(r => r.id_recurso === step.recursomultimedia_id);
        
        setShowStepContent(false);
        setShowInitial3DPopup(false);

        if(recurso?.tipo === '3d_model' && recurso.metadatos) {
            try {
                const cfgs: HotspotConfig[] = JSON.parse(recurso.metadatos);
                // Config Audio
                const music = cfgs.find(c => c.contentType === 'backgroundMusic');
                setBackgroundMusicUrl(music?.url || null);

                // Config Hotspots (Excluyendo audio)
                const interactive = cfgs.filter(c => c.contentType !== 'backgroundMusic');
                totalHotspotsRef.current = interactive.length;
                
                setShowInitial3DPopup(true);
                setShowStepContent(true);
            } catch(e) { console.error("Error 3D JSON", e); }
        } else {
            // Si cambiamos de paso y NO es 3D, paramos la música anterior
            setBackgroundMusicUrl(null);
            if(backgroundAudioRef.current) backgroundAudioRef.current.pause();
            
            if(recurso?.tipo !== 'video' && recurso?.tipo !== 'audio') setShowStepContent(true);
        }
    }, [currentStepIndex, flujoData, recursosData]);

    // ==================================================================
    // HANDLERS
    // ==================================================================
    const handleHistoriaSelect = (id: number) => {
        setSelectedHistoriaId(id);
        setCurrentStepIndex(0);
        setShowEndMessage(false);
        setShowBottomBar(true);
        setDiscoveredHotspots(0);
    };

    const handleReturnToMenu = () => {
        setSelectedHistoriaId(null);
        setFlujoData([]);
        setCurrentStepIndex(0);
        setShowEndMessage(false);
        setDiscoveredHotspots(0);
        
        // Cerrar todos los modales
        setShowMap(false);
        setShowInventory(false);
        setShowCharacters(false);
        setShowStories(false);

        if(backgroundAudioRef.current) {
            backgroundAudioRef.current.pause();
            backgroundAudioRef.current = null;
        }
    };

    const handleNextStep = async (nextId: number | null) => {
        const step = flujoData[currentStepIndex];
        const res = recursosData.find(r => r.id_recurso === step.recursomultimedia_id);
        
        // Validacion 3D estricta
        if(res?.tipo === '3d_model' && discoveredHotspots < totalHotspotsRef.current) {
            setNotification(`⚠️ Faltan ${totalHotspotsRef.current - discoveredHotspots} puntos por descubrir.`);
            setTimeout(()=>setNotification(null), 3000);
            return;
        }

        if(!nextId) {
            if(user && selectedHistoriaId) {
                await gameServiceUser.completeStory(user.id, String(selectedHistoriaId));
                await fetchPlayerStats();
            }
            setShowEndMessage(true);
        } else {
            const idx = flujoData.findIndex(f => f.id_flujo === nextId);
            if(idx !== -1) setCurrentStepIndex(idx);
        }
    };

    const handleHotspotClick = async (h: HotspotConfig) => {
        if(!discoveredHotspotIds.current.has(h.meshName)) {
            discoveredHotspotIds.current.add(h.meshName);
            setDiscoveredHotspots(prev => prev + 1);
            
            if(h.recompensaId && user) {
                await gameServiceUser.otorgarRecompensa(user.id, h.recompensaId, String(selectedHistoriaId));
                await fetchPlayerStats();
                setNotification("¡Objeto Obtenido!");
                setTimeout(()=>setNotification(null), 2000);
            }
            if(h.personajeId) {
                 const p = personajesData.find(pd => pd.id_personaje === h.personajeId);
                 if(p) await gameServiceUser.knowCharacter(user.id, p.nombre);
            }
        }
        setHotspotModal(h);
        setIsHotspotModalOpen(true);
    };

    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(()=>{});
            setIsFullscreen(true);
        } else {
            document.exitFullscreen().catch(()=>{});
            setIsFullscreen(false);
        }
    };
    
    const handleCharacterClickInBar = async (name: string) => {
        const p = personajesData.find(pd => pd.nombre === name);
        if(p) {
            const full = await obtenerFichaPersonajePorId(p.id_personaje);
            if(full) setSelectedCharacterForModal(full);
        }
    };
    
    const getRecurso = (id: number|null) => recursosData.find(r => r.id_recurso === id);
    const handleOpenMap = () => {
         const h = historias.find(hist => hist.id_historia === selectedHistoriaId);
         if(h?.id_ubicacion?.coordenadas) {
             const c = h.id_ubicacion.coordenadas.split(',');
             if(c.length === 2) setMapCenter([parseFloat(c[0]), parseFloat(c[1])]);
         }
         setShowMap(true);
    };


    // ==================================================================
    // RENDER
    // ==================================================================
    
    // 1. MENU PRINCIPAL
    if (!selectedHistoriaId) {
        return (
            <div className="menu-wrapper">
                <style>{styles}</style>
                <h1 className="text-5xl font-bold text-center mb-8 text-purple-400">Selecciona tu Aventura</h1>
                <div className="story-container">
                    {historias.map(h => {
                        const isLocked = h.id_historia_dependencia ? !historiasVisitadas.includes(h.id_historia_dependencia) : false;
                        const bg = h.id_imagen_historia ? getRecurso(h.id_imagen_historia)?.archivo : null;
                        const parent = isLocked ? historias.find(ph => ph.id_historia === h.id_historia_dependencia) : null;
                        
                        return (
                            <div key={h.id_historia} className={`story-card ${isLocked ? 'grayscale opacity-60' : 'hover:scale-105'}`}>
                                {bg && <img src={bg} style={{width:'100%', height:'100%', objectFit:'cover'}} />}
                                <div className="story-text">
                                    <h2 className="text-2xl font-bold text-white mb-2">{h.titulo}</h2>
                                    <p className="text-sm text-gray-300 mb-2 line-clamp-2">{h.descripcion}</p>
                                    {h.narrativa && <p className="text-xs text-gray-400 italic mt-1">{h.narrativa}</p>}
                                    
                                    {isLocked ? (
                                        <div className="mt-2 text-red-400 font-bold border border-red-500 inline-block px-2 py-1 rounded">🔒 Requiere: {parent?.titulo}</div>
                                    ) : (
                                        <button onClick={() => handleHistoriaSelect(h.id_historia)} className="mt-4 w-full bg-purple-600 text-white py-2 rounded font-bold hover:bg-purple-500 transition-colors">
                                            Jugar Ahora →
                                        </button>
                                    )}
                                </div>
                            </div>
                        )
                    })}
                </div>
                {/* Modal Bloqueo */}
                {lockedHistoryModal && (
                     <div className="overlay">
                        <div className="modal-window text-center">
                            <h3 className="text-xl font-bold mb-4">Historia Bloqueada</h3>
                            <p>Debes completar primero: <b>{lockedHistoryModal.historiaMadre.titulo}</b></p>
                            <button onClick={()=>setLockedHistoryModal(null)} className="nav-btn mt-4">Cerrar</button>
                        </div>
                     </div>
                )}
            </div>
        );
    }

    // 2. JUEGO
    const step = flujoData[currentStepIndex];
    if (!step) return <div className="app-container flex items-center justify-center bg-black text-white">Cargando...</div>;
    
    if(showEndMessage) {
        return (
            <div className="app-container flex items-center justify-center bg-black">
                <style>{styles}</style>
                <div className="modal-window text-center">
                    <h1 className="text-4xl font-bold text-green-400 mb-4">¡Fin de la Historia!</h1>
                    <p className="mb-6 text-lg">Felicidades por completar la aventura.</p>
                    <button onClick={handleReturnToMenu} className="action-btn">Volver al Menú</button>
                </div>
            </div>
        );
    }

    const recurso = getRecurso(step.recursomultimedia_id);
    const is3D = recurso?.tipo === '3d_model';

    return (
        <div className="app-container">
            <style>{styles}</style>
            
            {/* --- CAPA MEDIOS (0) --- */}
            <div className="media-background">
                {recurso?.tipo === 'imagen' && <img src={recurso.archivo} className="full-cover" />}
                {recurso?.tipo === 'video' && <video src={recurso.archivo} className="full-cover" autoPlay onEnded={() => handleNextStep(step.id_siguiente_paso)} />}
                {is3D && (
                    <div style={{width:'100%', height:'100%'}}>
                        <Scene3D modelUrl={recurso!.archivo} hotspotData={recurso!.metadatos || '[]'} cameraHeight={cameraHeight} onHotspotClick={handleHotspotClick} />
                    </div>
                )}
                {step.tipo_paso === 'app' && recurso && <iframe ref={iframeAppRef} src={recurso.archivo} className="full-cover" style={{border:'none'}} />}
            </div>

            {/* --- CAPA UI (100) --- */}
            <div className="ui-foreground">
                
                {/* Barra Superior */}
                <div className="top-nav">
                    <button className="nav-btn" onClick={handleReturnToMenu}>⬅ Menú</button>
                    <button className="nav-btn" onClick={toggleFullscreen}>{isFullscreen ? 'Salir Pantalla' : 'Pantalla Completa'}</button>
                </div>

                {/* Stats 3D (Top Right) */}
                {is3D && (
                    <div className="stats-panel">
                        <div className="stat-pill bg-blue-900">
                             🎯 {discoveredHotspots} / {totalHotspotsRef.current}
                        </div>
                        <div className="control-group">
                             <span style={{fontSize:'1.2rem'}}>🔊</span>
                             <input type="range" min="0" max="1" step="0.1" value={backgroundMusicVolume} onChange={e => setBackgroundMusicVolume(parseFloat(e.target.value))} style={{width:'80px'}} />
                        </div>
                         <div className="control-group">
                             <span style={{fontSize:'1.2rem'}}>📷</span>
                             <input type="range" min="-3" max="3" step="0.1" value={cameraHeight} onChange={e => setCameraHeight(parseFloat(e.target.value))} style={{width:'80px'}} />
                        </div>
                    </div>
                )}

                {/* POPUP INSTRUCCIONES (Click activa Audio) */}
                {is3D && showInitial3DPopup && (
                    <div className="modal-center">
                        <h2 className="text-3xl font-bold text-blue-400 mb-4">¡Explora!</h2>
                        <p className="text-lg mb-6">Encuentra {totalHotspotsRef.current} puntos de interés en este modelo.</p>
                        <button onClick={() => { setShowInitial3DPopup(false); initAudioAndPlay(); }} className="action-btn">
                            ¡Entendido!
                        </button>
                    </div>
                )}

                {/* Texto Narrativo (No 3D) */}
                {step.tipo_paso === 'narrativo' && showStepContent && !is3D && recurso?.tipo !== 'video' && (
                     <div className="modal-center" style={{ background: 'rgba(26,32,44,0.95)' }}>
                        <p className="text-xl leading-relaxed mb-8">{step.contenido}</p>
                        <button onClick={() => handleNextStep(step.id_siguiente_paso)} className="action-btn">Continuar</button>
                     </div>
                )}

                {/* Botón Siguiente 3D (Flotante) */}
                {is3D && !showInitial3DPopup && discoveredHotspots >= totalHotspotsRef.current && totalHotspotsRef.current > 0 && (
                    <div style={{position:'absolute', bottom:'85px', right:'20px'}}>
                         <button onClick={() => handleNextStep(step.id_siguiente_paso)} className="action-btn bg-green-600 animate-bounce shadow-xl">
                             Siguiente Zona ➡
                         </button>
                    </div>
                )}

                {/* Barra Inferior */}
                {showBottomBar && (
                    <div className="hud-bar">
                        <div className="text-yellow-400 font-bold text-lg flex items-center gap-2">
                            XP: {playerStats?.xp_total || 0}
                        </div>
                        
                        <div className="hud-icons">
                            <div className="icon-btn" onClick={handleOpenMap}>🗺️</div>
                            <div className="icon-btn" onClick={() => setShowInventory(true)}>📦 <span style={{fontSize:'0.8rem', marginLeft:'2px'}}>{playerStats?.inventario?.length}</span></div>
                            <div className="icon-btn" onClick={() => setShowCharacters(true)}>👥 <span style={{fontSize:'0.8rem', marginLeft:'2px'}}>{playerStats?.personajes_conocidos?.length}</span></div>
                            <div className="icon-btn" onClick={() => setShowStories(true)}>📚</div>
                            <div className="icon-btn text-gray-400" style={{fontSize:'1rem'}} onClick={() => setShowBottomBar(false)}>▼</div>
                        </div>
                    </div>
                )}
                {!showBottomBar && <button onClick={()=>setShowBottomBar(true)} style={{position:'absolute', bottom:'20px', left:'20px', zIndex:500, padding:'10px', background:'#2d3748', color:'white', borderRadius:'50%', fontSize:'1.5rem', cursor:'pointer'}}>📊</button>}
                
                {/* Notificaciones */}
                {notification && (
                    <div style={{position:'absolute', top:'100px', left:'50%', transform:'translateX(-50%)', background:'#48bb78', padding:'10px 20px', borderRadius:'20px', color:'white', fontWeight:'bold', boxShadow:'0 10px 20px rgba(0,0,0,0.3)'}}>
                        {notification}
                    </div>
                )}

            </div> {/* END UI FOREGROUND */}


            {/* ========================== MODALES (Overlays) ========================== */}
            
            {showMap && (
                <div className="overlay">
                    <div className="modal-window" style={{ width:'95vw', height:'90vh', maxWidth:'none', padding:0, overflow:'hidden' }}>
                        <span className="x-btn bg-black rounded-full z-50" onClick={() => setShowMap(false)}>×</span>
                        <MapaView historias={historias} historiasVisitadas={historiasVisitadas} onStartNarrativeFromMap={()=>{}} onBack={() => setShowMap(false)} initialCenter={mapCenter} />
                    </div>
                </div>
            )}

            {isHotspotModalOpen && hotspotModal && (
                <div className="overlay">
                    <span className="x-btn text-white" style={{top:'2rem', right:'2rem', fontSize:'3rem'}} onClick={() => setIsHotspotModalOpen(false)}>×</span>
                    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', maxWidth:'90%', maxHeight:'90%' }}>
                         {hotspotModal.contentType === 'imagen' && <img src={hotspotModal.url} style={{maxHeight:'70vh', borderRadius:'10px'}} />}
                         {hotspotModal.contentType === 'video' && <video src={hotspotModal.url} controls autoPlay style={{maxHeight:'70vh', borderRadius:'10px'}} />}
                         {hotspotModal.contentType === 'interactive' && <iframe ref={iframeRef} src={hotspotModal.url} style={{width:'80vw', height:'70vh', border:'none', background:'white', borderRadius:'10px'}} />}
                         <div style={{ marginTop:'1rem', background:'rgba(0,0,0,0.8)', color:'white', padding:'0.5rem 1.5rem', borderRadius:'1rem', fontSize:'1.2rem', fontWeight:'bold' }}>
                             {hotspotModal.title}
                         </div>
                    </div>
                </div>
            )}

            {showInventory && (
                <div className="overlay">
                    <div className="modal-window">
                        <span className="x-btn" onClick={() => setShowInventory(false)}>×</span>
                        <h2 className="text-2xl font-bold mb-4 text-blue-400">Inventario</h2>
                        {playerStats?.inventario?.map((it, i) => <div key={i} className="list-row"><b>{it.nombre}</b> <span className="text-sm text-gray-400">{it.descripcion}</span></div>)}
                    </div>
                </div>
            )}

            {showStories && (
                <div className="overlay">
                    <div className="modal-window">
                        <span className="x-btn" onClick={() => setShowStories(false)}>×</span>
                        <h2 className="text-2xl font-bold mb-4 text-green-400">Diario</h2>
                        <button onClick={handleReturnToMenu} className="nav-btn w-full mb-4 text-center" style={{display:'block', background:'#3182ce'}}>Volver al Menú</button>
                        {historiasVisitadas.map(id => { const h = historias.find(hh => hh.id_historia === id); return h ? <div key={id} className="list-row">{h.titulo}</div> : null })}
                    </div>
                </div>
            )}

            {showCharacters && (
                <div className="overlay">
                     <div className="modal-window">
                        <span className="x-btn" onClick={() => setShowCharacters(false)}>×</span>
                        <h2 className="text-2xl font-bold mb-4 text-purple-400">Personajes</h2>
                        {playerStats?.personajes_conocidos?.map((name, i) => <div key={i} className="list-row" onClick={() => handleCharacterClickInBar(name)}>{name}</div>)}
                     </div>
                </div>
            )}

            {selectedCharacterForModal && (
                 <div className="overlay">
                    <div className="modal-window text-center">
                        <span className="x-btn" onClick={() => setSelectedCharacterForModal(null)}>×</span>
                        <h2 className="text-2xl font-bold mb-2">{selectedCharacterForModal.nombre}</h2>
                        {selectedCharacterForModal.imagen && <img src={selectedCharacterForModal.imagen} style={{width:'120px', height:'120px', borderRadius:'50%', objectFit:'cover', border:'3px solid #4299e1', margin:'1rem auto'}} />}
                        <p style={{lineHeight:'1.6'}}>{selectedCharacterForModal.descripcion}</p>
                    </div>
                 </div>
            )}

        </div>
    );
};

export default FlujoNarrativoUsuario;