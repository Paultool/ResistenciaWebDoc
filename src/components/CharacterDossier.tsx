import React from 'react';
import { Personaje } from '../supabaseClient';
import { useLanguage } from '../contexts/LanguageContext';
import { flujoTranslations, getLocalizedContent } from './FlujoNarrativoUsuario/translations';

interface CharacterDossierProps {
    character: Personaje | null;
    onClose: () => void;
}

const CharacterDossier: React.FC<CharacterDossierProps> = ({ character, onClose }) => {
    const { language } = useLanguage();
    const t = flujoTranslations[language];

    if (!character) return null;

    return (
        <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/85 backdrop-blur-sm font-mono" style={{ display: 'flex' }}>
            {/* Contenedor Principal del Expediente */}
            <div className="relative w-[90%] max-w-lg bg-black/95 border border-[#33ff00] shadow-[0_0_40px_rgba(51,255,0,0.15)] flex flex-col max-h-[90vh] overflow-hidden">

                {/* Decoración de Esquinas */}
                <div className="absolute top-0 left-0 w-3 h-3 bg-[#33ff00] z-10"></div>
                <div className="absolute top-0 right-0 w-3 h-3 bg-[#33ff00] z-10"></div>
                <div className="absolute bottom-0 left-0 w-3 h-3 bg-[#33ff00] z-10"></div>
                <div className="absolute bottom-0 right-0 w-3 h-3 bg-[#33ff00] z-10"></div>

                {/* ENCABEZADO */}
                <div className="flex justify-between items-center p-5 border-b border-[#33ff00]/30 bg-[#33ff00]/5">
                    <div>
                        <h2 className="text-[#33ff00] text-xl font-bold tracking-widest uppercase flex items-center gap-2">
                            {t.file_title} {getLocalizedContent(character, 'nombre', language)}
                        </h2>
                        <p className="text-[9px] text-[#33ff00]/60 mt-1">{t.access_lvl}</p>
                    </div>
                    <button
                        className="text-[#33ff00] hover:bg-[#33ff00] hover:text-black border border-[#33ff00] w-8 h-8 flex items-center justify-center transition-colors font-bold"
                        onClick={onClose}
                    >
                        X
                    </button>
                </div>

                {/* CONTENIDO SCROLLABLE */}
                <div className="p-6 overflow-y-auto custom-scrollbar space-y-6">

                    {/* Estilos Scrollbar */}
                    <style>{`
                        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
                        .custom-scrollbar::-webkit-scrollbar-track { background: #111; }
                        .custom-scrollbar::-webkit-scrollbar-thumb { background: #33ff00; border-radius: 0px; }
                        
                        @keyframes pulse-scan {
                            0% { transform: translateY(-100%); }
                            100% { transform: translateY(1000%); }
                        }
                    `}</style>

                    {/* SECCIÓN 1: IDENTIFICACIÓN VISUAL */}
                    <div className="flex flex-col items-center">
                        {character.imagen ? (
                            <div className="relative group">
                                {/* Marco de la foto */}
                                <div className="absolute -top-2 -left-2 w-4 h-4 border-t-2 border-l-2 border-[#33ff00]"></div>
                                <div className="absolute -bottom-2 -right-2 w-4 h-4 border-b-2 border-r-2 border-[#33ff00]"></div>

                                <img
                                    src={character.imagen}
                                    alt={character.nombre}
                                    className="w-40 h-40 object-cover filter grayscale contrast-125 border border-[#33ff00]/50 group-hover:grayscale-0 transition-all duration-500"
                                />

                                {/* Overlay de escaneo */}
                                <div className="absolute inset-0 bg-[linear-gradient(transparent_50%,rgba(51,255,0,0.1)_50%)] bg-[length:100%_4px] pointer-events-none"></div>
                                <div className="absolute top-0 left-0 w-full h-1 bg-[#33ff00]/20 blur-[2px] animate-[pulse-scan_3s_linear_infinite] pointer-events-none"></div>
                            </div>
                        ) : (
                            <div className="w-40 h-40 border border-dashed border-[#33ff00]/50 flex items-center justify-center bg-black">
                                <span className="text-[#33ff00]/30 text-4xl">?</span>
                            </div>
                        )}
                        <div className="mt-4 text-center">
                            <span className="text-[10px] text-[#33ff00] font-bold border border-[#33ff00] px-3 py-1 uppercase tracking-widest">
                                {character.rol || 'Agente'}
                            </span>
                        </div>
                    </div>

                    {/* SECCIÓN 2: DESCRIPCIÓN */}
                    <div className="border-l-2 border-[#33ff00] pl-4 bg-[#33ff00]/5 py-2">
                        <h4 className="text-[#33ff00] text-xs font-bold uppercase tracking-wider mb-2">
                            {'>'} {t.psych_profile}
                        </h4>
                        <p className="text-sm text-gray-300 leading-relaxed font-sans">
                            {getLocalizedContent(character, 'descripcion', language)}
                        </p>
                    </div>

                    {/* SECCIÓN 3: METADATOS (GRID TÉCNICA) */}
                    {character.metadata && (
                        <div>
                            <h4 className="text-[#33ff00] text-xs font-bold uppercase tracking-wider mb-3 border-b border-[#33ff00]/20 pb-1">
                                {'>'} {t.tech_attr}
                            </h4>
                            <div className="grid grid-cols-2 gap-3">
                                {Object.entries(character.metadata).map(([key, value]) => (
                                    <div key={key} className="bg-black border border-[#33ff00]/20 p-2 flex flex-col hover:border-[#33ff00]/60 transition-colors">
                                        <span className="text-[9px] text-[#33ff00]/60 uppercase tracking-widest mb-1">{key}</span>
                                        <span className="text-white text-sm font-bold truncate" title={String(value)}>
                                            {String(value)}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* FOOTER / BOTÓN CIERRE */}
                <div className="p-5 border-t border-[#33ff00]/30 bg-black">
                    <button
                        onClick={onClose}
                        className="w-full group relative py-3 border border-[#33ff00] text-[#33ff00] font-bold text-sm tracking-[0.2em] uppercase
                        transition-all duration-300 hover:bg-[#33ff00] hover:text-black hover:shadow-[0_0_15px_rgba(51,255,0,0.4)]"
                    >
                        <span>{t.close_btn}</span>
                    </button>
                    <div className="mt-3 text-[8px] text-[#33ff00]/40 text-center tracking-[0.5em] animate-pulse">
                        TERMINAL_ESTE_REPOSITORIO_CRYPT
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CharacterDossier;
