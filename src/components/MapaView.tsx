import React, { useRef, useEffect, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './MapaView.css'; // Asegúrate de que este archivo exista y estilice el header
import HistoriaDetail from './HistoriaDetail'; // 1. IMPORTAR

// 2. ACTUALIZAR INTERFAZ (para coincidir con FlujoNarrativoUsuario)
//    Asegúrate de que la interfaz aquí coincida con la que le pasas desde FlujoNarrativoUsuario
interface Historia {
  id_historia: number; // Corregido de 'id' a 'id_historia'
  titulo: string;
  id_ubicacion: {
    coordenadas: string;
  } | null;
  id_historia_dependencia?: number | null; // Necesario para lógica de bloqueo
  // ... (cualquier otra propiedad que venga en el objeto 'historia')
}

// 3. ACTUALIZAR PROPS
interface MapaViewProps {
  historias: Historia[];
  onBack: () => void; // Función para cerrar el modal del mapa
  historiasVisitadas: number[]; // Array de IDs de historias completadas
  onStartNarrativeFromMap: (historiaId: number) => void; // Función para iniciar el flujo
}

// 4. DEFINIR ICONOS DE PINES
// (URLs de iconos de ejemplo. Asegúrate de que sean accesibles)
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

// 5. ACTUALIZAR COMPONENTE
const MapaView: React.FC<MapaViewProps> = ({ historias, onBack, historiasVisitadas, onStartNarrativeFromMap }) => {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  // 6. AÑADIR ESTADO para el modal de detalle
  const [selectedHistoriaId, setSelectedHistoriaId] = useState<number | null>(null);

  // 7. AÑADIR LÓGICA DE BLOQUEO
  const isLocked = (historia: Historia): boolean => {
      if (historia.id_historia_dependencia) {
          // Si tiene dependencia, verifica si NO ha sido visitada
          return !historiasVisitadas.includes(historia.id_historia_dependencia);
      }
      // Si no tiene dependencia, nunca está bloqueada
      return false;
  };

  useEffect(() => {
    // Solo inicializa el mapa si no existe una instancia
    if (!mapInstanceRef.current && mapRef.current) {
      const initialCoords: L.LatLngTuple = [19.598508, -99.174725]; // Hacklab
      const initialZoom = 18; // Un zoom más general

      const map = L.map(mapRef.current).setView(initialCoords, initialZoom);
      mapInstanceRef.current = map;

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(map);

      // ¡¡¡IMPORTANTE!!!
      // Leaflet necesita recalcular su tamaño cuando se muestra en un modal
      // que estaba oculto. Usamos un timeout para asegurar que el DOM esté listo.
      setTimeout(() => {
        map.invalidateSize();
      }, 100);
    }
    
    // Si el mapa ya está inicializado, actualizamos los marcadores
    if (mapInstanceRef.current) {
        const map = mapInstanceRef.current;
        
        // Limpiar marcadores viejos
        map.eachLayer((layer) => {
          if (layer instanceof L.Marker) {
            map.removeLayer(layer);
          }
        });

        // 8. ACTUALIZAR LÓGICA DE MARCADORES
        historias.forEach(historia => {
          const coordenadas = historia.id_ubicacion?.coordenadas;
          if (coordenadas) {
            const [lat, lng] = coordenadas.split(',').map(Number);
            if (!isNaN(lat) && !isNaN(lng)) {
              
              const locked = isLocked(historia);
              const icon = locked ? yellowIcon : greenIcon;
              
              const marker = L.marker([lat, lng], { icon: icon }).addTo(map);
              
              // Añadimos un popup simple
              marker.bindPopup(`<b>${historia.titulo}</b><br>${locked ? 'Bloqueada' : 'Disponible'}`);

              // Al hacer clic, abrimos el modal de HistoriaDetail
              marker.on('click', () => {
                setSelectedHistoriaId(historia.id_historia); 
              });
            }
          }
        });
    }

  }, [historias, historiasVisitadas]); // Añadir historiasVisitadas a las dependencias

  return (
    // 9. ACTUALIZAR JSX (Asegurar altura completa)
    <div className="mapa-view-container" style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      
      {/* El zIndex es importante para que el header esté sobre el mapa */}
      <div className="view-header" style={{ flexShrink: 0, position: 'relative', zIndex: 10 }}>
        {/* El botón de volver ahora es manejado por el modal padre */}
        <h2>🗺️ Mapa de La Resistencia</h2>
        <p>Explora las historias. (Verde: Desbloqueada, Amarillo: Bloqueada)</p>
      </div>
      
      {/* Aseguramos que el mapa ocupe el espacio restante */}
      <div 
        id="map" 
        ref={mapRef} 
        className="map-container" 
        style={{ flexGrow: 1, height: '100%', width: '100%', zIndex: 5 }} // zIndex más bajo que el header
      >
      </div>

      {/* 10. RENDERIZAR HISTORIA DETAIL COMO OVERLAY */}
      {/* Se mostrará encima de todo (mapa y header) */}
      {selectedHistoriaId && (
        <div 
          className="historia-detail-map-wrapper" // <-- NUEVA CLASE PARA EL CSS
          style={{
            position: 'absolute', // El wrapper es absoluto, anclado al mapa-view-container
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            zIndex: 1000 // Asegura que esté sobre el mapa
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