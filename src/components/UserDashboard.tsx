import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { obtenerHistorias, obtenerPersonajes, obtenerUbicaciones } from '../supabaseClient'
import { gameService } from '../services/GameService'
import GameStats from './GameStats'
import './UserDashboard.css'

interface DashboardData {
  totalHistorias: number
  totalPersonajes: number
  totalUbicaciones: number
}

const UserDashboard: React.FC<{ onNavigate?: (view: string) => void }> = ({ onNavigate }) => {
  const { user, signOut } = useAuth()
  const [dashboardData, setDashboardData] = useState<DashboardData>({ 
    totalHistorias: 0, 
    totalPersonajes: 0, 
    totalUbicaciones: 0
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false);  

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
      console.error('Error cargando datos básicos:', error)
      setError('Error al cargar los datos: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const initializarPerfilJugador = async () => {
    try {
      if (!user?.id) return
      
      // Inicializar o cargar perfil del jugador
      await gameService.initializePlayerProfile(user.id)
      console.log('✅ Perfil de jugador inicializado')
      if (user?.email === 'paultool@gmail.com') {
          setIsAdmin(true);
 
       }
    } catch (error: any) {
      console.error('Error inicializando perfil de jugador:', error)
    }
  }

  const handleNavigate = (view: string) => {
    console.log(`🔄 Navegando a: ${view}`)
    if (onNavigate) {
      onNavigate(view)
    }
  }

  const handleSignOut = async () => {
    // Limpiar cache del servicio de juego
    gameService.clearCache()
    await signOut()
  }

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <div className="user-info">
          <div className="avatar">
            {user?.email?.charAt(0).toUpperCase() || '👤'}
          </div>
          <div className="user-details">
            <h2>¡Bienvenido, Resistente!</h2>
            <p className="email">{user?.email}</p>
          </div>
        </div>
        <button onClick={handleSignOut} className="btn btn-logout">
          🚪 Cerrar Sesión
        </button>
      </div>

      {error && (
        <div className="error-banner">
          <p>❌ {error}</p>
          <button onClick={cargarDatosBasicos} className="retry-btn">
            🔄 Reintentar
          </button>
        </div>
      )}

      {/* Estadísticas del Juego RPG Reales */}
      <div className="game-stats-section">
        <h3 className="section-title">📊 Tu Progreso</h3>
        <GameStats showDetailed={true} />
      </div>

      {loading ? (
        <div className="loading-stats">
          <p>⏳ Cargando información...</p>
        </div>
      ) : (


        
        <div className="database-info">
          


          <div className="dashboard-actions">
        <h3>🎯 Acciones Rápidas</h3>
        <div className="actions-grid">
          <button 
            className="action-btn inventory-btn"
            onClick={() => handleNavigate('cine')}
          >
            <span className="action-icon">🎬</span>
            <span className="action-text">Cine</span>
          </button>
          
          <button 
            className="action-btn characters-btn"
            onClick={() => handleNavigate('personajes')}
          >
            <span className="action-icon">🎭</span>
            <span className="action-text">Galería de Personajes</span>
          </button>
          <button 
            className="action-btn inventory-btn"
            onClick={() => handleNavigate('inventario')}
          >
            <span className="action-icon">🎒</span>
            <span className="action-text">Mi Inventario</span>
          </button>

           {isAdmin && (
            <button 
              className="action-btn inventory-btn"
              onClick={() => handleNavigate('admin')}
            >
              <span className="action-icon">🛠️</span>
              <span className="action-text"> Admin</span>
            </button>                      
          )}

        </div>
        
      </div>
      
      
    <br></br><h3 className="section-title">📚 Contenido Disponible</h3>


          <div className="info-grid">
            <div className="info-card">
              <div className="info-icon">📖</div>
              <div className="info-content">
                <div className="info-number">{dashboardData.totalHistorias}</div>
                <div className="info-label">Historias Disponibles</div>
              </div>
            </div>

            

            <div className="info-card">
              <div className="info-icon">👥</div>
              <div className="info-content">
                <div className="info-number">{dashboardData.totalPersonajes}</div>
                <div className="info-label">Personajes</div>
              </div>
            </div>

            <div className="info-card">
              <div className="info-icon">🗺️</div>
              <div className="info-content">
                <div className="info-number">{dashboardData.totalUbicaciones}</div>
                <div className="info-label">Ubicaciones</div>
              </div>
            </div>
          </div>
        </div>
      )}

      
    </div>
  )
}

export default UserDashboard