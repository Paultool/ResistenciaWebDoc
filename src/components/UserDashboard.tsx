import React, { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useLanguage } from '../contexts/LanguageContext'
import { obtenerHistorias, obtenerPersonajes, obtenerUbicaciones, supabase } from '../supabaseClient'
import { gameServiceUser as gameService } from '../services/GameServiceUser'
import GameStats from './GameStats'
import MapaMiniPreview from './MapaMiniPreview'
import MapaViewS from './MapaViewS'
import './UserDashboard.css'

interface DashboardData {
  totalHistorias: number
  totalPersonajes: number
  totalUbicaciones: number
}

const dashboardTranslations = {
  es: {
    connection: 'CONEXIÓN ESTABLECIDA',
    exit: '[ SALIR ]',
    loading: 'CARGANDO INTERFAZ DE COMANDO...',
    error: 'FALLO DE SISTEMA: ',
    retry: 'REINTENTAR',
    progress: 'PROGRESO INDIVIDUAL',
    global: 'DB GLOBAL',
    missions: 'MISIONES',
    subjects: 'SUJETOS',
    locations: 'PUNTOS',
    sync: 'SYNC',
    root: '[ PRIVILEGIOS ROOT ]',
    nodata: '[ ! ] NO HAY DATOS DISPONIBLES',
    loadingData: '> CARGANDO DATOS...',
    titleMissions: '📂 MISIONES COMPLETADAS',
    titleContacts: '👥 CONTACTOS CONOCIDOS',
    titleLocations: '📍 LUGARES VISITADOS',
    titleMerits: '🎖️ MÉRITOS DESBLOQUEADOS',
    titleResources: '🎒 RECURSOS EN INVENTARIO',
    activeMissions: '> MISIONES ACTIVAS',
    tacticalRadar: 'RADAR TÁCTICO',
    badgeCompleted: '✓ COMPLETADO',
    badgeLocked: '🔒 BLOQUEADO',
    badgeAvailable: '▶ DISPONIBLE',
    tapToExpand: 'RADAR TÁCTICO > TOCAR PARA EXPANDIR'
  },
  en: {
    connection: 'CONNECTION ESTABLISHED',
    exit: '[ EXIT ]',
    loading: 'LOADING COMMAND INTERFACE...',
    error: 'SYSTEM FAILURE: ',
    retry: 'RETRY',
    progress: 'INDIVIDUAL PROGRESS',
    global: 'GLOBAL DB',
    missions: 'MISSIONS',
    subjects: 'SUBJECTS',
    locations: 'LOCATIONS',
    sync: 'SYNC',
    root: '[ ROOT PRIVILEGES ]',
    nodata: '[ ! ] NO DATA AVAILABLE',
    loadingData: '> LOADING DATA...',
    titleMissions: '📂 COMPLETED MISSIONS',
    titleContacts: '👥 KNOWN CONTACTS',
    titleLocations: '📍 VISITED LOCATIONS',
    titleMerits: '🎖️ UNLOCKED MERITS',
    titleResources: '🎒 INVENTORY RESOURCES',
    activeMissions: '> ACTIVE MISSIONS',
    tacticalRadar: 'TACTICAL RADAR',
    badgeCompleted: '✓ COMPLETED',
    badgeLocked: '🔒 LOCKED',
    badgeAvailable: '▶ AVAILABLE',
    tapToExpand: 'TACTICAL RADAR > TAP TO EXPAND'
  }
}

