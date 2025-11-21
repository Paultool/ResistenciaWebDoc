import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { obtenerHistorias, obtenerPersonajes, obtenerUbicaciones } from '../supabaseClient'
import { gameServiceUser as gameService } from '../services/GameServiceUser'
import GameStats from './GameStats'
import '../styles/resistance-theme.css'
import './UserDashboard.css'

interface DashboardData {
  totalHistorias: number
  totalPersonajes: number
  totalUbicaciones: number
}

const UserDashboard: React.FC<{ onNavigate?: (view: string) => void; onNavigateToStory?: (historiaId: number) => void }> = ({ onNavigate, onNavigateToStory }) => {
  const { user, signOut } = useAuth()
  const [dashboardData, setDashboardData] = useState<DashboardData>({
    totalHistorias: 0,
    totalPersonajes: 0,
    totalUbicaciones: 0
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)

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
      setError('ERROR AL CARGAR DATOS: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const initializarPerfilJugador = async () => {
    try {
      if (!user?.id) return

      await gameService.initializePlayerProfile(user.id)
      console.log('✅ Perfil de jugador inicializado')
      if (user?.email === 'paultool@gmail.com') {
        setIsAdmin(true)
      }
    } catch (error: any) {
      console.error('Error inicializando perfil de jugador:', error)
    }
  }

  const handleSignOut = async () => {
    gameService.clearCache()
    await signOut()
  }

  return (
    <div className="user-dashboard-container scanlines">
      {/* Status Bar */}
      <div className="dashboard-status-bar">
        <div className="status-info mono-text-green">
          [ 🟢 ONLINE ] <span className="user-display mono-text-amber">{user?.email?.split('@')[0] || 'AGENTE'}</span>
        </div>
        <button onClick={handleSignOut} className="status-logout-btn terminal-btn">
          [ SALIR ]
        </button>
      </div>

      {error && (
        <div className="dashboard-error">
          <p className="mono-text">❌ {error}</p>
          <button onClick={cargarDatosBasicos} className="terminal-btn">
            [ REINTENTAR ]
          </button>
        </div>
      )}

      {loading ? (
        <div className="dashboard-loading">
          <p className="mono-text-green cursor-blink">CARGANDO INTERFAZ DE MISIÓN</p>
        </div>
      ) : (
        <div className="dashboard-grid">
          {/* Main Panel: Player Stats */}
          <div className="dashboard-main-panel terminal-box-highlight">
            <h3 className="panel-title mono-text-green">
              &gt;&gt;&gt; REPORTE DE PROGRESO
            </h3>
            <div className="terminal-separator"></div>
            <GameStats showDetailed={true} onNavigateToStory={onNavigateToStory} />
          </div>

          {/* Side Panel: Content Metrics */}
          <div className="dashboard-side-panel terminal-box-highlight">
            <h3 className="panel-title mono-text-green">
              &gt;&gt;&gt; INVENTARIO DE DATOS
            </h3>
            <div className="terminal-separator"></div>

            <div className="metrics-grid">
              <div className="metric-card">
                <div className="metric-icon">📖</div>
                <div className="metric-number mono-text-amber">{dashboardData.totalHistorias}</div>
                <div className="metric-label mono-text-muted">HISTORIAS</div>
              </div>

              <div className="metric-card">
                <div className="metric-icon">👥</div>
                <div className="metric-number mono-text-amber">{dashboardData.totalPersonajes}</div>
                <div className="metric-label mono-text-muted">PERSONAJES</div>
              </div>

              <div className="metric-card">
                <div className="metric-icon">🗺️</div>
                <div className="metric-number mono-text-amber">{dashboardData.totalUbicaciones}</div>
                <div className="metric-label mono-text-muted">UBICACIONES</div>
              </div>
            </div>

            <div className="panel-footer mono-text-muted">
              <p>ÚLTIMA ACTUALIZACIÓN: {new Date().toLocaleTimeString()}</p>
              {isAdmin && <p className="admin-badge mono-text-amber">[ ACCESO ADMIN ACTIVO ]</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default UserDashboard