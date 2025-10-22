import React, { useState, useEffect } from 'react'
import { useAdmin } from '../hooks/useAdmin'
import AdminHistorias from './AdminHistorias'
import AdminPersonajes from './AdminPersonajes'
import AdminUbicaciones from './AdminUbicaciones'
import AdminUsuarios from './AdminUsuarios'
import AdminConfig from './AdminConfig'
import AdminAnalytics from './AdminAnalytics'
import AdminFlujoNarrativo from './AdminFlujoNarrativo';
import AdminRecursosMultimedia from './AdminRecursosMultimedia';
import AdminRecompensas from './AdminRecompensas';
import FlujoNarrativoDisplay from './FlujoNarrativoDisplay';
import FlujoNarrativoUsuario from './FlujoNarrativoUsuario';
// Importamos la función de la API y la interfaz de tipos
// NOTA: Asegúrate de que AdminDashboardStats en supabaseClient.ts use minúsculas
import { fetchDashboardStats, AdminDashboardStats } from '../supabaseClient';


import './AdminPanel.css'

interface AdminPanelProps {
  onBack?: () => void
}

type AdminView = 'dashboard' | 'historias' | 'personajes' | 'ubicaciones' | 'usuarios' | 'config' | 'analytics' | 'flujo_narrativo' | 'recursosMultimedia' | 'recompensas' | 'flujodisplay' | 'flujousuario';