const UserDashboard: React.FC<{
  onNavigate?: (view: string) => void;
  onStartNarrative?: (id: number) => void;
  historias?: any[];  // Array of available stories
}> = ({ onNavigate, onStartNarrative, historias = [] }) => {
  const { user, signOut } = useAuth()
  const { language } = useLanguage()
  const t = dashboardTranslations[language] || dashboardTranslations.es

  const [profileData, setProfileData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showFullMap, setShowFullMap] = useState(false); // Estado para mostrar mapa full

  // Agregamos estado para historias visitadas
  const [userProfile, setUserProfile] = useState<any>(null);
  const [favoritas, setFavoritas] = useState<string[]>([]); // Estado local para favoritas

  // Nuevo estado para los modales
  const [activeModal, setActiveModal] = useState<'missions' | 'contacts' | 'locations' | 'merits' | 'resources' | null>(null);
  const [modalData, setModalData] = useState<any[] | null>(null);
  const [loadingModal, setLoadingModal] = useState(false);

  // Mapa para imágenes de historias
  const [imagenesMap, setImagenesMap] = useState<Map<number, string>>(new Map());


  const cargarDatosBasicos = useCallback(async () => {
    if (!user) return

    try {
      setLoading(true)
      const data = await gameService.getPlayerStats(user.id)
      setProfileData({
        totalHistorias: data?.historias_completadas || 0,
        totalPersonajes: data?.personajes_encontrados || 0,
        totalUbicaciones: data?.ubicaciones_descubiertas || 0
      })
    } catch (err: any) {
      console.error('Error cargando datos básicos:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [user])

  // Cargar perfil completo del jugador (incluyendo historias visitadas)
  const initializarPerfilJugador = useCallback(async () => {
    if (!user) return;
    try {
      const perfil = await gameService.getPlayerStats(user.id);
      setUserProfile(perfil);
      setFavoritas(perfil?.historias_favoritas || []); // Inicializar favoritas
    } catch (error) {
      console.error("Error al cargar perfil de jugador:", error);
    }
  }, [user]);

  // Cargar imágenes de historias (recursos multimedia)
  useEffect(() => {
    const cargarImagenes = async () => {
      // Necesitamos cargar recursos multimedia que sean imágenes de historias
      // Esto es un parche porque no tenemos las URLs directas en la prop historias
      // En una implementación ideal, "historias" ya traería la URL de la imagen
      try {
        const { data, error } = await supabase
          .from('recursomultimedia') // CORRECTED TABLE NAME
          .select('id_recurso, archivo') // CORRECTED COLUMNS
          .eq('tipo', 'imagen');

        if (data) {
          const map = new Map<number, string>();
          data.forEach((item: any) => {
            map.set(item.id_recurso, item.archivo);
          });
          setImagenesMap(map);
        }
      } catch (e) {
        console.error("Error cargando imagenes:", e);
      }
    };

    cargarImagenes();
  }, []);

  useEffect(() => {
    if (user) {
      cargarDatosBasicos();
      initializarPerfilJugador();
    }
  }, [user, cargarDatosBasicos, initializarPerfilJugador]);

  const handleSignOut = async () => {
    try {
      if (gameService.clearCache) gameService.clearCache();
    } catch (e) {
      console.warn(e);
    } finally {
      await signOut();
    }
  };

  const handleStatClick = async (type: 'missions' | 'contacts' | 'locations' | 'merits' | 'resources') => {
    if (!user?.id) return;

    setActiveModal(type);
    setLoadingModal(true);

    try {
      let data;
      switch (type) {
        case 'missions':
          data = await gameService.getCompletedStories(user.id);
          break;
        case 'contacts':
          data = await gameService.getKnownCharacters(user.id);
          break;
        case 'locations':
          data = await gameService.getVisitedLocations(user.id);
          break;
        case 'merits':
          data = await gameService.getUnlockedRewards(user.id);
          break;
        case 'resources':
          data = await gameService.getInventoryItems(user.id);
          break;
      }
      setModalData(data);
    } catch (error) {
      console.error('Error loading modal data:', error);
      setModalData([]);
    } finally {
      setLoadingModal(false);
    }
  }

  const closeModal = () => {
    setActiveModal(null);
    setModalData(null);
  }

  const renderModalContent = () => {
    if (!activeModal) return null;
    const getModalTitle = () => {
      switch (activeModal) {
        case 'missions': return t.titleMissions;
        case 'contacts': return t.titleContacts;
        case 'locations': return t.titleLocations;
        case 'merits': return t.titleMerits;
        case 'resources': return t.titleResources;
      }
    };
    return (
      <div className="stat-modal-overlay" onClick={closeModal}>
        <div className="stat-modal-content" onClick={(e) => e.stopPropagation()}>
          <div className="stat-modal-header">
            <h3>{getModalTitle()}</h3>
            <button onClick={closeModal} className="stat-modal-close">×</button>
          </div>
          <div className="stat-modal-body">
            {loadingModal ? (
              <div className="text-center py-8 text-[#33ff00]">
                <p>{t.loadingData}</p>
              </div>
            ) : modalData && modalData.length > 0 ? (
              <div className="stat-modal-list">
                {modalData.map((item: any, index: number) => (
                  <div key={index} className="stat-modal-item">
                    <div className="stat-modal-item-icon">
                      {activeModal === 'missions' && '📂'}
                      {activeModal === 'contacts' && '👤'}
                      {activeModal === 'locations' && '📍'}
                      {activeModal === 'merits' && '🎖️'}
                      {activeModal === 'resources' && '🎒'}
                    </div>
                    <div className="stat-modal-item-content">
                      <div className="stat-modal-item-name">
                        {item.nombre || item.titulo || item.name || 'Item'}
                      </div>
                      {item.descripcion && (
                        <div className="stat-modal-item-desc">{item.descripcion}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <p>{t.nodata}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="dashboard-container">
      {/* 1. HEADER DE ESTADO */}
      <div className="dashboard-status-bar">
        <div className="status-label">
          <span className="animate-pulse text-green-500">●</span>
          <span className="hidden sm:inline ml-2">{t.connection} |</span>
          <span className="user-id-display ml-2">OP: {user?.email?.split('@')[0]}</span>
        </div>
        <button onClick={handleSignOut} className="btn-status-logout">
          {t.exit}
        </button>
      </div>

      {error && (
        <div className="border border-red-500 text-red-500 p-2 text-center text-xs mb-4 bg-red-500/10">
          <p>⚠️ {t.error + error} <button onClick={cargarDatosBasicos} className="underline ml-2">{t.retry}</button></p>
        </div>
      )}

      {loading ? (
        <div className="text-center p-10 text-[#33ff00] text-sm animate-pulse">
          <p>{'>'} {t.loading || 'CARGANDO INTERFAZ DE COMANDO...'}</p>
        </div>
      ) : showFullMap ? (
        /* VISTA DE MAPA COMPLETA */
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: '#000' }}>
          <MapaViewS
            historias={historias}
            historiasVisitadas={userProfile?.historias_visitadas || []}
            onStartNarrativeFromMap={(id) => {
              setShowFullMap(false);
              onStartNarrative?.(id);
            }}
            onExit={() => setShowFullMap(false)}
          />
        </div>
      ) : (
        /* VISTA NORMAL DASHBOARD */
        null
      )}

      {/* LAYOUT RESTAURADO: GameStats arriba como estaba originalmente */}

      {!loading && (
        <>
          {/* 1. GAME STATS - ARRIBA (muestra PROGRESO INDIVIDUAL completo) */}
          <div className="game-stats-panel-top">
            <h3 className="section-title main-title">&gt; {t.progress}</h3>
            <GameStats showDetailed={true} onNavigateToStory={onStartNarrative} onStatClick={handleStatClick} />
          </div>

          {/* 2. HISTORIAS - DESPUÉS DE STATS */}
          {historias && historias.length > 0 && (() => {
            // Obtener favoritos del perfil
            const favoritas = userProfile?.historias_favoritas || [];

            // Función para toggle favorite
            const handleToggleFavorite = async (historiaId: number, e: React.MouseEvent) => {
              e.stopPropagation();
              if (!user?.id) return;

              const favs = [...favoritas];
              const historiaIdStr = String(historiaId);
              const index = favs.indexOf(historiaIdStr);

              if (index > -1) {
                favs.splice(index, 1);
              } else {
                favs.push(historiaIdStr);
              }

              // Actualizar en BD
              await supabase
                .from('perfiles_jugador')
                .update({ historias_favoritas: favs })
                .eq('user_id', user.id);

              // Recargar perfil
              const perfil = await gameService.getPlayerStats(user.id);
              setUserProfile(perfil);
            };

            return (
              <div className="historias-disponibles-section">
                <h3 className="section-title">{t.activeMissions} [{historias.length}]</h3>

                <div className="historias-horizontal-scroll">
                  {historias.map((historia, index) => {
                    const historiaId = historia.id_historia || historia.id;
                    const titulo = historia.titulo || 'MISIÓN SIN TÍTULO';
                    const descripcion = historia.narrativa || historia.descripcion || '';

                    // EXACTAMENTE como FlujoNarrativo - usar imagenesMap.get()
                    const imagenUrl = historia.id_imagen_historia
                      ? imagenesMap.get(historia.id_imagen_historia) || null
                      : null;

                    // Verificar si es favorita - usar favoritas del scope externo
                    const esFavorita = favoritas.includes(String(historiaId));

                    // Calcular estado bloqueado (asegurando comparación de strings)
                    const esBloqueada = historia.id_historia_dependencia
                      ? !(userProfile?.historias_visitadas || []).map(String).includes(String(historia.id_historia_dependencia))
                      : false;

                    // Calcular estado completada (asegurando comparación de strings)
                    const esCompletada = (userProfile?.historias_visitadas || []).map(String).includes(String(historiaId));

                    const progreso = esCompletada ? 100 : 0;

                    return (
                      <div
                        key={historiaId}
                        className="historia-card-horizontal"
                        onClick={() => !esBloqueada && onStartNarrative?.(historiaId)}
                        title={titulo}
                        style={{ cursor: esBloqueada ? 'not-allowed' : 'pointer' }}
                      >
                        {/* BADGES SUPERIORES */}
                        <div className="historia-badges-top">
                          <span className="badge-sec">SEC 0{index + 1}</span>
                          {esCompletada && <span className="badge-completado-top">{t.badgeCompleted}</span>}
                          {esBloqueada && <span className="badge-bloqueado-top">{t.badgeLocked}</span>}
                        </div>

                        {/* Preview image */}
                        <div className="historia-preview">
                          {imagenUrl ? (
                            <img src={imagenUrl} alt={titulo} />
                          ) : (
                            <div className="historia-placeholder">📂</div>
                          )}
                        </div>

                        {/* Info */}
                        <div className="historia-info">
                          <div className="historia-titulo">{titulo}</div>

                          {/* Descripción */}
                          {descripcion && (
                            <div className="historia-descripcion">
                              {descripcion.substring(0, 65)}{descripcion.length > 65 ? '...' : ''}
                            </div>
                          )}

                          {/* Progress bar */}
                          <div className="historia-progreso-container">
                            <div
                              className="historia-progreso-bar"
                              style={{ width: `${progreso}%` }}
                            />
                          </div>

                          {/* Botones de acción */}
                          <div className="historia-actions">
                            {/* Status badge */}
                            <div className="historia-badges">
                              {esCompletada ? (
                                <span className="badge-completado">{t.badgeCompleted}</span>
                              ) : esBloqueada ? (
                                <span className="badge-bloqueado">{t.badgeLocked}</span>
                              ) : (
                                <span className="badge-disponible">{t.badgeAvailable}</span>
                              )}
                            </div>

                            {/* Botón de favoritos - IGUAL que FlujoNarrativo */}
                            {!esBloqueada && (
                              <button
                                className="historia-favorite-btn"
                                onClick={(e) => handleToggleFavorite(historiaId, e)}
                                title={esFavorita ? 'Quitar de favoritos' : 'Agregar a favoritos'}
                              >
                                {esFavorita ? '♥' : '♡'}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* 3. MINI MAPA - RADAR */}
          <div className="dashboard-minimap-section">
            <div className="section-title-map" style={{
              color: '#33ff00',
              fontSize: '0.9rem',
              marginBottom: '10px',
              fontWeight: 'bold',
              letterSpacing: '2px'
            }}>
              {t.tacticalRadar}
            </div>
            <MapaMiniPreview
              historias={historias}
              userProfile={userProfile}
              onExpand={() => setShowFullMap(true)}
              label={t.tapToExpand}
            />
          </div>
        </>
      )}

      {/* MODAL */}
      {renderModalContent()}
    </div >
  )
}

export default UserDashboard