import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { gameServiceUser as gameService } from '../services/GameServiceUser'
import '../styles/resistance-theme.css'
import './GameStats.css'

interface GameStatsProps {
  className?: string
  showDetailed?: boolean
  onNavigateToStory?: (historiaId: number) => void
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

const GameStats: React.FC<GameStatsProps> = ({ className = '', showDetailed = true, onNavigateToStory }) => {
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

    // Escuchar eventos de actualización de estadísticas
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
        setError('No se pudieron cargar las estadísticas')
      }
    } catch (err: any) {
      console.error('Error cargando estadísticas de juego:', err)
      setError('Error al cargar las estadísticas: ' + err.message)
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
      console.error('Error cargando historias favoritas:', err)
    } finally {
      setLoadingFavorites(false)
    }
  }

  const handleFavoriteClick = (historiaId: number) => {
    if (onNavigateToStory) {
      onNavigateToStory(historiaId)
    } else {
      console.warn('No navigation handler provided for favorite story:', historiaId)
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
    if (nivel >= 20) return 'LÍDER LEGENDARIO'
    if (nivel >= 15) return 'RESISTENTE ÉPICO'
    if (nivel >= 10) return 'GUERRERO URBANO'
    if (nivel >= 7) return 'LUCHADOR VETERANO'
    if (nivel >= 5) return 'ACTIVISTA EXPERIMENTADO'
    if (nivel >= 3) return 'APRENDIZ COMPROMETIDO'
    return 'RESISTENTE NOVATO'
  }

  if (loading) {
    return (
      <div className={`resistance-dashboard loading ${className}`}>
        <div className="terminal-loading">
          <div className="loading-text mono-text-green">
            <span className="cursor-blink">CARGANDO DATOS</span>
          </div>
        </div>
      </div>
    )
  }

  if (error || !stats) {
    return (
      <div className={`resistance-dashboard error ${className}`}>
        <div className="terminal-error">
          <p className="error-text mono-text-amber">❌ {error || 'ERROR: NO SE PUDIERON CARGAR LAS ESTADÍSTICAS'}</p>
          <button onClick={cargarEstadisticas} className="terminal-btn">
            🔄 REINTENTAR
          </button>
        </div>
      </div>
    )
  }

  const progressPercentage = getProgressPercentage()
  const rankTitle = getRankTitle(stats.nivel)

  return (
    <div className={`resistance-dashboard ${className} scanlines`}>
      {/* SECCIÓN 1: NIVEL Y XP */}
      <div className="agent-status">
        <div className="status-row">
          <div className="level-badge mono-text-amber">
            [LVL {stats.nivel}]
          </div>
          <div className="xp-container">
            <div className="xp-bar">
              <div className="xp-fill" style={{ width: `${progressPercentage}%` }} />
            </div>
            <div className="xp-text mono-text-amber">
              {stats.xpTotal.toLocaleString()}/{(stats.xpTotal + stats.xpParaSiguienteNivel).toLocaleString()} XP
            </div>
          </div>
        </div>
        <div className="rank-title mono-text-green">
          {rankTitle}
        </div>
      </div>

      {/* SEPARADOR */}
      <div className="terminal-separator" />

      {showDetailed && (
        <>
          {/* SECCIÓN 2: ESTADÍSTICAS */}
          <div className="stats-grid">
            <div className="stat-item fade-in">
              <div className="stat-icon">📚</div>
              <div className="stat-number mono-text-white">{stats.historiasCompletadas}</div>
              <div className="stat-label mono-text-muted">HISTORIAS</div>
            </div>

            <div className="stat-item fade-in" style={{ animationDelay: '0.1s' }}>
              <div className="stat-icon">👥</div>
              <div className="stat-number mono-text-white">{stats.personajesConocidos}</div>
              <div className="stat-label mono-text-muted">PERSONAJES</div>
            </div>

            <div className="stat-item fade-in" style={{ animationDelay: '0.2s' }}>
              <div className="stat-icon">📍</div>
              <div className="stat-number mono-text-white">{stats.ubicacionesVisitadas}</div>
              <div className="stat-label mono-text-muted">UBICACIONES</div>
            </div>

            <div className="stat-item fade-in" style={{ animationDelay: '0.3s' }}>
              <div className="stat-icon">🏆</div>
              <div className="stat-number mono-text-white">{stats.logrosDesbloqueados}</div>
              <div className="stat-label mono-text-muted">LOGROS</div>
            </div>

            <div className="stat-item fade-in" style={{ animationDelay: '0.4s' }}>
              <div className="stat-icon">🎒</div>
              <div className="stat-number mono-text-white">{stats.inventarioItems}</div>
              <div className="stat-label mono-text-muted">OBJETOS</div>
            </div>

            <div className="stat-item fade-in" style={{ animationDelay: '0.5s' }}>
              <div className="stat-icon">🔥</div>
              <div className="stat-number mono-text-white">{stats.rachaDias}</div>
              <div className="stat-label mono-text-muted">RACHA</div>
            </div>
          </div>

          {/* SEPARADOR */}
          <div className="terminal-separator" />

          {/* SECCIÓN 3: ARCHIVOS FAVORITOS */}
          <div className="favorites-section">
            <div className="favorites-header mono-text-green">
              &gt;&gt;&gt; ARCHIVOS_FAVORITOS [{favoriteStories.length}]
            </div>

            {loadingFavorites ? (
              <div className="favorites-loading">
                <span className="mono-text-muted cursor-blink">CARGANDO</span>
              </div>
            ) : favoriteStories.length === 0 ? (
              <div className="favorites-empty">
                <span className="mono-text-muted">[!] NO HAY ARCHIVOS CLASIFICADOS</span>
              </div>
            ) : (
              <div className="favorites-row">
                {favoriteStories.map((historia, index) => (
                  <div
                    key={historia.id_historia}
                    className="folder-item hover-glow-amber"
                    onClick={() => handleFavoriteClick(historia.id_historia)}
                    title={historia.titulo}
                  >
                    <div className="folder-icon">📁</div>
                    <div className="folder-name mono-text-amber">
                      {historia.titulo && historia.titulo.length > 15
                        ? historia.titulo.substring(0, 15) + '...'
                        : historia.titulo || 'Sin título'}
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