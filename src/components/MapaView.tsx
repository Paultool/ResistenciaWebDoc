import React, { useRef, useEffect, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './MapaView.css';
import HistoriaDetail from './HistoriaDetail';

// Interfaz de Historia (sin cambios)
interface Historia {
  id_historia: number;
  titulo: string;
  id_ubicacion: {
    coordenadas: string;
  } | null;
  id_historia_dependencia?: number | null;
}

// --- MODIFICACIÓN 1: Actualizar la Interfaz de Props ---
// Añadimos la nueva prop 'initialCenter' que viene de FlujoNarrativoUsuario
interface MapaViewProps {
  historias: Historia[];
  onBack: () => void;
  historiasVisitadas: number[];
  onStartNarrativeFromMap: (historiaId: number) => void;
  initialCenter: [number, number]; // <-- ¡AQUÍ ESTÁ LA NUEVA PROP!
}

// Iconos (sin cambios)
const greenIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});

const yellowIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-yellow.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});


// --- MODIFICACIÓN 2: Actualizar la Firma del Componente ---
// Recibimos 'initialCenter' desde las props
const MapaView: React.FC<MapaViewProps> = ({ 
  historias, 
  onBack, 
  historiasVisitadas, 
  onStartNarrativeFromMap, 
  initialCenter // <-- ¡AQUÍ LA RECIBIMOS!
}) => {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const [selectedHistoriaId, setSelectedHistoriaId] = useState<number | null>(null);

  // Lógica de bloqueo (sin cambios)
  const isLocked = (historia: Historia): boolean => {
      if (historia.id_historia_dependencia) {
          return !historiasVisitadas.includes(historia.id_historia_dependencia);
      }
      return false;
  };

  // --- MODIFICACIÓN 3: Lógica de 'useEffect' REFACTORIZADA ---
  
  // EFECTO 1: Para INICIALIZAR y CENTRAR el mapa
  // Se ejecuta solo si 'initialCenter' cambia (la primera vez o si el usuario cambia de historia y reabre el mapa)
  useEffect(() => {
    
    // Si el mapa NO está inicializado Y el ref del DOM está listo
    if (!mapInstanceRef.current && mapRef.current) {
      console.log(`[MapaView] Inicializando mapa en: ${initialCenter}`);
      
      // Usamos la prop 'initialCenter' y un zoom más razonable
      const initialCoords: L.LatLngTuple = initialCenter;
      const initialZoom = 16; // 21 es demasiado zoom, 16 es mejor

      const map = L.map(mapRef.current).setView(initialCoords, initialZoom);
      mapInstanceRef.current = map;

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(map);

      // Forzar recalculo de tamaño para el modal
      setTimeout(() => {
        map.invalidateSize();
      }, 100);
    
    // Si el mapa YA está inicializado, solo re-centramos
    } else if (mapInstanceRef.current) {
      console.log(`[MapaView] Re-centrando mapa en: ${initialCenter}`);
      mapInstanceRef.current.setView(initialCenter, 16); // Usar el mismo zoom
      
      // Forzar recalculo de tamaño
      setTimeout(() => {
        mapInstanceRef.current?.invalidateSize();
      }, 100);
    }
  
  // Este efecto DEBE depender de 'initialCenter'
  }, [initialCenter]);


  // EFECTO 2: Para ACTUALIZAR los marcadores
  // Se ejecuta solo si las historias o las visitadas cambian
  useEffect(() => {
    // Si el mapa no está listo, no hacer nada
    if (!mapInstanceRef.current) return;

    const map = mapInstanceRef.current;
    
    // Limpiar marcadores viejos
    map.eachLayer((layer) => {
      if (layer instanceof L.Marker) {
        map.removeLayer(layer);
      }
    });

    // Lógica de marcadores (sin cambios)
    historias.forEach(historia => {
      const coordenadas = historia.id_ubicacion?.coordenadas;
      if (coordenadas) {
        const [lat, lng] = coordenadas.split(',').map(Number);
        if (!isNaN(lat) && !isNaN(lng)) {
          
          const locked = isLocked(historia);
          const icon = locked ? yellowIcon : greenIcon;
          
          const marker = L.marker([lat, lng], { icon: icon }).addTo(map);
          
          marker.bindPopup(`<b>${historia.titulo}</b><br>${locked ? 'Bloqueada' : 'Disponible'}`);

          marker.on('click', () => {
            setSelectedHistoriaId(historia.id_historia); 
          });
        }
      }
    });
  
  // Este efecto DEBE depender de las historias y su estado
  }, [historias, historiasVisitadas]);

  
  // JSX (sin cambios)
  return (
    <div className="mapa-view-container" style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      
      <div className="view-header" style={{ flexShrink: 0, position: 'relative', zIndex: 10 }}>
        <h2>🗺️ Mapa de La Resistencia</h2>
        <p>Explora las historias. (Verde: Desbloqueada, Amarillo: Bloqueada)</p>
      </div>
      
      <div 
        id="map" 
        ref={mapRef} 
        className="map-container" 
        style={{ flexGrow: 1, height: '100%', width: '100%', zIndex: 5 }}
      >
      </div>

      {selectedHistoriaId && (
        <div 
          className="historia-detail-map-wrapper"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            zIndex: 1000
          }}
        >
          <HistoriaDetail
              historiaId={selectedHistoriaId}
              onClose={() => setSelectedHistoriaId(null)}
              onStartNarrative={(historia) => {
                  onStartNarrativeFromMap(historia.id_historia); 
                  setSelectedHistoriaId(null);
              }}
          />
        </div>
      )}
    </div>
  );
};

export default MapaView;