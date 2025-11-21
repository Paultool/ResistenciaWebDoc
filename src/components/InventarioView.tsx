import React, { useState, useEffect } from 'react'
import { gameServiceUser as gameService, InventoryItem } from '../services/GameServiceUser'
import { useAuth } from '../contexts/AuthContext'
import './InventarioView.css'

interface InventarioViewProps {
  onBack?: () => void
}

// Definimos categorías visuales que agrupan posibles valores de la DB
const CATEGORIAS = [
  { id: 'todos', label: '📦 Todos' },
  { id: 'documento', label: '📄 Documentos', types: ['documento', 'nota', 'carta', 'informe', 'papel'] },
  { id: 'evidencia', label: '🔍 Evidencia', types: ['evidencia', 'pista', 'objeto', 'clave'] },
  { id: 'foto', label: '📸 Fotos', types: ['foto', 'imagen', 'fotografia', 'polaroid'] },
  { id: 'otro', label: '🔹 Otros', types: [] } // Fallback
];

const InventarioView: React.FC<InventarioViewProps> = ({ onBack }) => {
  const { user } = useAuth()
  const [inventario, setInventario] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null)

  // Estado para el filtro activo
  const [activeCategory, setActiveCategory] = useState<string>('todos')

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
      if (stats && stats.inventario) {
        // Normalizamos los tipos a minúsculas para evitar errores de 'FOTO' vs 'foto'
        const itemsNormalizados = stats.inventario.map(item => ({
          ...item,
          tipo: item.tipo ? item.tipo.toLowerCase() : 'otro'
        }));
        setInventario(itemsNormalizados)
      }
    } catch (err: any) {
      console.error('Error cargando inventario:', err)
      setError('Error al cargar el inventario: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  // --- LÓGICA DE FILTRADO ROBUSTA ---
  const getCategoryForItem = (tipo: string): string => {
    for (const cat of CATEGORIAS) {
      if (cat.types && cat.types.includes(tipo)) {
        return cat.id;
      }
    }
    return 'otro';
  };

  const filteredItems = inventario.filter(item => {
    if (activeCategory === 'todos') return true;
    const itemCat = getCategoryForItem(item.tipo);

    // Si la categoría es 'otro', incluimos todo lo que no coincida con las otras cats
    if (activeCategory === 'otro') {
      const knownTypes = CATEGORIAS.flatMap(c => c.types || []);
      return !knownTypes.includes(item.tipo);
    }

    return itemCat === activeCategory;
  });

  // Helper para contar items por categoría visual
  const countByCategory = (catId: string) => {
    if (catId === 'todos') return inventario.length;
    if (catId === 'otro') {
      const knownTypes = CATEGORIAS.flatMap(c => c.types || []);
      return inventario.filter(i => !knownTypes.includes(i.tipo)).length;
    }
    const targetTypes = CATEGORIAS.find(c => c.id === catId)?.types || [];
    return inventario.filter(i => targetTypes.includes(i.tipo)).length;
  };

  // --- HELPERS VISUALES ---
  const getItemIcon = (tipo: string): string => {
    const map: Record<string, string> = {
      'documento': '📄', 'nota': '📝', 'carta': '✉️',
      'foto': '📸', 'imagen': '🖼️',
      'evidencia': '🔍', 'pista': '🧩',
      'llave': '🔑', 'usb': '💾'
    };
    // Búsqueda parcial (ej: si tipo es 'documento_secreto', devuelve documento)
    for (const key in map) {
      if (tipo.includes(key)) return map[key];
    }
    return '📦';
  }

  const getRarityColor = (rareza: string): string => {
    const r = rareza ? rareza.toLowerCase() : 'comun';
    const colors: Record<string, string> = {
      'común': '#718096', 'comun': '#718096',
      'rara': '#63b3ed', 'raro': '#63b3ed',
      'épica': '#9f7aea', 'epico': '#9f7aea',
      'legendaria': '#f6ad55', 'legendario': '#f6ad55',
      'clave': '#f56565' // Objetos clave en rojo
    }
    return colors[r] || '#718096';
  }

  if (loading) {
    return (
      <div className="iv-container">
        <div className="iv-header">
          <h2>🎒 Mi Inventario</h2>
        </div>
        <div className="iv-status">
          <p>⏳ Cargando objetos...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="iv-container">
        <div className="iv-header">
          <h2>🎒 Mi Inventario</h2>
        </div>
        <div className="iv-status">
          <p>❌ {error}</p>
          <button onClick={cargarInventario} className="iv-btn-retry">🔄 Reintentar</button>
        </div>
      </div>
    )
  }

  return (
    <div className="iv-container">
      <div className="iv-header">
        <h2>Mi Inventario</h2>
        <p>Objetos y evidencias recolectadas</p>
      </div>

      <div className="iv-controls">
        {/* Filtros Generados Dinámicamente */}
        <div className="iv-filter-bar">
          {CATEGORIAS.map(cat => {
            const count = countByCategory(cat.id);
            // Solo mostrar categorías que tengan items (o Todos)
            if (cat.id !== 'todos' && count === 0) return null;

            return (
              <button
                key={cat.id}
                className={`iv-filter-btn ${activeCategory === cat.id ? 'active' : ''}`}
                onClick={() => setActiveCategory(cat.id)}
              >
                {cat.label} ({count})
              </button>
            );
          })}
        </div>

        <div className="iv-stats">
          <span className="iv-stat-item">Total: <span className="iv-stat-val">{inventario.length}</span></span>
          <span className="iv-stat-item">Mostrando: <span className="iv-stat-val">{filteredItems.length}</span></span>
        </div>
      </div>

      {filteredItems.length === 0 ? (
        <div className="iv-empty">
          <span className="iv-empty-icon">📭</span>
          <p>No hay objetos en esta categoría.</p>
        </div>
      ) : (
        <div className="iv-grid">
          {filteredItems.map((item, index) => {
            const color = getRarityColor(item.rareza);
            return (
              <div
                key={index}
                className="iv-card"
                style={{ borderColor: activeCategory === 'todos' ? '#333' : color }} // Sutil detalle de color
              >
                <div className="iv-card-header">
                  <div className="iv-icon-box">{getItemIcon(item.tipo)}</div>
                  <span className="iv-rarity-badge" style={{ color: color }}>
                    {item.rareza || 'COMÚN'}
                  </span>
                </div>

                <div className="iv-card-body">
                  <h3 className="iv-card-title">{item.nombre}</h3>
                  <span className="iv-card-type">{item.tipo}</span>
                  <p className="iv-card-desc">
                    {item.descripcion || 'Sin descripción disponible.'}
                  </p>
                </div>

                <div className="iv-card-footer">
                  <span className="iv-card-date">
                    {new Date(item.fecha_obtencion).toLocaleDateString('es-MX')}
                  </span>
                  <button
                    onClick={() => setSelectedItem(item)}
                    className="iv-btn-view"
                  >
                    Ver Detalles
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de Detalle (Namespaced iv-) */}
      {selectedItem && (
        <div className="iv-modal-overlay" onClick={() => setSelectedItem(null)}>
          <div className="iv-modal" onClick={(e) => e.stopPropagation()}>

            <div className="iv-modal-header">
              <div className="iv-modal-title-group">
                <span className="iv-modal-icon">{getItemIcon(selectedItem.tipo)}</span>
                <h2 className="iv-modal-h2">{selectedItem.nombre}</h2>
              </div>
              <button onClick={() => setSelectedItem(null)} className="iv-modal-close">×</button>
            </div>

            <div className="iv-modal-content">
              <div className="iv-detail-row">
                <div className="iv-detail-label">Tipo & Rareza</div>
                <div className="iv-detail-value" style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <span style={{ textTransform: 'capitalize' }}>{selectedItem.tipo}</span>
                  <span className="iv-rarity-badge" style={{ color: getRarityColor(selectedItem.rareza) }}>
                    {selectedItem.rareza}
                  </span>
                </div>
              </div>

              <div className="iv-detail-row">
                <div className="iv-detail-label">Descripción</div>
                <div className="iv-detail-value">{selectedItem.descripcion}</div>
              </div>

              <div className="iv-detail-row">
                <div className="iv-detail-label">Origen</div>
                <div className="iv-detail-value">
                  {selectedItem.historia_origen || 'Desconocido'}
                  <span style={{ color: '#718096', fontSize: '0.8rem', marginLeft: '8px' }}>
                    ({new Date(selectedItem.fecha_obtencion).toLocaleDateString()})
                  </span>
                </div>
              </div>

              {/* Sección explicativa de rareza */}
              <div className="iv-detail-row" style={{ background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '6px', border: 'none' }}>
                <div className="iv-detail-label" style={{ marginBottom: '0' }}>Información</div>
                <p style={{ fontSize: '0.85rem', color: '#a0aec0', fontStyle: 'italic', margin: '4px 0 0 0' }}>
                  {selectedItem.rareza === 'común' && 'Objeto estándar encontrado frecuentemente.'}
                  {selectedItem.rareza === 'rara' && 'Objeto poco común, útil para ciertas interacciones.'}
                  {selectedItem.rareza === 'épica' && 'Objeto valioso con gran importancia narrativa.'}
                  {selectedItem.rareza === 'legendaria' && 'Reliquia única. Define el curso de la historia.'}
                  {selectedItem.rareza === 'clave' && 'Necesario para desbloquear nuevas áreas.'}
                </p>
              </div>
            </div>

            <div className="iv-modal-footer">
              <button onClick={() => setSelectedItem(null)} className="iv-btn-close-modal">
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default InventarioView