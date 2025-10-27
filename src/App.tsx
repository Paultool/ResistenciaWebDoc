import React, { useState, useEffect, useRef } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import AuthForm from './components/AuthForm';
import UserDashboard from './components/UserDashboard';
import PersonajesView from './components/PersonajesView';
import MapaView from './components/MapaViewS';
import InventarioView from './components/InventarioView';
import HistoriaDetail from './components/HistoriaDetail';
import AdminPanel from './components/AdminPanel';
import FlujoNarrativoUsuario from './components/FlujoNarrativoUsuario';


import { supabase, testConnection, obtenerHistorias, Historia, obtenerRecursosMultimedia } from './supabaseClient';
import 'bootstrap/dist/css/bootstrap.min.css';
import '@fortawesome/fontawesome-free/css/all.min.css';
import './App.css';
import './components/HistoriaDetail.css';


// ==========================================================
// --- Componente para mostrar una historia individual (Card) ---
// ==========================================================
interface HistoriaCardProps {
  historia: Historia;
  onViewDetail: (id: number) => void;
}

const HistoriaCard: React.FC<HistoriaCardProps> = ({ historia, onViewDetail }) => {
  return (
    <div className="historia-card">
      <h3>{historia.titulo}</h3>
      <p className="descripcion">{historia.descripcion}</p>
      <div className="metadata">
        <span className="fecha">
          📅 {new Date(historia.fecha_creacion).toLocaleDateString('es-MX')}
        </span>
        <span className={`tipo ${historia.es_historia_principal ? 'principal' : 'secundaria'}`}>
          {historia.es_historia_principal ? '⭐ Principal' : '📖 Secundaria'}
        </span>
        <span className="nivel">
          🔒 Nivel {historia.nivel_acceso_requerido}
        </span>
      </div>
      <div className="card-actions">
        <button
          onClick={() => onViewDetail(historia.id)}
          className="btn btn-primary btn-sm"
        >
          👁️ Ver Detalle
        </button>
      </div>
    </div>
  );
};

