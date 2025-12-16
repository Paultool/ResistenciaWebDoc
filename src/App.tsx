import React, { useState, useEffect, useRef } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LanguageProvider, useLanguage } from './contexts/LanguageContext';
import { fetchAndConvertSubtitle } from './utils/subtitleUtils';
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

const modalTranslations = {
  acerca: {
    es: {
      title: 'Acerca del Proyecto',
      body: 'SERIE WEB INMERSIVA // DOCU-JUEGO\n\n"Expulsado por la gentrificación de la Ciudad de México, un ingeniero se retira a la periferia industrial para convertir el garaje familiar en una trinchera digital. En este docu-juego inmersivo, el usuario hereda su lucha: gestionar la escasez, reparar electrónica rota y tejer una comunidad para sobrevivir en un sistema diseñado para borrarte."'
    },
    en: {
      title: 'About the Project',
      body: 'IMMERSIVE WEB SERIES // DOCU-GAME\n\n"Expelled by the gentrification of Mexico City, an engineer retreats to the industrial periphery to turn the family garage into a digital trench. In this immersive docu-game, the user inherits his struggle: managing scarcity, repairing broken electronics, and weaving a community to survive in a system designed to erase you."'
    }
  },
  'making-off': {
    es: {
      title: 'Making Off y Recursos',
      body: `
      <div class="modal-links-grid">
          <a href="https://melvinrecords.gt.tc/resistencia/dossier/" target="_blank" rel="noopener noreferrer" class="modal-link-btn" title="DOSSIER">
              <i class="fas fa-folder-open text-2xl"></i>
          </a>
      </div>`
    },
    en: {
      title: 'Making Of & Resources',
      body: `
      <div class="modal-links-grid">
          <a href="https://melvinrecords.gt.tc/resistencia/dossier/" target="_blank" rel="noopener noreferrer" class="modal-link-btn" title="DOSSIER">
              <i class="fas fa-folder-open text-2xl"></i>
          </a>
      </div>`
    }
  },
  equipo: {
    es: {
      title: 'Equipo',
      body: 'Miembros clave del equipo:\n\n- Director: Juan Rodrigo Jardon Galeana\n- Productor: Pablo Benjamin Nieto Mercado\n- Desarrollador Principal UX/UI: Paultool\n- Editor: Marcelo Castillo Sabando'
    },
    en: {
      title: 'Crew',
      body: 'Key team members:\n\n- Director: Juan Rodrigo Jardon Galeana\n- Producer: Pablo Benjamin Nieto Mercado\n- Lead UX/UI Developer: Paultool\n- Editor: Marcelo Castillo Sabando'
    }
  }
};

interface InfoModalProps {
  contentKey: 'acerca' | 'making-off' | 'equipo';
  onClose: () => void;
  onOpenVideoModal?: (videoId: string, title: string) => void;
  lang?: 'es' | 'en';
}

