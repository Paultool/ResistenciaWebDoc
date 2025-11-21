import React, { useState, useEffect } from 'react'
import {
  supabase,
  Historia,
  obtenerHistoriaDetalle,
  obtenerFlujoNarrativoDeHistoria,
  obtenerPersonajesPorHistoriaId,
  obtenerMultimediaPorIds
} from '../supabaseClient'
import { gameServiceUser as gameService } from '../services/GameServiceUser'
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
  const [isFavorited, setIsFavorited] = useState(false)
  const [isFavoritingLoading, setIsFavoritingLoading] = useState(false)

  useEffect(() => {
    const fetchHistoriaData = async () => {
      setLoading(true);
      setError(null);
      try {
        const historiaData = await obtenerHistoriaDetalle(historiaId);
        setHistoria(historiaData);

        const flujoData = await obtenerFlujoNarrativoDeHistoria(historiaId);

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

        const [personajesData, multimediaData] = await Promise.all([
          obtenerPersonajesPorHistoriaId(historiaId),
          obtenerMultimediaPorIds(multimediaIds)
        ]);

        setPersonajes(personajesData || []);
        setMultimedia(multimediaData || []);

        if (user?.id) {
          const stats = await gameService.getPlayerStats(user.id);
          setPlayerStats(stats);
          const nivelRequerido = historiaData?.nivel_acceso_requerido || 1;
          setCanAccess(stats?.nivel >= nivelRequerido);

          const historiaIdStr = String(historiaId);
          setIsFavorited(stats?.historias_favoritas?.includes(historiaIdStr) || false);
        }

      } catch (err: any) {
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

  const handleToggleFavorite = async () => {
    if (!user?.id || isFavoritingLoading) return

    try {
      setIsFavoritingLoading(true)
      const historiaIdStr = String(historiaId)

      let success = false
      if (isFavorited) {
        success = await gameService.removeFromFavorites(user.id, historiaIdStr)
      } else {
        success = await gameService.addToFavorites(user.id, historiaIdStr)
      }

      if (success) {
        setIsFavorited(!isFavorited)
      } else {
        alert('❌ Error al actualizar favoritos. Inténtalo de nuevo.')
      }
    } catch (error: any) {
      console.error('Error toggling favorite:', error)
      alert('❌ Error al actualizar favoritos. Inténtalo de nuevo.')
    } finally {
      setIsFavoritingLoading(false)
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
          className="hd-media-content"
        ></iframe>
      );
    }

    const url = recurso.archivo.startsWith('http')
      ? recurso.archivo
      : `${supabase.storage.from('assets-juego').getPublicUrl(recurso.archivo).data.publicUrl}`;

    switch (recurso.tipo) {
      case 'imagen':
        return <img src={url} alt={recurso.descripcion || "Imagen del recurso"} className="hd-media-content" />;
      case 'video':
        return <video src={url} controls className="hd-media-content" />;
      case 'audio':
        return <audio src={url} controls className="hd-media-content" />;
      default:
        return <span className="unsupported-media">Archivo: {recurso.archivo}</span>;
    }
  };

  if (loading) {
    return (
      <div className="hd-overlay">
        <div className="hd-modal">
          <p>⏳ Cargando...</p>
        </div>
      </div>
    );
  }

  if (error || !historia) {
    return (
      <div className="hd-overlay">
        <div className="hd-modal">
          <p className="error-message">❌ {error || 'No se encontró la historia.'}</p>
          <button onClick={onClose} className="hd-btn hd-btn-sec">
            Cerrar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="hd-overlay">
      <div className="hd-modal">
        <div className="hd-header">
          <div className="hd-header-top">
            <h2 className="hd-title">{historia.titulo}</h2>
            <button onClick={onClose} className="hd-btn-close">×</button>
          </div>
          <div className="hd-meta">
            <span className={`hd-badge ${historia.es_historia_principal ? 'hd-badge-main' : 'hd-badge-sec'}`}>
              {historia.es_historia_principal ? '⭐ Principal' : '📖 Secundaria'}
            </span>
            <span className="hd-badge hd-badge-lvl">
              🔒 Nivel {historia.nivel_acceso_requerido}
            </span>
            <span className="hd-badge hd-badge-date">
              📅 {new Date(historia.fecha_creacion).toLocaleDateString('es-MX')}
            </span>
          </div>
        </div>

        <div className="hd-tabs">
          <button
            className={`hd-tab ${activeTab === 'contenido' ? 'active' : ''}`}
            onClick={() => setActiveTab('contenido')}
          >
            📜 Contenido
          </button>
          <button
            className={`hd-tab ${activeTab === 'personajes' ? 'active' : ''}`}
            onClick={() => setActiveTab('personajes')}
          >
            🎭 Personajes ({personajes?.length || 0})
          </button>
          <button
            className={`hd-tab ${activeTab === 'multimedia' ? 'active' : ''}`}
            onClick={() => setActiveTab('multimedia')}
          >
            🎥 Multimedia ({multimedia?.length || 0})
          </button>
        </div>

        <div className="hd-content">
          {activeTab === 'contenido' && (
            <div>
              <h3 className="hd-section-title">📝 Descripción</h3>
              <p className="hd-description">{historia.narrativa}</p>

              <div className="hd-actions">
                <button
                  className={`hd-btn ${canAccess ? 'hd-btn-primary' : 'hd-btn-disabled'}`}
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
                  <div className="hd-access-msg">
                    <p>📊 Tu nivel actual: {playerStats?.nivel || 1}</p>
                    <p>🔒 Nivel requerido: {historia.nivel_acceso_requerido}</p>
                  </div>
                )}

                <button
                  className="hd-btn hd-btn-sec"
                  onClick={handleToggleFavorite}
                  disabled={isFavoritingLoading}
                >
                  {isFavoritingLoading ? (
                    '⏳ Procesando...'
                  ) : isFavorited ? (
                    '❤️ Remover de Favoritas'
                  ) : (
                    '🤍 Marcar como Favorita'
                  )}
                </button>
              </div>
            </div>
          )}

          {activeTab === 'personajes' && (
            <div>
              {(personajes && personajes.length > 0) ? (
                <div className="hd-grid">
                  {personajes.map(personaje => (
                    <div key={personaje.id_personaje} className="hd-char-card">
                      {personaje.imagen ? (
                        <img src={personaje.imagen} alt={personaje.nombre} loading="lazy" className="hd-char-img" />
                      ) : (
                        <div className="hd-char-placeholder">
                          <span>👤</span>
                        </div>
                      )}
                      <h4 className="hd-char-name">{personaje.nombre}</h4>
                      <p className="hd-char-rol">{personaje.rol}</p>
                      <p className="hd-char-desc">{personaje.descripcion}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="hd-status-msg">
                  <p>👥 No hay personajes asociados a esta historia</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'multimedia' && (
            <div>
              {(multimedia && multimedia.length > 0) ? (
                <div className="hd-grid">
                  {multimedia.map(recurso => (
                    <div key={recurso.id_recurso} className="hd-media-card">
                      <div className="hd-media-preview">
                        {renderRecurso(recurso)}
                      </div>
                      <div className="hd-media-info">
                        <h4 className="hd-media-title">
                          {recurso.titulo || (recurso.descripcion?.length > 50 ? recurso.descripcion.substring(0, 50) + '...' : (recurso.descripcion || 'Sin descripción'))}
                        </h4>
                        <span className="hd-media-tag">{recurso.tipo.toUpperCase()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="hd-status-msg">
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
