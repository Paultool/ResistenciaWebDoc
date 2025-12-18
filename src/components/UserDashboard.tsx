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
  historias?: any[];  // Array of available stories
}> = ({ onNavigate, onStartNarrative, historias = [] }) => {
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
    <div className="dashboard-container user-dashboard" style={{ background: '#000', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* GRID LAYOUT PRINCIPAL (FLEX GROW) */}
      <div className="dashboard-grid" style={{ flex: 1, overflow: 'hidden' }}>

        {/* PANEL IZQUIERDO: MAPA TÁCTICO */}
        <div className="map-panel">
          <MapaViewS
            historias={historias}
            historiasVisitadas={userProfile?.historias_visitadas || []}
            onStartNarrativeFromMap={(id) => onStartNarrative?.(id)}
            onExit={undefined} // Undefined para ocultar botón cerrar
          />
          {/* Overlay sutil para integrarlo visualmente */}
          <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', boxShadow: 'inset 0 0 50px rgba(0,0,0,0.8)' }}></div>
        </div>

        {/* PANEL DERECHO: LISTA DE OPERACIONES (RESTAURADO) */}
        <div className="missions-panel">
          <h3 className="section-title" style={{ position: 'sticky', top: 0, background: '#000', zIndex: 10, padding: '10px 0', borderBottom: '1px solid #333' }}>
            {t.activeMissions} [{historias.length}]
          </h3>

          {historias.map((historia, index) => {
            const historiaId = historia.id_historia || historia.id;
            const titulo = historia.titulo || 'OPERACIÓN DESCONOCIDA';
            const descripcion = historia.narrativa || historia.descripcion || '';

            // RESTAURADO: Imágenes via Map
            const imagenUrl = historia.id_imagen_historia
              ? imagenesMap.get(historia.id_imagen_historia) || null
              : null;

            // RESTAURADO: Lógica de Estado y Favoritos
            const favoritas = userProfile?.historias_favoritas || [];
            const esFavorita = favoritas.includes(String(historiaId));

            const esCompletada = (userProfile?.historias_visitadas || []).map(String).includes(String(historiaId));
            const esBloqueada = historia.id_historia_dependencia
              ? !(userProfile?.historias_visitadas || []).map(String).includes(String(historia.id_historia_dependencia))
              : false;

            const progreso = esCompletada ? 100 : 0;

            // Handler para Favoritos (Copiado de original)
            const handleToggleFavorite = async (e: React.MouseEvent) => {
              e.stopPropagation();
              if (!user?.id) return;
              const favs = [...favoritas];
              const historiaIdStr = String(historiaId);
              const idx = favs.indexOf(historiaIdStr);
              if (idx > -1) favs.splice(idx, 1);
              else favs.push(historiaIdStr);

              // Optimistic update local
              const newProfile = { ...userProfile, historias_favoritas: favs };
              setUserProfile(newProfile);

              await supabase.from('perfiles_jugador').update({ historias_favoritas: favs }).eq('user_id', user.id);
              // Background refresh
              const perfil = await gameService.getPlayerStats(user.id);
              setUserProfile(perfil);
            };

            return (
              <div
                key={historiaId}
                className="operation-row"
                style={{ opacity: esBloqueada ? 0.6 : 1, padding: '10px', display: 'grid', gridTemplateColumns: '80px 1fr', gap: '15px', alignItems: 'start' }}
                onClick={() => !esBloqueada && onStartNarrative?.(historiaId)}
              >
                {/* IMAGEN THUMBNAIL */}
                <div style={{ width: '80px', height: '80px', background: '#111', borderRadius: '4px', overflow: 'hidden', border: '1px solid #333' }}>
                  {imagenUrl ? (
                    <img src={imagenUrl} alt={titulo} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <div className="flex items-center justify-center h-full text-2xl">📂</div>
                  )}
                </div>

                {/* CONTENIDO */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', width: '100%' }}>

                  <div className="operation-header" style={{ padding: 0, border: 'none', marginBottom: 0 }}>
                    <span className="operation-title" style={{ fontSize: '0.85rem' }}>{titulo}</span>
                    <div className="flex gap-2">
                      {esCompletada && <span className="operation-status status-completed">{t.badgeCompleted}</span>}
                      {esBloqueada && <span className="operation-status status-locked">{t.badgeLocked}</span>}
                    </div>
                  </div>

                  {/* Descripción Corta */}
                  <div style={{ fontSize: '0.7rem', color: '#aaa', lineHeight: '1.2', height: '2.4em', overflow: 'hidden' }}>
                    {descripcion.substring(0, 80)}{descripcion.length > 80 ? '...' : ''}
                  </div>

                  {/* Barra Progreso */}
                  <div className="operation-progress-bar" style={{ marginTop: 'auto' }}>
                    <div className="operation-progress-fill" style={{ width: `${progreso}%` }}></div>
                  </div>

                  {/* Footer Card: Botones */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '5px' }}>
                    {/* Botón Favorito */}
                    {!esBloqueada && (
                      <button
                        onClick={handleToggleFavorite}
                        style={{ background: 'none', border: 'none', color: esFavorita ? '#dc2626' : '#555', fontSize: '1.2rem', cursor: 'pointer', padding: 0 }}
                      >
                        {esFavorita ? '♥' : '♡'}
                      </button>
                    )}

                    {!esBloqueada && (
                      <button className="operation-execute-btn" style={{ padding: '2px 8px', fontSize: '0.7rem' }}>
                        EJECUTAR &gt;
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