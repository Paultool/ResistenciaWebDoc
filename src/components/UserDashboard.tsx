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
    tapToExpand: 'RADAR TÁCTICO > TOCAR PARA EXPANDIR',
    leader: 'LÍDER DE RESISTENCIA',
    merits: 'MÉRITOS',
    resources: 'RECURSOS',
    contacts: 'CONTACTOS'
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
    tapToExpand: 'TACTICAL RADAR > TAP TO EXPAND',
    leader: 'RESISTANCE LEADER',
    merits: 'MERITS',
    resources: 'RESOURCES',
    contacts: 'CONTACTS'
  }
}

const UserDashboard: React.FC<{
  onNavigate?: (view: string) => void;
  onStartNarrative?: (id: number) => void;
  onViewDetail?: (id: number) => void;
  historias?: any[];  // Array of available stories
}> = ({ onNavigate, onStartNarrative, onViewDetail, historias = [] }) => {
  const { user, signOut } = useAuth()
  const { language } = useLanguage()
  const t = dashboardTranslations[language] || dashboardTranslations.es

  // Agregamos estado para historias visitadas
  const [userProfile, setUserProfile] = useState<any>(null);
  const [favoritas, setFavoritas] = useState<string[]>([]); // Estado local para favoritas

  // Mapa para imágenes de historias
  const [imagenesMap, setImagenesMap] = useState<Map<number, string>>(new Map());


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
      try {
        const { data, error } = await supabase
          .from('recursomultimedia')
          .select('id_recurso, archivo')
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
      initializarPerfilJugador();
    }
  }, [user, initializarPerfilJugador]);

  return (
    <div className="dashboard-container user-dashboard">

      {/* GRID LAYOUT PRINCIPAL */}
      <div className="dashboard-grid">

        {/* PANEL IZQUIERDO: MAPA TÁCTICO */}
        <div className="map-panel">
          <MapaViewS
            historias={historias}
            historiasVisitadas={userProfile?.historias_visitadas || []}
            onStartNarrativeFromMap={(id) => onStartNarrative?.(id)}
            onExit={undefined}
          />
          <div className="map-overlay"></div>
        </div>

        {/* PANEL DERECHO: LISTA DE OPERACIONES */}
        <div className="missions-panel">
          <h3 className="section-title">
            {t.activeMissions} [{historias.length}]
          </h3>

          {historias.map((historia) => {
            const historiaId = historia.id_historia || historia.id;
            const titulo = historia.titulo || 'OPERACIÓN DESCONOCIDA';
            const descripcion = historia.narrativa || historia.descripcion || '';
            const imagenUrl = historia.id_imagen_historia ? imagenesMap.get(historia.id_imagen_historia) : null;
            const favoritas = userProfile?.historias_favoritas || [];
            const esFavorita = favoritas.includes(String(historiaId));
            const esCompletada = (userProfile?.historias_visitadas || []).map(String).includes(String(historiaId));
            const esBloqueada = historia.id_historia_dependencia
              ? !(userProfile?.historias_visitadas || []).map(String).includes(String(historia.id_historia_dependencia))
              : false;
            const progreso = esCompletada ? 100 : 0;

            const handleToggleFavorite = async (e: React.MouseEvent) => {
              e.stopPropagation();
              if (!user?.id) return;
              const favs = [...favoritas];
              const historiaIdStr = String(historiaId);
              const idx = favs.indexOf(historiaIdStr);
              if (idx > -1) favs.splice(idx, 1);
              else favs.push(historiaIdStr);

              const newProfile = { ...userProfile, historias_favoritas: favs };
              setUserProfile(newProfile);
              await supabase.from('perfiles_jugador').update({ historias_favoritas: favs }).eq('user_id', user.id);
              const perfil = await gameService.getPlayerStats(user.id);
              setUserProfile(perfil);
            };

            return (
              <div
                key={historiaId}
                className={`operation-row ${esBloqueada ? 'locked' : ''}`}
                onClick={() => !esBloqueada && onStartNarrative?.(historiaId)}
              >
                {/* IMAGEN THUMBNAIL (Clickable to show details) */}
                <div
                  className="operation-thumbnail cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    onViewDetail?.(historiaId);
                  }}
                  title="Ver detalles del nodo"
                >
                  {imagenUrl ? (
                    <img src={imagenUrl} alt={titulo} />
                  ) : (
                    <div className="operation-placeholder">📂</div>
                  )}
                </div>

                {/* CONTENIDO */}
                <div className="operation-content">
                  <div className="operation-header">
                    <span className="operation-title">{titulo}</span>
                    <div className="operation-badges">
                      {esCompletada && <span className="operation-status status-completed">{t.badgeCompleted}</span>}
                      {esBloqueada && <span className="operation-status status-locked">{t.badgeLocked}</span>}
                    </div>
                  </div>

                  <div className="operation-description">
                    {descripcion.substring(0, 80)}{descripcion.length > 80 ? '...' : ''}
                  </div>

                  <div className="operation-progress-bar">
                    <div className="operation-progress-fill" style={{ width: `${progreso}%` }}></div>
                  </div>

                  <div className="operation-footer">
                    {!esBloqueada && (
                      <button onClick={handleToggleFavorite} className={`favorite-btn ${esFavorita ? 'active' : ''}`} title={esFavorita ? 'Remover de prioritarios' : 'Marcar prioritario'}>
                        <i className={`${esFavorita ? 'fas' : 'far'} fa-heart`}></i>
                      </button>
                    )}
                    {!esBloqueada && (
                      <button className="operation-execute-btn">
                        {language === 'es' ? 'EJECUTAR >' : 'EXECUTE >'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  )
}


export default UserDashboard