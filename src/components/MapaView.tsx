import React, { useRef, useEffect, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './MapaView.css';
import HistoriaDetail from './HistoriaDetail';
import { RecursoMultimediaData } from './types';

interface Historia {
  id_historia: number;
  titulo: string;
  id_ubicacion: {
    coordenadas: string;
  } | null;
  id_historia_dependencia?: number | null;
}

interface MapaViewProps {
  historias: Historia[];
  onBack: () => void;
  historiasVisitadas: number[];
  onStartNarrativeFromMap: (historiaId: number) => void;
  initialCenter: [number, number];
  recursos: RecursoMultimediaData[];
}

// --- CAMBIO EN ICONOS: Usar filtros CSS si es posible, o mantener estos ---
// Nota: Al invertir el mapa con CSS, los iconos también se invierten. 
// Si se ven raros, puedes aplicar style={{ filter: 'invert(100%)' }} al div del icono, 
// pero Leaflet lo hace difícil. Por ahora, estos funcionarán y se verán "distintos" por el filtro global.
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

const MapaView: React.FC<MapaViewProps> = ({
  historias,
  onBack,
  historiasVisitadas,
  onStartNarrativeFromMap,
  initialCenter
}) => {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const [selectedHistoriaId, setSelectedHistoriaId] = useState<number | null>(null);

  const isLocked = (historia: Historia): boolean => {
    if (historia.id_historia_dependencia) {
      return !historiasVisitadas.includes(historia.id_historia_dependencia);
    }
    return false;
  };

  // --- EFECTO 1: Inicializar (Tu lógica corregida) ---
  useEffect(() => {
    if (!mapInstanceRef.current && mapRef.current) {
      console.log(`[MapaView] Inicializando mapa en: ${initialCenter}`);

      const initialCoords: L.LatLngTuple = initialCenter;
      const initialZoom = 16;

      const map = L.map(mapRef.current, {
        zoomControl: false // Desactivamos el zoom por defecto para moverlo o estilizarlo si queremos
      }).setView(initialCoords, initialZoom);

      // Re-agregamos control de zoom en la posición deseada
      L.control.zoom({ position: 'bottomright' }).addTo(map);

      mapInstanceRef.current = map;

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; RESISTENCIA_OS | OpenStreetMap'
      }).addTo(map);

      setTimeout(() => { map.invalidateSize(); }, 100);

    } else if (mapInstanceRef.current) {
      console.log(`[MapaView] Re-centrando mapa en: ${initialCenter}`);
      mapInstanceRef.current.setView(initialCenter, 16);
      setTimeout(() => { mapInstanceRef.current?.invalidateSize(); }, 100);
    }
  }, [initialCenter]);


  // --- EFECTO 2: Marcadores ---
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    map.eachLayer((layer) => {
      if (layer instanceof L.Marker) {
        map.removeLayer(layer);
      }
    });

    historias.forEach(historia => {
      const coordenadas = historia.id_ubicacion?.coordenadas;
      if (coordenadas) {
        const [lat, lng] = coordenadas.split(',').map(Number);
        if (!isNaN(lat) && !isNaN(lng)) {

          const locked = isLocked(historia);
          const icon = locked ? yellowIcon : greenIcon;

          const marker = L.marker([lat, lng], { icon: icon }).addTo(map);

          // Popup estilo técnico
          const statusText = locked ? '[ BLOQUEADO ]' : '[ DISPONIBLE ]';
          const popupContent = `
            <div style="text-align: center;">
                <strong style="font-size:14px;">${historia.titulo}</strong>
                <hr style="border: 0; border-top: 1px solid #33ff00; margin: 5px 0;">
                <span style="font-size:10px;">${statusText}</span>
            </div>
          `;

          marker.bindPopup(popupContent);

          marker.on('click', () => {
            setSelectedHistoriaId(historia.id_historia);
          });
        }
      }
    });
  }, [historias, historiasVisitadas]);


  // --- NUEVO JSX (ESTILO TERMINAL) ---
  return (
    <div className="mapa-view-container select-none">

      {/* ENCABEZADO DE TERMINAL */}
      <div className="w-full flex justify-between items-center border-b border-[#33ff00]/30 bg-black/90 p-4 z-20">
        <div>
          <h2 className="text-[#33ff00] text-xl font-bold tracking-widest uppercase flex items-center gap-2">
            <span className="animate-pulse">⌖</span> GEOLOCALIZACIÓN
          </h2>
          <p className="text-[10px] text-[#33ff00]/60 font-mono mt-1">
            RASTREO DE NODOS ACTIVO.
          </p>
        </div>
      </div>

      {/* CONTENEDOR DEL MAPA */}
      <div className="relative flex-grow w-full h-full z-10">

        {/* El mapa Leaflet */}
        <div
          id="map"
          ref={mapRef}
          className="h-full w-full"
          style={{ background: '#000' }} // Fallback background
        >
        </div>

        {/* Overlay Decorativo (Miras en las esquinas del mapa) */}
        <div className="absolute top-4 left-4 w-8 h-8 border-t-2 border-l-2 border-[#33ff00]/50 pointer-events-none z-[400]"></div>
        <div className="absolute top-4 right-4 w-8 h-8 border-t-2 border-r-2 border-[#33ff00]/50 pointer-events-none z-[400]"></div>
        <div className="absolute bottom-4 left-4 w-8 h-8 border-b-2 border-l-2 border-[#33ff00]/50 pointer-events-none z-[400]"></div>
        <div className="absolute bottom-4 right-4 w-8 h-8 border-b-2 border-r-2 border-[#33ff00]/50 pointer-events-none z-[400]"></div>

        {/* Leyenda Flotante */}
        <div className="absolute bottom-8 left-8 bg-black/80 border border-[#33ff00]/30 p-3 z-[500] backdrop-blur-sm">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-3 h-3 rounded-full bg-green-500 shadow-[0_0_5px_green]"></div>
            <span className="text-[#33ff00] text-[10px]">NODO SEGURO</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-yellow-500 shadow-[0_0_5px_yellow]"></div>
            <span className="text-yellow-500 text-[10px]">ENCRIPTADO</span>
          </div>
        </div>

      </div>

      {/* MODAL DE DETALLE (Si se selecciona una historia) */}
      {selectedHistoriaId && (
        <div
          className="absolute top-0 left-0 w-full h-full z-[1000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
        >
          {/* Wrapper para HistoriaDetail con estilo */}
          <div className="w-full max-w-md border border-[#33ff00] shadow-[0_0_30px_rgba(51,255,0,0.3)]">
            <HistoriaDetail
              historiaId={selectedHistoriaId}
              onClose={() => setSelectedHistoriaId(null)}
              onStartNarrative={(historia) => {
                onStartNarrativeFromMap(historia.id_historia);
                setSelectedHistoriaId(null);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default MapaView;