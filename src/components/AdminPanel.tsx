import React, { useState } from 'react'
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


import './AdminPanel.css'

interface AdminPanelProps {
  onBack?: () => void
}

// Actualiza el tipo para incluir todas las vistas
type AdminView = 'dashboard' | 'historias' | 'personajes' | 'ubicaciones' | 'usuarios' | 'config' | 'analytics' | 'flujo_narrativo' | 'recursosMultimedia' | 'recompensas' | 'flujodisplay' | 'flujousuario';

const AdminPanel: React.FC<AdminPanelProps> = ({ onBack }) => {
  const { isAdmin, adminUser, loading } = useAdmin()
  const [currentView, setCurrentView] = useState<AdminView>('dashboard')
  const [selectedHistoriaId, setSelectedHistoriaId] = useState<number | null>(null);
  const [stats, setStats] = useState({
    totalUsuarios: 0,
    totalHistorias: 0,
    totalPersonajes: 0,
    totalUbicaciones: 0,
    usuariosActivos: 0,
    sesionesHoy: 0
  })

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
        return (
          <div className="admin-dashboard">
            <div className="dashboard-header">
              <h2>📊 Panel de Control</h2>
              <p>Bienvenido al sistema de administración de WebDoc La Resistencia</p>
            </div>

            <div className="admin-stats-grid">
              <div className="admin-stat-card users">
                <div className="stat-icon">👥</div>
                <div className="stat-content">
                  <h3>{stats.totalUsuarios}</h3>
                  <p>Usuarios Totales</p>
                </div>
              </div>

              <div className="admin-stat-card stories">
                <div className="stat-icon">📚</div>
                <div className="stat-content">
                  <h3>{stats.totalHistorias}</h3>
                  <p>Historias</p>
                </div>
              </div>

              <div className="admin-stat-card characters">
                <div className="stat-icon">🎭</div>
                <div className="stat-content">
                  <h3>{stats.totalPersonajes}</h3>
                  <p>Personajes</p>
                </div>
              </div>

              <div className="admin-stat-card locations">
                <div className="stat-icon">🗺️</div>
                <div className="stat-content">
                  <h3>{stats.totalUbicaciones}</h3>
                  <p>Ubicaciones</p>
                </div>
              </div>

              <div className="admin-stat-card active">
                <div className="stat-icon">🟢</div>
                <div className="stat-content">
                  <h3>{stats.usuariosActivos}</h3>
                  <p>Usuarios Activos</p>
                </div>
              </div>

              <div className="admin-stat-card sessions">
                <div className="stat-icon">📈</div>
                <div className="stat-content">
                  <h3>{stats.sesionesHoy}</h3>
                  <p>Sesiones Hoy</p>
                </div>
              </div>
            </div>

            <div className="quick-actions">
              <h3>⚡ Acciones Rápidas</h3>
              <div className="actions-grid">
                <button 
                  className="action-btn create-story"
                  onClick={() => setCurrentView('historias')}
                >
                  📝 Crear Nueva Historia
                </button>
                <button 
                  className="action-btn create-character"
                  onClick={() => setCurrentView('personajes')}
                >
                  🎭 Añadir Personaje
                </button>
                <button 
                  className="action-btn create-location"
                  onClick={() => setCurrentView('ubicaciones')}
                >
                  📍 Nueva Ubicación
                </button>
                <button
                  className="action-btn create-resource"
                  onClick={() => setCurrentView('recursosMultimedia')}
                >
                  🖼️ Añadir Recurso
                </button>
                <button 
                  className="action-btn view-analytics"
                  onClick={() => setCurrentView('analytics')}
                >
                  📊 Ver Analíticas
                </button>
              </div>
            </div>

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
      <div className="admin-header">
        <div className="admin-nav">
          <h1>⚙️ Administración</h1>
          <div className="admin-user-info">
            <span className="admin-badge">ADMIN</span>
            <span className="admin-email">{adminUser?.email}</span>
          </div>
        </div>
      </div>

      <div className="admin-sidebar">
        <nav className="admin-menu">
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
            📜 Ver Flujo Narrativo
          </button>
          <button 
            className={`menu-item ${currentView === 'flujousuario' ? 'active' : ''}`}
            onClick={() => setCurrentView('flujousuario')}
          >
            📜 Ver Flujo cinematico
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

      <div className="admin-main">
        {renderCurrentView()}
      </div>
    </div>
  )
}

export default AdminPanel;