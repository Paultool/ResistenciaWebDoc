import React, { useState } from 'react';
import {
  User,
  Gift,
  Image,
  MapPin,
  Box,
  PlusCircle,
  Video,
  Music,
  FileText
} from 'lucide-react';

// Helper para obtener el icono correcto según el tipo de multimedia
const getMediaIcon = (type: string) => {
  switch (type) {
    case 'video': return <Video size={14} />;
    case 'audio': return <Music size={14} />;
    case '3d_model': return <Box size={14} />;
    default: return <Image size={14} />;
  }
};

// Definición de las propiedades que recibe el componente
interface SidebarProps {
  personajes: any[];
  recompensas: any[];
  multimedia: any[];
  ubicaciones: any[];
  // Función para manejar la creación rápida desde el sidebar
  onCreateNew: (type: 'character' | 'location' | 'reward' | 'multimedia') => void;
}

export const CanvasSidebar: React.FC<SidebarProps> = ({
  personajes,
  recompensas,
  multimedia,
  ubicaciones,
  onCreateNew
}) => {
  // Estado para controlar la pestaña activa
  const [tab, setTab] = useState<'chars' | 'locations' | 'media' | 'rewards'>('chars');

  // Manejador del inicio de arrastre (Drag Start)
  const onDragStart = (event: React.DragEvent, nodeType: string, data: any) => {
    // Establecemos el tipo de nodo para que ReactFlow sepa qué renderizar
    event.dataTransfer.setData('application/reactflow', nodeType);
    // Pasamos los datos completos del objeto como JSON string
    event.dataTransfer.setData('application/json-data', JSON.stringify(data));
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div className="canvas-sidebar">
      {/* 1. PESTAÑAS DE NAVEGACIÓN */}
      <div className="sidebar-tabs">
        <button
          className={tab === 'chars' ? 'active' : ''}
          onClick={() => setTab('chars')}
          title="Personajes"
        >
          <User size={18} />
        </button>
        <button
          className={tab === 'locations' ? 'active' : ''}
          onClick={() => setTab('locations')}
          title="Ubicaciones"
        >
          <MapPin size={18} />
        </button>
        <button
          className={tab === 'media' ? 'active' : ''}
          onClick={() => setTab('media')}
          title="Multimedia"
        >
          <Image size={18} />
        </button>
        <button
          className={tab === 'rewards' ? 'active' : ''}
          onClick={() => setTab('rewards')}
          title="Recompensas"
        >
          <Gift size={18} />
        </button>
      </div>

      {/* 2. SECCIÓN DE CREACIÓN RÁPIDA */}
      <div className="sidebar-create-section">
        {tab === 'chars' && (
          <button className="btn-create-new" onClick={() => onCreateNew('character')}>
            <PlusCircle size={14} /> Crear Personaje
          </button>
        )}
        {tab === 'locations' && (
          <button className="btn-create-new" onClick={() => onCreateNew('location')}>
            <PlusCircle size={14} /> Crear Ubicación
          </button>
        )}
        {tab === 'media' && (
          <button className="btn-create-new" onClick={() => onCreateNew('multimedia')}>
            <PlusCircle size={14} /> Subir Multimedia
          </button>
        )}
        {tab === 'rewards' && (
          <button className="btn-create-new" onClick={() => onCreateNew('reward')}>
            <PlusCircle size={14} /> Crear Recompensa
          </button>
        )}
      </div>

      {/* 3. LISTA DE ELEMENTOS (DRAGGABLES) */}
      <div className="sidebar-list">
        <div className="sidebar-instruction">Arrastra al canvas ➔</div>

        {/* LISTA DE PERSONAJES */}
        {tab === 'chars' && personajes.map((p) => (
          <div
            key={p.id_personaje}
            className="dnd-node"
            draggable
            onDragStart={(e) => onDragStart(e, 'character', p)}
          >
            <User size={14} color="#28a745" />
            <span>{p.nombre}</span>
          </div>
        ))}

        {/* LISTA DE UBICACIONES */}
        {tab === 'locations' && ubicaciones.map((u) => (
          <div
            key={u.id_ubicacion}
            className="dnd-node"
            draggable
            onDragStart={(e) => onDragStart(e, 'location', u)}
          >
            <MapPin size={14} color="#ff0072" />
            <span>{u.nombre}</span>
          </div>
        ))}

        {/* LISTA DE MULTIMEDIA */}
        {tab === 'media' && multimedia.map((m) => (
          <div
            key={m.id_recurso}
            className="dnd-node"
            draggable
            onDragStart={(e) => onDragStart(e, 'multimedia', m)}
          >
            <span style={{ color: '#17a2b8' }}>{getMediaIcon(m.tipo)}</span>
            <span style={{ fontSize: '0.8em' }}>
              {m.Nombre || m.archivo.split('/').pop()?.substring(0, 20) || 'Archivo sin nombre'}
            </span>
          </div>
        ))}

        {/* LISTA DE RECOMPENSAS */}
        {tab === 'rewards' && recompensas.map((r) => (
          <div
            key={r.id_recompensa}
            className="dnd-node"
            draggable
            onDragStart={(e) => onDragStart(e, 'reward', r)}
          >
            <Gift size={14} color="#ffc107" />
            <span>{r.nombre} <small style={{ opacity: 0.7 }}>({r.valor} XP)</small></span>
          </div>
        ))}

        {/* MENSAJES DE LISTA VACÍA */}
        {tab === 'chars' && personajes.length === 0 && <p className="empty-msg">No hay personajes.</p>}
        {tab === 'locations' && ubicaciones.length === 0 && <p className="empty-msg">No hay ubicaciones.</p>}
        {tab === 'media' && multimedia.length === 0 && <p className="empty-msg">No hay multimedia.</p>}
        {tab === 'rewards' && recompensas.length === 0 && <p className="empty-msg">No hay recompensas.</p>}
      </div>
    </div>
  );
};