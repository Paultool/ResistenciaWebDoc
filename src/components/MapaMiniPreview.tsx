
import React, { useRef, useEffect, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { gameServiceUser } from '../services/GameServiceUser';

interface MapaMiniPreviewProps {
    historias: any[];
    userProfile: any;
    onExpand: () => void; // Para abrir la vista de mapa completa
    label?: string;
}

const MapaMiniPreview: React.FC<MapaMiniPreviewProps> = ({ historias, userProfile, onExpand, label }) => {
    const mapRef = useRef<HTMLDivElement>(null);
    const mapInstanceRef = useRef<L.Map | null>(null);
    const [recursosInternos, setRecursosInternos] = useState<any[]>([]);

    // Cargar recursos para iconos personalizados
    useEffect(() => {
        const fetchImages = async () => {
            const { data } = await gameServiceUser.fetchMultimediaResources();
            if (data) setRecursosInternos(data);
        };
        fetchImages();
    }, []);

    // Inicializar Mapa
    useEffect(() => {
        if (!mapRef.current) return;

        if (!mapInstanceRef.current) {
            // Coordenadas default (CDMX)
            const defaultCenter: [number, number] = [19.4326, -99.1332];

            const map = L.map(mapRef.current, {
                zoomControl: false,
                attributionControl: false,
                dragging: false, // Estático para preview
                scrollWheelZoom: false,
                doubleClickZoom: false,
                boxZoom: false,
                keyboard: false
            }).setView(defaultCenter, 13);

            // Capa Oscura (Dark/Night mode)
            L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
                maxZoom: 19
            }).addTo(map);

            mapInstanceRef.current = map;
        }

        const map = mapInstanceRef.current;

        // Limpiar marcadores anteriores
        map.eachLayer((layer) => {
            if (layer instanceof L.Marker) {
                map.removeLayer(layer);
            }
        });

        // Iconos
        const createCustomIcon = (url: string) => L.divIcon({
            className: 'custom-map-icon',
            html: `<div style="background-image: url('${url}'); width: 40px; height: 40px; background-size: cover; border-radius: 50%; border: 2px solid #33ff00;"></div>`,
            iconSize: [40, 40],
            iconAnchor: [20, 20]
        });

        const userIcon = L.divIcon({
            className: 'user-marker',
            html: '<div class="radar-ping"></div><div class="user-dot"></div>',
            iconSize: [40, 40],
            iconAnchor: [20, 20]
        });

        // Marcadores de historias
        if (historias && Array.isArray(historias)) {
            historias.forEach(h => {
                if (h.latitud && h.longitud) {
                    let iconUrl = null;
                    if (h.id_imagen_historia && recursosInternos.length > 0) {
                        const rec = recursosInternos.find(r => r.id_recurso === h.id_imagen_historia);
                        if (rec) iconUrl = rec.archivo;
                    }

                    const markerHtml = `<div class="mini-story-marker" style="border-color: ${(userProfile?.historias_visitadas || []).map(String).includes(String(h.id_historia || h.id))
                            ? '#33ff00' : '#dc2626'
                        }"></div>`;

                    const miniIcon = L.divIcon({
                        className: 'mini-marker-icon',
                        html: markerHtml,
                        iconSize: [10, 10],
                        iconAnchor: [5, 5]
                    });

                    L.marker([h.latitud, h.longitud], { icon: miniIcon }).addTo(map);
                }
            });
        }

        // Obtener ubicación real del usuario
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const { latitude, longitude } = position.coords;
                    // Actualizar vista
                    map.setView([latitude, longitude], 14);
                    L.marker([latitude, longitude], { icon: userIcon }).addTo(map);
                },
                () => {
                    // Fallback si no hay GPS
                }
            );
        }

        // Cleanup
        return () => {
            // No destruir el mapa agresivamente para evitar parpadeos,
            // pero en React estricto a veces es necesario.
            // map.remove(); 
        };

    }, [historias, userProfile, recursosInternos]);

    return (
        <div className="mini-map-container" onClick={onExpand}>
            <div className="mini-map-overlay">
                <span className="mini-map-label">{label || 'RADAR TÁCTICO > TOCAR PARA EXPANDIR'}</span>
                <div className="mini-map-grid-lines"></div>
            </div>
            <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
        </div>
    );
};

export default MapaMiniPreview;
