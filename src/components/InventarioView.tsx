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
    <div className="relative min-h-screen bg-black text-[#a8a8a8] font-mono selection:bg-[#33ff00] selection:text-black overflow-hidden flex flex-col">

      {/* Fondo Scanlines */}
      <div className="absolute inset-0 pointer-events-none z-0 opacity-20 fixed"
        style={{ backgroundImage: 'linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.06))', backgroundSize: '100% 2px, 3px 100%' }}>
      </div>

      {/* Header de Estadísticas */}
      <div className="relative z-10 p-4 flex flex-col md:flex-row justify-between items-center border-b border-[#33ff00]/30 bg-black/80 backdrop-blur-sm gap-4 md:gap-0">
        <div className="flex gap-6 text-xs md:text-sm">
          <span className="text-[#33ff00]">CAPACIDAD: <span className="font-bold text-white">ILIMITADA</span></span>
          <span className="text-[#33ff00]">ITEMS EN BODEGA: <span className="font-bold text-white">{inventario.length}</span></span>
        </div>

        {/* Filtros Estilizados */}
        <div className="flex flex-wrap justify-center gap-2">
          {CATEGORIAS.map(cat => {
            const count = countByCategory(cat.id);
            if (cat.id !== 'todos' && count === 0) return null;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`
                            px-3 py-1 text-[10px] md:text-xs uppercase font-bold border transition-all
                            ${activeCategory === cat.id
                    ? 'bg-[#33ff00] text-black border-[#33ff00]'
                    : 'bg-black text-[#33ff00] border-[#33ff00]/30 hover:border-[#33ff00]'}
                        `}
              >
                {cat.label} [{count}]
              </button>
            );
          })}
        </div>

        {onBack && (
          <button onClick={onBack} className="text-[#33ff00] hover:text-white border border-[#33ff00] px-3 py-1 text-xs uppercase">
            [ VOLVER ]
          </button>
        )}
      </div>

      {/* --- ÁREA PRINCIPAL (CARRUSEL) --- */}
      <div className="relative z-10 flex-grow flex items-center w-full overflow-hidden">

        {filteredItems.length === 0 ? (
          <div className="w-full flex flex-col items-center justify-center opacity-50">
            <span className="text-4xl mb-2">📦</span>
            <p className="text-[#33ff00] font-bold">[ ! ] SECCIÓN VACÍA</p>
          </div>
        ) : (
          <>
            {/* Botón Navegación Izquierda */}
            <button
              onClick={scrollLeft}
              className="hidden md:flex absolute left-4 z-50 w-12 h-12 border border-[#33ff00]/50 bg-black/50 text-[#33ff00] items-center justify-center hover:bg-[#33ff00] hover:text-black transition-all rounded-full backdrop-blur-md"
            >
              {'<'}
            </button>

            {/* Botón Navegación Derecha */}
            <button
              onClick={scrollRight}
              className="hidden md:flex absolute right-4 z-50 w-12 h-12 border border-[#33ff00]/50 bg-black/50 text-[#33ff00] items-center justify-center hover:bg-[#33ff00] hover:text-black transition-all rounded-full backdrop-blur-md"
            >
              {'>'}
            </button>

            {/* --- CONTENEDOR DE SCROLL --- */}
            <div
              ref={scrollContainerRef}
              className="w-full h-full flex items-center gap-6 overflow-x-auto px-6 md:px-16 snap-x snap-mandatory no-scrollbar py-8"
              style={{ scrollBehavior: 'smooth' }}
            >
              {filteredItems.map((item, index) => {
                const color = getRarityColor(item.rareza);
                return (
                  <div
                    key={index}
                    className="
                                    relative shrink-0 snap-center
                                    w-[85vw] landscape:w-[400px] landscape:h-[80vh] h-[60vh]
                                    md:w-[300px] md:h-[500px]
                                    border-2 bg-black overflow-hidden flex flex-col transition-all duration-300
                                    hover:shadow-[0_0_20px_rgba(51,255,0,0.1)]
                                "
                    style={{ borderColor: selectedItem === item ? '#33ff00' : (item.rareza === 'clave' ? '#ff0000' : '#33ff0030') }}
                  >
                    {/* Header de la Carta */}
                    <div className="p-4 border-b border-gray-800 flex justify-between items-start bg-gradient-to-b from-gray-900 to-black">
                      <div className="text-4xl filter drop-shadow-[0_0_5px_rgba(255,255,255,0.5)]">
                        {getItemIcon(item.tipo)}
                      </div>
                      <span
                        className="text-[10px] font-bold uppercase px-2 py-1 border"
                        style={{ color: color, borderColor: color, backgroundColor: `${color}10` }}
                      >
                        {item.rareza || 'COMÚN'}
                      </span>
                    </div>

                    {/* Cuerpo de la Carta */}
                    <div className="p-4 flex flex-col justify-between flex-grow">
                      <div>
                        <span className="text-[10px] text-gray-500 uppercase tracking-widest block mb-1">{item.tipo}</span>
                        <h3 className="text-lg font-bold text-white uppercase mb-2 leading-tight">{item.nombre}</h3>
                        <p className="text-xs text-gray-400 line-clamp-4 font-sans border-l-2 border-gray-800 pl-2">
                          {item.descripcion || 'DATOS NO DISPONIBLES.'}
                        </p>
                      </div>

                      <button
                        onClick={() => setSelectedItem(item)}
                        className="mt-4 w-full border border-[#33ff00] text-[#33ff00] py-2 text-xs font-bold uppercase hover:bg-[#33ff00] hover:text-black transition-all"
                      >
                        [ INSPECCIONAR ]
                      </button>
                    </div>
                  </div>
                );
              })}
              <div className="w-4 shrink-0"></div>
            </div>
          </>
        )}
      </div>

      {/* MODAL DETALLE (Estilo Hacker) */}
      {selectedItem && (
        <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex items-center justify-center p-4" onClick={() => setSelectedItem(null)}>
          <div className="relative w-full max-w-2xl bg-black border border-[#33ff00] shadow-[0_0_50px_rgba(51,255,0,0.2)] flex flex-col max-h-[90vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>

            {/* Header Modal */}
            <div className="p-6 border-b border-[#33ff00]/30 flex justify-between items-start bg-[#33ff00]/5">
              <div>
                <h2 className="text-2xl font-bold text-white uppercase mb-1">{selectedItem.nombre}</h2>
                <div className="flex gap-2 items-center">
                  <span className="text-xs font-bold px-2 py-0.5 border" style={{ color: getRarityColor(selectedItem.rareza), borderColor: getRarityColor(selectedItem.rareza) }}>
                    {selectedItem.rareza || 'COMÚN'}
                  </span>
                  <span className="text-xs text-gray-500 uppercase">| {selectedItem.tipo}</span>
                </div>
              </div>
              <button onClick={() => setSelectedItem(null)} className="text-[#33ff00] hover:text-white font-bold text-xl">X</button>
            </div>

            {/* Contenido Modal */}
            <div className="p-6 overflow-y-auto custom-scrollbar">
              <div className="mb-6">
                <h4 className="text-[#33ff00] text-xs uppercase tracking-[0.2em] mb-2 border-b border-[#33ff00]/30 pb-1">DESCRIPCIÓN TÉCNICA</h4>
                <p className="text-gray-300 text-sm leading-relaxed font-sans border-l-2 border-[#33ff00] pl-4">
                  {selectedItem.descripcion}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-[#111] p-3 border border-gray-800">
                  <span className="block text-gray-500 text-[10px] uppercase">ORIGEN</span>
                  <span className="block text-white text-sm">{selectedItem.historia_origen || 'DESCONOCIDO'}</span>
                </div>
                <div className="bg-[#111] p-3 border border-gray-800">
                  <span className="block text-gray-500 text-[10px] uppercase">FECHA DE ADQUISICIÓN</span>
                  <span className="block text-white text-sm">{new Date(selectedItem.fecha_obtencion).toLocaleDateString()}</span>
                </div>
              </div>
            </div>

            {/* Footer Modal */}
            <div className="p-4 border-t border-[#33ff00]/30 bg-black">
              <button onClick={() => setSelectedItem(null)} className="w-full bg-[#33ff00]/10 border border-[#33ff00] text-[#33ff00] py-3 font-bold uppercase tracking-widest hover:bg-[#33ff00] hover:text-black transition-all">
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