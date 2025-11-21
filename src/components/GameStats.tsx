import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { gameServiceUser as gameService } from '../services/GameServiceUser'
import './GameStats.css'

interface GameStatsProps {
  className?: string
  showDetailed?: boolean
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

const GameStats: React.FC<GameStatsProps> = ({ className = '', showDetailed = true }) => {
  const { user } = useAuth()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (user?.id) {
      cargarEstadisticas()
    }

    // Escuchar eventos de actualización de estadísticas
    const handleStatsUpdate = () => {
      if (user?.id) {
        setTimeout(() => cargarEstadisticas(), 500) // Pequeño delay para que se actualice la BD
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
        setError('No se pudieron cargar las estadísticas')
      }
    } catch (err: any) {
      console.error('Error cargando estadísticas de juego:', err)
      setError('Error al cargar las estadísticas: ' + err.message)
    } finally {
      setLoading(false)
    }
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
    if (nivel >= 20) return '🏛️ Líder Legendario'
    if (nivel >= 15) return '⚡ Resistente Épico'
    if (nivel >= 10) return '🔥 Guerrero Urbano'
    if (nivel >= 7) return '💪 Luchador Veterano'
    if (nivel >= 5) return '🌟 Activista Experimentado'
    if (nivel >= 3) return '📚 Aprendiz Comprometido'
    return '🌱 Resistente Novato'
  }

  if (loading) {
    return (
      <div className={`game-stats loading ${className}`}>
        <div className="stats-skeleton">
          <div className="skeleton-line level"></div>
          <div className="skeleton-line xp"></div>
          <div className="skeleton-line progress"></div>
        </div>
      </div>
    )
  }

  if (error || !stats) {
    return (
      <div className={`game-stats error ${className}`}>
        <div className="error-content">
          <p className="error-message">❌ {error || 'No se pudieron cargar las estadísticas'}</p>
          <button onClick={cargarEstadisticas} className="retry-btn">
            🔄 Reintentar
          </button>
        </div>
      </div>
    )
  }

  const progressPercentage = getProgressPercentage()
  const rankTitle = getRankTitle(stats.nivel)

  return (
    <div className={`game-stats ${className}`}>
      <div className="player-level-section">
        <div className="level-badge-container">
          <div className="level-badge">
            <span className="level-number">{stats.nivel}</span>
            <span className="level-label">NIVEL</span>
          </div>
          <div className="level-info">
            <h3 className="rank-title">{rankTitle}</h3>
            <div className="xp-display">
              <span className="current-xp">{stats.xpTotal.toLocaleString()}</span>
              <span className="xp-label">XP</span>
            </div>
          </div>
        </div>

        <div className="xp-progress-container">
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${progressPercentage}%` }}
            ></div>
            <div className="progress-spark"></div>
          </div>
          <div className="progress-text">
            <span>Siguiente nivel: {stats.xpParaSiguienteNivel.toLocaleString()} XP</span>
          </div>
        </div>
      </div>

      {showDetailed && (
        <div className="detailed-stats">
          <div className="stats-grid">
            <div className="stat-item stories">
              <div className="stat-icon">📚</div>
              <div className="stat-content">
                <div className="stat-number">{stats.historiasCompletadas}</div>
                <div className="stat-label">Historias</div>
              </div>
            </div>

            <div className="stat-item characters">
              <div className="stat-icon">👥</div>
              <div className="stat-content">
                <div className="stat-number">{stats.personajesConocidos}</div>
                <div className="stat-label">Personajes</div>
              </div>
            </div>

            <div className="stat-item locations">
              <div className="stat-icon">📍</div>
              <div className="stat-content">
                <div className="stat-number">{stats.ubicacionesVisitadas}</div>
                <div className="stat-label">Ubicaciones</div>
              </div>
            </div>

            <div className="stat-item achievements">
              <div className="stat-icon">🏆</div>
              <div className="stat-content">
                <div className="stat-number">{stats.logrosDesbloqueados}</div>
                <div className="stat-label">Logros</div>
              </div>
            </div>

            <div className="stat-item inventory">
              <div className="stat-icon">🎒</div>
              <div className="stat-content">
                <div className="stat-number">{stats.inventarioItems}</div>
                <div className="stat-label">Objetos</div>
              </div>
            </div>

            <div className="stat-item streak">
              <div className="stat-icon">🔥</div>
              <div className="stat-content">
                <div className="stat-number">{stats.rachaDias}</div>
                <div className="stat-label">Días</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default GameStats