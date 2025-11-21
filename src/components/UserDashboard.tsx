import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { obtenerHistorias, obtenerPersonajes, obtenerUbicaciones } from '../supabaseClient'
import { gameServiceUser as gameService } from '../services/GameServiceUser'
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

      await gameService.initializePlayerProfile(user.id)
      console.log('✅ Perfil de jugador inicializado')
      if (user?.email === 'paultool@gmail.com') {
        setIsAdmin(true);
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
    <div className="dashboard-container">

      {/* 1. ENCABEZADO MINIMALISTA DE ESTADO */}
      <div className="dashboard-status-bar">
        <div className="status-label">
          [ 🟢 ONLINE ] <span className="user-id-display">RESISTENTE: {user?.email}</span>
        </div>
        <button onClick={handleSignOut} className="btn btn-status-logout">
          [ EXIT ]
        </button>
      </div>

      {error && (
        <div className="error-banner">
          <p>❌ ERROR DE DATOS. <button onClick={cargarDatosBasicos} className="retry-btn">REINTENTAR</button></p>
        </div>
      )}

      {loading ? (
        <div className="loading-stats">
          <p>⏳ CARGANDO INTERFAZ DE MISIÓN...</p>
        </div>
      ) : (
        <>
          {/* 2. GRID PRINCIPAL DE PANELES (OCUPA TODA LA VISTA) */}
          <div className="main-dashboard-grid">

            {/* PANEL PRINCIPAL: ESTADÍSTICAS DEL JUGADOR (EL MÁS GRANDE) */}
            <div className="game-stats-panel">
              <h3 className="section-title main-title">| REPORTE DE PROGRESO DE LA RESISTENCIA |</h3>
              <GameStats showDetailed={true} />
            </div>

            {/* PANEL LATERAL: MÉTRICAS DE CONTENIDO (COMPACTO) */}
            <div className="data-metrics-panel">
              <h3 className="section-title">| INVENTARIO DE DATOS |</h3>

              <div className="info-grid">
                <div className="info-card">
                  <div className="info-icon">📖</div>
                  <div className="info-content">
                    <div className="info-number">{dashboardData.totalHistorias}</div>
                    <div className="info-label">HISTORIAS</div>
                  </div>
                </div>

                <div className="info-card">
                  <div className="info-icon">👥</div>
                  <div className="info-content">
                    <div className="info-number">{dashboardData.totalPersonajes}</div>
                    <div className="info-label">PERSONAJES</div>
                  </div>
                </div>

                <div className="info-card">
                  <div className="info-icon">🗺️</div>
                  <div className="info-content">
                    <div className="info-number">{dashboardData.totalUbicaciones}</div>
                    <div className="info-label">UBICACIONES</div>
                  </div>
                </div>
              </div>

              {/* OPCIONAL: Línea de status adicional para llenar el espacio */}
              <div className="side-panel-footer">
                <p>Última actualización: {new Date().toLocaleTimeString()}</p>
                {isAdmin && <p className="admin-status">[ ACCESO ADMIN ACTIVO ]</p>}
              </div>

            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default UserDashboard