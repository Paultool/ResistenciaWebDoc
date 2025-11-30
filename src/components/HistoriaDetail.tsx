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
  isLocked?: boolean // <--- NUEVO PROP
}

// Interfaces
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

const HistoriaDetail: React.FC<HistoriaDetailProps> = ({ historiaId, onClose, onStartNarrative, isLocked }) => {
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
        setError('ERROR EN LA MATRIZ DE DATOS: ' + err.message);
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
        alert(`[ACCESO DENEGADO] Nivel ${historia.nivel_acceso_requerido} requerido.`)
        return
      }

      setHasStarted(true)
      onStartNarrative(historia);

    } catch (error: any) {
      console.error('Error comenzando historia:', error)
    } finally {
      setIsCompleting(false)
    }
  }

  const handleToggleFavorite = async () => {
    if (!user?.id || isFavoritingLoading) return

    try {
      setIsFavoritingLoading(true)
      const historiaIdStr = String(historiaId)
      const isNowFavorited = await gameService.toggleFavoriteStory(user.id, historiaIdStr)
      setIsFavorited(isNowFavorited)
    } catch (error: any) {
      console.error('Error toggling favorite:', error)
    } finally {
      setIsFavoritingLoading(false)
    }
  }

  const renderRecurso = (recurso: RecursoMultimedia) => {
    if (!recurso || !recurso.archivo) return null;

    // ... Lógica de YouTube igual ... 
    const getYouTubeId = (url: string) => {
      const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;
      const match = url.match(regex);
      return match ? match[1] : null;
    };
    const youtubeId = getYouTubeId(recurso.archivo);
    if (youtubeId) {
      return <div className="hd-media-content bg-black flex items-center justify-center text-red-500">▶ YT_VIDEO</div>;
    }

    const url = recurso.archivo.startsWith('http')
      ? recurso.archivo
      : `${supabase.storage.from('assets-juego').getPublicUrl(recurso.archivo).data.publicUrl}`;

    switch (recurso.tipo) {
      case 'imagen':
        return <img src={url} alt="Asset" className="hd-media-content" />;
      case 'video':
        return <video src={url} className="hd-media-content" />;
      case 'audio':
        return <div className="hd-media-content flex items-center justify-center bg-black text-[#33ff00]">🔊 AUDIO</div>;
      default:
        return <span className="unsupported-media">FILE: {recurso.archivo}</span>;
    }
  };

  if (loading) {
    return (
      <div className="hd-overlay">
        <div className="hd-modal" style={{ justifyContent: 'center', alignItems: 'center', border: 'none', background: 'transparent', boxShadow: 'none' }}>
          <div className="text-[#33ff00] text-xl animate-pulse font-bold tracking-widest">
            {'>'} ACCEDIENDO AL NODO...
          </div>
        </div>
      </div>
    );
  }

  if (error || !historia) {
    return (
      <div className="hd-overlay">
        <div className="hd-modal" style={{ height: 'auto', padding: '40px', textAlign: 'center' }}>
          <p className="text-red-500 mb-6 font-bold">{error || 'NODO NO ENCONTRADO O CORRUPTO.'}</p>
          <button onClick={onClose} className="hd-btn hd-btn-sec">
            [ CERRAR CONEXIÓN ]
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="hd-overlay">
      <div className="hd-modal">

        {/* Decoración de Esquinas Tácticas */}
        <div style={{ position: 'absolute', top: 0, left: 0, width: '10px', height: '10px', borderTop: '2px solid #33ff00', borderLeft: '2px solid #33ff00', zIndex: 10 }}></div>
        <div style={{ position: 'absolute', top: 0, right: 0, width: '10px', height: '10px', borderTop: '2px solid #33ff00', borderRight: '2px solid #33ff00', zIndex: 10 }}></div>
        <div style={{ position: 'absolute', bottom: 0, left: 0, width: '10px', height: '10px', borderBottom: '2px solid #33ff00', borderLeft: '2px solid #33ff00', zIndex: 10 }}></div>
        <div style={{ position: 'absolute', bottom: 0, right: 0, width: '10px', height: '10px', borderBottom: '2px solid #33ff00', borderRight: '2px solid #33ff00', zIndex: 10 }}></div>

        <div className="hd-header">
          <div className="hd-header-top">
            <h2 className="hd-title">{historia.titulo}</h2>
            <button onClick={onClose} className="hd-btn-close">X</button>
          </div>
          <div className="hd-meta">
            <span className={`hd-badge ${historia.es_historia_principal ? 'hd-badge-main' : 'hd-badge-sec'}`}>
              {historia.es_historia_principal ? 'PRIORIDAD: ALTA' : 'PRIORIDAD: BAJA'}
            </span>
            <span className="hd-badge hd-badge-lvl">
              SEC_LVL: {historia.nivel_acceso_requerido}
            </span>
            <span className="hd-badge hd-badge-date">
              DATE: {new Date(historia.fecha_creacion).toLocaleDateString('es-MX')}
            </span>
          </div>
        </div>

        <div className="hd-tabs">
          <button
            className={`hd-tab ${activeTab === 'contenido' ? 'active' : ''}`}
            onClick={() => setActiveTab('contenido')}
          >
            LOG_DATOS
          </button>
          <button
            className={`hd-tab ${activeTab === 'personajes' ? 'active' : ''}`}
            onClick={() => setActiveTab('personajes')}
          >
            SUJETOS [{personajes?.length || 0}]
          </button>
          <button
            className={`hd-tab ${activeTab === 'multimedia' ? 'active' : ''}`}
            onClick={() => setActiveTab('multimedia')}
          >
            ARCHIVOS [{multimedia?.length || 0}]
          </button>
        </div>

        <div className="hd-content">
          {activeTab === 'contenido' && (
            <div>
              <h3 className="hd-section-title">{'>'} RESUMEN DE INTELIGENCIA</h3>
              <p className="hd-description">{historia.narrativa}</p>

              {/* CAMBIO: Si está bloqueado (isLocked), mostramos mensaje y ocultamos botones */}
              {isLocked ? (
                <div className="p-4 border border-yellow-500 bg-yellow-500/10 text-yellow-500 text-center font-bold tracking-widest mt-6 animate-pulse">
                  [ ! ] NODO ENCRIPTADO - REQUIERE DESBLOQUEO PREVIO
                </div>
              ) : (

                <div className="hd-actions">
                  <button
                    className={`hd-btn ${canAccess ? '' : 'hd-btn-disabled'}`}
                    onClick={handleComenzarHistoria}
                    disabled={!canAccess || isCompleting}
                  >
                    {isCompleting ? (
                      'PROCESANDO...'
                    ) : hasStarted ? (
                      '[ SECUENCIA INICIADA ]'
                    ) : canAccess ? (
                      `[ INICIAR SIMULACIÓN ]`
                    ) : (
                      `BLOQUEADO: NIVEL ${historia.nivel_acceso_requerido} REQUERIDO`
                    )}
                  </button>

                  {!canAccess && (
                    <div className="hd-access-msg">
                      TU NIVEL: {playerStats?.nivel || 1} // REQUERIDO: {historia.nivel_acceso_requerido}
                    </div>
                  )}

                  <button
                    className="hd-btn hd-btn-sec"
                    onClick={handleToggleFavorite}
                    disabled={isFavoritingLoading}
                  >
                    {isFavoritingLoading ? '...' : isFavorited ? '[-] REMOVER DE PRIORITARIOS' : '[+] MARCAR PRIORITARIO'}
                  </button>
                </div>
              )}
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
                        <div className="hd-char-placeholder">?</div>
                      )}
                      <h4 className="hd-char-name">{personaje.nombre}</h4>
                      <p className="hd-char-rol">{personaje.rol || 'DESCONOCIDO'}</p>
                      <p className="hd-char-desc">{personaje.descripcion}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="hd-status-msg">
                  SIN REGISTROS DE SUJETOS
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
                          {recurso.titulo || (recurso.descripcion?.length > 30 ? recurso.descripcion.substring(0, 30) + '...' : 'ARCHIVO_SIN_NOMBRE')}
                        </h4>
                        <span className="hd-media-tag">{recurso.tipo.toUpperCase()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="hd-status-msg">
                  NO SE ENCONTRARON ARCHIVOS ADJUNTOS
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