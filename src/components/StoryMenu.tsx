import React from 'react'
import { HistoriaData, RecursoMultimediaData } from './types'
import '../styles/resistance-theme.css'
import './StoryMenu.css'

interface StoryMenuProps {
    historias: HistoriaData[]
    historiasVisitadas: number[]
    recursosData: RecursoMultimediaData[]
    onSelectHistoria: (id: number) => void
    onLockedClick: (historia: HistoriaData) => void
}

const StoryMenu: React.FC<StoryMenuProps> = ({
    historias,
    historiasVisitadas,
    recursosData,
    onSelectHistoria,
    onLockedClick
}) => {
    // Process stories: Calculate locked state and SORT
    const processedStories = React.useMemo(() => {
        return historias.map(historia => {
            let isLocked = false
            if (historia.id_historia_dependencia) {
                isLocked = !historiasVisitadas.includes(historia.id_historia_dependencia)
            }
            return { ...historia, isLocked }
        }).sort((a, b) => {
            const ordenA = a.orden ?? 9999
            const ordenB = b.orden ?? 9999
            return ordenA - ordenB
        })
    }, [historias, historiasVisitadas])

    if (processedStories.length === 0) {
        return (
            <div className="story-menu-empty scanlines">
                <p className="mono-text-muted">NO HAY HISTORIAS DISPONIBLES</p>
            </div>
        )
    }

    return (
        <div className="story-menu-container scanlines">
            <div className="story-menu-header">
                <h1 className="menu-title mono-text-green">
                    [ SELECCIONA TU MISIÓN ]
                </h1>
                <div className="menu-subtitle mono-text-amber">
                    &gt;&gt;&gt; ARCHIVOS DE RESISTENCIA DISPONIBLES
                </div>
            </div>

            <div className="terminal-separator"></div>

            <div className="stories-grid">
                {processedStories.map(historia => {
                    const imagenFondo = historia.id_imagen_historia
                        ? recursosData.find(r => r.id_recurso === historia.id_imagen_historia)?.archivo
                        : null

                    return (
                        <div
                            key={historia.id_historia}
                            onClick={() => historia.isLocked ? onLockedClick(historia) : onSelectHistoria(historia.id_historia)}
                            className={`story-card ${historia.isLocked ? 'locked' : 'unlocked'}`}
                        >
                            {/* Background Image */}
                            {imagenFondo ? (
                                <img
                                    src={imagenFondo}
                                    alt={historia.titulo}
                                    className="story-card-bg"
                                />
                            ) : (
                                <div className="story-card-bg-fallback"></div>
                            )}

                            {/* Overlay */}
                            <div className="story-card-overlay"></div>

                            {/* Content */}
                            <div className="story-card-content">
                                <div className="story-card-header">
                                    {historia.isLocked && (
                                        <span className="story-lock-badge mono-text">
                                            [🔒 BLOQUEADO]
                                        </span>
                                    )}
                                </div>

                                <div className="story-card-footer">
                                    <h2 className="story-title mono-text-amber">
                                        {historia.titulo}
                                    </h2>
                                    <div className="story-action mono-text-green">
                                        {historia.isLocked ? '&gt; REQUIERE ACCESO' : '&gt; INICIAR MISIÓN'}
                                    </div>
                                </div>
                            </div>

                            {/* Scanlines effect on card */}
                            <div className="story-card-scanlines"></div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

export default StoryMenu