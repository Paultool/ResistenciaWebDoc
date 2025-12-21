import React, { useRef, useEffect, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './MapaViewS.css'; // Asegúrate de tener el CSS full screen que te pasé antes
import HistoriaDetail from './HistoriaDetail';
import { gameServiceUser } from '../services/GameServiceUser';

// --- Interfaces ---
interface Historia {
  id_historia: number; // Nota: App.tsx usa 'id', aquí mapeamos o usamos 'any' si hay conflicto
  titulo: string;
  id_ubicacion: { coordenadas: string } | null;
  id_historia_dependencia?: number | null;
  id_imagen_historia?: number;
}

interface RecursoMultimedia {
  id_recurso: number;
  archivo: string;
}

interface MapaViewSProps {
  historias: any[]; // Usamos any[] para evitar conflictos de tipos 'id' vs 'id_historia'
  historiasVisitadas: number[];
  // 👇 Esta es la función clave que llama al padre
  onStartNarrativeFromMap: (historiaId: number) => void;
  onExit?: () => void; // Prop opcional para cerrar el mapa
}

const userIcon = L.divIcon({
  className: 'custom-user-marker',
  html: '<div class="user-location-marker"></div>',
  iconSize: [20, 20],
  iconAnchor: [10, 10]
});

const MapaViewS: React.FC<MapaViewSProps> = ({
  historias,
  historiasVisitadas,
  onStartNarrativeFromMap,
  onExit
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const hasCenteredRef = useRef(false); // Para centrar solo la primera vez

  const [selectedHistoriaId, setSelectedHistoriaId] = useState<number | null>(null);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [recursosInternos, setRecursosInternos] = useState<RecursoMultimedia[]>([]);

  // --- 0. UTILIDAD: Calcular distancia (Haversine) ---
  const calcularDistancia = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // Radio tierra km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // --- 1. Obtener Imágenes ---
  useEffect(() => {
    const fetchImages = async () => {
      if (historias.length === 0) return;
      const { data } = await gameServiceUser.fetchMultimediaResources();
      if (data) setRecursosInternos(data);
    };
    fetchImages();
  }, [historias]);

  // --- 2. Iconos ---


  const createStoryIcon = (imgUrl: string | undefined, locked: boolean) => {
    const content = imgUrl
      ? `<img src="${imgUrl}" alt="H" onerror="this.style.display='none'" />`
      : `<div style="width:100%; height:100%; display:flex; align-items:center; justify-content:center; transform:rotate(45deg); font-weight:bold; color:white;">?</div>`;

    // Colores: Verde neón (#33ff00) para disponible, Amarillo (#ecc94b) para bloqueado
    const borderColor = locked ? '#ecc94b' : '#33ff00';

    return L.divIcon({
      className: 'custom-marker-icon',
      // Inyectamos el color del borde directamente en el estilo inline para sobreescribir el CSS
      html: `<div class="marker-pin" style="border-color: ${borderColor}; background-color: #1a202c;">${content}</div>`,
      iconSize: [50, 50],
      iconAnchor: [25, 50],
      popupAnchor: [0, -55]
    });
  };

  // --- 3. Inicialización Mapa y GPS Inteligente ---
  useEffect(() => {
    const defaultCenter: [number, number] = [19.5150782476539, -99.15488030551825];

    if (!mapInstanceRef.current && mapRef.current) {
      const map = L.map(mapRef.current, {
        zoomControl: false,
        attributionControl: false
      }).setView(defaultCenter, 11); // Nivel de zoom ajustado a 11 para ver CDMX y EdoMex

      // USAR OpenStreetMap para permitir el "hack" de inversion de colores por CSS y que sea igual al Flujo Narrativo
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(map);

      mapInstanceRef.current = map;
    }

    /* 
    // DESACTIVADO: No solicitar GPS automáticamente al abrir el dashboard
    if (navigator.geolocation) {
      const watchId = navigator.geolocation.watchPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setUserLocation([latitude, longitude]);

          if (mapInstanceRef.current) {
            if (!userMarkerRef.current) {
              userMarkerRef.current = L.marker([latitude, longitude], { icon: userIcon }).addTo(mapInstanceRef.current);
            } else {
              userMarkerRef.current.setLatLng([latitude, longitude]);
            }
          }
        },
        (err) => console.warn("GPS Error:", err),
        { enableHighAccuracy: true, maximumAge: 10000, timeout: 5000 }
      );
      return () => navigator.geolocation.clearWatch(watchId);
    }
    */
  }, [historias]);

  // --- 4. Pintar Pines ---
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    map.eachLayer((layer) => {
      if (layer instanceof L.Marker && layer !== userMarkerRef.current) map.removeLayer(layer);
    });

    historias.forEach(historia => {
      const coordsStr = historia.id_ubicacion?.coordenadas;
      if (coordsStr) {
        const coords = coordsStr.split(',').map(Number);
        if (coords.length === 2 && !isNaN(coords[0]) && !isNaN(coords[1])) {
          const [lat, lng] = coords;

          // Manejo flexible de IDs (App usa 'id', Base usa 'id_historia')
          const hId = historia.id_historia || historia.id;
          const hDep = historia.id_historia_dependencia;

          const isLocked = hDep ? !historiasVisitadas.includes(hDep) : false;
          const recursoEncontrado = recursosInternos.find(r => r.id_recurso === historia.id_imagen_historia);

          const marker = L.marker([lat, lng], {
            icon: createStoryIcon(recursoEncontrado?.archivo, isLocked)
          }).addTo(map);

          marker.on('click', () => setSelectedHistoriaId(hId));
        }
      }
    });
  }, [historias, historiasVisitadas, recursosInternos]);

  const handleCenterOnUser = () => {
    if (userLocation && mapInstanceRef.current) mapInstanceRef.current.flyTo(userLocation, 17);
  };

  // --- 5. COMUNICACIÓN ---
  const handleStartStorySafe = (historiaData: any) => {
    // Aseguramos obtener el ID sin importar la estructura
    const idParaIniciar = historiaData.id || historiaData.id_historia;

    if (idParaIniciar) {
      // 1. Cerrar modal local
      setSelectedHistoriaId(null);
      // 2. Mandar señal al PADRE (App.tsx)
      onStartNarrativeFromMap(Number(idParaIniciar));
    } else {
      console.error("❌ No se encontró ID en:", historiaData);
    }
  };

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden flex flex-col font-mono select-none">

      {/* CONTENEDOR DEL MAPA */}
      <div className="relative flex-grow w-full h-full z-10">

        {/* El mapa Leaflet (Sin filtros grises, color natural oscuro) */}
        <div id="map" ref={mapRef} className="h-full w-full bg-[#050505]"></div>

        {/* OVERLAYS DECORATIVOS (Miras Tácticas Minimalistas) */}
        <div className="absolute top-4 left-4 w-16 h-16 border-t-2 border-l-2 border-[#33ff00]/50 pointer-events-none z-[400]"></div>
        <div className="absolute top-4 right-4 w-16 h-16 border-t-2 border-r-2 border-[#33ff00]/50 pointer-events-none z-[400]"></div>
        <div className="absolute bottom-4 left-4 w-16 h-16 border-b-2 border-l-2 border-[#33ff00]/50 pointer-events-none z-[400]"></div>
        <div className="absolute bottom-4 right-4 w-16 h-16 border-b-2 border-r-2 border-[#33ff00]/50 pointer-events-none z-[400]"></div>

        {/* Cruz Central */}
        <div className="absolute inset-0 pointer-events-none z-[400] flex items-center justify-center opacity-10">
          <div className="w-[1px] h-full bg-[#33ff00]"></div>
          <div className="h-[1px] w-full bg-[#33ff00] absolute"></div>
        </div>

        {/* Botón GPS */}
        {userLocation && (
          <button
            onClick={handleCenterOnUser}
            className="absolute bottom-24 right-6 z-[500] bg-black/80 border border-[#33ff00] text-[#33ff00] w-12 h-12 flex items-center justify-center rounded-full shadow-[0_0_15px_rgba(51,255,0,0.3)] hover:bg-[#33ff00] hover:text-black transition-all active:scale-95"
            title="Centrar en mi ubicación"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        )}

        {/* Leyenda Flotante */}
        {/* Leyenda Flotante (Ajustada a Top-Left - Más arriba) */}
        <div className="absolute top-6 left-6 bg-black/90 border border-[#33ff00]/30 p-2 z-[500] backdrop-blur-md shadow-lg rounded-sm transform scale-90 origin-top-left">
          <h4 className="text-[#33ff00] text-[9px] uppercase tracking-widest mb-1 border-b border-[#33ff00]/20 pb-1">SIMBOLOGÍA</h4>
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-sm bg-green-500 shadow-[0_0_5px_green]"></div>
              <span className="text-gray-300 text-[8px] uppercase">NODO DISPONIBLE</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-sm bg-yellow-500 shadow-[0_0_5px_yellow]"></div>
              <span className="text-gray-300 text-[8px] uppercase">ACCESO RESTRINGIDO</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full border-2 border-blue-500 bg-blue-500/20"></div>
              <span className="text-gray-300 text-[8px] uppercase">TU UBICACIÓN</span>
            </div>
          </div>
        </div>

        {/* BOTÓN SALIR / CERRAR MAPA (FIXED) */}
        {onExit && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              console.log("Cerrando mapa...");
              onExit();
            }}
            className="absolute top-6 right-6 z-[9999] w-12 h-12 bg-black/90 border-2 border-[#dc2626] text-[#dc2626] rounded-full flex items-center justify-center hover:bg-[#dc2626] hover:text-white transition-all shadow-[0_0_20px_rgba(220,38,38,0.5)] cursor-pointer"
            title="CERRAR MAPA TÁCTICO"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* MODAL DE DETALLE */}
      {selectedHistoriaId && (
        <div className="absolute inset-0 z-[1000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md border border-[#33ff00] shadow-[0_0_50px_rgba(51,255,0,0.2)] bg-black relative">
            {/* Decoración Modal */}
            <div className="absolute top-0 left-0 w-2 h-2 bg-[#33ff00]"></div>
            <div className="absolute top-0 right-0 w-2 h-2 bg-[#33ff00]"></div>
            <div className="absolute bottom-0 left-0 w-2 h-2 bg-[#33ff00]"></div>
            <div className="absolute bottom-0 right-0 w-2 h-2 bg-[#33ff00]"></div>

            {/* LÓGICA PARA CALCULAR BLOQUEO ANTES DE RENDERIZAR */}
            {(() => {
              const selectedStory = historias.find(h => (h.id_historia || h.id) === selectedHistoriaId);
              const isLocked = selectedStory?.id_historia_dependencia
                ? !historiasVisitadas.includes(selectedStory.id_historia_dependencia)
                : false;

              return (
                <HistoriaDetail
                  historiaId={selectedHistoriaId}
                  onClose={() => setSelectedHistoriaId(null)}
                  onStartNarrative={handleStartStorySafe}
                  isLocked={isLocked} // <--- PASAMOS EL ESTADO DE BLOQUEO
                />
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
};

export default MapaViewS;