import React, { useState, useEffect } from 'react'
import { gameServiceUser as gameService, InventoryItem } from '../services/GameServiceUser'
import { useAuth } from '../contexts/AuthContext'
import './InventarioView.css'

interface InventarioViewProps {
  onBack?: () => void
}

// Categorías Tácticas
const CATEGORIAS = [
  { id: 'todos', label: 'ALL_ITEMS' },
  { id: 'documento', label: 'ARCHIVOS', types: ['documento', 'nota', 'carta', 'informe', 'papel'] },
  { id: 'evidencia', label: 'EVIDENCIA', types: ['evidencia', 'pista', 'objeto', 'clave'] },
  { id: 'foto', label: 'IMÁGENES', types: ['foto', 'imagen', 'fotografia', 'polaroid'] },
  { id: 'otro', label: 'OTROS', types: [] }
];

const InventarioView: React.FC<InventarioViewProps> = ({ onBack }) => {
  const { user } = useAuth()
  const [inventario, setInventario] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null)
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
        const itemsNormalizados = stats.inventario.map(item => ({
          ...item,
          tipo: item.tipo ? item.tipo.toLowerCase() : 'otro'
        }));
        setInventario(itemsNormalizados)
      }
    } catch (err: any) {
      console.error('Error:', err)
      setError('ERROR DE SISTEMA: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const getCategoryForItem = (tipo: string): string => {
    for (const cat of CATEGORIAS) {
      if (cat.types && cat.types.includes(tipo)) return cat.id;
    }
    return 'otro';
  };

  const filteredItems = inventario.filter(item => {
    if (activeCategory === 'todos') return true;
    const itemCat = getCategoryForItem(item.tipo);
    if (activeCategory === 'otro') {
      const knownTypes = CATEGORIAS.flatMap(c => c.types || []);
      return !knownTypes.includes(item.tipo);
    }
    return itemCat === activeCategory;
  });

  const countByCategory = (catId: string) => {
    if (catId === 'todos') return inventario.length;
    if (catId === 'otro') {
      const knownTypes = CATEGORIAS.flatMap(c => c.types || []);
      return inventario.filter(i => !knownTypes.includes(i.tipo)).length;
    }
    const targetTypes = CATEGORIAS.find(c => c.id === catId)?.types || [];
    return inventario.filter(i => targetTypes.includes(i.tipo)).length;
  };

  const getItemIcon = (tipo: string): string => {
    const map: Record<string, string> = {
      'documento': '📄', 'nota': '📝', 'carta': '✉️',
      'foto': '📸', 'imagen': '🖼️',
      'evidencia': '🔍', 'pista': '🧩', 'llave': '🔑', 'usb': '💾'
    };
    for (const key in map) {
      if (tipo.includes(key)) return map[key];
    }
    return '📦';
  }

  // Colores Neón para Rarezas
  const getRarityColor = (rareza: string): string => {
    const r = rareza ? rareza.toLowerCase() : 'comun';
    const colors: Record<string, string> = {
      'común': '#888', 'comun': '#888',
      'rara': '#00ffff', 'raro': '#00ffff', // Cian
      'épica': '#ff00ff', 'epico': '#ff00ff', // Magenta
      'legendaria': '#ffff00', 'legendario': '#ffff00', // Amarillo
      'clave': '#ff0000' // Rojo Alerta
    }
    return colors[r] || '#888';
  }

  const scrollContainerRef = React.useRef<HTMLDivElement>(null)

  const scrollLeft = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: -300, behavior: 'smooth' })
    }
  }

  const scrollRight = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: 300, behavior: 'smooth' })
    }
  }

  if (loading) {
    return (
      <div className="iv-container flex items-center justify-center">
        <div className="text-[#33ff00] text-xl animate-pulse font-mono">
          {'>'} ACCEDIENDO ALMACÉN...
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="iv-container flex items-center justify-center">
        <div className="text-red-500 font-mono border border-red-500 p-4">
          [ ! ] {error}
          <button onClick={cargarInventario} className="block mt-4 text-white border border-white px-4 py-2 hover:bg-white hover:text-black w-full">
            REINTENTAR
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="iv-container">


      <div className="iv-controls">
        {/* Stats Bar */}
        <div className="iv-stats">
          <span>CAPACIDAD: <span className="iv-stat-val">ILIMITADA</span></span>
          <span>ITEMS EN BODEGA: <span className="iv-stat-val" style={{ color: '#33ff00' }}>{inventario.length}</span></span>
        </div>

        {/* Filtros */}
        <div className="iv-filter-bar">
          {CATEGORIAS.map(cat => {
            const count = countByCategory(cat.id);
            if (cat.id !== 'todos' && count === 0) return null;
            return (
              <button
                key={cat.id}
                className={`iv-filter-btn ${activeCategory === cat.id ? 'active' : ''}`}
                onClick={() => setActiveCategory(cat.id)}
              >
                {cat.label} [{count}]
              </button>
            );
          })}
        </div>
      </div>

      {/* GRID CONTENT */}
      {filteredItems.length === 0 ? (
        <div className="iv-empty">
          <p>[ ! ] SECCIÓN VACÍA</p>
        </div>
      ) : (
        <div className="iv-carousel-wrapper">
          <button className="iv-nav-btn iv-nav-left" onClick={scrollLeft}>{'<'}</button>

          <div className="iv-grid" ref={scrollContainerRef}>
            {filteredItems.map((item, index) => {
              const color = getRarityColor(item.rareza);
              return (
                <div
                  key={index}
                  className="iv-card"
                  style={{ borderColor: selectedItem === item ? '#33ff00' : '#333' }}
                >
                  <div className="iv-card-header">
                    <div className="iv-icon-box">{getItemIcon(item.tipo)}</div>
                    <span className="iv-rarity-badge" style={{ color: color, borderColor: color }}>
                      {item.rareza || 'N/A'}
                    </span>
                  </div>

                  <div className="iv-card-body">
                    <span className="iv-card-type">{item.tipo}</span>
                    <h3 className="iv-card-title">{item.nombre}</h3>
                    <div className="iv-card-desc">
                      {item.descripcion || 'DATOS NO DISPONIBLES.'}
                    </div>
                  </div>

                  <div className="iv-card-footer">
                    <button onClick={() => setSelectedItem(item)} className="iv-btn-view">
                      [ INSPECCIONAR ]
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <button className="iv-nav-btn iv-nav-right" onClick={scrollRight}>{'>'}</button>
        </div>
      )}

      {/* MODAL DETALLE */}
      {selectedItem && (
        <div className="iv-modal-overlay" onClick={() => setSelectedItem(null)}>
          <div className="iv-modal" onClick={(e) => e.stopPropagation()}>

            <div className="iv-modal-header">
              <h2 className="iv-modal-h2">{selectedItem.nombre}</h2>
              <button onClick={() => setSelectedItem(null)} className="iv-modal-close">X</button>
            </div>

            <div className="iv-modal-content">
              <div className="iv-detail-row">
                <div className="iv-detail-label">CLASIFICACIÓN</div>
                <div className="iv-detail-value flex gap-2 items-center">
                  <span className="iv-rarity-badge" style={{ color: getRarityColor(selectedItem.rareza) }}>
                    {selectedItem.rareza}
                  </span>
                  <span className="text-sm text-[#666] uppercase">| {selectedItem.tipo}</span>
                </div>
              </div>

              <div className="iv-detail-row">
                <div className="iv-detail-label">DESCRIPCIÓN TÉCNICA</div>
                <div className="iv-detail-value" style={{ lineHeight: '1.6' }}>
                  {selectedItem.descripcion}
                </div>
              </div>

              <div className="iv-detail-row">
                <div className="iv-detail-label">ORIGEN / FECHA</div>
                <div className="iv-detail-value text-sm">
                  {selectedItem.historia_origen || 'DESCONOCIDO'}
                  <span className="text-[#666] ml-2">
                    [{new Date(selectedItem.fecha_obtencion).toLocaleDateString()}]
                  </span>
                </div>
              </div>
            </div>

            <div className="iv-modal-footer">
              <button onClick={() => setSelectedItem(null)} className="iv-btn-close-modal">
                CERRAR VISUALIZACIÓN
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default InventarioView