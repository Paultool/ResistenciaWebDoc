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

import { supabase, testConnection, obtenerHistorias, Historia } from './supabaseClient';
import 'bootstrap/dist/css/bootstrap.min.css';
import '@fortawesome/fontawesome-free/css/all.min.css';
import './App.css';
import './components/HistoriaDetail.css';

// ==========================================================
// --- ESTILOS GLOBALES PARA ANIMACIONES (INYECCIÓN) ---
// ==========================================================
const GlobalStyles = () => (
  <style>{`
    :root { --neon-green: #33ff00; }
    
    /* Animación de línea de escaneo */
    @keyframes shimmer {
      0% { transform: translateX(-100%); }
      100% { transform: translateX(400%); }
    }
    
    /* Animación de revelado de texto */
    @keyframes text-reveal {
      0% { opacity: 0; letter-spacing: 1rem; filter: blur(10px); }
      100% { opacity: 1; letter-spacing: 0.2em; filter: blur(0); }
    }
    
    /* Parpadeo de cursor */
    @keyframes blink-cursor {
      0%, 100% { opacity: 1; }
      50% { opacity: 0; }
    }

    /* Overlay CRT */
    .crt-overlay {
      background: linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%), 
                  linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.06));
      background-size: 100% 2px, 6px 100%;
      pointer-events: none;
    }

    /* Efecto Glitch en texto */
    .text-glitch:hover {
      text-shadow: 2px 0 red, -2px 0 blue;
    }
    
    /* Utilidades Tácticas */
    .font-mono { font-family: 'Courier Prime', 'Courier New', monospace; }
    .tracking-widest { letter-spacing: 0.2em; }

    
  `}</style>
);

// ==========================================================
// --- COMPONENTES AUXILIARES (Modales, WIP, Cards) ---
// ==========================================================



const LoginModal: React.FC<{ onClose: () => void; onRequestFullscreen: () => void }> = ({ onClose, onRequestFullscreen }) => {
  return <AuthForm onRequestFullscreen={onRequestFullscreen} onClose={onClose} />;
};

const modalInfoContent = {
  acerca: {
    title: 'Acerca del Proyecto',
    body: 'LA RESISTENCIA es un documental web interactivo que explora las narrativas urbanas de la resistencia social en la Ciudad de México.'
  },
  'making-off': {
    title: 'Making Off y Recursos',
    body: `
    <div class="modal-links-grid">
        <button class="modal-link-btn js-open-video" data-video-id="1MpN0MbBFlA" data-video-title="PRIMER CORTE (Video)">
            <i class="fab fa-youtube"></i> PRIMER CORTE (Video)
        </button>
        <a href="https://pablonieto.jimdofree.com/2025/10/28/la-resistencia-wip/" target="_blank" rel="noopener noreferrer" class="modal-link-btn">
            <i class="fas fa-camera-retro"></i> GALERIA
        </a>
        <a href="https://drive.google.com/file/d/1MbjrWQTWGnUcngcSb2afQpiZjqqNFtqG/view?usp=sharing" target="_blank" rel="noopener noreferrer" class="modal-link-btn">
            <i class="fas fa-folder-open"></i> CARPETA DE PRODUCCION
        </a>
        <a href="https://github.com/Paultool/ResistenciaWebDoc" target="_blank" rel="noopener noreferrer" class="modal-link-btn">
            <i class="fab fa-github"></i> GITHUB
        </a>
    </div>`
  },
  equipo: {
    title: 'Equipo',
    body: 'Miembros clave del equipo:\n\n- Director: Juan Rodrigo Jardon Galeana \n- Productor: Pablo Benjamin Nieto Mercado\n- Desarrollador Principal UX/UI: Paultool\n- Editor: Marcelo Castillo Sabando'
  }
};

interface InfoModalProps {
  contentKey: 'acerca' | 'making-off' | 'equipo';
  onClose: () => void;
  onOpenVideoModal?: (videoId: string, title: string) => void;
}

