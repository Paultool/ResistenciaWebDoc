import React, { useState, useEffect } from 'react'
import {
  supabase,
  Historia,
  obtenerHistoriaDetalle,
  obtenerFlujoNarrativoDeHistoria,
  obtenerPersonajesPorHistoriaId,
  obtenerMultimediaPorIds
} from '../supabaseClient'
import { gameService } from '../services/GameService'
import { useAuth } from '../contexts/AuthContext'
import './HistoriaDetail.css'

interface HistoriaDetailProps {
  historiaId: number
  onClose: () => void
  onStartNarrative: (historia: Historia) => void
}

// Interfaces de datos precisas
interface Personaje {
  id_personaje: number;
  nombre: string;
  imagen: string | null;
  rol?: string; 
  descripcion?: string; 
}

interface RecursoMultimedia {
  id_recurso: number;
  tipo: 'imagen' | 'video' | 'audio' | 'transcripcion' | 'subtitulo';
  archivo: string;
  metadatos: string | null;
  descripcion: string;
  titulo?: string; 
}

interface HistoriaCompleta extends Historia {
  narrativa: string;
  recursomultimedia: RecursoMultimedia[];
  personaje: Personaje[];
}

const HistoriaDetail: React.FC<HistoriaDetailProps> = ({ historiaId, onClose, onStartNarrative }) => {
  const { user } = useAuth()
  // Aseguramos que multimedia y personajes inicien como array para evitar el error 'length'
  const [historia, setHistoria] = useState<HistoriaCompleta | null>(null)
  const [personajes, setPersonajes] = useState<Personaje[]>([]);
  const [multimedia, setMultimedia] = useState<RecursoMultimedia[]>([]);
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'contenido' | 'personajes' | 'multimedia'>('contenido')
  const [playerStats, setPlayerStats] = useState<any>(null)
  const [canAccess, setCanAccess] = useState(true)
  const [isCompleting, setIsCompleting] = useState(false)
  const [hasStarted, setHasStarted] = useState(false)

  useEffect(() => {
    const fetchHistoriaData = async () => {
      setLoading(true);
      setError(null);
      try {
        const historiaData = await obtenerHistoriaDetalle(historiaId);
        setHistoria(historiaData);

        const flujoData = await obtenerFlujoNarrativoDeHistoria(historiaId);

        // Obtener IDs de personajes y multimedia únicos
        const personajeIds = Array.from(new Set(
          flujoData
            .map(paso => paso.id_personaje)
            .filter(id => id !== null) as number[]
        ));

        const multimediaIds = Array.from(new Set(
          flujoData
            .map(paso => paso.recursomultimedia_id)
            .filter(id => id !== null) as number[]
        ));

        // Cargar datos por separado
        const [personajesData, multimediaData] = await Promise.all([
          obtenerPersonajesPorHistoriaId(historiaId),
          obtenerMultimediaPorIds(multimediaIds)
        ]);

        // Nos aseguramos de que siempre sean arrays (incluso si la API devuelve null o undefined)
        setPersonajes(personajesData || []);
        setMultimedia(multimediaData || []);
        
        // Cargar estadísticas del jugador
        if (user?.id) {
          const stats = await gameService.getPlayerStats(user.id);
          setPlayerStats(stats);
          const nivelRequerido = historiaData?.nivel_acceso_requerido || 1;
          setCanAccess(stats?.nivel >= nivelRequerido);
        }

      } catch (err: any) {
        // En caso de error, aseguramos que multimedia sea un array vacío
        setMultimedia([]); 
        setError('Error al cargar los detalles de la historia: ' + err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchHistoriaData();
  }, [historiaId, user]);

  const handleComenzarHistoria = async () => {
    if (!user?.id || !historia || isCompleting) return
    
    try {
      setIsCompleting(true)
      
      if (!canAccess) {
        alert(`🔒 Necesitas alcanzar el nivel ${historia.nivel_acceso_requerido} para acceder a esta historia.`)
        return
      }

      setHasStarted(true)
      onStartNarrative(historia);
      
    } catch (error: any) {
      console.error('Error comenzando historia:', error)
      alert('❌ Error al comenzar la historia. Inténtalo de nuevo.')
    } finally {
      setIsCompleting(false)
    }
  }

  const renderRecurso = (recurso: RecursoMultimedia) => {
    if (!recurso || !recurso.archivo) return null;
    
    const getYouTubeId = (url: string) => {
      const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;
      const match = url.match(regex);
      return match ? match[1] : null;
    };

    const youtubeId = getYouTubeId(recurso.archivo);
    
    if (youtubeId) {
      const embedUrl = `https://www.youtube.com/embed/${youtubeId}`;
      return (
        <iframe
          src={embedUrl}
          title={recurso.descripcion || "Video de YouTube"}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="multimedia-media" 
        ></iframe>
      );
    }
    
    const url = recurso.archivo.startsWith('http')
      ? recurso.archivo
      : `${supabase.storage.from('assets-juego').getPublicUrl(recurso.archivo).data.publicUrl}`;
    
    switch (recurso.tipo) {
      case 'imagen':
        return <img src={url} alt={recurso.descripcion || "Imagen del recurso"} className="multimedia-media" />;
      case 'video':
        return <video src={url} controls className="multimedia-media" />;
      case 'audio':
        return <audio src={url} controls className="multimedia-audio" />;
      default:
        return <span className="unsupported-media">Archivo: {recurso.archivo}</span>;
    }
  };

  if (loading) {
    return (
      <div className="historia-detail-overlay loading-detail">
        <div className="historia-detail-modal">
          <p>⏳ Cargando...</p>
        </div>
      </div>
    );
  }

  if (error || !historia) {
    return (
      <div className="historia-detail-overlay error-detail">
        <div className="historia-detail-modal">
          <p className="error-message">❌ {error || 'No se encontró la historia.'}</p>
          <button onClick={onClose} className="btn-secondary mt-3">
            Cerrar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="historia-detail-overlay"> 
      <div className="historia-detail-modal">
        <div className="modal-header">
          <button onClick={onClose} className="btn-close">×</button> 
          <h2>{historia.titulo}</h2>
          <div className="historia-meta">
            <span className={`badge ${historia.es_historia_principal ? 'principal' : 'secundaria'}`}>
              {historia.es_historia_principal ? '⭐ Principal' : '📖 Secundaria'}
            </span>
            <span className="level-badge">
              🔒 Nivel {historia.nivel_acceso_requerido}
            </span>
            <span className="date-badge">
              📅 {new Date(historia.fecha_creacion).toLocaleDateString('es-MX')}
            </span>
          </div>
        </div>

        <div className="modal-tabs">
          <button
            className={`tab ${activeTab === 'contenido' ? 'active' : ''}`}
            onClick={() => setActiveTab('contenido')}
          >
            📜 Contenido
          </button>
          <button
            className={`tab ${activeTab === 'personajes' ? 'active' : ''}`}
            onClick={() => setActiveTab('personajes')}
          >
            🎭 Personajes ({personajes?.length || 0})
          </button>
          <button
            className={`tab ${activeTab === 'multimedia' ? 'active' : ''}`}
            onClick={() => setActiveTab('multimedia')}
          >
            🎥 Multimedia ({multimedia?.length || 0})
          </button>
        </div>

        <div className="modal-content content-tab"> 
          {activeTab === 'contenido' && (
            <div className="tab-panel">
              <div className="historia-description">
                <h3>📝 Descripción</h3>
                <p>{historia.narrativa}</p>
              </div>

              {historia.metadata && (
                <div className="historia-metadata">
                  <h3>🔍 Detalles Adicionales</h3>
                  <pre>{JSON.stringify(historia.metadata, null, 2)}</pre>
                </div>
              )}
              
              <div className="historia-actions">
                <button
                  className={`btn ${canAccess ? 'btn-primary' : 'btn-disabled'}`}
                  onClick={handleComenzarHistoria}
                  disabled={!canAccess || isCompleting}
                >
                  {isCompleting ? (
                    '⏳ Procesando...'
                  ) : hasStarted ? (
                    '✅ Historia Comenzada'
                  ) : canAccess ? (
                    `▶️ Comenzar Historia`
                  ) : (
                    `🔒 Requiere Nivel ${historia.nivel_acceso_requerido}`
                  )}
                </button>
                
                {!canAccess && (
                  <div className="access-info">
                    <p>📊 Tu nivel actual: {playerStats?.nivel || 1}</p>
                    <p>🔒 Nivel requerido: {historia.nivel_acceso_requerido}</p>
                  </div>
                )}
                
                <button className="btn btn-secondary">
                  🔖 Marcar como Favorita
                </button>
              </div>
            </div>
          )}

          {activeTab === 'personajes' && (
            <div className="tab-panel">
              {(personajes && personajes.length > 0) ? (
                <div className="personajes-grid">
                  {personajes.map(personaje => (
                    <div key={personaje.id_personaje} className="personaje-card">
                      <div className="personaje-avatar">
                        {personaje.imagen ? (
                          <img src={personaje.imagen} alt={personaje.nombre} loading="lazy" />
                        ) : (
                          <div className="placeholder-personaje-avatar">
                            <span className="avatar-icon-small">👤</span> 
                          </div>
                        )}
                      </div>
                      <div className="personaje-info">
                        <h4>{personaje.nombre}</h4>
                        <p className="personaje-rol">{personaje.rol}</p>
                        <p className="personaje-desc truncate-text">{personaje.descripcion}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="no-data">
                  <p>👥 No hay personajes asociados a esta historia</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'multimedia' && (
            <div className="tab-panel">
              {/* 🚨 CORRECCIÓN DEL ERROR DE LENGTH: Se verifica si existe 'multimedia' antes de leer 'length' */}
              {(historia?.recursomultimedia?.length ?? 0) > 0 ? (
                <div className="multimedia-grid">
                  {multimedia.map(recurso => (
                    <div key={recurso.id_recurso} className="multimedia-item">
                      <div className="multimedia-preview">
                        {renderRecurso(recurso)}
                      </div>
                      <div className="multimedia-info">
                        {recurso.titulo ? (
                            <h4>{recurso.titulo}</h4>
                        ) : (
                            <h4>{recurso.descripcion.length > 50 ? recurso.descripcion.substring(0, 50) + '...' : recurso.descripcion}</h4> 
                        )}
                        <p className="multimedia-tipo">{recurso.tipo.toUpperCase()}</p>
                        <p className="multimedia-desc truncate-text">{recurso.descripcion}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="no-data">
                  <p>🎥 No hay recursos multimedia para esta historia</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default HistoriaDetail