import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { gameService } from '../services/GameService';

// Interfaces de datos actualizadas para soportar la navegación
interface FlujoNarrativoData {
    id_flujo: number;
    orden: number;
    tipo_paso: 'narrativo' | 'pregunta' | 'final';
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
}

interface RecompensaData {
    id_recompensa: number;
    nombre: string;
    valor: number;
    descripcion: string | null;      
}

interface RecursoMultimediaData {
    id_recurso: number;
    tipo: 'imagen' | 'video' | 'audio' | 'transcripcion' | 'subtitulo';
    archivo: string;
    metadatos: string | null;
}

const FlujoNarrativoDisplay: React.FC = () => {
    const { user } = useAuth();
    const [historias, setHistorias] = useState<HistoriaData[]>([]);
    const [recompensas, setRecompensas] = useState<RecompensaData[]>([]);
    const [pasos, setPasos] = useState<FlujoNarrativoData[]>([]);
    const [selectedHistoriaId, setSelectedHistoriaId] = useState<number | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [recursos, setRecursos] = useState<RecursoMultimediaData[]>([]);
    const [selectedPaso, setSelectedPaso] = useState<FlujoNarrativoData | null>(null);

    // --- NUEVOS ESTADOS Y REFS PARA LA LÓGICA DE DO NOT TRACK ---
    const [isVideoPlaying, setIsVideoPlaying] = useState(false);
    const [isShowingVideo, setIsShowingVideo] = useState(false);
    const [showDialog, setShowDialog] = useState(false);
    const [dialogUrl, setDialogUrl] = useState('');
    const videoRef = useRef<HTMLVideoElement>(null);
    // -------------------------------------------------------------

    useEffect(() => {
        const cargarDatosIniciales = async () => {
            console.log('✅ Iniciando la carga de datos iniciales...');
            try {
                const { data: historiasData, error: historiasError } = await supabase
                    .from('historia')
                    .select('id_historia, titulo');

                const { data: recompensasData, error: recompensasError } = await supabase
                    .from('recompensa')
                    .select('id_recompensa, nombre, valor, descripcion');

                const { data: recursosData, error: recursosError } = await supabase
                    .from('recursomultimedia')
                    .select('id_recurso, tipo, archivo, metadatos');

                if (historiasError) throw historiasError;
                if (recompensasError) throw recompensasError;
                if (recursosError) throw recursosError;

                setHistorias(historiasData || []);
                setRecompensas(recompensasData || []);
                setRecursos(recursosData || []);
                console.log('🎉 Datos iniciales cargados con éxito.');
            } catch (err: any) {
                setError('Error al cargar datos iniciales: ' + err.message);
                console.error('❌ Error al cargar datos iniciales:', err);
            }
        };
        cargarDatosIniciales();
    }, []);

    useEffect(() => {
        if (selectedHistoriaId) {
            const cargarFlujoNarrativo = async () => {
                console.log(`⏳ Cargando flujo narrativo para la historia con ID: ${selectedHistoriaId}`);
                setLoading(true);
                try {
                    const { data: pasosData, error: pasosError } = await supabase
                        .from('flujo_narrativo')
                        .select('*')
                        .eq('id_historia', selectedHistoriaId)
                        .order('orden', { ascending: true });

                    if (pasosError) throw pasosError;
                    
                    setPasos(pasosData as FlujoNarrativoData[] || []);
                    setSelectedPaso(pasosData && pasosData.length > 0 ? pasosData[0] as FlujoNarrativoData : null);

                    console.log('📜 Flujo narrativo cargado:', pasosData);
                    setError(null);
                } catch (err: any) {
                    setError('Error al cargar el flujo narrativo: ' + err.message);
                    console.error('❌ Error al cargar el flujo narrativo:', err);
                } finally {
                    setLoading(false);
                }
            };
            cargarFlujoNarrativo();
        } else {
            setPasos([]);
            console.log('🗑️ Deseleccionando historia. Pasos limpiados.');
        }
    }, [selectedHistoriaId]);

    const registrarEventoJuego = async (evento: string, detalles: object) => {
        if (!user?.id) {
            console.warn('⚠️ No se puede registrar el evento. Usuario no autenticado.');
            return;
        }
        try {
            console.log(`📡 Registrando evento: ${evento}`, detalles);
            if (evento === 'historia_completada') {
                await gameService.completeStory(user.id, detalles.historia_id, true);
                console.log('✅ Historia completada en Supabase.' + detalles);
            }
            console.log('✅ Evento registrado con éxito.');
        } catch (err: any) {
            console.error('❌ Error al registrar evento:', err);
        }
    };

    const actualizarPerfilJugador = async (recompensaId: number | null) => {
        if (!user?.id || !recompensaId) {
            console.warn('⚠️ No se puede actualizar el perfil. Usuario o recompensa inválidos.');
            return;
        }
        try {
            console.log(`🔄 Actualizando perfil del jugador con recompensa: ${recompensaId}`);
            await gameService.otorgarRecompensa(user.id, recompensaId);
            console.log('✅ Perfil del jugador actualizado. Recompensa otorgada.');
        } catch (err: any) {
            console.error('❌ Error al actualizar el perfil del jugador:', err);
        }
    };
    
    const registrarInteraccion = async (pasoId: number, tipoInteraccion: string) => {
        if (!user?.id) {
            console.warn('⚠️ No se puede registrar la interacción. Usuario no autenticado.');
            return;
        }
        try {
            console.log(`✍️ Registrando interacción del usuario (${user.id}) con el paso #${pasoId}. Tipo: ${tipoInteraccion}`);
            await gameService.registrarInteraccion(user.id, pasoId, tipoInteraccion);
            console.log('✅ Interacción registrada.');
        } catch (err: any) {
            console.error('❌ Error al registrar interacción:', err);
        }
    };

    const handleHistoriaChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const id = parseInt(e.target.value);
        console.log(`➡️ Historia seleccionada: ${id}`);
        setSelectedHistoriaId(id);
        setSelectedPaso(null);
    };

    const handlePasoClick = (paso: FlujoNarrativoData) => {
        console.log(`🔍 Paso #${paso.orden} seleccionado para previsualización.`);
        setSelectedPaso(paso);
        // Reiniciar estados del video/dialogo al abrir una nueva previsualización
        setIsShowingVideo(false);
        setIsVideoPlaying(false);
        setShowDialog(false);
    };

    // --- NUEVAS FUNCIONES PARA LA LÓGICA DE DO NOT TRACK ---
    const handleVideoStart = () => {
        setIsShowingVideo(true); // Muestra el contenedor del video
        setIsVideoPlaying(true); // Indica que el video está en reproducción
        // El video comenzará a reproducirse debido a la prop `autoPlay` en el JSX
    };

    const handleVideoEnd = () => {
        setIsVideoPlaying(false);
        setIsShowingVideo(false);
        // Si hay un siguiente paso, avanza automáticamente.
        // Si no, la lógica de `handleSiguientePaso` no hará nada.
        handleSiguientePaso();
    };

    const handleDialogSubmit = () => {
        console.log('URL ingresada:', dialogUrl);
        // Aquí puedes agregar la lógica para guardar el valor de dialogUrl
        setShowDialog(false);
        setDialogUrl('');
        handleSiguientePaso();
    };
    // --------------------------------------------------------

    const handleSiguientePaso = async () => {
        if (!selectedPaso) return;

        await registrarInteraccion(selectedPaso.id_flujo, 'avanzar');

        if (selectedPaso.id_recompensa) {
            await actualizarPerfilJugador(selectedPaso.id_recompensa);
        }

        console.log(`🔄 Navegando desde el paso #${selectedPaso.orden}...`);

        if (selectedPaso.tipo_paso === 'final') {
            try {
                await gameService.completeStory(user.id, selectedHistoriaId.toString(), true);
                console.log(`✅ Historia ${selectedHistoriaId} completada.`);
            } catch (err: any) {
                console.error('❌ Error al completar la historia:', err.message);
                setError('Error al completar la historia.');
                return;
            }

            if (selectedPaso.id_siguiente_paso) {
                console.log(`🔄 Enlazando a la siguiente historia con ID: ${selectedPaso.id_siguiente_paso}`);
                setSelectedHistoriaId(selectedPaso.id_siguiente_paso);
                setSelectedPaso(null);
            } else {
                console.log('🎉 Fin de la narrativa. No hay más historias enlazadas.');
                setSelectedPaso(null);
            }
        } else {
            const currentIndex = pasos.findIndex(p => p.id_flujo === selectedPaso.id_flujo);
            if (currentIndex > -1 && currentIndex < pasos.length - 1) {
                const nextPaso = pasos[currentIndex + 1];
                setSelectedPaso(nextPaso);
                console.log(` ↳ Navegación secuencial al siguiente paso #${nextPaso.orden}`);
            } else {
                setSelectedPaso(null);
                console.log('🏁 Fin de la secuencia de pasos. No hay más pasos secuenciales.');
            }
        }
    };
    
    
    const handleOpcionClick = async (pasoDestinoId: number) => {
        if (!selectedPaso) return;
        
        await registrarInteraccion(selectedPaso.id_flujo, `opcion_seleccionada:${pasoDestinoId}`);

        const pasoDestino = pasos.find(p => p.id_flujo === pasoDestinoId);
        if (pasoDestino) {
            if (pasoDestino.id_recompensa) {
                await actualizarPerfilJugador(pasoDestino.id_recompensa);
            }
            setSelectedPaso(pasoDestino);
        } else {
            console.error(`❌ El paso de destino con ID ${pasoDestinoId} no fue encontrado.`);
        }
    };

    const renderMediaPreview = (recursoId: number | null) => {
        if (!recursoId) return null;

        const recurso = recursos.find(r => r.id_recurso === recursoId);
        if (!recurso) {
            console.warn(`⚠️ Recurso multimedia con ID ${recursoId} no encontrado.`);
            return <p>Recurso multimedia no encontrado.</p>;
        }
        
        // --- Lógica actualizada para manejar videos de forma diferente ---
        if (recurso.tipo === 'video' && !isShowingVideo) {
             return (
                 <div className="video-trigger-container">
                    <p className="video-info">Este paso contiene un video. Presiona "Reproducir Video" para verlo.</p>
                    <button onClick={handleVideoStart} className="video-play-btn">
                        ▶️ Reproducir Video
                    </button>
                 </div>
             );
        }
        // --------------------------------------------------------------
        
        if (recurso.tipo === 'imagen') {
            return <img src={recurso.archivo} alt="Recurso Multimedia" className="media-preview-img" />;
        } else if (recurso.tipo === 'audio') {
            return <audio controls src={recurso.archivo} className="media-preview-audio" />;
        }
        
        if (recurso.tipo === 'video' && isShowingVideo) {
            return (
                // Este video se renderiza a pantalla completa
                <video
                    ref={videoRef}
                    src={recurso.archivo}
                    autoPlay
                    onEnded={handleVideoEnd}
                    className="media-preview-video"
                />
            );
        }
        
        return <p>Tipo de contenido no soportado.</p>;
    };

    if (loading) {
        return <div className="loading-state">⏳ Cargando flujo narrativo...</div>;
    }

    if (error) {
        return <div className="error-state">❌ {error}</div>;
    }

    const opciones = selectedPaso?.opciones_decision?.opciones_siguientes_json;

    return (
        <div className="flujo-narrativo-container">
            <style jsx>{`
                :root {
                    --bg-color: #f0f4f8;
                    --text-color: #2c3e50;
                    --card-bg: #ffffff;
                    --accent-color: #3498db;
                    --accent-hover: #2980b9;
                    --border-color: #e0e6ed;
                    --shadow-light: rgba(0, 0, 0, 0.1);
                    --shadow-dark: rgba(0, 0, 0, 0.2);
                }

                body {
                    font-family: 'Inter', sans-serif;
                    background-color: var(--bg-color);
                    color: var(--text-color);
                    line-height: 1.6;
                }
                
                .flujo-narrativo-container {
                    padding: 2rem;
                    max-width: 1200px;
                    margin: 0 auto;
                }

                .view-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 2rem;
                    border-bottom: 2px solid var(--border-color);
                    padding-bottom: 1rem;
                }

                h2 {
                    font-size: 2rem;
                    font-weight: 700;
                    color: var(--text-color);
                }
                
                .header-actions {
                    display: flex;
                    gap: 1rem;
                }

                .form-select {
                    padding: 0.5rem 1rem;
                    border: 1px solid var(--border-color);
                    border-radius: 8px;
                    background-color: var(--card-bg);
                    color: var(--text-color);
                    cursor: pointer;
                    transition: all 0.2s ease-in-out;
                }
                
                .form-select:hover {
                    border-color: var(--accent-color);
                }

                .pasos-list {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
                    gap: 1.5rem;
                }

                .paso-card {
                    background-color: var(--card-bg);
                    border-radius: 12px;
                    padding: 1.5rem;
                    box-shadow: 0 4px 12px var(--shadow-light);
                    transition: transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out;
                    cursor: pointer;
                    display: flex;
                    flex-direction: column;
                    height: 100%;
                }

                .paso-card:hover {
                    transform: translateY(-5px);
                    box-shadow: 0 8px 20px var(--shadow-light);
                }

                .paso-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 1rem;
                    border-bottom: 1px dashed var(--border-color);
                    padding-bottom: 0.5rem;
                }

                .paso-orden {
                    font-weight: 600;
                    color: var(--accent-color);
                }
                
                .paso-badge {
                    font-size: 0.8rem;
                    padding: 0.3rem 0.6rem;
                    border-radius: 50px;
                    font-weight: 600;
                    text-transform: uppercase;
                    color: var(--card-bg);
                }

                .paso-badge-narrativo {
                    background-color: #27ae60;
                }

                .paso-badge-pregunta {
                    background-color: #e74c3c;
                }

                .paso-body {
                    flex-grow: 1;
                }
                
                .paso-contenido {
                    margin: 0;
                    font-size: 0.9rem;
                    color: #555;
                }

                .paso-recompensa {
                    margin-top: 1rem;
                    font-size: 0.85rem;
                    font-weight: 500;
                    color: #2c3e50;
                    padding: 0.5rem;
                    background-color: #f9e79f;
                    border-radius: 8px;
                    text-align: center;
                }

                /* --- Modal Styles --- */
                .modal-backdrop {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background-color: rgba(0, 0, 0, 0.5);
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    z-index: 1000;
                    backdrop-filter: blur(5px);
                }
                
                .modal-content {
                    background-color: var(--card-bg);
                    border-radius: 16px;
                    padding: 2rem;
                    width: 90%;
                    max-width: 600px;
                    box-shadow: 0 10px 30px var(--shadow-dark);
                    transform: scale(0.95);
                    animation: pop-in 0.3s forwards ease-out;
                }

                @keyframes pop-in {
                    to {
                        transform: scale(1);
                    }
                }

                .modal-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    border-bottom: 1px solid var(--border-color);
                    padding-bottom: 1rem;
                    margin-bottom: 1rem;
                }

                .modal-header h3 {
                    font-size: 1.5rem;
                    font-weight: 600;
                    margin: 0;
                }

                .close-modal-btn {
                    background: none;
                    border: none;
                    font-size: 2rem;
                    cursor: pointer;
                    color: var(--text-color);
                    transition: transform 0.2s ease-in-out;
                }

                .close-modal-btn:hover {
                    transform: rotate(90deg);
                }

                .modal-body {
                    padding: 1rem 0;
                }

                .preview-pregunta h4, .preview-narrativo h4 {
                    font-size: 1.25rem;
                    font-weight: 500;
                    margin-bottom: 1rem;
                }
                
                .opciones-container {
                    display: flex;
                    flex-direction: column;
                    gap: 1rem;
                    margin-top: 1.5rem;
                }
                
                .opcion-btn, .siguiente-btn {
                    padding: 0.75rem 1.5rem;
                    font-size: 1rem;
                    font-weight: 600;
                    border-radius: 8px;
                    cursor: pointer;
                    transition: all 0.2s ease-in-out;
                    text-align: center;
                    border: none;
                }

                .opcion-btn {
                    background-color: var(--accent-color);
                    color: #ffffff;
                    box-shadow: 0 4px 6px var(--shadow-light);
                }

                .opcion-btn:hover {
                    background-color: var(--accent-hover);
                    transform: translateY(-2px);
                    box-shadow: 0 6px 10px var(--shadow-light);
                }

                .siguiente-btn {
                    background-color: #2ecc71;
                    color: #ffffff;
                    box-shadow: 0 4px 6px var(--shadow-light);
                }

                .siguiente-btn:hover {
                    background-color: #27ae60;
                    transform: translateY(-2px);
                    box-shadow: 0 6px 10px var(--shadow-light);
                }

                .empty-options-mensaje, .fin-mensaje {
                    text-align: center;
                    color: #888;
                    font-style: italic;
                    margin-top: 1.5rem;
                }
                
                .loading-state, .error-state, .empty-state {
                    text-align: center;
                    font-size: 1.2rem;
                    padding: 2rem;
                    color: #7f8c8d;
                }

                /* Media Previews */
                .media-preview-img, .media-preview-video, .media-preview-audio {
                    max-width: 100%;
                    border-radius: 12px;
                    margin-bottom: 1.5rem;
                    box-shadow: 0 4px 10px var(--shadow-light);
                }
                
                .video-trigger-container {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 1rem;
                    padding: 2rem;
                    background-color: #f1f2f6;
                    border-radius: 12px;
                    border: 1px dashed #ced4da;
                    margin-bottom: 1.5rem;
                }

                .video-info {
                    font-style: italic;
                    text-align: center;
                    color: #6c757d;
                }
                
                .video-play-btn {
                    background-color: #e74c3c;
                    color: white;
                    border: none;
                    padding: 0.75rem 1.5rem;
                    border-radius: 8px;
                    font-size: 1rem;
                    cursor: pointer;
                    transition: background-color 0.2s ease-in-out;
                }

                .video-play-btn:hover {
                    background-color: #c0392b;
                }

                /* Estilos Full Screen */
                .full-screen-video-container {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100vw;
                    height: 100vh;
                    background-color: black;
                    z-index: 1000;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                }
                
                .full-screen-video-container video {
                    width: 100%;
                    height: 100%;
                    object-fit: contain;
                }
                
                /* Estilos Cuadro de Diálogo */
                .dialog-overlay {
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    background-color: rgba(0, 0, 0, 0.85);
                    padding: 2rem;
                    color: white;
                    border-radius: 12px;
                    box-shadow: 0 8px 30px rgba(0,0,0,0.5);
                    opacity: 0;
                    transition: opacity 0.3s ease-in-out;
                    pointer-events: none;
                    z-index: 1001;
                    width: 90%;
                    max-width: 450px;
                }
                
                .dialog-overlay.is-visible {
                    opacity: 1;
                    pointer-events: auto;
                }
                
                .dialog-overlay p {
                    margin-bottom: 1rem;
                }
                
                .dialog-overlay input {
                    width: 100%;
                    padding: 0.75rem;
                    border: 1px solid #777;
                    border-radius: 8px;
                    background-color: #333;
                    color: white;
                    font-size: 1rem;
                    margin-bottom: 1rem;
                }
                
                .dialog-overlay button {
                    width: 100%;
                    padding: 0.75rem;
                    background-color: #2ecc71;
                    color: white;
                    border: none;
                    border-radius: 8px;
                    cursor: pointer;
                }
                
                @media (max-width: 768px) {
                    .flujo-narrativo-container {
                        padding: 1rem;
                    }

                    .view-header {
                        flex-direction: column;
                        align-items: flex-start;
                        gap: 1rem;
                    }
                    
                    .header-actions {
                        width: 100%;
                    }

                    .form-select {
                        width: 100%;
                    }
                }
            `}</style>
            
            {/* Contenedor del video a pantalla completa */}
            {isShowingVideo && (
                <div className="full-screen-video-container">
                    {renderMediaPreview(selectedPaso?.recursomultimedia_id)}
                </div>
            )}
            
            {/* Contenedor del diálogo */}
            {showDialog && (
                <div className="dialog-overlay is-visible">
                    <p>¿Nos puedes proporcionar una URL para continuar?</p>
                    <input
                        type="text"
                        placeholder="Introduce la URL aquí..."
                        value={dialogUrl}
                        onChange={(e) => setDialogUrl(e.target.value)}
                    />
                    <button onClick={handleDialogSubmit}>Enviar</button>
                </div>
            )}

            {/* Resto de la interfaz de la aplicación */}
            {!isShowingVideo && !showDialog && (
                <>
                    <div className="view-header">
                        <h2>📜 Visualización del Flujo Narrativo</h2>
                        <div className="header-actions">
                            <select
                                value={selectedHistoriaId || ''}
                                onChange={handleHistoriaChange}
                                className="form-select"
                            >
                                <option value="">Selecciona una Historia</option>
                                {historias.map((historia) => (
                                    <option key={historia.id_historia} value={historia.id_historia}>
                                        {historia.titulo}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                    
                    {pasos.length === 0 && selectedHistoriaId ? (
                        <p className="empty-state">No hay pasos narrativos definidos para esta historia.</p>
                    ) : !selectedHistoriaId ? (
                        <p className="empty-state">Selecciona una historia para ver su flujo narrativo.</p>
                    ) : (
                        <div className="pasos-list">
                            {pasos.map((paso) => {
                                const recompensaAsociada = recompensas.find(r => r.id_recompensa === paso.id_recompensa);
                                
                                return (
                                    <div 
                                        key={paso.id_flujo} 
                                        className="paso-card"
                                        onClick={() => handlePasoClick(paso)}
                                    >
                                        <div className="paso-header">
                                            <span className="paso-orden">Paso #{paso.orden}</span>
                                            <span className={`paso-badge paso-badge-${paso.tipo_paso}`}>
                                                {paso.tipo_paso}
                                            </span>
                                        </div>
                                        
                                        <div className="paso-body">
                                            <p className="paso-contenido">{paso.contenido}</p>
                                            {paso.id_recompensa && (
                                                <div className="paso-recompensa">
                                                    🎁 **Recompensa:** {recompensaAsociada?.nombre || 'Desconocida'}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {selectedPaso && (
                        <div className="modal-backdrop">
                            <div className="modal-content">
                                <div className="modal-header">
                                    <h3>Previsualización del Paso #{selectedPaso.orden}</h3>
                                    <button onClick={() => setSelectedPaso(null)} className="close-modal-btn">
                                        &times;
                                    </button>
                                </div>
                                <div className="modal-body">
                                    {selectedPaso.tipo_paso === 'pregunta' ? (
                                        <div className="preview-pregunta">
                                            {renderMediaPreview(selectedPaso.recursomultimedia_id)}
                                            <h4 className="pregunta-titulo">{selectedPaso.contenido}</h4>
                                            {opciones && opciones.length > 0 ? (
                                                <div className="opciones-container">
                                                    {opciones.map((opcion, index) => (
                                                        <button 
                                                            key={index}
                                                            className="opcion-btn"
                                                            onClick={() => handleOpcionClick(opcion.siguiente_paso_id)}
                                                        >
                                                            {opcion.texto}
                                                        </button>
                                                    ))}
                                                </div>
                                            ) : (
                                                <p className="empty-options-mensaje">❌ No hay opciones de decisión disponibles para esta pregunta.</p>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="preview-narrativo">
                                            {renderMediaPreview(selectedPaso.recursomultimedia_id)}
                                            <h4>Contenido Narrativo</h4>
                                            <p>{selectedPaso.contenido}</p>
                                            <div className="navigation-container">
                                                {selectedPaso.id_siguiente_paso !== null ? (
                                                    <button onClick={handleSiguientePaso} className="siguiente-btn">
                                                        Siguiente →
                                                    </button>
                                                ) : (
                                                    <p className="fin-mensaje">Fin de la secuencia.</p>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default FlujoNarrativoDisplay;