const InfoModal: React.FC<InfoModalProps> = ({ contentKey, onClose, onOpenVideoModal }) => {
  const { title, body } = modalInfoContent[contentKey];
  const modalContentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (contentKey === 'making-off' && modalContentRef.current && onOpenVideoModal) {
      const modal = modalContentRef.current;
      const videoButtons = modal.querySelectorAll('.js-open-video');
      const handleVideoClick = (e: Event) => {
        const button = e.currentTarget as HTMLButtonElement;
        const videoId = button.getAttribute('data-video-id');
        const title = button.getAttribute('data-video-title') || 'Video';
        if (videoId) {
          e.preventDefault();
          onClose();
          onOpenVideoModal(videoId, title);
        }
      };
      videoButtons.forEach(button => button.addEventListener('click', handleVideoClick));
      return () => videoButtons.forEach(button => button.removeEventListener('click', handleVideoClick));
    }
  }, [contentKey, onClose, onOpenVideoModal]);

  return (
    <div className="info-modal-overlay" onClick={onClose}>
      <div className="info-modal-content" onClick={(e) => e.stopPropagation()} ref={modalContentRef}>
        <button onClick={onClose} className="info-modal-close-btn">&times;</button>
        <h2 className="info-modal-title">{title}</h2>
        <div className="info-modal-body" dangerouslySetInnerHTML={{ __html: contentKey === 'making-off' ? body : body.replace(/\n/g, '<br/>') }} />
      </div>
    </div>
  );
};

interface WorkInProgressViewProps {
  onOpenVideoModal: (videoId: string, title: string) => void;
}

const WorkInProgressView: React.FC<WorkInProgressViewProps> = ({ onOpenVideoModal }) => {
  const links = [
    {
      name: 'PRIMER CORTE (Video)',
      type: 'video',
      videoId: '1MpN0MbBFlA',
      icon: 'fab fa-youtube',
      meta: 'MP4_STREAM // 1080p'
    },
    {
      name: 'GALERIA DE ARTE',
      type: 'link',
      url: 'https://pablonieto.jimdofree.com/2025/10/28/la-resistencia-wip/',
      icon: 'fas fa-camera-retro',
      meta: 'IMG_ARCHIVE // EXTERNAL'
    },
    {
      name: 'CARPETA DE PRODUCCION',
      type: 'link',
      url: 'https://drive.google.com/file/d/1MbjrWQTWGnUcngcSb2afQpiZjqqNFtqG/view?usp=sharing',
      icon: 'fas fa-folder-open',
      meta: 'PDF_DOSSIER // CLASSIFIED'
    },
    {
      name: 'REPOSITORIO GITHUB',
      type: 'link',
      url: 'https://github.com/Paultool/ResistenciaWebDoc',
      icon: 'fab fa-github',
      meta: 'SOURCE_CODE // PUBLIC'
    },
  ];

  return (
    <div className="wip-container">

      {/* Header Táctico */}
      <div className="wip-header">
        <div>
          <h2 className="wip-title-text">R&D_LAB</h2>
          <p className="wip-subtitle">{'>'} AREA DE DESARROLLO Y RECURSOS EXTERNOS</p>
        </div>
        <div className="text-right hidden md:block text-[10px] text-[#33ff00]/50 font-mono">
          ACCESS_LEVEL: BETA<br />
          BUILD: v.2.5.0
        </div>
      </div>

      {/* Grid de Archivos */}
      <div className="wip-links-grid">
        {links.map((link, index) => {
          const isVideo = link.type === 'video';

          // Renderizado condicional de Button o Anchor
          const CardContent = () => (
            <>
              <i className={`${link.icon} wip-icon`}></i>
              <span className="wip-link-name">{link.name}</span>
              <div className="wip-meta">
                <span>ID: 0{index + 1}_DAT</span>
                <span>{link.meta}</span>
              </div>
              <div className="absolute bottom-3 right-3">
                <i className={`fas ${isVideo ? 'fa-play' : 'fa-external-link-alt'} wip-external-icon`}></i>
              </div>
            </>
          );

          if (isVideo) {
            return (
              <button
                key={link.name}
                onClick={() => onOpenVideoModal(link.videoId!, link.name)}
                className="wip-link-card text-left"
              >
                <CardContent />
              </button>
            );
          }

          return (
            <a
              key={link.name}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="wip-link-card"
            >
              <CardContent />
            </a>
          );
        })}
      </div>
    </div>
  );
};

// ==========================================================
// --- 1. COMPONENTE BOTTOM BAR (DEFINIDO AQUÍ PARA EVITAR ERROR) ---
// ==========================================================
interface BottomBarProps {
  onOpenModal: (contentKey: 'acerca' | 'making-off' | 'equipo') => void;
  onOpenLogin: () => void;
  onToggleVisibility: () => void;
}

