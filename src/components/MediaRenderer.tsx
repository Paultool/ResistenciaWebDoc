import React from 'react';
import Scene3D from './Scene3D';
import { RecursoMultimediaData, HotspotConfig } from './types';

interface MediaRendererProps {
    recurso: RecursoMultimediaData | undefined;
    videoRef: React.RefObject<HTMLVideoElement>;
    audioRef: React.RefObject<HTMLAudioElement>;
    iframeAppRef: React.RefObject<HTMLIFrameElement>;
    cameraHeight: number;
    onVideoEnd: () => void;
    onHotspotClick: (config: HotspotConfig) => void;
}

const MediaRenderer: React.FC<MediaRendererProps> = ({
    recurso,
    videoRef,
    audioRef,
    iframeAppRef,
    cameraHeight,
    onVideoEnd,
    onHotspotClick
}) => {
    if (!recurso) return null;

    const { tipo, archivo, metadatos } = recurso;

    if (tipo === 'imagen') {
        return <img src={archivo} alt="Historia" className="w-full h-full object-cover absolute inset-0" />;
    }

    if (tipo === 'video') {
        return (
            <video
                ref={videoRef}
                src={archivo}
                autoPlay
                className="w-full h-full object-cover absolute inset-0"
                onEnded={onVideoEnd}
            />
        );
    }

    if (tipo === 'audio') {
        // Audio renderiza una imagen de fondo negra o placeholder y el audio oculto o visualizador
        return <audio ref={audioRef} src={archivo} autoPlay onEnded={onVideoEnd} />;
    }

    if (tipo === 'app') {
        return (
            <div className="full-media-container z-50 bg-black absolute inset-0">
                <iframe
                    ref={iframeAppRef}
                    src={archivo}
                    className="w-full h-full border-none"
                    allowFullScreen
                />
            </div>
        );
    }

    if (tipo === '3d_model') {
        // Preparamos los metadatos para el componente 3D
        // Aseguramos que pasamos solo los hotspots interactivos o toda la config
        return (
            <Scene3D 
                modelUrl={archivo}
                hotspotData={metadatos || '[]'}
                cameraHeight={cameraHeight}
                onHotspotClick={onHotspotClick}
            />
        );
    }

    return null;
};

export default MediaRenderer;