const AdminPanel: React.FC<AdminPanelProps> = ({ onBack }) => {
  const { isAdmin, adminUser, loading } = useAdmin()
  const [currentView, setCurrentView] = useState<AdminView>('dashboard')
  const [selectedHistoriaId, setSelectedHistoriaId] = useState<number | null>(null);
  
  // Usamos el tipo corregido con minúsculas para coincidir con el RPC de Supabase
  const [stats, setStats] = useState<AdminDashboardStats>({
    totalusuarios: 0,
    totalhistorias: 0,
    totalpersonajes: 0,
    totalubicaciones: 0,
    usuariosactivos: 0,
    sesioneshoy: 0
  })

  const [statsLoading, setStatsLoading] = useState(true);

  // --- Hook para cargar las estadísticas ---
  useEffect(() => {
    const loadStats = async () => {
      setStatsLoading(true);
      try {
        const dashboardStats = await fetchDashboardStats();
        console.log('✅ Estadísticas del Dashboard cargadas:', dashboardStats);
        setStats(dashboardStats);
      } catch (error) {
        console.error('❌ Error al cargar las estadísticas del dashboard:', error);
      } finally {
        setStatsLoading(false);
      }
    };
    
    if (!loading && isAdmin) {
      loadStats();
    }
  }, [loading, isAdmin]);


  if (loading) {
    return (
      <div className="admin-panel">
        <div className="admin-loading">
          <h2>⚙️ Verificando permisos...</h2>
        </div>
      </div>
    )
  }

  if (!isAdmin) {
    // ... (Lógica de no autorizado)
    return (
      <div className="admin-panel">
        <div className="admin-unauthorized">
          <div className="unauthorized-content">
            <h2>🚫 Acceso Restringido</h2>
            <p>No tienes permisos de administrador para acceder a este panel.</p>
            <p><strong>Usuario actual:</strong> {adminUser?.email}</p>
            <p><strong>Rol:</strong> {adminUser?.role}</p>
            <button onClick={onBack} className="btn btn-secondary">
              ← Volver al Dashboard
            </button>
          </div>
        </div>
      </div>
    )
  }
  
  const handleSelectHistoria = (id: number) => {
    setSelectedHistoriaId(id);
    setCurrentView('flujo_narrativo');
  };

  // Función para renderizar el contenido de la vista actual
  const renderCurrentView = () => {
    switch (currentView) {
      case 'historias':
        return <AdminHistorias onSelectHistoria={handleSelectHistoria} />
      case 'personajes':
        return <AdminPersonajes />
      case 'ubicaciones':
        return <AdminUbicaciones />
      case 'usuarios':
        return <AdminUsuarios />
      case 'recursosMultimedia':
        return <AdminRecursosMultimedia />
      case 'recompensas':
        return <AdminRecompensas />;
      case 'flujo_narrativo':
        return <AdminFlujoNarrativo historiaId={selectedHistoriaId} />
      case 'flujodisplay':
        return <FlujoNarrativoDisplay historiaId={selectedHistoriaId} />; 
      case 'flujousuario':
        return <FlujoNarrativoUsuario historiaId={selectedHistoriaId} />; 
      case 'config':
        return <AdminConfig />
      case 'analytics':
        return <AdminAnalytics />
      default:
        // Renderizado del Dashboard (currentView === 'dashboard')
        if (statsLoading) {
          return (
             <div className="admin-dashboard">
                <div className="dashboard-header">
                  <h2>📊 Panel de Control</h2>
                  <p>Cargando estadísticas...</p>
                </div>
                <div className="admin-loading-spinner"></div> 
             </div>
          )
        }

        return (
          <div className="admin-dashboard">
            <div className="dashboard-header">
              <h2>📊 Panel de Control</h2>
              <p>Bienvenido al sistema de administración de WebDoc La Resistencia</p>
            </div>

            {/* Grid de Estadísticas con acceso en minúsculas */}
            <div className="admin-stats-grid">
              <div className="admin-stat-card users">
                <div className="stat-icon">👥</div>
                <div className="stat-content">
                  <h3>{stats.totalusuarios}</h3>
                  <p>Usuarios Totales</p>
                </div>
              </div>

              <div className="admin-stat-card stories">
                <div className="stat-icon">📚</div>
                <div className="stat-content">
                  <h3>{stats.totalhistorias}</h3>
                  <p>Historias</p>
                </div>
              </div>

              <div className="admin-stat-card characters">
                <div className="stat-icon">🎭</div>
                <div className="stat-content">
                  <h3>{stats.totalpersonajes}</h3>
                  <p>Personajes</p>
                </div>
              </div>

              <div className="admin-stat-card locations">
                <div className="stat-icon">🗺️</div>
                <div className="stat-content">
                  <h3>{stats.totalubicaciones}</h3>
                  <p>Ubicaciones</p>
                </div>
              </div>

              <div className="admin-stat-card active">
                <div className="stat-icon">🟢</div>
                <div className="stat-content">
                  <h3>{stats.usuariosactivos}</h3>
                  <p>Usuarios Activos (Últimas 24h)</p>
                </div>
              </div>

              <div className="admin-stat-card sessions">
                <div className="stat-icon">📈</div>
                <div className="stat-content">
                  <h3>{stats.sesioneshoy}</h3>
                  <p>Interacciones Hoy</p>
                </div>
              </div>
            </div>
            
            {/* Las acciones rápidas de navegación ya NO van aquí, el menú es fijo */}

            <div className="recent-activity">
              <h3>📋 Actividad Reciente</h3>
              <div className="activity-list">
                <div className="activity-item">
                  <span className="activity-time">Hace 2 horas</span>
                  <span className="activity-description">Nuevo usuario registrado: usuario@ejemplo.com</span>
                </div>
                <div className="activity-item">
                  <span className="activity-time">Hace 5 horas</span>
                  <span className="activity-description">Historia "Tepito Resiste" completada 12 veces</span>
                </div>
                <div className="activity-item">
                  <span className="activity-time">Hace 1 día</span>
                  <span className="activity-description">Sistema de logros actualizado</span>
                </div>
              </div>
            </div>
          </div>
        )
      }

      
  }

  return (
    <div className="admin-panel">
      {/* El header ahora es el contenedor fijo que incluye el menú */}
      <div className="admin-header">
        <div className="admin-nav">
          {/* Botón de "Volver" solo si NO es el dashboard */}
          {currentView !== 'dashboard' && (
            <button 
              className="btn-back-dashboard" 
              onClick={() => setCurrentView('dashboard')}
            >
              ← Dashboard
            </button>
          )}
          <h1>⚙️ Administración</h1>
          <div className="admin-user-info">
            <span className="admin-badge">ADMIN</span>
            <span className="admin-email">{adminUser?.email}</span>
          </div>
        </div>
        
        {/* 🚀 EL MENÚ DE NAVEGACIÓN FIJO 🚀 */}
        <div className="admin-menu-bar">
          <nav className="admin-top-menu">
            <button 
                className={`menu-item ${currentView === 'dashboard' ? 'active' : ''}`}
                onClick={() => setCurrentView('dashboard')}
              >
                📊 Dashboard
            </button>
            <button 
              className={`menu-item ${currentView === 'historias' ? 'active' : ''}`}
              onClick={() => setCurrentView('historias')}
            >
              📚 Historias
            </button>
            <button 
              className={`menu-item ${currentView === 'personajes' ? 'active' : ''}`}
              onClick={() => setCurrentView('personajes')}
            >
              🎭 Personajes
            </button>
            <button 
              className={`menu-item ${currentView === 'ubicaciones' ? 'active' : ''}`}
              onClick={() => setCurrentView('ubicaciones')}
            >
              🗺️ Ubicaciones
            </button>
            <button
              className={`menu-item ${currentView === 'recursosMultimedia' ? 'active' : ''}`}
              onClick={() => setCurrentView('recursosMultimedia')}
            >
              🖼️ Recursos Multimedia
            </button>
            <button 
              className={`menu-item ${currentView === 'recompensas' ? 'active' : ''}`}
              onClick={() => setCurrentView('recompensas')}
            >
              🎁 Recompensas
            </button>
            <button 
              className={`menu-item ${currentView === 'flujo_narrativo' ? 'active' : ''}`}
              onClick={() => setCurrentView('flujo_narrativo')}
            >
              📜 Flujo Narrativo
            </button>
            <button 
              className={`menu-item ${currentView === 'flujodisplay' ? 'active' : ''}`}
              onClick={() => setCurrentView('flujodisplay')}
            >
              👁️ Ver Flujo Narrativo
            </button>
            <button 
              className={`menu-item ${currentView === 'flujousuario' ? 'active' : ''}`}
              onClick={() => setCurrentView('flujousuario')}
            >
              🎬 Ver Flujo Cinemático
            </button>     
            <button 
              className={`menu-item ${currentView === 'usuarios' ? 'active' : ''}`}
              onClick={() => setCurrentView('usuarios')}
            >
              👥 Usuarios
            </button>
            <button 
              className={`menu-item ${currentView === 'analytics' ? 'active' : ''}`}
              onClick={() => setCurrentView('analytics')}
            >
              📈 Analíticas
            </button>
            <button 
              className={`menu-item ${currentView === 'config' ? 'active' : ''}`}
              onClick={() => setCurrentView('config')}
            >
              ⚙️ Configuración
            </button>
          </nav>
        </div>
      </div> {/* Fin de admin-header */}


      {/* El contenido principal del panel */}
      <div className="admin-main">
        {renderCurrentView()}
      </div>
    </div>
  )
}

export default AdminPanel;