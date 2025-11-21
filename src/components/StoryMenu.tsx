import React from 'react';
import { HistoriaData, RecursoMultimediaData } from './types'; // Importa tus tipos

interface StoryMenuProps {
    historias: HistoriaData[];
    historiasVisitadas: number[];
    recursosData: RecursoMultimediaData[];
    onSelectHistoria: (id: number) => void;
    onLockedClick: (historia: HistoriaData) => void;
}

const StoryMenu: React.FC<StoryMenuProps> = ({ 
    historias, 
    historiasVisitadas, 
    recursosData, 
    onSelectHistoria, 
    onLockedClick 
}) => {

    // 1. Procesar historias: Calcular estado (bloqueado) y ORDENAR
    const processedStories = React.useMemo(() => {
        return historias.map(historia => {
            let isLocked = false;
            if (historia.id_historia_dependencia) {
                isLocked = !historiasVisitadas.includes(historia.id_historia_dependencia);
            }
            return { ...historia, isLocked };
        }).sort((a, b) => {
            // LÓGICA DE ORDENAMIENTO
            const ordenA = a.orden ?? 9999; // Si es null, va al final
            const ordenB = b.orden ?? 9999;
            return ordenA - ordenB;
        });
    }, [historias, historiasVisitadas]);

    if (processedStories.length === 0) {
        return <div className="text-white text-center mt-20">No hay historias disponibles.</div>;
    }

    return (
        <div className="relative min-h-screen bg-gradient-to-b from-gray-900 via-black to-gray-900 text-white p-4 md:p-8 overflow-y-auto">
            <div className="max-w-7xl mx-auto">
                <h1 className="text-5xl font-bold text-center mb-3 bg-gradient-to-r from-purple-400 to-pink-600 bg-clip-text text-transparent">
                    Selecciona tu Aventura
                </h1>
                
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mt-8">
                    {processedStories.map(historia => {
                        const imagenFondo = historia.id_imagen_historia 
                            ? recursosData.find(r => r.id_recurso === historia.id_imagen_historia)?.archivo 
                            : null;

                        return (
                            <div
                                key={historia.id_historia}
                                onClick={() => historia.isLocked ? onLockedClick(historia) : onSelectHistoria(historia.id_historia)}
                                className={`relative rounded-xl overflow-hidden transition-all duration-500 transform ${
                                    historia.isLocked 
                                        ? 'opacity-70 cursor-pointer grayscale hover:opacity-90' 
                                        : 'cursor-pointer hover:scale-105 hover:shadow-2xl hover:shadow-purple-500/50'
                                }`}
                                style={{ minHeight: '400px' }}
                            >
                                {/* Renderizado de imagen y textos (copiado de tu original) */}
                                {imagenFondo ? (
                                    <img src={imagenFondo} alt={historia.titulo} className="absolute inset-0 w-full h-full object-cover"/>
                                ) : (
                                    <div className="absolute inset-0 bg-gradient-to-br from-purple-900 to-blue-900"></div>
                                )}
                                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/70 to-transparent"></div>
                                
                                <div className="absolute bottom-0 left-0 right-0 p-6 z-10">
                                    <h2 className="text-3xl font-bold mb-2 text-white drop-shadow-lg">{historia.titulo}</h2>
                                    {historia.isLocked && <span className="text-red-400 text-sm font-bold">🔒 BLOQUEADO</span>}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default StoryMenu;