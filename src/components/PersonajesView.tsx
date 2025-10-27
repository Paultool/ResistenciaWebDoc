import React, { useState, useEffect } from 'react'
import { obtenerPersonajes, Personaje } from '../supabaseClient'
import { gameService } from '../services/GameService'
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
      // Nota: El valor de XP (+25) es solo ilustrativo en la UI. El valor real viene del evento.
      const gameEvent = await gameService.meetCharacter(user.id, personaje.id.toString()) 
      if (gameEvent) {
        alert(`🎉 ¡Has conocido a ${personaje.nombre}! +${gameEvent.xp_ganado} XP`)
      }
    } catch (error: any) {
      console.error('Error conociendo personaje:', error)
      alert('Error al intentar conocer al personaje. Intenta de nuevo.')
    }
  }

  const openModal = (personaje: Personaje) => {
    setSelectedPersonaje(personaje)
  }

  const closeModal = () => {
    setSelectedPersonaje(null)
  }

  if (loading) {
    return (
      <div className="personajes-view">
        <div className="view-header">
          <h2>🎭 Galería de Personajes</h2>
        </div>
        <div className="loading">
          <p>⏳ Cargando personajes...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="personajes-view">
        <div className="view-header">
          <h2>🎭 Galería de Personajes</h2>
        </div>
        <div className="error">
          <p>❌ {error}</p>
          <button onClick={cargarPersonajes} className="retry-btn">🔄 Reintentar</button>
        </div>
      </div>
    )
  }

  return (
    <div className="personajes-view">
      <div className="view-header">
        <h2>🎭 Galería de Personajes</h2>
        <p>Conoce a los protagonistas de La Resistencia</p>
      </div>

      <div className="personajes-stats">
        <span className="stat">👥 Total: {personajes.length} personajes</span>
        <span className="stat">🏛️ Protagonistas de la resistencia urbana</span>
      </div>

      <div className="personajes-grid">
        {personajes.map((personaje) => {
          const atributos = personaje.metadata || {}
          
          return (
            <div key={personaje.id} className="personaje-card">
              <div className="personaje-image">
                {personaje.imagen ? (
                  <img 
                    src={personaje.imagen} 
                    alt={personaje.nombre} 
                    // Añadido 'loading="lazy"' para optimización de rendimiento.
                    loading="lazy" 
                  />
                ) : (
                  <div className="placeholder-image">
                    <span className="avatar-icon">👤</span>
                  </div>
                )}
              </div>
              
              <div className="personaje-info">
                <h3 className="personaje-nombre">{personaje.nombre}</h3>
                <p className="personaje-rol">{personaje.rol}</p>
                {/* 🚨 CAMBIO CLAVE: Usamos la clase CSS 'truncate-text' para limitar las líneas y evitar desbordamiento */}
                <p className="personaje-descripcion truncate-text"> 
                  {personaje.descripcion}
                </p>
                
                {atributos.edad && (
                  <div className="personaje-atributo">
                    <span className="atributo-label">Edad:</span> {atributos.edad}
                  </div>
                )}
                
                {atributos.profesion && (
                  <div className="personaje-atributo">
                    <span className="atributo-label">Profesión:</span> {atributos.profesion}
                  </div>
                )}
              </div>
              
              <div className="personaje-actions">
                <button 
                  onClick={() => openModal(personaje)}
                  className="btn btn-info"
                >
                  👁️ Ver Perfil
                </button>
                <button 
                  onClick={() => handleMeetCharacter(personaje)}
                  className="btn btn-primary"
                >
                  🤝 Conocer (+25 XP)
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Modal de Detalle de Personaje */}
      {selectedPersonaje && (
        <div className="personaje-modal-overlay" onClick={closeModal}>
          <div className="personaje-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{selectedPersonaje.nombre}</h2>
              <button onClick={closeModal} className="modal-close">×</button>
            </div>
            
            <div className="modal-content">
              <div className="modal-image">
                {selectedPersonaje.imagen ? (
                  <img src={selectedPersonaje.imagen} alt={selectedPersonaje.nombre} />
                ) : (
                  <div className="placeholder-image-large">
                    <span className="avatar-icon-large">👤</span>
                  </div>
                )}
              </div>
              
              <div className="modal-info">
                <div className="info-section">
                  <h4>🎭 Rol</h4>
                  <p>{selectedPersonaje.rol}</p>
                </div>
                
                <div className="info-section">
                  <h4>📝 Descripción</h4>
                  <p>{selectedPersonaje.descripcion}</p>
                </div>
                
                {selectedPersonaje.metadata && (
                  <div className="info-section">
                    <h4>📋 Atributos</h4>
                    <div className="atributos-list">
                      {/* Convertimos las claves a formato legible para el usuario */}
                      {Object.entries(selectedPersonaje.metadata).map(([key, value]) => (
                        <div key={key} className="atributo-item">
                          {/* capitalizamos la clave para mejor presentación */}
                          <span className="atributo-key">{key.charAt(0).toUpperCase() + key.slice(1)}:</span>
                          <span className="atributo-value">{String(value)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            <div className="modal-actions">
              <button 
                onClick={() => handleMeetCharacter(selectedPersonaje)}
                className="btn btn-primary btn-large"
              >
                🤝 Conocer Personaje (+25 XP)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default PersonajesView