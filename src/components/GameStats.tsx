import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useLanguage } from '../contexts/LanguageContext'
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

const statsTranslations = {
  es: {
    loading: '> DESCIFRANDO PERFIL...',
    error: 'DATOS NO DISPONIBLES',
    connectionError: 'FALLO DE CONEXIÓN',
    retry: 'REINTENTAR',
    progress: 'PROGRESO',
    missions: 'MISIONES',
    contacts: 'CONTACTOS',
    locations: 'LUGARES',
    merits: 'MÉRITOS',
    resources: 'RECURSOS',
    streak: 'RACHA',
    priorityFiles: 'ARCHIVOS PRIORITARIOS',
    loadingIndex: 'CARGANDO ÍNDICE...',
    noFiles: '[ ! ] SIN ARCHIVOS MARCADOS',
    ranks: {
      leader: 'LÍDER DE RESISTENCIA',
      tactical: 'OFICIAL TÁCTICO',
      veteran: 'AGENTE VETERANO',
      operator: 'OPERADOR DE CAMPO',
      recruit: 'RECLUTA'
    }
  },
  en: {
    loading: '> DECRYPTING PROFILE...',
    error: 'DATA UNAVAILABLE',
    connectionError: 'CONNECTION FAILURE',
    retry: 'RETRY',
    progress: 'PROGRESS',
    missions: 'MISSIONS',
    contacts: 'CONTACTS',
    locations: 'LOCATIONS',
    merits: 'MERITS',
    resources: 'RESOURCES',
    streak: 'STREAK',
    priorityFiles: 'PRIORITY FILES',
    loadingIndex: 'LOADING INDEX...',
    noFiles: '[ ! ] NO MARKED FILES',
    ranks: {
      leader: 'RESISTANCE LEADER',
      tactical: 'TACTICAL OFFICER',
      veteran: 'VETERAN AGENT',
      operator: 'FIELD OPERATOR',
      recruit: 'RECRUIT'
    }
  }
}

const GameStats: React.FC<GameStatsProps> = ({ className = '', showDetailed = true, onNavigateToStory, onStatClick }) => {
  const { user } = useAuth()
  const { language } = useLanguage()
  const t = statsTranslations[language]

  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [favoriteStories, setFavoriteStories] = useState<any[]>([])
  const [loadingFavorites, setLoadingFavorites] = useState(false)

  const cargarEstadisticas = React.useCallback(async () => {
    if (!user?.id) return
    try {
      setLoading(true)
      setError(null)
      const dashboardStats = await gameService.getDashboardStats(user.id)
      if (dashboardStats) {
        setStats(dashboardStats)
      } else {
        setError(t.error)
      }
    } catch (err: any) {
      console.error('Error:', err)
      setError(t.connectionError)
    } finally {
      setLoading(false)
    }
  }, [user?.id, t])

  const cargarHistoriasFavoritas = React.useCallback(async () => {
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
  }, [user?.id])

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
  }, [user?.id, cargarEstadisticas, cargarHistoriasFavoritas])

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
    if (nivel >= 20) return t.ranks.leader
    if (nivel >= 15) return t.ranks.tactical
    if (nivel >= 10) return t.ranks.veteran
    if (nivel >= 5) return t.ranks.operator
    return t.ranks.recruit
  }

  if (loading) {
    return (
      <div className={`resistance-dashboard loading ${className}`}>
        <div className="loading-text">{t.loading}</div>
      </div>
    )
  }

  if (error || !stats) {
    return (
      <div className={`resistance-dashboard error ${className}`}>
        <div>
          <p className="error-text">[ ! ] {error}</p>
          <button onClick={cargarEstadisticas} className="terminal-btn">{t.retry}</button>
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
              {t.progress}: {stats.xpTotal.toLocaleString()} / {(stats.xpTotal + stats.xpParaSiguienteNivel).toLocaleString()} XP
            </div>
          </div>
        </div>
      </div>

      {/* SEPARADOR VISUAL */}
      <div className="terminal-separator" />

      {showDetailed && (
        <>
          {/* SECCIÓN 2: ESTADÍSTICAS TÁCTICAS (GRID COMPACTO) */}
          <div className="stats-grid">
            <div className="stat-card" onClick={() => onStatClick?.('missions')}>
              <div className="stat-icon">📂</div>
              <div className="stat-content">
                <span className="stat-value">{stats.historiasCompletadas}</span>
                <span className="stat-label">{t.missions}</span>
              </div>
            </div>

            <div className="stat-card" onClick={() => onStatClick?.('contacts')}>
              <div className="stat-icon">👥</div>
              <div className="stat-content">
                <span className="stat-value">{stats.personajesConocidos}</span>
                <span className="stat-label">{t.contacts}</span>
              </div>
            </div>

            <div className="stat-card" onClick={() => onStatClick?.('locations')}>
              <div className="stat-icon">📍</div>
              <div className="stat-content">
                <span className="stat-value">{stats.ubicacionesVisitadas}</span>
                <span className="stat-label">{t.locations}</span>
              </div>
            </div>

            <div className="stat-card" onClick={() => onStatClick?.('merits')}>
              <div className="stat-icon">🎖️</div>
              <div className="stat-content">
                <span className="stat-value">{stats.logrosDesbloqueados}</span>
                <span className="stat-label">{t.merits}</span>
              </div>
            </div>

            <div className="stat-card" onClick={() => onStatClick?.('resources')}>
              <div className="stat-icon">🎒</div>
              <div className="stat-content">
                <span className="stat-value">{stats.inventarioItems}</span>
                <span className="stat-label">{t.resources}</span>
              </div>
            </div>
          </div>

          <div className="terminal-separator" />
        </>
      )}
    </div>
  )
}

export default GameStats