// ==========================================================
// --- Componente principal de contenido (cuando está autenticado) ---
// ==========================================================
const MainContent: React.FC = () => {

  const { user } = useAuth();  
  const [isAdmin, setIsAdmin] = useState(false);  
  const [currentView, setCurrentView] = useState<'dashboard' | 'historias' | 'personajes' | 'mapa' | 'inventario' | 'admin' | 'intro' | 'story-selection' | 'narrative-flow' | 'profile' | 'cine'>('dashboard');
  const [historias, setHistorias] = useState<Historia[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [conexionOk, setConexionOk] = useState(false);
  const [selectedHistoriaId, setSelectedHistoriaId] = useState<number | null>(null);
  const [selectedStory, setSelectedStory] = useState(null);
  const [userProfile, setUserProfile] = useState<any>({ user_id: null, xp_total: 0, ubicaciones_visitadas: [] });
  const [flujoNarrativoHistoriaId, setFlujoNarrativoHistoriaId] = useState<number | null>(null);
  const [view, setView] = useState('dashboard');
  const [historiaId, setHistoriaId] = useState<number | null>(null);
  const supabaseClient = supabase;
  
  // ESTADO: Controla la visibilidad de la barra de navegación superior
  const [showNavBar, setShowNavBar] = useState(true); 

  // Estado para controlar el menú hamburguesa en móvil
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleStartNarrative = (historia: Historia) => {
    setFlujoNarrativoHistoriaId(historia.id); 
    setCurrentView('cine'); 
  };

  useEffect(() => {
    const inicializar = async () => {
      console.log('🔄 Inicializando aplicación La Resistencia...');
      
      const conexionExitosa = await testConnection();
      setConexionOk(conexionExitosa);
      
      if (conexionExitosa && user) {
        if (user.email === 'paultool@gmail.com') {
          setIsAdmin(true);
        }

        await cargarHistorias();
        await setupProfile();
      } else if (!conexionExitosa) {
        setError('No se pudo conectar a la base de datos');
        setLoading(false);
      } else {
        setLoading(false);
      }
    };
    
    inicializar();
  }, [user]); 

  const cargarHistorias = async () => {
    try {
      setLoading(true);
      setError(null); 
      const historiasData = await obtenerHistorias();
      setHistorias(historiasData);
    } catch (err: any) {
      console.error('❌ Error cargando historias:', err);
      setError('Error al cargar las historias: ' + err.message);
    } finally {
      setLoading(false);
    }
  };
  
  const setupProfile = async () => {
    if (!user) return; 

    const fixedUserId = user.id; 
    
    const { data: profile, error } = await supabaseClient
      .from('perfiles_jugador')
      .select('*')
      .eq('user_id', fixedUserId)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error("Error al cargar el perfil del jugador:", error);
    }

    if (profile) {
      setUserProfile(profile);
    } else {
      const { data: newProfile, error: createError } = await supabaseClient
        .from('perfiles_jugador')
        .insert({ user_id: fixedUserId })
        .select()
        .single();
        
      if (createError) {
        console.error("Error al crear un nuevo perfil:", createError);
      } else {
        setUserProfile(newProfile);
      }
    }
  };

  const handleUpdateProfile = async (recompensaPositiva: number, recompensaNegativa: number, ubicacion: string) => {
    const totalXP = recompensaPositiva + recompensaNegativa;
    
    const updatedUbicaciones = new Set(userProfile.ubicaciones_visitadas || []);
    if (ubicacion) {
        updatedUbicaciones.add(ubicacion);
    }

    const { data: updatedProfile, error } = await supabaseClient
      .from('perfiles_jugador')
      .update({ 
        xp_total: userProfile.xp_total + totalXP,
        ubicaciones_visitadas: Array.from(updatedUbicaciones),
        fecha_ultimo_acceso: new Date().toISOString()
      })
      .eq('user_id', userProfile.user_id)
      .select()
      .single();

    if (error) {
      console.error("Error al actualizar el perfil:", error);
    } else {
      setUserProfile(updatedProfile);
    }
  };

  const handleNavigateFromDashboard = (view: string) => {
    setCurrentView(view as any);
  };

  const handleBackToDashboard = () => {
    setCurrentView('dashboard');
    setSelectedHistoriaId(null); 
    setFlujoNarrativoHistoriaId(null); 
  };

  const handleViewDetail = (historiaId: number) => {
    setSelectedHistoriaId(historiaId);
  };

  const closeDetail = () => {
    setSelectedHistoriaId(null);
  };

  const handleStartNarrativeFromDetail = (historiaId: number) => {
     const historiaSeleccionada = historias.find(h => h.id === historiaId);
     if (historiaSeleccionada) {
        handleStartNarrative(historiaSeleccionada);
     }
  };

  const handleNavClick = (view: any) => {
    setCurrentView(view);
    setIsMobileMenuOpen(false);
  };
  
  const handleToggleNavBar = () => {
    setShowNavBar(prev => !prev);
    if (showNavBar) {
        setIsMobileMenuOpen(false); 
    }
  };


  const renderCurrentView = () => {
    
      if (currentView === 'cine') {
        if (flujoNarrativoHistoriaId) {
          return (
            <FlujoNarrativoUsuario
              historiaId={flujoNarrativoHistoriaId}
              onBack={handleBackToDashboard}
              onUpdateProfile={handleUpdateProfile} 
            />
          );
        }
        return <FlujoNarrativoUsuario onBack={handleBackToDashboard} onUpdateProfile={handleUpdateProfile} />;
      }
        
      if (selectedHistoriaId) {
        return (
          <HistoriaDetail
            historiaId={selectedHistoriaId}
            onClose={closeDetail}
            onStartNarrative={() => handleStartNarrativeFromDetail(selectedHistoriaId)} 
          />
        );
      }
        
      switch (currentView) {
        case 'dashboard':
          return <UserDashboard onNavigate={handleNavigateFromDashboard} />;
        
        case 'historias':
          return (
            <div className="historias-view">
              <div className="view-header">
                <button onClick={handleBackToDashboard} className="back-btn">← Volver al Dashboard</button>
                <h2>📚 Historias Disponibles</h2>
                <p>Explora las narrativas urbanas de La Resistencia</p>
              </div>
              
              {loading && (<div className="loading"><p>⏳ Cargando historias...</p></div>)}

              {error && (
                <div className="error">
                  <p>❌ {error}</p>
                  <button onClick={cargarHistorias} className="retry-btn">🔄 Reintentar</button>
                </div>
              )}

              {!loading && !error && (
                <>
                  <div className="historias-stats">
                    <span className="stat">📊 Total: {historias.length} historias</span>
                    <span className="stat">⭐ Principales: {historias.filter(h => h.es_historia_principal).length}</span>
                    <span className="stat">📖 Secundarias: {historias.filter(h => !h.es_historia_principal).length}</span>
                  </div>

                  {historias.length === 0 ? (
                    <p className="no-data">No hay historias disponibles</p>
                  ) : (
                    <div className="historias-grid">
                      {historias.map((historia) => (
                        <HistoriaCard key={historia.id} historia={historia} onViewDetail={handleViewDetail}/>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          );
        
        case 'personajes':
          return <PersonajesView onBack={handleBackToDashboard} />;
        
        case 'mapa':
          return <MapaView onBack={handleBackToDashboard} historias={historias} onViewDetail={handleViewDetail} />;
        
        case 'inventario':
          return <InventarioView onBack={handleBackToDashboard} />;

        case 'admin':
          return isAdmin ? <AdminPanel /> : <p>Acceso denegado.</p>;
        
        default:
          return <UserDashboard onNavigate={handleNavigateFromDashboard} />;
      }
  };

  return (
    <div className="app-authenticated">
      
      {showNavBar && (
        <nav className="elegant-navbar">
          <div className="navbar-logo">
            <h1>LA RESISTENCIA</h1>
          </div>

          <button 
            className="navbar-hamburger-btn" 
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label="Toggle navigation"
            aria-expanded={isMobileMenuOpen}
          >
            <span></span>
            <span></span>
            <span></span>
          </button>

          <div className={`navbar-menu-container ${isMobileMenuOpen ? 'is-open' : ''}`}>
            <div className="navbar-links">
              <button className={`nav-link-btn ${currentView === 'dashboard' ? 'active' : ''}`} onClick={() => handleNavClick('dashboard')}>Dashboard</button>
              <button className={`nav-link-btn ${currentView === 'cine' ? 'active' : ''}`} onClick={() => handleNavClick('cine')}>Cine</button>
              <button className={`nav-link-btn ${currentView === 'historias' ? 'active' : ''}`} onClick={() => handleNavClick('historias')}>Historias</button>
              <button className={`nav-link-btn ${currentView === 'personajes' ? 'active' : ''}`} onClick={() => handleNavClick('personajes')}>Personajes</button>
              <button className={`nav-link-btn ${currentView === 'mapa' ? 'active' : ''}`} onClick={() => handleNavClick('mapa')}>Mapa</button>
              <button className={`nav-link-btn ${currentView === 'inventario' ? 'active' : ''}`} onClick={() => handleNavClick('inventario')}>Inventario</button>
              
              {isAdmin && (
                <button className={`nav-link-btn ${currentView === 'admin' ? 'active' : ''}`} onClick={() => handleNavClick('admin')}>Admin</button>
              )}
            </div>
            
            <div className="navbar-user-info">
              {user?.email}
            </div>
            
            <button 
                className="navbar-hide-btn" 
                onClick={handleToggleNavBar}
                title="Ocultar Menú Superior"
            >
                <i className="fas fa-chevron-up"></i>
            </button>

          </div>
        </nav>
      )}
      
      {!showNavBar && (
        <button className="navbar-show-btn" onClick={handleToggleNavBar} title="Mostrar Menú Superior">
            <i className="fas fa-chevron-down"></i>
        </button>
      )}
   
      <main className={`app-main ${!showNavBar ? 'navbar-hidden' : ''}`}>
        {renderCurrentView()}
      </main>
    </div>
  );
};


// ==========================================================
// --- NUEVOS COMPONENTES PARA EL LANDING PAGE ---
// ==========================================================

// --- Modal de Login ---
interface LoginModalProps {
  onClose: () => void;
  // Propagación de Fullscreen
  onRequestFullscreen: () => void; 
}

const LoginModal: React.FC<LoginModalProps> = ({ onClose, onRequestFullscreen }) => {
    return (
        <div className="info-modal-overlay" onClick={onClose}>
            <div className="info-modal-content login-modal-override" onClick={(e) => e.stopPropagation()}>
                <button onClick={onClose} className="info-modal-close-btn">&times;</button>
                <h2 className="info-modal-title">ACCESO</h2> 
                <p className="login-modal-subtitle">Únete a La Resistencia</p>
                {/* Pasar la función al AuthForm */}
                <AuthForm onRequestFullscreen={onRequestFullscreen} />
            </div>
        </div>
    );
};


/**
 * Contenido del Modal de Información
 */
const modalInfoContent = {
  acerca: {
    title: 'Acerca del Proyecto',
    body: 'LA RESISTENCIA es un documental web interactivo que explora las narrativas urbanas de la resistencia social en la Ciudad de México. A través de historias inmersivas, mapas georeferenciados y elementos de RPG, buscamos documentar y preservar la memoria colectiva de la lucha social.'
  },
  'making-off': {
    title: 'Making Off',
    body: 'Este proyecto fue realizado por un equipo multidisciplinario de cineastas, desarrolladores, diseñadores e investigadores. El proceso implicó una profunda investigación de campo, entrevistas, y el desarrollo de una plataforma tecnológica a medida para soportar la narrativa interactiva.'
  },
  equipo: {
    title: 'Equipo',
    body: 'Miembros clave del equipo:\n\n- Director: Pablo Benjamin Nieto Mercado\n- Productora: Melvin Records\n- Desarrollador Principal UX/UI: Paultool\n- Editor: Rodrigo Jardon\n- Investigador/a: Melvin Records'
  }
};

/**
 * Modal de Información
 */
interface InfoModalProps {
  contentKey: 'acerca' | 'making-off' | 'equipo';
  onClose: () => void;
}

const InfoModal: React.FC<InfoModalProps> = ({ contentKey, onClose }) => {
  const { title, body } = modalInfoContent[contentKey];

  return (
    <div className="info-modal-overlay" onClick={onClose}>
      <div className="info-modal-content" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="info-modal-close-btn">&times;</button>
        <h2 className="info-modal-title">{title}</h2>
        <p className="info-modal-body" style={{ whiteSpace: 'pre-wrap' }}>
          {body}
        </p>
      </div>
    </div>
  );
};

/**
 * Barra Inferior
 */
interface BottomBarProps {
  onOpenModal: (contentKey: 'acerca' | 'making-off' | 'equipo') => void;
  onOpenLogin: () => void;
  onToggleVisibility: () => void; 
}

const BottomBar: React.FC<BottomBarProps> = ({ onOpenModal, onOpenLogin, onToggleVisibility }) => {
  return (
    <footer className="bottom-bar">
      {/* Botón de Tache (Ocultar) */}
      <button onClick={onToggleVisibility} className="bottom-bar-close-btn" title="Ocultar Información">
        <i className="fas fa-times"></i> 
      </button>

      <button onClick={() => onOpenModal('acerca')} className="bottom-bar-btn">
        ACERCA DEL PROYECTO
      </button>
      <button onClick={() => onOpenModal('making-off')} className="bottom-bar-btn">
        MAKING OFF
      </button>
      <button onClick={() => onOpenModal('equipo')} className="bottom-bar-btn">
        EQUIPO
      </button>
      <button onClick={onOpenLogin} className="bottom-bar-btn">
        LOGIN
      </button>
    </footer>
  );
};

/**
 * Landing Page - Con introducción cinematográfica
 */
interface LandingPageProps {
  onLoginSuccess: () => void;
  // Función para solicitar Fullscreen en el contenedor principal
  onRequestFullscreen: () => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onLoginSuccess, onRequestFullscreen }) => {
  const [showContent, setShowContent] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [showBottomBar, setShowBottomBar] = useState(true); 
  
  const [infoModalContentKey, setInfoModalContentKey] = useState<'acerca' | 'making-off' | 'equipo' | null>(null);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  
  const videoSrc = "https://ia800103.us.archive.org/12/items/intro_resistencia/intro%20resistencia%20.mp4"; 

  const handleVideoEnd = () => {
    setShowContent(true);
    if (videoRef.current) {
        setIsMuted(videoRef.current.muted);
    }
  };

  const handleUnmuteClick = () => {
    const video = videoRef.current;

    if (video) {
        video.muted = false;
        video.volume = 0.7; 
        
        // 1. LLAMAMOS A LA FUNCIÓN DEL PADRE para Fullscreen
        onRequestFullscreen();
        
        setIsMuted(false);
        video.play().catch(error => console.error("Error al intentar reproducir sin mute:", error));
    }
  };
  
  const handleResisteClick = () => {
    // Reafirma la pantalla completa
    onRequestFullscreen(); 
    setIsLoginModalOpen(true);
  };
  
   useEffect(() => {
    const video = videoRef.current;
    if (video) {
        video.volume = 0.7;
    }
    
    // Función de limpieza al desmontar el componente (opcional)
    return () => {
        // No salimos de Fullscreen aquí, AppContent lo mantiene
    };
   }, []);

  const handleOpenLoginModal = () => {
    onRequestFullscreen(); 
    setIsLoginModalOpen(true);
  };
  
  const handleToggleBottomBar = () => {
    setShowBottomBar(prev => !prev);
  };


  return (
    <div className="landing-page"> 
      <video
        ref={videoRef}
        className="landing-video-bg"
        autoPlay
        loop={false} 
        muted={isMuted} 
        playsInline
        src={videoSrc}
        key={videoSrc}
        onEnded={handleVideoEnd}
      >
        Tu navegador no soporta el tag de video.
      </video>
      <div className="landing-overlay"></div>
      
      {/* Botón de control de audio y Fullscreen */}
      {isMuted && !showContent && (
        <button className="unmute-button" onClick={handleUnmuteClick}>
            <i className="fas fa-volume-up"></i> Activar Audio y Pantalla Completa
        </button>
      )}

      {/* El contenido final aparece con la transición al terminar el video */}
      <main className={`landing-content ${showContent ? 'show' : 'hide'}`}> 
        <h1 className="landing-title">LA RESISTENCIA</h1>
        <p className="landing-subtitle">
          Narrativa urbana interactiva sobre la resistencia social en Ciudad de México
        </p>
        <button onClick={handleResisteClick} className="btn btn-primary landing-button">
          RESISTE
        </button>
      </main>

      {/* RENDERIZADO CONDICIONAL: Solo mostrar si showBottomBar es true */}
      {showBottomBar && (
        <BottomBar 
          onOpenModal={setInfoModalContentKey} 
          onOpenLogin={handleOpenLoginModal}
          onToggleVisibility={handleToggleBottomBar}
        />
      )}
      
      {/* Botón flotante para MOSTRAR (las rayitas) */}
      {!showBottomBar && (
          <button className="bottom-bar-show-btn" onClick={handleToggleBottomBar} title="Mostrar Información">
              <i className="fas fa-bars"></i> 
          </button>
      )}


      {/* Modales */}
      {infoModalContentKey && (
        <InfoModal
          contentKey={infoModalContentKey}
          onClose={() => setInfoModalContentKey(null)}
        />
      )}
      
      {isLoginModalOpen && (
        <LoginModal
          onClose={() => setIsLoginModalOpen(false)}
          // Pasamos la función al LoginModal
          onRequestFullscreen={onRequestFullscreen} 
        />
      )}

    </div>
  );
};

// ==========================================================
// --- Componente principal de la aplicación ---
// ==========================================================
function App(): JSX.Element {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

/**
 * Contenido de la aplicación
 * Decide qué mostrar: el Landing/Login (si no está autenticado)
 * o el MainContent (si sí lo está).
 */
const AppContent: React.FC = () => {
  const { user, loading } = useAuth();
  
  // REFERENCIA: Al contenedor principal que no se desmonta (div.App)
  const appRef = useRef<HTMLDivElement>(null); 
  
  // FUNCIÓN: Se encarga de solicitar Fullscreen en el elemento principal
  const requestAppFullscreen = () => {
    const appContainer = appRef.current;
    if (appContainer) {
        // Aseguramos la compatibilidad con diferentes navegadores
        if (appContainer.requestFullscreen) {
            appContainer.requestFullscreen();
        } else if ((appContainer as any).mozRequestFullScreen) { /* Firefox */
            (appContainer as any).mozRequestFullScreen();
        } else if ((appContainer as any).webkitRequestFullscreen) { /* Chrome, Safari and Opera */
            (appContainer as any).webkitRequestFullscreen();
        } else if ((appContainer as any).msRequestFullscreen) { /* IE/Edge */
            (appContainer as any).msRequestFullscreen();
        }
    }
  };


  if (loading) {
    return (
      <div className="app-loading">
        <div className="loading-container">
          <h1>🏛️ WebDoc La Resistencia</h1>
          <p>⏳ Cargando aplicación...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="App" ref={appRef}> {/* ASIGNAMOS LA REFERENCIA AL CONTENEDOR APP */}
      {user ? (
        // --- VISTA AUTENTICADA ---
        <MainContent />
      ) : (
        // --- VISTA PÚBLICA (LANDING CON MODAL) ---
        <LandingPage 
            onLoginSuccess={() => { /* No es necesario aquí ya que AuthContext se encarga */ }}
            // PASAMOS LA FUNCIÓN DE FULLSCREEN A LANDINGPAGE
            onRequestFullscreen={requestAppFullscreen}
        />
      )}
    </div>
  );
};

export default App;