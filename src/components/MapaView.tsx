import React, { useState, useEffect } from 'react'
import { obtenerUbicaciones, Ubicacion } from '../supabaseClient'
import { gameService } from '../services/GameService'
import { useAuth } from '../contexts/AuthContext'
import './MapaView.css'

interface MapaViewProps {
  onBack?: () => void
}

const MapaView: React.FC<MapaViewProps> = ({ onBack }) => {
  const { user } = useAuth()
  const [ubicaciones, setUbicaciones] = useState<Ubicacion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedUbicacion, setSelectedUbicacion] = useState<Ubicacion | null>(null)
  const [mapMode, setMapMode] = useState<'list' | 'map'>('list')

  useEffect(() => {
    cargarUbicaciones()
  }, [])

  const cargarUbicaciones = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const ubicacionesData = await obtenerUbicaciones()
      setUbicaciones(ubicacionesData)
    } catch (err: any) {
      console.error('Error cargando ubicaciones:', err)
      setError('Error al cargar las ubicaciones: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleVisitLocation = async (ubicacion: Ubicacion) => {
    if (!user?.id) return
    
    try {
      const gameEvent = await gameService.visitLocation(user.id, ubicacion.id.toString())
      if (gameEvent) {
        alert(`🗺️ ¡Has visitado ${ubicacion.nombre}! +${gameEvent.xp_ganado} XP`)
      }
    } catch (error: any) {
      console.error('Error visitando ubicación:', error)
    }
  }

  const openModal = (ubicacion: Ubicacion) => {
    setSelectedUbicacion(ubicacion)
  }

  const closeModal = () => {
    setSelectedUbicacion(null)
  }

  const openGoogleMaps = (ubicacion: Ubicacion) => {
    const url = `https://www.google.com/maps/search/?api=1&query=${ubicacion.latitud},${ubicacion.longitud}`
    window.open(url, '_blank')
  }

  if (loading) {
    return (
      <div className="mapa-view">
        <div className="view-header">
          <button onClick={onBack} className="back-btn">← Volver</button>
          <h2>🗺️ Mapa Interactivo</h2>
        </div>
        <div className="loading">
          <p>⏳ Cargando ubicaciones...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="mapa-view">
        <div className="view-header">
          <button onClick={onBack} className="back-btn">← Volver</button>
          <h2>🗺️ Mapa Interactivo</h2>
        </div>
        <div className="error">
          <p>❌ {error}</p>
          <button onClick={cargarUbicaciones} className="retry-btn">🔄 Reintentar</button>
        </div>
      </div>
    )
  }

  return (
    <div className="mapa-view">
      <div className="view-header">
        <button onClick={onBack} className="back-btn">← Volver</button>
        <h2>🗺️ Mapa Interactivo</h2>
        <p>Explora las ubicaciones de Ciudad de México</p>
      </div>

      <div className="map-controls">
        <div className="mode-selector">
          <button 
            className={`mode-btn ${mapMode === 'list' ? 'active' : ''}`}
            onClick={() => setMapMode('list')}
          >
            📋 Vista Lista
          </button>
          <button 
            className={`mode-btn ${mapMode === 'map' ? 'active' : ''}`}
            onClick={() => setMapMode('map')}
          >
            🗺️ Vista Mapa
          </button>
        </div>
        
        <div className="ubicaciones-stats">
          <span className="stat">📍 Total: {ubicaciones.length} ubicaciones</span>
          <span className="stat">🏛️ Espacios de resistencia urbana</span>
        </div>
      </div>

      {mapMode === 'list' ? (
        <div className="ubicaciones-grid">
          {ubicaciones.map((ubicacion) => {
            const tipoIcon = getLocationIcon(ubicacion.metadata?.tipo || 'desconocido')
            
            return (
              <div key={ubicacion.id} className="ubicacion-card">
                <div className="ubicacion-header">
                  <div className="ubicacion-icon">{tipoIcon}</div>
                  <div className="ubicacion-coords">
                    📍 {ubicacion.latitud.toFixed(4)}, {ubicacion.longitud.toFixed(4)}
                  </div>
                </div>
                
                <div className="ubicacion-info">
                  <h3 className="ubicacion-nombre">{ubicacion.nombre}</h3>
                  <p className="ubicacion-tipo">{ubicacion.metadata?.tipo || 'Ubicación'}</p>
                  <p className="ubicacion-descripcion">
                    {ubicacion.descripcion?.substring(0, 120)}...
                  </p>
                </div>
                
                <div className="ubicacion-actions">
                  <button 
                    onClick={() => openModal(ubicacion)}
                    className="btn btn-info"
                  >
                    👁️ Ver Detalles
                  </button>
                  <button 
                    onClick={() => openGoogleMaps(ubicacion)}
                    className="btn btn-secondary"
                  >
                    🗺️ Abrir en Maps
                  </button>
                  <button 
                    onClick={() => handleVisitLocation(ubicacion)}
                    className="btn btn-primary"
                  >
                    📍 Visitar (+50 XP)
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="map-container">
          <div className="map-placeholder">
            <div className="map-placeholder-content">
              <h3>🗺️ Mapa Interactivo</h3>
              <p>Funcionalidad de mapa completo en desarrollo</p>
              <div className="coordinates-list">
                <h4>📍 Coordenadas de ubicaciones:</h4>
                {ubicaciones.map((ubicacion, index) => (
                  <div key={ubicacion.id} className="coordinate-item">
                    <strong>{ubicacion.nombre}</strong>: 
                    {ubicacion.latitud.toFixed(4)}, {ubicacion.longitud.toFixed(4)}
                    <button 
                      onClick={() => openGoogleMaps(ubicacion)}
                      className="btn-mini"
                    >
                      🗺️ Ver
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Detalle de Ubicación */}
      {selectedUbicacion && (
        <div className="ubicacion-modal-overlay" onClick={closeModal}>
          <div className="ubicacion-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{selectedUbicacion.nombre}</h2>
              <button onClick={closeModal} className="modal-close">×</button>
            </div>
            
            <div className="modal-content">
              <div className="modal-map-section">
                <div className="coordinates-display">
                  <h4>📍 Coordenadas</h4>
                  <p>Latitud: {selectedUbicacion.latitud}</p>
                  <p>Longitud: {selectedUbicacion.longitud}</p>
                  <button 
                    onClick={() => openGoogleMaps(selectedUbicacion)}
                    className="btn btn-secondary btn-full"
                  >
                    🗺️ Ver en Google Maps
                  </button>
                </div>
              </div>
              
              <div className="modal-info">
                <div className="info-section">
                  <h4>🏛️ Tipo</h4>
                  <p>{selectedUbicacion.metadata?.tipo || 'No especificado'}</p>
                </div>
                
                <div className="info-section">
                  <h4>📝 Descripción</h4>
                  <p>{selectedUbicacion.descripcion}</p>
                </div>
                
                <div className="info-section">
                  <h4>📊 Información Adicional</h4>
                  <p>Esta ubicación forma parte del recorrido de resistencia urbana en Ciudad de México.</p>
                </div>
              </div>
            </div>
            
            <div className="modal-actions">
              <button 
                onClick={() => handleVisitLocation(selectedUbicacion)}
                className="btn btn-primary btn-large"
              >
                📍 Visitar Ubicación (+50 XP)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Helper function to get appropriate icon for location type
const getLocationIcon = (tipo: string): string => {
  const icons: Record<string, string> = {
    'plaza': '🏛️',
    'mercado': '🛒',
    'barrio': '🏘️',
    'centro': '🏢',
    'parque': '🌳',
    'cultural': '🎭',
    'historico': '📜',
    'comunidad': '👥',
    'resistencia': '✊',
    'default': '📍'
  }
  
  return icons[tipo.toLowerCase()] || icons.default
}

export default MapaView