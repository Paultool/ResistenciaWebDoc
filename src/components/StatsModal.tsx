import React from 'react';

interface StatsModalProps {
    activeModal: 'missions' | 'contacts' | 'locations' | 'merits' | 'resources' | null;
    onClose: () => void;
    data: any[] | null;
    loading: boolean;
    language: 'es' | 'en';
    onViewDossier?: (data: any) => void;
}

const dashboardTranslations = {
    es: {
        titleMissions: '📂 MISIONES COMPLETADAS',
        titleContacts: '👥 CONTACTOS CONOCIDOS',
        titleLocations: '📍 LUGARES VISITADOS',
        titleMerits: '🎖️ MÉRITOS DESBLOQUEADOS',
        titleResources: '🎒 RECURSOS EN INVENTARIO',
        nodata: '[ ! ] NO HAY DATOS DISPONIBLES',
        loadingData: '> CARGANDO DATOS...'
    },
    en: {
        titleMissions: '📂 COMPLETED MISSIONS',
        titleContacts: '👥 KNOWN CONTACTS',
        titleLocations: '📍 VISITED LOCATIONS',
        titleMerits: '🎖️ UNLOCKED MERITS',
        titleResources: '🎒 INVENTORY RESOURCES',
        nodata: '[ ! ] NO DATA AVAILABLE',
        loadingData: '> LOADING DATA...'
    }
};

const StatsModal: React.FC<StatsModalProps> = ({ activeModal, onClose, data, loading, language, onViewDossier }) => {
    if (!activeModal) return null;

    const t = dashboardTranslations[language] || dashboardTranslations.es;

    const getModalTitle = () => {
        switch (activeModal) {
            case 'missions': return t.titleMissions;
            case 'contacts': return t.titleContacts;
            case 'locations': return t.titleLocations;
            case 'merits': return t.titleMerits;
            case 'resources': return t.titleResources;
            default: return '';
        }
    };

    return (
        <div className="stat-modal-overlay" onClick={onClose} style={{
            position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
            background: 'rgba(0,0,0,0.8)', zIndex: 2000, display: 'flex',
            alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(5px)'
        }}>
            <div className="stat-modal-content" onClick={(e) => e.stopPropagation()} style={{
                background: '#0a0a0a', border: '1px solid #33ff00',
                width: '90%', maxWidth: '600px', maxHeight: '80vh',
                display: 'flex', flexDirection: 'column', boxShadow: '0 0 20px rgba(51,255,0,0.2)'
            }}>
                <div className="stat-modal-header" style={{
                    padding: '15px', borderBottom: '1px solid #33ff00',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    background: 'rgba(51,255,0,0.1)'
                }}>
                    <h3 style={{ margin: 0, color: '#33ff00', fontFamily: 'monospace', fontWeight: 'bold' }}>
                        {getModalTitle()}
                    </h3>
                    <button onClick={onClose} style={{
                        background: 'none', border: 'none', color: '#33ff00', fontSize: '1.5rem', cursor: 'pointer'
                    }}>×</button>
                </div>

                <div className="stat-modal-body" style={{ padding: '20px', overflowY: 'auto' }}>
                    {loading ? (
                        <div className="text-center py-8 text-[#33ff00] animate-pulse">
                            <p>{t.loadingData}</p>
                        </div>
                    ) : data && data.length > 0 ? (
                        <div className="stat-modal-list" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {data.map((item: any, index: number) => (
                                <div key={index} className="stat-modal-item" style={{
                                    display: 'flex', gap: '15px', padding: '10px',
                                    background: 'rgba(255,255,255,0.05)', border: '1px solid #333',
                                    alignItems: 'flex-start'
                                }}>
                                    <div className="stat-modal-item-icon" style={{ fontSize: '1.5rem' }}>
                                        {activeModal === 'missions' && '📂'}
                                        {activeModal === 'contacts' && '👤'}
                                        {activeModal === 'locations' && '📍'}
                                        {activeModal === 'merits' && '🎖️'}
                                        {activeModal === 'resources' && '🎒'}
                                    </div>
                                    <div className="stat-modal-item-content">
                                        <div className="stat-modal-item-name" style={{ color: '#fff', fontWeight: 'bold', marginBottom: '4px' }}>
                                            {item.nombre || item.titulo || item.name || 'Item'}
                                        </div>
                                        {item.descripcion && (
                                            <div className="stat-modal-item-desc" style={{ color: '#aaa', fontSize: '0.8rem' }}>
                                                {item.descripcion}
                                            </div>
                                        )}
                                        {activeModal === 'contacts' && onViewDossier && (
                                            <button
                                                onClick={() => onViewDossier(item)}
                                                style={{
                                                    marginTop: '8px',
                                                    padding: '4px 10px',
                                                    background: 'transparent',
                                                    border: '1px solid #33ff00',
                                                    color: '#33ff00',
                                                    fontSize: '0.7rem',
                                                    fontFamily: 'monospace',
                                                    cursor: 'pointer',
                                                    transition: 'all 0.3s'
                                                }}
                                                className="hover:bg-[#33ff00] hover:text-black"
                                            >
                                                {language === 'es' ? 'VER EXPEDIENTE' : 'VIEW FILE'}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-8 text-gray-500">
                            <p>{t.nodata}</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default StatsModal;
