import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { 
  MapPin, BookOpen, User, Gift, Image, Video, Music, FileText, Box, 
  GitFork, Smartphone, Flag // Iconos nuevos para APP y FINAL
} from 'lucide-react';

const getMediaIcon = (type: string) => {
  switch (type) {
    case 'imagen': return <Image size={16} />;
    case 'video': return <Video size={16} />;
    case 'audio': return <Music size={16} />;
    case '3d_model': return <Box size={16} />;
    default: return <FileText size={16} />;
  }
};

// --- NODOS SIMPLES (Sin cambios) ---
export const StoryNode = memo(({ data }: NodeProps) => (
  <div className="custom-node node-story">
    <div className="node-header"><BookOpen size={16} /><strong>{data.label}</strong></div>
    <div className="node-body"><p>{data.descripcion?.substring(0,40)}...</p></div>
    <Handle type="target" position={Position.Top} id="location-in" style={{ background: '#ff0072' }} />
    <Handle type="source" position={Position.Bottom} id="flow-out" style={{ background: '#555' }} />
  </div>
));

export const LocationNode = memo(({ data }: NodeProps) => (
  <div className="custom-node node-location">
    <div className="node-header-loc"><MapPin size={16} /><strong>{data.label}</strong></div>
    <Handle type="source" position={Position.Bottom} id="location-out" style={{ background: '#ff0072' }} />
  </div>
));

export const CharacterNode = memo(({ data }: NodeProps) => (
  <div className="custom-node node-character">
    <div className="node-header-char"><User size={16} /><strong>{data.label}</strong></div>
    <Handle type="source" position={Position.Right} id="char-out" style={{ background: '#28a745' }} />
  </div>
));

export const RewardNode = memo(({ data }: NodeProps) => (
  <div className="custom-node node-reward">
    <div className="node-header-reward"><Gift size={16} /><strong>{data.label}</strong></div>
    <div className="node-body"><small>XP: {data.valor}</small></div>
    <Handle type="source" position={Position.Left} id="reward-out" style={{ background: '#ffc107' }} />
  </div>
));

export const MultimediaNode = memo(({ data }: NodeProps) => (
  <div className="custom-node node-media">
    <div className="node-header-media">{getMediaIcon(data.tipo)}<strong>{data.tipo?.toUpperCase()}</strong></div>
    <div className="node-body"><small style={{fontSize:9}}>{data.archivo?.split('/').pop()?.substring(0, 15)}...</small></div>
    <Handle type="source" position={Position.Right} id="media-out" style={{ background: '#17a2b8' }} />
  </div>
));

// --- NODO PASO (ACTUALIZADO: Lógica visual por tipo) ---
export const StepNode = memo(({ data }: NodeProps) => {
  // data.tipo viene del mapeo original, pero data.originalData.tipo_paso es el real de la DB
  // Usamos data.tipo_paso si existe (inyectado al crear nodo), sino data.tipo
  const stepType = data.tipo_paso || data.tipo || 'narrativo';

  // Configuración visual por tipo
  let headerStyle = { background: '#eee', color: '#666', borderBottomColor: '#ccc' };
  let headerText = 'NARRATIVO';
  let HeaderIcon = FileText;

  switch (stepType) {
      case 'pregunta': 
      case 'decision':
          headerStyle = { background: '#e3f2fd', color: '#0277bd', borderBottomColor: '#0277bd' };
          headerText = 'DECISIÓN';
          HeaderIcon = GitFork;
          break;
      case 'app':
          headerStyle = { background: '#e8f5e9', color: '#2e7d32', borderBottomColor: '#2e7d32' };
          headerText = 'APP / JUEGO';
          HeaderIcon = Smartphone;
          break;
      case 'final':
          headerStyle = { background: '#ffebee', color: '#c62828', borderBottomColor: '#c62828' };
          headerText = 'FINAL';
          HeaderIcon = Flag;
          break;
      default: // narrativo
          headerStyle = { background: '#f3f4f6', color: '#4b5563', borderBottomColor: '#9ca3af' };
          headerText = 'NARRATIVO';
          HeaderIcon = FileText;
          break;
  }

  return (
    <div className={`custom-node node-step type-${stepType}`}>
      {/* Entrada Flujo */}
      <Handle type="target" position={Position.Top} style={{ background: '#555', width: 10, height: 10 }} />
      
      <div className="node-header-step" style={headerStyle}>
        <span style={{fontWeight:'bold'}}>#{data.orden}</span>
        <span style={{display:'flex', alignItems:'center', gap:4, fontSize: 10, fontWeight:600}}>
            <HeaderIcon size={14}/> {headerText}
        </span>
      </div>

      <div className="node-body">
        <p style={{fontStyle: 'italic'}}>"{data.label?.substring(0, 45)}{data.label?.length > 45 ? '...' : ''}"</p>
      </div>

      {/* Conectores Laterales */}
      <Handle type="target" position={Position.Left} id="char-in" style={{ top: '30%', background: '#28a745' }} />
      <Handle type="target" position={Position.Left} id="media-in" style={{ top: '70%', background: '#17a2b8' }} />
      <Handle type="target" position={Position.Right} id="reward-in" style={{ top: '50%', background: '#ffc107' }} />

      {/* Salida Flujo */}
      <Handle 
        type="source" 
        position={Position.Bottom} 
        style={{ 
          background: stepType === 'final' ? 'transparent' : '#555', // Final no tiene salida visualmente fuerte
          width: 10,
          height: 10,
          opacity: stepType === 'final' ? 0 : 1
        }} 
      />
    </div>
  );
});