const BottomBar: React.FC<BottomBarProps> = ({ onOpenModal, onOpenLogin, onToggleVisibility }) => {
  return (
    <footer className="fixed bottom-0 left-0 w-full z-[100] font-mono select-none animate-in slide-in-from-bottom-10 duration-700">

      {/* Línea de escaneo superior (Shimmer Effect) */}
      <div className="w-full h-[1px] bg-[#33ff00]/20 relative overflow-hidden">
        <div className="absolute top-0 left-0 h-full w-1/3 bg-gradient-to-r from-transparent via-[#33ff00] to-transparent animate-[shimmer_3s_infinite]"></div>
      </div>

      {/* Contenedor Ultra-Compacto */}
      <div className="bg-black/95 backdrop-blur-md flex items-center justify-between md:justify-center h-12 px-4 md:gap-12 border-t border-[#33ff00]/10 shadow-[0_-10px_30px_rgba(0,0,0,0.8)]">

        {/* Botón LOGIN (El más importante) */}
        <button
          onClick={onOpenLogin}
          className="group flex items-center gap-2 text-[#33ff00] hover:text-white transition-colors text-[10px] md:text-xs font-bold tracking-[0.2em] uppercase"
        >
          <span className="opacity-0 group-hover:opacity-100 transition-opacity text-[#33ff00]">{'>'}</span>
          LOGIN
        </button>

        {/* Separador Visual (Solo Desktop) */}
        <span className="hidden md:block text-[#33ff00]/20 text-[10px]">|</span>

        {/* Botón ACERCA */}
        <button
          onClick={() => onOpenModal('acerca')}
          className="group text-gray-500 hover:text-[#33ff00] transition-colors text-[10px] md:text-xs font-bold tracking-widest uppercase"
        >
          <span className="hidden group-hover:inline mr-1">[</span>
          ACERCA
          <span className="hidden group-hover:inline ml-1">]</span>
        </button>

        {/* Botón WIP */}
        <button
          onClick={() => onOpenModal('making-off')}
          className="group text-gray-500 hover:text-[#33ff00] transition-colors text-[10px] md:text-xs font-bold tracking-widest uppercase"
        >
          <span className="hidden group-hover:inline mr-1">[</span>
          WIP
          <span className="hidden group-hover:inline ml-1">]</span>
        </button>

        {/* Botón CREW */}
        <button
          onClick={() => onOpenModal('equipo')}
          className="group text-gray-500 hover:text-[#33ff00] transition-colors text-[10px] md:text-xs font-bold tracking-widest uppercase"
        >
          <span className="hidden group-hover:inline mr-1">[</span>
          CREW
          <span className="hidden group-hover:inline ml-1">]</span>
        </button>

        {/* Separador Visual (Solo Desktop) */}
        <span className="hidden md:block text-[#33ff00]/20 text-[10px]">|</span>

        {/* Botón SALIR (Icono minimalista) */}
        <button
          onClick={onToggleVisibility}
          className="text-red-500/50 hover:text-red-500 transition-colors text-base flex items-center justify-center w-8"
          title="Ocultar Interfaz"
        >
          ✕
        </button>

      </div>
    </footer>
  );
};