const InfoModal: React.FC<InfoModalProps> = ({ contentKey, onClose, onOpenVideoModal, lang = 'es' }) => {
  const { title, body } = modalTranslations[contentKey][lang];
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
      name: 'GALERIA',
      type: 'link',
      url: 'https://pablonieto.jimdofree.com/2025/10/28/la-resistencia-wip/',
      icon: 'fas fa-camera-retro',
      meta: 'IMG_ARCHIVE // EXTERNAL'
    },
    {
      name: 'DOSSIER',
      type: 'link',
      url: 'https://melvinrecords.gt.tc/resistencia/dossier/',
      icon: 'fas fa-folder-open',
      meta: 'INTERACTIVE_DOSSIER // CLASSIFIED'
    },
    {
      name: 'GITHUB',
      type: 'link',
      url: 'https://github.com/Paultool/ResistenciaWebDoc',
      icon: 'fab fa-github',
      meta: 'SOURCE_CODE // PUBLIC'
    },
  ];

  return (
    <div className="wip-container">


      {/* Grid de Archivos */}
      <div className="wip-links-grid">
        {links.map((link, index) => {
          const isVideo = link.type === 'video';

          // Renderizado condicional de Button o Anchor
          const CardContent = () => (
            <>
              <i className={`${link.icon} wip-icon text-4xl mb-2`}></i>
              {/* <span className="wip-link-name">{link.name}</span> Texto eliminado por solicitud */}
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
  subtitlesEnabled: boolean;
  onToggleSubtitles: () => void;
}

const BottomBar: React.FC<BottomBarProps> = ({ onOpenModal, onOpenLogin, onToggleVisibility, subtitlesEnabled, onToggleSubtitles }) => {
  return (
    <footer className="fixed bottom-0 left-0 w-full z-[100] font-mono select-none animate-in slide-in-from-bottom-10 duration-700">

      {/* Línea de escaneo superior (Shimmer Effect) */}
      <div className="w-full h-[1px] bg-[#33ff00]/20 relative overflow-hidden">
        <div className="absolute top-0 left-0 h-full w-1/3 bg-gradient-to-r from-transparent via-[#33ff00] to-transparent animate-[shimmer_3s_infinite]"></div>
      </div>

      {/* Contenedor Ultra-Compacto */}
      <div className="bg-black/95 backdrop-blur-md flex items-center justify-between md:justify-center h-12 px-4 md:gap-12 border-t border-[#33ff00]/10 shadow-[0_-10px_30px_rgba(0,0,0,0.8)]">

        {/* Botón LOGIN (Icono) */}
        <button
          onClick={onOpenLogin}
          className="group flex items-center justify-center w-10 h-10 text-[#33ff00] hover:text-white hover:bg-[#33ff00]/10 rounded-full transition-all"
          title="LOGIN"
        >
          <i className="fas fa-sign-in-alt text-lg"></i>
        </button>

        {/* Separador Visual (Solo Desktop) */}
        <span className="hidden md:block text-[#33ff00]/20 text-[10px]">|</span>

        {/* Botón ACERCA */}
        <button
          onClick={() => onOpenModal('acerca')}
          className="group flex items-center justify-center w-10 h-10 text-gray-500 hover:text-[#33ff00] hover:bg-[#33ff00]/10 rounded-full transition-all"
          title="ACERCA / ABOUT"
        >
          <i className="fas fa-info-circle text-lg"></i>
        </button>

        {/* Botón WIP */}
        <button
          onClick={() => onOpenModal('making-off')}
          className="group flex items-center justify-center w-10 h-10 text-gray-500 hover:text-[#33ff00] hover:bg-[#33ff00]/10 rounded-full transition-all"
          title="WIP LAB / MAKING OF"
        >
          <i className="fas fa-flask text-lg"></i>
        </button>

        {/* Botón CREW */}
        <button
          onClick={() => onOpenModal('equipo')}
          className="group flex items-center justify-center w-10 h-10 text-gray-500 hover:text-[#33ff00] hover:bg-[#33ff00]/10 rounded-full transition-all"
          title="CREW / EQUIPO"
        >
          <i className="fas fa-users text-lg"></i>
        </button>

        {/* Separador Visual (Solo Desktop) */}
        <span className="hidden md:block text-[#33ff00]/20 text-[10px]">|</span>

        {/* Botón SUBS */}
        <button
          onClick={onToggleSubtitles}
          className={`group flex items-center justify-center w-10 h-10 transition-all rounded-full hover:bg-[#33ff00]/10 ${subtitlesEnabled ? 'text-[#33ff00]' : 'text-gray-500 hover:text-[#33ff00]'}`}
          title={subtitlesEnabled ? 'Subtítulos: ON' : 'Subtítulos: OFF'}
        >
          <i className="fas fa-closed-captioning text-lg"></i>
        </button>

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
  const [subtitleUrl, setSubtitleUrl] = useState<string | null>(null);

  // Consumir contexto de idioma
  const { language, toggleLanguage } = useLanguage();
  const subtitlesEnabled = language === 'en'; // Mapeo lógico: Inglés = Subtítulos ON

  const videoRef = useRef<HTMLVideoElement>(null);
  const videoSrc = "https://ia800103.us.archive.org/12/items/intro_resistencia/intro%20resistencia%20.mp4";

  useEffect(() => {
    if (showContent) {
      const timer = setTimeout(() => setShowBottomBar(true), 1500);
      return () => clearTimeout(timer);
    }
  }, [showContent]);

  useEffect(() => {
    // Ejemplo de carga de subtítulos para el video de fondo (si existiera un SRT)
    const srtUrl = "https://melvinrecords.gt.tc/resistencia/subtitles/intro-resistencia.srt";
    fetchAndConvertSubtitle(srtUrl).then(url => setSubtitleUrl(url));
  }, []);

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
      <div className="absolute inset-0 z-0">
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover opacity-70"
          autoPlay loop={false} muted={isMuted} playsInline
          src={videoSrc} key={videoSrc} onEnded={handleVideoEnd}
        >
          {subtitleUrl && subtitlesEnabled && (
            <track
              kind="subtitles"
              src={subtitleUrl}
              srcLang="en"
              label="English"
              default
            />
          )}
          Tu navegador no soporta video.
        </video>
        {/* Capa de efecto gris separada */}
        <div className="absolute inset-0 bg-black/30 mix-blend-saturation pointer-events-none"></div>
      </div>

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
            title="INICIALIZAR / INITIALIZE"
          >
            <div className="relative flex items-center justify-center">
              {/* Efecto de onda tras la calavera */}
              <div className="absolute inset-0 rounded-full border border-[#33ff00] animate-[ping_2s_infinite] opacity-30 scale-150"></div>
              {/* Calavera Gigante */}
              <span className="text-6xl md:text-8xl text-[#33ff00] drop-shadow-[0_0_15px_rgba(51,255,0,0.8)] filter transition-all hover:drop-shadow-[0_0_30px_rgba(51,255,0,1)]">
                ☠
              </span>
            </div>
          </button>
        )}

        {(!isMuted || showContent) && (
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
              className="group relative flex flex-col items-center gap-4 cursor-pointer transition-transform duration-700 hover:scale-110 mt-8"
              title="INGRESAR / ENTER"
            >
              <div className="relative flex items-center justify-center">
                {/* Efecto de onda: Verde -> Rojo al hover */}
                <div className="absolute inset-0 rounded-full border border-[#33ff00] group-hover:border-red-600 animate-[ping_2s_infinite] opacity-30 scale-150 transition-colors duration-500"></div>

                {/* Calavera: Verde -> Rojo al hover */}
                <span className="text-6xl md:text-8xl text-[#33ff00] group-hover:text-red-600 drop-shadow-[0_0_15px_rgba(51,255,0,0.8)] group-hover:drop-shadow-[0_0_30px_rgba(255,0,0,0.8)] filter transition-all duration-300">
                  ☠
                </span>
              </div>
            </button>

          </main>
        )}
      </div>

      {/* BARRA INFERIOR */}
      {showBottomBar && isBarVisible && (
        <BottomBar
          onOpenModal={setInfoModalContentKey}
          onOpenLogin={() => { onRequestFullscreen(); setIsLoginModalOpen(true); }}
          onToggleVisibility={() => setIsBarVisible(false)}
          subtitlesEnabled={subtitlesEnabled}
          onToggleSubtitles={toggleLanguage}
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
      {infoModalContentKey && <InfoModal contentKey={infoModalContentKey} onClose={() => setInfoModalContentKey(null)} onOpenVideoModal={handleOpenVideoModal} lang={language} />}
      {isLoginModalOpen && <LoginModal onClose={() => setIsLoginModalOpen(false)} onRequestFullscreen={onRequestFullscreen} />}
    </div>
  );
};

// ==========================================================
// --- 3. CONTENIDO PRINCIPAL (LOGGED IN) ---
// ==========================================================
const MainContent: React.FC = () => {
  const { user } = useAuth();
  const { language, toggleLanguage } = useLanguage();
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
      return <FlujoNarrativoUsuario historiaId={flujoNarrativoHistoriaId || undefined} onBack={() => { setFlujoNarrativoHistoriaId(null); setCurrentView('dashboard'); }} onUpdateProfile={handleUpdateProfile} />;
    }
    if (selectedHistoriaId) {
      return <HistoriaDetail historiaId={selectedHistoriaId} onClose={() => setSelectedHistoriaId(null)} onStartNarrative={() => handleStartNarrative(historias.find(h => h.id === selectedHistoriaId)!)} />;
    }
    switch (currentView) {
      case 'dashboard': return <UserDashboard onNavigate={(v) => setCurrentView(v as any)} onStartNarrative={handleStartNarrativeFromMap} historias={historias} />;
      case 'personajes': return <PersonajesView onBack={() => setCurrentView('dashboard')} />;
      case 'mapa': return <MapaView historias={historias} historiasVisitadas={userProfile?.historias_visitadas || []} onStartNarrativeFromMap={handleStartNarrativeFromMap} />;
      case 'inventario': return <InventarioView onBack={() => setCurrentView('dashboard')} />;
      case 'wip': return <WorkInProgressView onOpenVideoModal={(id, t) => setVideoModalData({ videoId: id, title: t })} />;
      case 'admin': return isAdmin ? <AdminPanel /> : <p>Acceso denegado</p>;
      default: return <UserDashboard onNavigate={(v) => setCurrentView(v as any)} onStartNarrative={handleStartNarrativeFromMap} historias={historias} />;
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
            {isMobileMenuOpen ? '☠' : '☠'}
          </button>

          {/* 3. CONTENEDOR DE MENÚ (Links + User) */}
          <div className={`term-menu-container ${isMobileMenuOpen ? 'is-open' : ''}`}>

            <div className="term-links flex items-center gap-2 h-full">
              {/* Botón Minimizar (Compacto) */}
              <button
                className="term-hide-btn flex items-center justify-center w-6 h-6 p-0 border border-[#33ff00]/30 hover:border-[#33ff00] text-[#33ff00] transition-colors bg-black/50"
                onClick={() => setShowNavBar(false)}
                title={language === 'es' ? 'OCULTAR INTERFAZ' : 'HIDE INTERFACE'}
              >
                <span className="text-xs">☠</span>
              </button>

              {/* Enlaces Mapeados */}
              <div className="flex flex-wrap gap-1 justify-center items-center max-w-5xl h-full">
                {[
                  { id: 'dashboard', icon: 'fas fa-chart-network' }, // SYSTEM
                  { id: 'historias', icon: 'fas fa-stream' },        // LOGS
                  { id: 'mapa', icon: 'fas fa-map-marker-alt' },   // MAP
                  { id: 'inventario', icon: 'fas fa-box-open' },     // ITEMS
                  { id: 'personajes', icon: 'fas fa-users-cog' },    // CREW
                  { id: 'wip', icon: 'fas fa-flask' }                // LAB
                ].map(item => {
                  // Diccionario de navegación
                  const navLabels: Record<string, { es: string; en: string }> = {
                    dashboard: { es: 'SISTEMA', en: 'SYSTEM' },
                    historias: { es: 'LOGS', en: 'LOGS' },
                    mapa: { es: 'MAPA', en: 'MAP' },
                    inventario: { es: 'ITEMS', en: 'ITEMS' },
                    personajes: { es: 'CREW', en: 'CREW' },
                    wip: { es: 'LAB', en: 'LAB' }
                  };
                  const label = navLabels[item.id][language];

                  return (
                    <button
                      key={item.id}
                      className={`term-link-btn ${currentView === item.id ? 'active' : ''} group relative flex items-center gap-1.5 px-2 py-0.5 border border-[#33ff00]/30 hover:border-[#33ff00] transition-all bg-black/50 hover:bg-[#33ff00]/10`}
                      onClick={() => {
                        if (item.id === 'historias') setFlujoNarrativoHistoriaId(null);
                        setCurrentView(item.id as any);
                        setIsMobileMenuOpen(false);
                      }}
                      title={label}
                    >
                      <i className={`${item.icon} text-xs group-hover:text-[#33ff00] transition-colors`}></i>
                      {/* Texto visible solo en desktop, compacto y estilo OS */}
                      <span className="hidden md:block text-[9px] tracking-widest font-bold uppercase">{label}</span>
                    </button>
                  );
                })}
                {/* Botón Idioma (Cloud Cachups / CC) */}
                <button
                  className="term-link-btn group relative flex items-center justify-center px-2 py-0.5 border border-[#33ff00]/30 hover:border-[#33ff00] transition-all bg-black/50 hover:bg-[#33ff00]/10"
                  onClick={toggleLanguage}
                  title={language === 'es' ? 'CAMBIAR A INGLÉS (CC)' : 'SWITCH TO SPANISH (CC)'}
                >
                  <i className="fas fa-closed-captioning text-xs group-hover:text-[#33ff00] transition-colors mr-1"></i>
                  <span className="text-[9px] font-bold">
                    {language === 'es' ? 'EN' : 'ES'}
                  </span>
                </button>

              </div>
              {isAdmin && (
                <button
                  className={`term-link-btn flex items-center justify-center px-2 py-0.5 ${currentView === 'admin' ? 'active' : ''}`}
                  style={{ color: '#ff0000', borderColor: currentView === 'admin' ? '#ff0000' : 'transparent' }}
                  onClick={() => { setCurrentView('admin'); setIsMobileMenuOpen(false); }}
                  title="ADMIN PANEL"
                >
                  <i className="fas fa-user-shield text-xs"></i>
                </button>
              )}

            </div>
          </div>
        </nav>
      )}
      {!showNavBar && (
        <button
          className="term-restore-btn"
          onClick={() => setShowNavBar(true)}
          title={language === 'es' ? 'RESTAURAR INTERFAZ' : 'RESTORE INTERFACE'}
        >
          <span className="term-restore-icon">▼</span>
          {language === 'es' ? 'DESPLEGAR_MENU' : 'EXPAND_MENU'}
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

  if (loading) return (
    <div className="app-loading">
      <div className="loading-container">

        {/* Título Glitch */}
        <h1 className="loading-glitch-text" data-text="LA_RESISTENCIA">
          LA_RESISTENCIA
        </h1>

        {/* Barra de Progreso Estilo Terminal */}
        <div className="loading-bar-container">
          <span className="loading-bar-text">ESTABLECIENDO CONEXIÓN SEGURA...</span>
          <div className="flex items-center gap-1">
            <span className="loading-bar-bracket">[</span>
            <div className="w-full h-5 bg-[#33ff00]/20 relative overflow-hidden">
              <div className="h-full bg-[#33ff00] animate-[shimmer_2s_infinite]"></div>
            </div>
            <span className="loading-bar-bracket">]</span>
          </div>
        </div>

        {/* Logs Simulados */}
        <div className="loading-logs">
          <div className="typewriter text-xs">
            <p>{'>'} SYSTEM_CHECK... OK</p>
            <p>{'>'} DECRYPTING ARCHIVES... OK</p>
            <p className="animate-pulse">{'>'} ACCESS GRANTED_</p>
          </div>
        </div>

      </div>
    </div>
  );

  return (
    <div className="App" ref={appRef}>
      <GlobalStyles />

      <video className="glitch-overlay" autoPlay muted loop playsInline>
        <source src="https://ia903404.us.archive.org/18/items/fondo_202511/Fondo.mp4" type="video/webm" />
      </video>

      {user ? <MainContent /> : <LandingPage onLoginSuccess={() => { }} onRequestFullscreen={requestAppFullscreen} />}
    </div>
  );
};

function App() {
  return (
    <AuthProvider>
      <LanguageProvider>
        <AppContent />
      </LanguageProvider>
    </AuthProvider>
  );
}

export default App;