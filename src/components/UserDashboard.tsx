import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useLanguage } from '../contexts/LanguageContext'
import { obtenerHistorias, obtenerPersonajes, obtenerUbicaciones } from '../supabaseClient'
import { gameServiceUser as gameService } from '../services/GameServiceUser'
import GameStats from './GameStats'
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
    titleResources: '🎒 RECURSOS EN INVENTARIO'
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
    titleResources: '🎒 INVENTORY RESOURCES'
  }
}

const UserDashboard: React.FC<{ onNavigate?: (view: string) => void; onStartNarrative?: (id: number) => void }> = ({ onNavigate, onStartNarrative }) => {
  const { user, signOut } = useAuth()
  const { language } = useLanguage()
  const t = dashboardTranslations[language]

  const [dashboardData, setDashboardData] = useState<DashboardData>({
    totalHistorias: 0,
    totalPersonajes: 0,
    totalUbicaciones: 0
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false);
  const [activeModal, setActiveModal] = useState<'missions' | 'contacts' | 'locations' | 'merits' | 'resources' | null>(null);
  const [modalData, setModalData] = useState<any>(null);
  const [loadingModal, setLoadingModal] = useState(false);

  useEffect(() => {
    cargarDatosBasicos()
    if (user?.id) {
      initializarPerfilJugador()
    }
  }, [user])

  const cargarDatosBasicos = async () => {
    try {
      setLoading(true)
      setError(null)
      const [historias, personajes, ubicaciones] = await Promise.all([
        obtenerHistorias(),
        obtenerPersonajes(),
        obtenerUbicaciones()
      ])
      setDashboardData({
        totalHistorias: historias.length,
        totalPersonajes: personajes.length,
        totalUbicaciones: ubicaciones.length
      })
    } catch (error: any) {
      console.error('Error:', error)
      setError(t.error + error.message)
    } finally {
      setLoading(false)
    }
  }

  const initializarPerfilJugador = async () => {
    try {
      if (!user?.id) return
      await gameService.initializePlayerProfile(user.id)
      if (user?.email === 'paultool@gmail.com') setIsAdmin(true);
    } catch (error: any) {
      console.error('Error init profile:', error)
    }
  }

  const handleSignOut = async () => {
    try {
      if (gameService.clearCache) gameService.clearCache()
    } catch (e) { console.warn(e) }
    finally { await signOut() }
  }

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
          <p>{'>'} {t.loading}</p>
        </div>
      ) : (
        <>
          {/* 2. GRID PRINCIPAL */}
          <div className="main-dashboard-grid">
            {/* PANEL IZQ: ESTADÍSTICAS */}
            <div className="game-stats-panel">
              <h3 className="section-title main-title">{'>'} {t.progress}</h3>
              <GameStats showDetailed={true} onNavigateToStory={onStartNarrative} onStatClick={handleStatClick} />
            </div>
            {/* PANEL DER: MÉTRICAS GLOBALES */}
            <div className="data-metrics-panel">
              <h3 className="section-title">{t.global}</h3>
              <div className="info-grid">
                <div className="info-card">
                  <div className="info-icon">📂</div>
                  <div className="info-content">
                    <div className="info-number">{dashboardData.totalHistorias}</div>
                    <div className="info-label">{t.missions}</div>
                  </div>
                </div>
                {/*sujetos*/}
                <div className="info-card">
                  <div className="info-icon">👥</div>
                  <div className="info-content">
                    <div className="info-number">{dashboardData.totalPersonajes}</div>
                    <div className="info-label">{t.subjects}</div>
                  </div>
                </div>
                <div className="info-card">
                  <div className="info-icon">📍</div>
                  <div className="info-content">
                    <div className="info-number">{dashboardData.totalUbicaciones}</div>
                    <div className="info-label">{t.locations}</div>
                  </div>
                </div>
              </div>
              <div className="side-panel-footer">
                <p>{t.sync}: {new Date().toLocaleTimeString()}</p>
                {isAdmin && <p className="admin-status">{t.root}</p>}
              </div>
            </div>
          </div>
        </>
      )}
      {/* MODAL */}
      {renderModalContent()}
    </div>
  )
}

export default UserDashboard