// ==========================================================
// --- 2. COMPONENTE LANDING PAGE (USANDO BOTTOM BAR) ---
// ==========================================================
interface LandingPageProps {
  onLoginSuccess: () => void;
  onRequestFullscreen: () => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onLoginSuccess, onRequestFullscreen }) => {
  const [showContent, setShowContent] = useState(false);
  const [isMuted, setIsMuted] = useState(true);

  // Estados para la barra
  const [showBottomBar, setShowBottomBar] = useState(true); // Cambiado a true para aparecer inmediatamente 
  const [isBarVisible, setIsBarVisible] = useState(true);

  const [infoModalContentKey, setInfoModalContentKey] = useState<'acerca' | 'making-off' | 'equipo' | null>(null);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [videoModalData, setVideoModalData] = useState<{ videoId: string; title: string } | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const videoSrc = "https://ia600103.us.archive.org/12/items/intro_resistencia/intro%20resistencia%20sub%20sp.mp4";

  useEffect(() => {
    if (showContent) {
      const timer = setTimeout(() => setShowBottomBar(true), 1500);
      return () => clearTimeout(timer);
    }
  }, [showContent]);

  const handleVideoEnd = () => {
    setShowContent(true);
    if (videoRef.current) setIsMuted(videoRef.current.muted);
  };

  const handleUnmuteClick = () => {
    const video = videoRef.current;
    if (video) {
      video.muted = false;
      video.volume = 0.7;
      onRequestFullscreen();
      setIsMuted(false);
      video.play().catch(e => console.error("Error play:", e));
    }
  };

  const handleResisteClick = () => {
    onRequestFullscreen();
    setIsLoginModalOpen(true);
  };

  const handleOpenVideoModal = (videoId: string, title: string) => {
    setVideoModalData({ videoId, title });
  };

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden font-mono selection:bg-[#33ff00] selection:text-black">

      {/* ATMÓSFERA VISUAL */}
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-cover z-0 opacity-50 grayscale contrast-125"
        autoPlay loop={false} muted={isMuted} playsInline
        src={videoSrc} key={videoSrc} onEnded={handleVideoEnd}
      >
        Tu navegador no soporta video.
      </video>

      {/* Capas FX */}
      <div className="absolute inset-0 z-[1] pointer-events-none bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10"></div>
      <div className="absolute inset-0 z-[2] pointer-events-none crt-overlay opacity-30"></div>
      <div className="absolute inset-0 z-[1] pointer-events-none bg-[radial-gradient(circle_at_center,transparent_0%,#000_120%)]"></div>

      {/* HUD SUPERIOR */}
      <div className="absolute top-0 left-0 w-full p-6 z-20 flex justify-between items-start text-[9px] md:text-[10px] text-[#33ff00]/60 tracking-widest uppercase mix-blend-screen pointer-events-none">
        <div className="flex flex-col gap-1">
          <span>SIGNAL: <span className="text-[#33ff00] animate-pulse">ENCRYPTED</span></span>
          <span>LOC: 19.4326° N, 99.1332° W</span>
        </div>
        <div className="text-right flex flex-col gap-1">
          <span>REC: ● LIVE</span>
          <span>SECURE_BOOT: TRUE</span>
        </div>
      </div>

      {/* NÚCLEO */}
      <div className="relative z-30 w-full h-full flex flex-col items-center justify-center">

        {isMuted && !showContent && (
          <button
            onClick={handleUnmuteClick}
            className="group relative flex flex-col items-center gap-4 cursor-pointer transition-transform duration-700 hover:scale-105"
          >
            <div className="relative w-20 h-20 border border-[#33ff00] rounded-full flex items-center justify-center">
              <div className="absolute inset-0 rounded-full border border-[#33ff00] animate-[ping_2s_infinite] opacity-50"></div>
              <span className="text-3xl text-[#33ff00] ml-1">▶</span>
            </div>
            <div className="bg-black/80 border border-[#33ff00]/30 px-4 py-2 backdrop-blur-sm">
              <span className="text-[#33ff00] text-xs md:text-sm tracking-[0.3em] uppercase">
                {'>'} INICIALIZAR_SISTEMA<span className="animate-[blink-cursor_1s_infinite]">_</span>
              </span>
            </div>
          </button>
        )}

        <main className={`flex flex-col items-center text-center transition-all duration-1000 ease-out 
          ${showContent ? 'opacity-100 translate-y-0 blur-0' : 'opacity-0 translate-y-10 blur-sm pointer-events-none'}`}>

          <div className="mb-4 flex items-center gap-3 text-[#33ff00]/70 text-[10px] md:text-xs tracking-[0.4em] uppercase font-bold">
            <span className="w-1 h-1 bg-[#33ff00]"></span>
            PROTOCOL_V2.4 :: READY
            <span className="w-1 h-1 bg-[#33ff00]"></span>
          </div>
          {/* TÍTULO CON CLASE GLITCH-YELLOW */}
          <h1
            className="glitch-yellow text-5xl md:text-7xl lg:text-8xl font-black mb-10 tracking-tighter select-none z-10"
            data-text="LA RESISTENCIA"
            style={{
              animation: showContent ? 'text-reveal 1.5s cubic-bezier(0.19, 1, 0.22, 1) forwards' : 'none'
            }}
          >
            LA RESISTENCIA
          </h1>

          <button
            onClick={handleResisteClick}
            className="group relative flex items-center gap-3 px-6 py-2 bg-black border border-[#33ff00] text-[#33ff00] font-mono text-xs font-bold uppercase tracking-widest overflow-hidden transition-all hover:shadow-[0_0_20px_rgba(51,255,0,0.5)] hover:border-[#33ff00]"
          >
            {/* Fondo animado de barrido */}
            <div className="absolute inset-0 bg-[#33ff00] transform translate-x-[-100%] group-hover:translate-x-0 transition-transform duration-300 origin-left z-0"></div>

            {/* Contenido (Calavera + Texto) */}
            <span className="relative z-10 flex items-center gap-2 group-hover:text-black transition-colors duration-300">
              <span className="text-lg leading-none">☠</span>
              RESISTE
            </span>
          </button>

        </main>
      </div>

      {/* BARRA INFERIOR */}
      {showBottomBar && isBarVisible && (
        <BottomBar
          onOpenModal={setInfoModalContentKey}
          onOpenLogin={() => { onRequestFullscreen(); setIsLoginModalOpen(true); }}
          onToggleVisibility={() => setIsBarVisible(false)}
        />
      )}

      {showBottomBar && !isBarVisible && (
        <button
          className="fixed bottom-4 right-4 z-50 text-[#33ff00] opacity-50 hover:opacity-100 text-2xl animate-pulse"
          onClick={() => setIsBarVisible(true)}
          title="Restaurar Interfaz"
        >
          +
        </button>
      )}

      {/* MODALES */}
      {infoModalContentKey && <InfoModal contentKey={infoModalContentKey} onClose={() => setInfoModalContentKey(null)} onOpenVideoModal={handleOpenVideoModal} />}
      {isLoginModalOpen && <LoginModal onClose={() => setIsLoginModalOpen(false)} onRequestFullscreen={onRequestFullscreen} />}
    </div>
  );
};

