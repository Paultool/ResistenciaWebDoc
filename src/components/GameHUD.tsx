import React from 'react';
import { PlayerStats, FlujoNarrativoData } from './types'; // Importar tipos

interface GameHUDProps {
    stats: PlayerStats | null;
    currentStepIndex: number;
    totalSteps: number;
    onOpenMap: () => void;
    onOpenInventory: () => void;
    onOpenCharacters: () => void;
    onOpenStories: () => void;
    showBottomBar: boolean;
    setShowBottomBar: (show: boolean) => void;
}

const GameHUD: React.FC<GameHUDProps> = ({
    stats,
    currentStepIndex,
    totalSteps,
    onOpenMap,
    onOpenInventory,
    onOpenCharacters,
    onOpenStories,
    showBottomBar,
    setShowBottomBar
}) => {
    if (!stats) return null;

    return (
        <>
            {/* Toggle Button */}
            {!showBottomBar && (
                <button
                    className="absolute bottom-4 left-4 z-50 bg-gray-800/80 text-white p-3 rounded-full"
                    onClick={() => setShowBottomBar(true)}
                >
                    📊
                </button>
            )}

            <div className={`bottom-bar fixed bottom-0 left-0 w-full flex justify-between items-center p-4 bg-gray-900/90 transition-transform duration-300 ${!showBottomBar ? 'translate-y-full' : ''}`}>
                <button className="text-sm bg-gray-700 px-2 rounded" onClick={() => setShowBottomBar(false)}>✕</button>
                
                <div className="flex gap-2 text-white">
                    <span>XP: {stats.xp_total || 0}</span>
                </div>

                {/* Timeline sencilla */}
                <div className="flex gap-1">
                    {Array.from({ length: totalSteps }).map((_, idx) => (
                        <div key={idx} className={`w-2 h-2 rounded-full ${idx === currentStepIndex ? 'bg-blue-500' : 'bg-gray-600'}`} />
                    ))}
                </div>

                <div className="flex gap-4 text-2xl">
                    <button onClick={onOpenMap}>🗺️</button>
                    <button onClick={onOpenInventory}>📦</button>
                    <button onClick={onOpenCharacters}>👥</button>
                    <button onClick={onOpenStories}>📚</button>
                </div>
            </div>
        </>
    );
};

export default GameHUD;