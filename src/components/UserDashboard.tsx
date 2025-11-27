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
      console.error('Error:', error)
      setError('FALLO DE SISTEMA: ' + error.message)
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

  return (
    <div className="dashboard-container">

      {/* 1. HEADER DE ESTADO */}
      <div className="dashboard-status-bar">
        <div className="status-label">
          <span className="animate-pulse text-green-500">●</span>
          <span className="hidden sm:inline ml-2">CONEXIÓN ESTABLECIDA |</span> 
          <span className="user-id-display ml-2">OP: {user?.email?.split('@')[0]}</span>
        </div>
        <button onClick={handleSignOut} className="btn-status-logout">
          [ EXIT ]
        </button>
      </div>

      {error && (
        <div className="border border-red-500 text-red-500 p-2 text-center text-xs mb-4 bg-red-500/10">
          <p>⚠️ {error} <button onClick={cargarDatosBasicos} className="underline ml-2">REINTENTAR</button></p>
        </div>
      )}

      {loading ? (
        <div className="text-center p-10 text-[#33ff00] text-sm animate-pulse">
          <p>{'>'} CARGANDO INTERFAZ DE COMANDO...</p>
        </div>
      ) : (
        <>
          {/* 2. GRID PRINCIPAL */}
          <div className="main-dashboard-grid">

            {/* PANEL IZQ: ESTADÍSTICAS */}
            <div className="game-stats-panel">
              <h3 className="section-title main-title">{'>'} PROGRESO INDIVIDUAL</h3>
              {/* GameStats debe heredar el tamaño de fuente del contenedor */}
              <GameStats showDetailed={true} />
            </div>

            {/* PANEL DER: MÉTRICAS GLOBALES */}
            <div className="data-metrics-panel">
              <h3 className="section-title">DB GLOBAL</h3>

              <div className="info-grid">
                <div className="info-card">
                  <div className="info-icon">📂</div>
                  <div className="info-content">
                    <div className="info-number">{dashboardData.totalHistorias}</div>
                    <div className="info-label">MISIONES</div>
                  </div>
                </div>

                {/*sujetos*/}
                <div className="info-card">
                  <div className="info-icon">👥</div> 
                  <div className="info-content">
                    <div className="info-number">{dashboardData.totalPersonajes}</div>
                    <div className="info-label">SUJETOS</div>
                  </div>
                </div>

                <div className="info-card">
                  <div className="info-icon">📍</div>
                  <div className="info-content">
                    <div className="info-number">{dashboardData.totalUbicaciones}</div>
                    <div className="info-label">PUNTOS</div>
                  </div>
                </div>
              </div>

              <div className="side-panel-footer">
                <p>SYNC: {new Date().toLocaleTimeString()}</p>
                {isAdmin && <p className="admin-status">[ ROOT PRIVILEGES ]</p>}
              </div>

            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default UserDashboard