// ==========================================================
// --- 3. CONTENIDO PRINCIPAL (LOGGED IN) ---
// ==========================================================
const MainContent: React.FC = () => {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentView, setCurrentView] = useState<'dashboard' | 'historias' | 'personajes' | 'mapa' | 'inventario' | 'admin' | 'wip'>('dashboard');
  const [historias, setHistorias] = useState<Historia[]>([]);
  const [selectedHistoriaId, setSelectedHistoriaId] = useState<number | null>(null);
  const [flujoNarrativoHistoriaId, setFlujoNarrativoHistoriaId] = useState<number | null>(null);
  const [videoModalData, setVideoModalData] = useState<{ videoId: string; title: string } | null>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [showNavBar, setShowNavBar] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const init = async () => {
      if (user) {
        setIsAdmin(user.email === 'paultool@gmail.com');
        const hist = await obtenerHistorias();
        setHistorias(hist);
        // Cargar perfil
        const { data } = await supabase.from('perfiles_jugador').select('*').eq('user_id', user.id).single();
        if (data) setUserProfile(data);
        else await supabase.from('perfiles_jugador').insert({ user_id: user.id });
      }
    };
    init();
  }, [user]);

  const handleStartNarrative = (historia: Historia) => {
    setFlujoNarrativoHistoriaId(historia.id);
    setCurrentView('historias');
  };

  const handleStartNarrativeFromMap = (historiaId: number) => {
    setFlujoNarrativoHistoriaId(historiaId);
    setCurrentView('historias');
  };

  const handleUpdateProfile = async (pos: number, neg: number, loc: string) => {
    // Lógica simplificada para actualizar perfil
    if (userProfile) {
      const xp = userProfile.xp_total + pos + neg;
      await supabase.from('perfiles_jugador').update({ xp_total: xp }).eq('user_id', userProfile.user_id);
    }
  };

  const renderCurrentView = () => {
    if (currentView === 'historias') {
      return <FlujoNarrativoUsuario historiaId={flujoNarrativoHistoriaId || undefined} onBack={() => setCurrentView('dashboard')} onUpdateProfile={handleUpdateProfile} />;
    }
    if (selectedHistoriaId) {
      return <HistoriaDetail historiaId={selectedHistoriaId} onClose={() => setSelectedHistoriaId(null)} onStartNarrative={() => handleStartNarrative(historias.find(h => h.id === selectedHistoriaId)!)} />;
    }
    switch (currentView) {
      case 'dashboard': return <UserDashboard onNavigate={(v) => setCurrentView(v as any)} />;
      case 'personajes': return <PersonajesView onBack={() => setCurrentView('dashboard')} />;
      case 'mapa': return <MapaView historias={historias} historiasVisitadas={userProfile?.historias_visitadas || []} onStartNarrativeFromMap={handleStartNarrativeFromMap} initialCenter={[19.640645, -99.137597]} />;
      case 'inventario': return <InventarioView onBack={() => setCurrentView('dashboard')} />;
      case 'wip': return <WorkInProgressView onOpenVideoModal={(id, t) => setVideoModalData({ videoId: id, title: t })} />;
      case 'admin': return isAdmin ? <AdminPanel /> : <p>Acceso denegado</p>;
      default: return <UserDashboard onNavigate={(v) => setCurrentView(v as any)} />;
    }
  };

  return (
    <div className="app-authenticated">
      {showNavBar && (
        <nav className="term-navbar">

          {/* 1. LOGO */}
          <div className="term-logo">
            <h1>
              <span className="term-cursor">{'>'}</span> LA_RESISTENCIA
            </h1>
          </div>

          {/* 2. BOTÓN HAMBURGUESA (Solo Móvil) */}
          <button
            className="term-hamburger-btn"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? '☠' : '[ MENU ]'}
          </button>

          {/* 3. CONTENEDOR DE MENÚ (Links + User) */}
          <div className={`term-menu-container ${isMobileMenuOpen ? 'is-open' : ''}`}>

            <div className="term-links">
              {/* Botón Minimizar */}
              <button
                className="term-hide-btn"
                onClick={() => setShowNavBar(false)}
                title="Ocultar Interfaz"
              >
                ☠
              </button>

              {/* Enlaces Mapeados */}
              {[
                { id: 'dashboard', label: 'DASHBOARD' },
                { id: 'historias', label: 'MISIONES' },
                { id: 'mapa', label: 'GEOLOCALIZACIÓN' },
                { id: 'inventario', label: 'ALMACÉN' },
                { id: 'personajes', label: 'SUJETOS' },
                { id: 'wip', label: 'WIP_LAB' }
              ].map(item => (
                <button
                  key={item.id}
                  className={`term-link-btn ${currentView === item.id ? 'active' : ''}`}
                  onClick={() => { setCurrentView(item.id as any); setIsMobileMenuOpen(false); }}
                >
                  {currentView === item.id ? `> ${item.label}` : item.label}
                </button>
              ))}

              {/* Admin */}
              {isAdmin && (
                <button
                  className={`term-link-btn ${currentView === 'admin' ? 'active' : ''}`}
                  style={{ color: '#ff0000', borderColor: currentView === 'admin' ? '#ff0000' : '#333' }}
                  onClick={() => { setCurrentView('admin'); setIsMobileMenuOpen(false); }}
                >
                  ADMIN
                </button>
              )}
            </div>

            {/* Info Usuario */}
            <div className="term-user-info">
              USR_ID: {user?.email?.split('@')[0] || 'GUEST'}
            </div>
          </div>
        </nav>
      )}
      {!showNavBar && (
        <button
          className="term-restore-btn"
          onClick={() => setShowNavBar(true)}
          title="Restaurar Interfaz"
        >
          <span className="term-restore-icon">▼</span>
          DESPLEGAR_MENU
        </button>
      )}
      <main className={`app-main ${!showNavBar ? 'navbar-hidden' : ''}`}>
        {renderCurrentView()}
      </main>

    </div>
  );
};

// ==========================================================
// --- 4. APP ROOT ---
// ==========================================================
const AppContent: React.FC = () => {
  const { user, loading } = useAuth();
  const appRef = useRef<HTMLDivElement>(null);

  const requestAppFullscreen = () => {
    const el = appRef.current as any;
    if (el) {
      if (el.requestFullscreen) el.requestFullscreen();
      else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
    }
  };

  if (loading) return <div className="app-loading"><div className="loading-container"><h1>🏛️ WebDoc La Resistencia</h1><p>⏳ Cargando...</p></div></div>;

  return (
    <div className="App" ref={appRef}>
      <GlobalStyles />
      <video className="glitch-overlay" autoPlay muted loop playsInline>
        <source src="https://nz71ioy1keimlqqc.public.blob.vercel-storage.com/Fondo.webm" type="video/webm" />
      </video>
      {user ? <MainContent /> : <LandingPage onLoginSuccess={() => { }} onRequestFullscreen={requestAppFullscreen} />}
    </div>
  );
};

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;