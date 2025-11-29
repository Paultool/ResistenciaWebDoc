import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { gameServiceUser as gameService } from '../services/GameServiceUser'
import './GameStats.css'

interface GameStatsProps {
  className?: string
  showDetailed?: boolean
  onNavigateToStory?: (historiaId: number) => void
  onStatClick?: (type: 'missions' | 'contacts' | 'locations' | 'merits' | 'resources') => void
}

interface DashboardStats {
  nivel: number
  xpTotal: number
  xpParaSiguienteNivel: number
  historiasCompletadas: number
  personajesConocidos: number
  ubicacionesVisitadas: number
  logrosDesbloqueados: number
  rachaDias: number
  inventarioItems: number
}

const GameStats: React.FC<GameStatsProps> = ({ className = '', showDetailed = true, onNavigateToStory, onStatClick }) => {
  const { user } = useAuth()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [favoriteStories, setFavoriteStories] = useState<any[]>([])
  const [loadingFavorites, setLoadingFavorites] = useState(false)

  useEffect(() => {
    if (user?.id) {
      cargarEstadisticas()
      cargarHistoriasFavoritas()
    }

    const handleStatsUpdate = () => {
      if (user?.id) {
        setTimeout(() => {
          cargarEstadisticas()
          cargarHistoriasFavoritas()
        }, 500)
      }
    }

    window.addEventListener('statsUpdated', handleStatsUpdate)
    return () => {
      window.removeEventListener('statsUpdated', handleStatsUpdate)
    }
  }, [user])

  const cargarEstadisticas = async () => {
    if (!user?.id) return
    try {
      setLoading(true)
      setError(null)
      const dashboardStats = await gameService.getDashboardStats(user.id)
      if (dashboardStats) {
        setStats(dashboardStats)
      } else {
        setError('DATOS NO DISPONIBLES')
      }
    } catch (err: any) {
      console.error('Error:', err)
      setError('FALLO DE CONEXIÓN')
    } finally {
      setLoading(false)
    }
  }

  const cargarHistoriasFavoritas = async () => {
    if (!user?.id) return
    try {
      setLoadingFavorites(true)
      const favorites = await gameService.getFavoriteStoriesDetails(user.id)
      setFavoriteStories(favorites || [])
    } catch (err: any) {
      console.error('Error favorites:', err)
    } finally {
      setLoadingFavorites(false)
    }
  }

  const handleFavoriteClick = (historiaId: number) => {
    if (onNavigateToStory) onNavigateToStory(historiaId)
  }

  const getProgressPercentage = () => {
    if (!stats) return 0
    const xpNivelActual = stats.nivel === 1 ? 0 : Math.pow(stats.nivel - 1, 2) * 100
    const xpNivelSiguiente = Math.pow(stats.nivel, 2) * 100
    const xpEnNivelActual = stats.xpTotal - xpNivelActual
    const xpNecesarioNivel = xpNivelSiguiente - xpNivelActual
    return Math.min(100, Math.max(0, (xpEnNivelActual / xpNecesarioNivel) * 100))
  }

  const getRankTitle = (nivel: number): string => {
    if (nivel >= 20) return 'LÍDER DE RESISTENCIA'
    if (nivel >= 15) return 'OFICIAL TÁCTICO'
    if (nivel >= 10) return 'AGENTE VETERANO'
    if (nivel >= 5) return 'OPERADOR DE CAMPO'
    return 'RECLUTA'
  }

  if (loading) {
    return (
      <div className={`resistance-dashboard loading ${className}`}>
        <div className="loading-text">{'>'} DESCIFRANDO PERFIL...</div>
      </div>
    )
  }

  if (error || !stats) {
    return (
      <div className={`resistance-dashboard error ${className}`}>
        <div>
          <p className="error-text">[ ! ] {error}</p>
          <button onClick={cargarEstadisticas} className="terminal-btn">REINTENTAR</button>
        </div>
      </div>
    )
  }

  const progressPercentage = getProgressPercentage()
  const rankTitle = getRankTitle(stats.nivel)

  return (
    <div className={`resistance-dashboard ${className}`}>

      {/* SECCIÓN 1: ESTATUS PRINCIPAL */}
      <div className="agent-status">
        <div className="rank-title">{rankTitle}</div>

        <div className="status-row">
          <div className="level-badge">
            LVL {stats.nivel}
          </div>

          <div className="xp-container">
            <div className="xp-bar">
              <div className="xp-fill" style={{ width: `${progressPercentage}%` }} />
            </div>
            <div className="xp-text">
              PROGRESO: {stats.xpTotal.toLocaleString()} / {(stats.xpTotal + stats.xpParaSiguienteNivel).toLocaleString()} XP
            </div>
          </div>
        </div>
      </div>

      {/* SEPARADOR VISUAL */}
      <div className="terminal-separator" />

      {showDetailed && (
        <>
          {/* SECCIÓN 2: ESTADÍSTICAS TÁCTICAS */}
          <div className="stats-grid">
            <div className="stat-item fade-in clickable" onClick={() => onStatClick?.('missions')}>
              <div className="stat-icon">📂</div>
              <div className="stat-number">{stats.historiasCompletadas}</div>
              <div className="stat-label">MISIONES</div>
            </div>

            <div className="stat-item fade-in clickable" style={{ animationDelay: '0.1s' }} onClick={() => onStatClick?.('contacts')}>
              <div className="stat-icon">👥</div>
              <div className="stat-number">{stats.personajesConocidos}</div>
              <div className="stat-label">CONTACTOS</div>
            </div>

            <div className="stat-item fade-in clickable" style={{ animationDelay: '0.2s' }} onClick={() => onStatClick?.('locations')}>
              <div className="stat-icon">📍</div>
              <div className="stat-number">{stats.ubicacionesVisitadas}</div>
              <div className="stat-label">LUGARES</div>
            </div>

            <div className="stat-item fade-in clickable" style={{ animationDelay: '0.3s' }} onClick={() => onStatClick?.('merits')}>
              <div className="stat-icon">🎖️</div>
              <div className="stat-number">{stats.logrosDesbloqueados}</div>
              <div className="stat-label">MÉRITOS</div>
            </div>

            <div className="stat-item fade-in clickable" style={{ animationDelay: '0.4s' }} onClick={() => onStatClick?.('resources')}>
              <div className="stat-icon">🎒</div>
              <div className="stat-number">{stats.inventarioItems}</div>
              <div className="stat-label">RECURSOS</div>
            </div>

            <div className="stat-item fade-in" style={{ animationDelay: '0.5s' }}>
              <div className="stat-icon">🔥</div>
              <div className="stat-number">{stats.rachaDias}</div>
              <div className="stat-label">RACHA</div>
            </div>
          </div>

          <div className="terminal-separator" />

          {/* SECCIÓN 3: ARCHIVOS PRIORITARIOS */}
          <div className="favorites-section">
            <div className="favorites-header">
              {'>'} ARCHIVOS PRIORITARIOS [{favoriteStories.length}]
            </div>

            {loadingFavorites ? (
              <div className="favorites-empty">CARGANDO ÍNDICE...</div>
            ) : favoriteStories.length === 0 ? (
              <div className="favorites-empty">
                [ ! ] SIN ARCHIVOS MARCADOS
              </div>
            ) : (
              <div className="favorites-row">
                {favoriteStories.map((historia) => (
                  <div
                    key={historia.id_historia}
                    className="folder-item"
                    onClick={() => handleFavoriteClick(historia.id_historia)}
                    title={historia.titulo}
                  >
                    <div className="folder-icon">📁</div>
                    <div className="folder-name">
                      {historia.titulo || 'ARCH_001'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

export default GameStats