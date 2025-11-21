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
}

const MapaViewS: React.FC<MapaViewSProps> = ({ 
  historias, 
  historiasVisitadas, 
  onStartNarrativeFromMap
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
  const userIcon = L.divIcon({
      className: 'custom-user-marker',
      html: '<div class="user-location-marker"></div>',
      iconSize: [20, 20],
      iconAnchor: [10, 10]
  });

  const createStoryIcon = (imgUrl: string | undefined, locked: boolean) => {
    const content = imgUrl 
        ? `<img src="${imgUrl}" alt="H" onerror="this.style.display='none'" />` 
        : `<div style="width:100%; height:100%; display:flex; align-items:center; justify-content:center; transform:rotate(45deg); font-weight:bold; color:white;">?</div>`;

    return L.divIcon({
        className: 'custom-marker-icon',
        html: `<div class="marker-pin ${locked ? 'locked' : 'unlocked'}">${content}</div>`,
        iconSize: [50, 50],
        iconAnchor: [25, 50],
        popupAnchor: [0, -55]
    });
  };

  // --- 3. Inicialización Mapa y GPS Inteligente ---
  useEffect(() => {
    const defaultCenter: [number, number] = [19.4326, -99.1332];

    if (!mapInstanceRef.current && mapRef.current) {
      const map = L.map(mapRef.current, { 
          zoomControl: false,
          attributionControl: false 
      }).setView(defaultCenter, 13);
      
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
      mapInstanceRef.current = map;
    }

    if (navigator.geolocation) {
        const watchId = navigator.geolocation.watchPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                setUserLocation([latitude, longitude]);
                
                if (mapInstanceRef.current) {
                    // Actualizar marcador usuario
                    if (!userMarkerRef.current) {
                        userMarkerRef.current = L.marker([latitude, longitude], { icon: userIcon }).addTo(mapInstanceRef.current);
                    } else {
                        userMarkerRef.current.setLatLng([latitude, longitude]);
                    }

                    // --- LÓGICA: VOLAR A HISTORIA MÁS CERCANA ---
                    if (!hasCenteredRef.current && historias.length > 0) {
                        let nearestCoords: [number, number] | null = null;
                        let minDistance = Infinity;

                        historias.forEach(h => {
                            // Adaptamos para leer 'id_ubicacion' (objeto) o 'ubicacion' (si viene plano)
                            const coordsStr = h.id_ubicacion?.coordenadas || h.ubicacion?.coordenadas;
                            
                            if(coordsStr){
                                const [hLat, hLon] = coordsStr.split(',').map(Number);
                                if (!isNaN(hLat) && !isNaN(hLon)) {
                                    const dist = calcularDistancia(latitude, longitude, hLat, hLon);
                                    if(dist < minDistance) {
                                        minDistance = dist;
                                        nearestCoords = [hLat, hLon];
                                    }
                                }
                            }
                        });

                        if (nearestCoords) {
                            console.log(`🎯 Volando a la historia más cercana (${minDistance.toFixed(2)}km)`);
                            mapInstanceRef.current.flyTo(nearestCoords, 16, { duration: 2 });
                        } else {
                            mapInstanceRef.current.flyTo([latitude, longitude], 16);
                        }
                        hasCenteredRef.current = true; // Ya no centramos más automáticamente
                    }
                }
            },
            (err) => console.warn("GPS Error:", err),
            { enableHighAccuracy: true, maximumAge: 10000, timeout: 5000 }
        );
        return () => navigator.geolocation.clearWatch(watchId);
    }
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
    <div className="mapa-view-container">
      <div id="map" ref={mapRef} className="map-container">
          {userLocation && (
              <button onClick={handleCenterOnUser} className="gps-center-btn" title="Centrar en mí">
                🎯
              </button>
          )}
      </div>

      {selectedHistoriaId && (
        <div className="historia-detail-map-wrapper">
          <HistoriaDetail
              historiaId={selectedHistoriaId}
              onClose={() => setSelectedHistoriaId(null)}
              onStartNarrative={handleStartStorySafe}
          />
        </div>
      )}
    </div>
  );
};

export default MapaViewS;