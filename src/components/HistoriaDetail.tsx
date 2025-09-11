import React, { useState, useEffect } from 'react'
import { Historia, obtenerHistoriaDetalle } from '../supabaseClient'
import { gameService } from '../services/GameService'
import { useAuth } from '../contexts/AuthContext'

interface HistoriaDetailProps {
  historiaId: number
  onClose: () => void
}

interface HistoriaCompleta extends Historia {
  recursomultimedia: any[]
  personaje: any[]
  ubicacion: any[]
}

const HistoriaDetail: React.FC<HistoriaDetailProps> = ({ historiaId, onClose }) => {
  const { user } = useAuth()
  const [historia, setHistoria] = useState<HistoriaCompleta | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'contenido' | 'personajes' | 'multimedia'>('contenido')
  const [playerStats, setPlayerStats] = useState<any>(null)
  const [canAccess, setCanAccess] = useState(true)
  const [hasStarted, setHasStarted] = useState(false)
  const [isCompleting, setIsCompleting] = useState(false)

  useEffect(() => {
    cargarHistoriaDetalle()
    if (user?.id) {
      cargarEstadisticasJugador()
    }
  }, [historiaId, user])

  const cargarEstadisticasJugador = async () => {
    if (!user?.id) return
    
    try {
      const stats = await gameService.getPlayerStats(user.id)
      setPlayerStats(stats)
      
      // Verificar si el jugador puede acceder a esta historia
      if (historia && stats) {
        const nivelRequerido = historia.nivel_acceso_requerido || 1
        setCanAccess(stats.nivel >= nivelRequerido)
      }
    } catch (error: any) {
      console.error('Error cargando estadísticas del jugador:', error)
    }
  }

  const cargarHistoriaDetalle = async () => {
    try {
      setLoading(true)
      setError(null)
      const historiaData = await obtenerHistoriaDetalle(historiaId)
      setHistoria(historiaData)
    } catch (err: any) {
      console.error('Error cargando historia detalle:', err)
      setError('No se pudo cargar la historia: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleComenzarHistoria = async () => {
    if (!user?.id || !historia || isCompleting) return
    
    try {
      setIsCompleting(true)
      
      // Verificar acceso por nivel
      if (!canAccess) {
        alert(`🔒 Necesitas alcanzar el nivel ${historia.nivel_acceso_requerido} para acceder a esta historia.`)
        return
      }

      // Marcar historia como comenzada
      setHasStarted(true)
      
      // Otorgar XP por comenzar la historia
      console.log('🎮 Comenzando historia...', { userId: user.id, historiaId: historia.id, esPrincipal: historia.es_historia_principal })
      const gameEvent = await gameService.completeStory(
        user.id, 
        historia.id.toString(), 
        historia.es_historia_principal
      )
      console.log('✅ Historia completada, evento:', gameEvent)

      // Agregar objeto al inventario (simulado)
      const nuevoObjeto = {
        id: `obj_${Date.now()}`,
        nombre: `Testimonio: ${historia.titulo}`,
        descripcion: `Evidencia recolectada durante la exploración de "${historia.titulo}". Este testimonio documenta las experiencias y conocimientos adquiridos.`,
        tipo: 'documento' as const,
        rareza: historia.es_historia_principal ? 'épica' as const : 'rara' as const,
        historia_origen: historia.titulo
      }
      
      await gameService.addToInventory(user.id, nuevoObjeto)

      // Mostrar resultado
      const nivelAnterior = playerStats?.nivel || 1
      const xpGanado = gameEvent.xp_ganado
      const nivelActual = gameService.calculateLevel(gameEvent.xp_ganado)
      
      let mensaje = `🎉 ¡Historia completada!\n\n`
      mensaje += `📈 +${xpGanado} XP ganados\n`
      mensaje += `📦 +1 objeto añadido al inventario\n\n`
      
      if (nivelActual > nivelAnterior) {
        mensaje += `🎊 ¡SUBISTE DE NIVEL! Ahora eres Nivel ${nivelActual}\n\n`
      }
      
      mensaje += `💡 Explora más historias para continuar tu progreso.`
      
      alert(mensaje)
      
      // Recargar estadísticas
      await cargarEstadisticasJugador()
      
      // Emitir evento personalizado para actualizar estadísticas globalmente
      window.dispatchEvent(new CustomEvent('statsUpdated', { 
        detail: { userId: user.id, xpGanado: gameEvent.xp_ganado } 
      }))
      
    } catch (error: any) {
      console.error('Error completando historia:', error)
      alert('❌ Error al completar la historia. Inténtalo de nuevo.')
    } finally {
      setIsCompleting(false)
    }
  }

  if (loading) {
    return (
      <div className="historia-detail-overlay">
        <div className="historia-detail-modal">
          <div className="loading-detail">
            <p>⏳ Cargando historia...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error || !historia) {
    return (
      <div className="historia-detail-overlay">
        <div className="historia-detail-modal">
          <div className="error-detail">
            <p>❌ {error || 'Historia no encontrada'}</p>
            <button onClick={onClose} className="btn btn-secondary">
              ← Volver
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="historia-detail-overlay">
      <div className="historia-detail-modal">
        <div className="modal-header">
          <button onClick={onClose} className="btn-close">✕</button>
          <h2>{historia.titulo}</h2>
          <div className="historia-meta">
            <span className={`badge ${historia.es_historia_principal ? 'principal' : 'secundaria'}`}>
              {historia.es_historia_principal ? '⭐ Principal' : '📖 Secundaria'}
            </span>
            <span className="level-badge">
              🔒 Nivel {historia.nivel_acceso_requerido}
            </span>
            <span className="date-badge">
              📅 {new Date(historia.fecha_creacion).toLocaleDateString('es-MX')}
            </span>
          </div>
        </div>

        <div className="modal-tabs">
          <button 
            className={`tab ${activeTab === 'contenido' ? 'active' : ''}`}
            onClick={() => setActiveTab('contenido')}
          >
            📜 Contenido
          </button>
          <button 
            className={`tab ${activeTab === 'personajes' ? 'active' : ''}`}
            onClick={() => setActiveTab('personajes')}
          >
            🎭 Personajes ({historia.personaje?.length || 0})
          </button>
          <button 
            className={`tab ${activeTab === 'multimedia' ? 'active' : ''}`}
            onClick={() => setActiveTab('multimedia')}
          >
            🎥 Multimedia ({historia.recursomultimedia?.length || 0})
          </button>
        </div>

        <div className="modal-content">
          {activeTab === 'contenido' && (
            <div className="content-tab">
              <div className="historia-description">
                <h3>📝 Descripción</h3>
                <p>{historia.descripcion}</p>
              </div>
              
              {historia.metadata && (
                <div className="historia-metadata">
                  <h3>🔍 Detalles Adicionales</h3>
                  <pre>{JSON.stringify(historia.metadata, null, 2)}</pre>
                </div>
              )}
              
              <div className="historia-actions">
                <button 
                  className={`btn ${canAccess ? 'btn-primary' : 'btn-disabled'}`}
                  onClick={handleComenzarHistoria}
                  disabled={!canAccess || isCompleting}
                >
                  {isCompleting ? (
                    '⏳ Procesando...'
                  ) : hasStarted ? (
                    '✅ Historia Completada'
                  ) : canAccess ? (
                    `▶️ Comenzar Historia (+${historia.es_historia_principal ? 150 : 75} XP)`
                  ) : (
                    `🔒 Requiere Nivel ${historia.nivel_acceso_requerido}`
                  )}
                </button>
                
                {!canAccess && (
                  <div className="access-info">
                    <p>📊 Tu nivel actual: {playerStats?.nivel || 1}</p>
                    <p>🔒 Nivel requerido: {historia.nivel_acceso_requerido}</p>
                  </div>
                )}
                
                <button className="btn btn-secondary">
                  🔖 Marcar como Favorita
                </button>
              </div>
            </div>
          )}

          {activeTab === 'personajes' && (
            <div className="personajes-tab">
              {historia.personaje && historia.personaje.length > 0 ? (
                <div className="personajes-grid">
                  {historia.personaje.map((personaje: any) => (
                    <div key={personaje.id} className="personaje-card">
                      <div className="personaje-avatar">
                        {personaje.nombre.charAt(0).toUpperCase()}
                      </div>
                      <div className="personaje-info">
                        <h4>{personaje.nombre}</h4>
                        <p className="personaje-rol">{personaje.rol}</p>
                        <p className="personaje-desc">{personaje.descripcion}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="no-data">
                  <p>👥 No hay personajes asociados a esta historia</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'multimedia' && (
            <div className="multimedia-tab">
              {historia.recursomultimedia && historia.recursomultimedia.length > 0 ? (
                <div className="multimedia-grid">
                  {historia.recursomultimedia.map((recurso: any) => (
                    <div key={recurso.id} className="multimedia-item">
                      <div className="multimedia-icon">
                        {recurso.tipo === 'video' && '🎥'}
                        {recurso.tipo === 'audio' && '🎧'}
                        {recurso.tipo === 'image' && '🖼️'}
                        {!['video', 'audio', 'image'].includes(recurso.tipo) && '📎'}
                      </div>
                      <div className="multimedia-info">
                        <h4>{recurso.titulo}</h4>
                        <p className="multimedia-tipo">{recurso.tipo.toUpperCase()}</p>
                        <p className="multimedia-desc">{recurso.descripcion}</p>
                        <button className="btn btn-sm btn-outline">
                          👁️ Ver Recurso
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="no-data">
                  <p>🎥 No hay recursos multimedia para esta historia</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default HistoriaDetail