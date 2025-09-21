import React, { useRef, useEffect } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './MapaView.css'; // Asegúrate de crear este archivo para los estilos del mapa

// Define el tipo de la historia para TypeScript
interface Historia {
  id: number;
  titulo: string;
  id_ubicacion: {
    coordenadas: string;
  } | null;
}

interface MapaViewProps {
  historias: Historia[];
  onViewDetail: (historiaId: number) => void;
  onBack: () => void;
}

const MapaView: React.FC<MapaViewProps> = ({ historias, onViewDetail, onBack }) => {
  // Referencia al div donde se montará el mapa
  const mapRef = useRef(null);
  // Referencia a la instancia del mapa para evitar re-creación
  const mapInstanceRef = useRef(null);

  useEffect(() => {
    // Solo inicializa el mapa si no existe una instancia
    if (!mapInstanceRef.current && mapRef.current) {
      // Centro inicial en Ciudad de México, México
      const initialCoords = [19.4326, -99.1332];
      const initialZoom = 12;

      const map = L.map(mapRef.current).setView(initialCoords, initialZoom);
      mapInstanceRef.current = map;

      // Añadir la capa de OpenStreetMap
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(map);
    }
    
    // Si el mapa ya está inicializado, actualizamos los marcadores
    if (mapInstanceRef.current) {
        const map = mapInstanceRef.current;
        
        // Limpiar marcadores viejos para evitar duplicados
        map.eachLayer((layer) => {
          if (layer instanceof L.Marker) {
            map.removeLayer(layer);
          }
        });

        // Añadir nuevos marcadores para cada historia con ubicación
        historias.forEach(historia => {
          const coordenadas = historia.id_ubicacion?.coordenadas;
          if (coordenadas) {
            const [lat, lng] = coordenadas.split(',').map(Number);
            if (!isNaN(lat) && !isNaN(lng)) {
              const marker = L.marker([lat, lng]).addTo(map);
              marker.bindPopup(`<b>${historia.titulo}</b>`);
              marker.on('click', () => onViewDetail(historia.id));
            }
          }
        });
    }

  }, [historias, onViewDetail]);

  return (
    <div className="mapa-view-container">
      <div className="view-header">
        <button onClick={onBack} className="back-btn">← Volver al Dashboard</button>
        <h2>🗺️ Mapa de La Resistencia</h2>
        <p>Explora la ubicación de las historias en Ciudad de México</p>
      </div>
      <div id="map" ref={mapRef} className="map-container"></div>
    </div>
  );
};

export default MapaView;