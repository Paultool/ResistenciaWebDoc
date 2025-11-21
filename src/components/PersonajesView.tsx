import React, { useState, useEffect } from 'react'
import { obtenerPersonajes, Personaje } from '../supabaseClient'
import { gameServiceUser as gameService } from '../services/GameServiceUser'
import { useAuth } from '../contexts/AuthContext'
import './PersonajesView.css'

interface PersonajesViewProps {
  onBack?: () => void
}

const PersonajesView: React.FC<PersonajesViewProps> = ({ onBack }) => {
  const { user } = useAuth()
  const [personajes, setPersonajes] = useState<Personaje[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedPersonaje, setSelectedPersonaje] = useState<Personaje | null>(null)

  useEffect(() => {
    cargarPersonajes()
  }, [])

  const cargarPersonajes = async () => {
    try {
      setLoading(true)
      setError(null)
      const personajesData = await obtenerPersonajes()
      setPersonajes(personajesData)
    } catch (err: any) {
      console.error('Error cargando personajes:', err)
      setError('Error al cargar los personajes: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleMeetCharacter = async (personaje: Personaje) => {
    if (!user?.id) return
    try {
      const gameEvent = await gameService.meetCharacter(user.id, personaje.id.toString())
      if (gameEvent) {
        alert(`🎉 ¡Has conocido a ${personaje.nombre}! +${gameEvent.xp_ganado} XP`)
      }
    } catch (error: any) {
      console.error('Error conociendo personaje:', error)
      alert('Error al intentar conocer al personaje. Intenta de nuevo.')
    }
  }

  if (loading) {
    return (
      <div className="pv-container">
        <div className="pv-header">
          <h2>🎭 Galería de Personajes</h2>
        </div>
        <div className="pv-status">
          <p>⏳ Cargando datos...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="pv-container">
        <div className="pv-header">
          <h2>🎭 Galería de Personajes</h2>
        </div>
        <div className="pv-status">
          <p>❌ {error}</p>
          <button onClick={cargarPersonajes} className="pv-btn-retry">🔄 Reintentar</button>
        </div>
      </div>
    )
  }

  return (
    <div className="pv-container">
      <div className="pv-header">
        <h2>Galería de Personajes</h2>
        <p>Protagonistas de La Resistencia</p>
      </div>

      <div className="pv-stats">
        <span className="pv-stat-item">👥 Total: <span className="pv-stat-highlight">{personajes.length}</span></span>
        <span className="pv-stat-item">🏛️ Fichas disponibles</span>
      </div>

      <div className="pv-grid">
        {personajes.map((personaje) => {
          const atributos = personaje.metadata || {}

          return (
            <div key={personaje.id} className="pv-card">
              <div className="pv-image-container">
                {personaje.imagen ? (
                  <img
                    src={personaje.imagen}
                    alt={personaje.nombre}
                    loading="lazy"
                  />
                ) : (
                  <div className="pv-placeholder">👤</div>
                )}
              </div>

              <div className="pv-info">
                <h3 className="pv-name">{personaje.nombre}</h3>
                <p className="pv-rol">{personaje.rol || 'Sin rol definido'}</p>
                <p className="pv-desc">
                  {personaje.descripcion || 'Sin descripción disponible.'}
                </p>

                {atributos.edad && (
                  <div className="pv-meta-row">
                    <span className="pv-meta-label">Edad:</span> {atributos.edad}
                  </div>
                )}

                {atributos.profesion && (
                  <div className="pv-meta-row">
                    <span className="pv-meta-label">Profesión:</span> {atributos.profesion}
                  </div>
                )}
              </div>

              <div className="pv-actions">
                {/* Botón único que ahora ocupará todo el ancho */}
                <button
                  onClick={() => setSelectedPersonaje(personaje)}
                  className="pv-btn pv-btn-sec"
                >
                  👁️ Ver Ficha
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Modal de Detalle de Personaje */}
      {selectedPersonaje && (
        <div className="pv-modal-overlay" onClick={() => setSelectedPersonaje(null)}>
          <div className="pv-modal" onClick={(e) => e.stopPropagation()}>

            <div className="pv-modal-header">
              <h2 className="pv-modal-title">{selectedPersonaje.nombre}</h2>
              <button onClick={() => setSelectedPersonaje(null)} className="pv-modal-close">×</button>
            </div>

            <div className="pv-modal-content">
              {/* Columna Izquierda: Imagen */}
              <div className="pv-modal-img-container">
                {selectedPersonaje.imagen ? (
                  <img src={selectedPersonaje.imagen} alt={selectedPersonaje.nombre} />
                ) : (
                  <div className="pv-placeholder">👤</div>
                )}
              </div>

              {/* Columna Derecha: Info */}
              <div className="pv-modal-info">
                <div>
                  <h4 className="pv-section-title">Rol / Ocupación</h4>
                  <p className="pv-modal-desc" style={{ color: '#63b3ed', fontWeight: 'bold' }}>{selectedPersonaje.rol}</p>
                </div>

                <div>
                  <h4 className="pv-section-title">Descripción</h4>
                  <p className="pv-modal-desc">{selectedPersonaje.descripcion}</p>
                </div>

                {selectedPersonaje.metadata && (
                  <div>
                    <h4 className="pv-section-title">Atributos</h4>
                    <div className="pv-attr-grid">
                      {Object.entries(selectedPersonaje.metadata).map(([key, value]) => (
                        <div key={key} className="pv-attr-row">
                          <span className="pv-attr-key">{key.charAt(0).toUpperCase() + key.slice(1)}</span>
                          <span className="pv-attr-val">{String(value)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="pv-modal-actions">
              {/* Aquí se mantiene el botón para ganar XP */}
              <button
                onClick={() => handleMeetCharacter(selectedPersonaje)}
                className="pv-btn pv-btn-pri"
                style={{ width: 'auto', display: 'inline-flex' }}
              >
                🤝 Registrar Encuentro (+25 XP)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default PersonajesView