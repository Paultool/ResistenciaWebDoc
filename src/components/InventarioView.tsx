import React, { useState, useEffect } from 'react'
import { gameService, InventoryItem } from '../services/GameService'
import { useAuth } from '../contexts/AuthContext'
import './InventarioView.css'

interface InventarioViewProps {
  onBack?: () => void
}

const InventarioView: React.FC<InventarioViewProps> = ({ onBack }) => {
  const { user } = useAuth()
  const [inventario, setInventario] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null)
  const [filterType, setFilterType] = useState<string>('todos')

  useEffect(() => {
    if (user?.id) {
      cargarInventario()
    }
  }, [user])

  const cargarInventario = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const stats = await gameService.getPlayerStats(user?.id!)
      if (stats) {
        setInventario(stats.inventario)
      }
    } catch (err: any) {
      console.error('Error cargando inventario:', err)
      setError('Error al cargar el inventario: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const openModal = (item: InventoryItem) => {
    setSelectedItem(item)
  }

  const closeModal = () => {
    setSelectedItem(null)
  }

  const filteredItems = inventario.filter(item => 
    filterType === 'todos' || item.tipo === filterType
  )

  const getItemIcon = (tipo: string): string => {
    const icons: Record<string, string> = {
      'documento': '📄',
      'foto': '📸',
      'contacto': '👤',
      'evidencia': '🔍',
      'memoria': '💭'
    }
    return icons[tipo] || '📦'
  }

  const getRarityColor = (rareza: string): string => {
    const colors: Record<string, string> = {
      'común': '#6b7280',
      'rara': '#3b82f6',
      'épica': '#8b5cf6',
      'legendaria': '#f59e0b'
    }
    return colors[rareza] || colors.común
  }

  if (loading) {
    return (
      <div className="inventario-view">
        <div className="view-header">
          <button onClick={onBack} className="back-btn">← Volver</button>
          <h2>🎒 Mi Inventario</h2>
        </div>
        <div className="loading">
          <p>⏳ Cargando inventario...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="inventario-view">
        <div className="view-header">
          <button onClick={onBack} className="back-btn">← Volver</button>
          <h2>🎒 Mi Inventario</h2>
        </div>
        <div className="error">
          <p>❌ {error}</p>
          <button onClick={cargarInventario} className="retry-btn">🔄 Reintentar</button>
        </div>
      </div>
    )
  }

  return (
    <div className="inventario-view">
      <div className="view-header">
        <button onClick={onBack} className="back-btn">← Volver</button>
        <h2>🎒 Mi Inventario</h2>
        <p>Objetos recolectados durante tu participación en La Resistencia</p>
      </div>

      <div className="inventario-controls">
        <div className="filter-selector">
          <button 
            className={`filter-btn ${filterType === 'todos' ? 'active' : ''}`}
            onClick={() => setFilterType('todos')}
          >
            📦 Todos ({inventario.length})
          </button>
          <button 
            className={`filter-btn ${filterType === 'documento' ? 'active' : ''}`}
            onClick={() => setFilterType('documento')}
          >
            📄 Documentos ({inventario.filter(i => i.tipo === 'documento').length})
          </button>
          <button 
            className={`filter-btn ${filterType === 'foto' ? 'active' : ''}`}
            onClick={() => setFilterType('foto')}
          >
            📸 Fotos ({inventario.filter(i => i.tipo === 'foto').length})
          </button>
          <button 
            className={`filter-btn ${filterType === 'contacto' ? 'active' : ''}`}
            onClick={() => setFilterType('contacto')}
          >
            👤 Contactos ({inventario.filter(i => i.tipo === 'contacto').length})
          </button>
          <button 
            className={`filter-btn ${filterType === 'evidencia' ? 'active' : ''}`}
            onClick={() => setFilterType('evidencia')}
          >
            🔍 Evidencias ({inventario.filter(i => i.tipo === 'evidencia').length})
          </button>
        </div>
        
        <div className="inventario-stats">
          <span className="stat">📊 Total: {inventario.length} objetos</span>
          <span className="stat">⭐ Objetos únicos recolectados</span>
        </div>
      </div>

      {filteredItems.length === 0 ? (
        <div className="empty-inventory">
          <div className="empty-icon">📦</div>
          <h3>Inventario Vacío</h3>
          <p>{filterType === 'todos' 
            ? 'Aún no has recolectado objetos. Explora historias para encontrar elementos únicos.'
            : `No tienes objetos de tipo '${filterType}' en tu inventario.`}
          </p>
        </div>
      ) : (
        <div className="inventario-grid">
          {filteredItems.map((item, index) => (
            <div 
              key={index} 
              className="item-card"
              style={{
                borderColor: getRarityColor(item.rareza),
                boxShadow: `0 4px 12px ${getRarityColor(item.rareza)}33`
              }}
            >
              <div className="item-header">
                <div className="item-icon">{getItemIcon(item.tipo)}</div>
                <div className="item-rarity" style={{ color: getRarityColor(item.rareza) }}>
                  {item.rareza.toUpperCase()}
                </div>
              </div>
              
              <div className="item-info">
                <h3 className="item-nombre">{item.nombre}</h3>
                <p className="item-tipo">{item.tipo}</p>
                <p className="item-descripcion">
                  {item.descripcion?.substring(0, 100)}...
                </p>
                <div className="item-meta">
                  <span className="item-fecha">
                    📅 {new Date(item.fecha_obtencion).toLocaleDateString('es-MX')}
                  </span>
                  <span className="item-historia">
                    📖 {item.historia_origen}
                  </span>
                </div>
              </div>
              
              <div className="item-actions">
                <button 
                  onClick={() => openModal(item)}
                  className="btn btn-primary"
                >
                  👁️ Ver Detalle
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal de Detalle de Objeto */}
      {selectedItem && (
        <div className="item-modal-overlay" onClick={closeModal}>
          <div className="item-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">
                <span className="modal-icon">{getItemIcon(selectedItem.tipo)}</span>
                <h2>{selectedItem.nombre}</h2>
              </div>
              <button onClick={closeModal} className="modal-close">×</button>
            </div>
            
            <div className="modal-content">
              <div className="item-details">
                <div className="detail-section">
                  <h4>🏷️ Tipo</h4>
                  <p>{selectedItem.tipo}</p>
                </div>
                
                <div className="detail-section">
                  <h4>⭐ Rareza</h4>
                  <p style={{ color: getRarityColor(selectedItem.rareza) }}>
                    {selectedItem.rareza.toUpperCase()}
                  </p>
                </div>
                
                <div className="detail-section">
                  <h4>📝 Descripción</h4>
                  <p>{selectedItem.descripcion}</p>
                </div>
                
                <div className="detail-section">
                  <h4>📅 Fecha de Obtención</h4>
                  <p>{new Date(selectedItem.fecha_obtencion).toLocaleString('es-MX')}</p>
                </div>
                
                <div className="detail-section">
                  <h4>📖 Historia de Origen</h4>
                  <p>{selectedItem.historia_origen}</p>
                </div>
                
                <div className="detail-section rarity-info">
                  <h4>ℹ️ Información de Rareza</h4>
                  <div className="rarity-description">
                    {selectedItem.rareza === 'común' && (
                      <p>Objetos frecuentes encontrados durante la exploración urbana.</p>
                    )}
                    {selectedItem.rareza === 'rara' && (
                      <p>Elementos especiales que requieren investigación profunda.</p>
                    )}
                    {selectedItem.rareza === 'épica' && (
                      <p>Objetos únicos con gran valor histórico y narrativo.</p>
                    )}
                    {selectedItem.rareza === 'legendaria' && (
                      <p>Elementos extremadamente raros con poder transformador.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
            
            <div className="modal-actions">
              <button onClick={closeModal} className="btn btn-secondary btn-large">
                ✅ Entendido
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default InventarioView