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
import CharacterDossier from './components/CharacterDossier';

import { supabase, testConnection, obtenerHistorias, Historia, obtenerFichaPersonajePorId, Personaje } from './supabaseClient';
import { gameServiceUser as gameService } from './services/GameServiceUser';
import StatsModal from './components/StatsModal';
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
  const [isBuffering, setIsBuffering] = useState(false);

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
  // VIDEO SOURCES
  // Desktop: Video original
  const desktopVideoSrc = "https://archive.org/download/intro_resistencia/intro%20resistencia%20.mp4";
  // Mobile: Optimizado (<720p, ~1-1.5Mbps)
  const mobileVideoSrc = "https://archive.org/download/intro_mobile/intro_mobile.mp4";

  const [videoSrc, setVideoSrc] = useState(() => window.innerWidth < 768 ? mobileVideoSrc : desktopVideoSrc);

  useEffect(() => {
    const handleResize = () => {
      const isMobile = window.innerWidth < 768;
      const newSrc = isMobile ? mobileVideoSrc : desktopVideoSrc;
      setVideoSrc(prev => {
        if (prev !== newSrc) return newSrc;
        return prev;
      });
    };

    // Check on resize (orientation change)
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ${isBuffering ? 'opacity-40' : 'opacity-70'}`}
          autoPlay loop={false} muted={isMuted} playsInline
          preload="auto"
          poster="/movie_poster_realistic.png"
          src={videoSrc} key={videoSrc}
          onEnded={handleVideoEnd}
          onWaiting={() => setIsBuffering(true)}
          onPlaying={() => setIsBuffering(false)}
          onCanPlay={() => setIsBuffering(false)}
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

        {/* BUFFERING INDICATOR */}
        {isBuffering && (
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 flex flex-col items-center pointer-events-none">
            <div className="w-12 h-12 border-4 border-[#33ff00] border-t-transparent rounded-full animate-spin mb-4"></div>
            <span className="text-[#33ff00] bg-black/50 px-2 font-mono text-xs tracking-widest animate-pulse">ESTABLECIENDO SEÑAL...</span>
          </div>
        )}
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
              className="landing-glitch-title mb-10 select-none z-10"
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
interface MainContentProps {
  onRequestFullscreen: () => void;
}

const MainContent: React.FC<MainContentProps> = ({ onRequestFullscreen }) => {
  const { user, signOut } = useAuth();
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

  const [userStats, setUserStats] = useState<any>(null);
  const [activeStatModal, setActiveStatModal] = useState<'missions' | 'contacts' | 'locations' | 'merits' | 'resources' | null>(null);
  const [statModalData, setStatModalData] = useState<any[] | null>(null);
  const [loadingStatModal, setLoadingStatModal] = useState(false);
  const [selectedCharacterForDossier, setSelectedCharacterForDossier] = useState<Personaje | null>(null);

  const handleViewDossier = async (characterBasic: any) => {
    // characterBasic might just have 'nombre' if it's from the old stats
    // But we need the ID to fetch full details.
    setLoadingStatModal(true);
    try {
      let characterId = characterBasic.id_personaje || characterBasic.id;

      // If no ID, we have to search by name in the 'personaje' table
      if (!characterId) {
        const { data, error } = await supabase
          .from('personaje')
          .select('id_personaje')
          .eq('nombre', characterBasic.nombre)
          .single();

        if (!error && data) {
          characterId = data.id_personaje;
        }
      }

      if (characterId) {
        const fullDetails = await obtenerFichaPersonajePorId(characterId);
        if (fullDetails) {
          setSelectedCharacterForDossier(fullDetails);
        }
      } else {
        console.error("No se pudo encontrar el ID del personaje:", characterBasic.nombre);
      }
    } catch (error) {
      console.error("Error al cargar expediente:", error);
    } finally {
      setLoadingStatModal(false);
    }
  };

  const getRankName = (lvl: number) => {
    if (lvl >= 10) return 'LEYENDA';
    if (lvl >= 7) return 'COMANDANTE';
    if (lvl >= 5) return 'VETERANO';
    if (lvl >= 3) return 'EXPLORADOR';
    return 'RECLUTA';
  };

  useEffect(() => {
    const init = async () => {
      if (user) {
        setIsAdmin(user.email === 'paultool@gmail.com');
        const hist = await obtenerHistorias();
        setHistorias(hist);

        // Cargar perfil y stats globalmente
        const loadStats = async () => {
          const stats = await gameService.getPlayerStats(user.id);
          if (stats) {
            setUserStats({
              missions: stats.historias_completadas,
              contacts: (stats.personajes_conocidos || []).length,
              locations: (stats.historias_visitadas || []).length, // Placeholder, updated below
              merits: (stats.logros_desbloqueados || []).length,
              resources: (stats.inventario || []).length,
              xp: stats.xp_total,
              nivel: stats.nivel || 1
            });

            // Calculate unique locations based on stories
            if (stats.historias_visitadas?.length > 0) {
              const hIds = stats.historias_visitadas.map((id: string) => Number(id)).filter((id: number) => !isNaN(id));
              if (hIds.length > 0) {
                const { data: storiesData } = await supabase
                  .from('historia')
                  .select('id_ubicacion')
                  .in('id_historia', hIds);
                if (storiesData) {
                  const uniqueLocs = new Set(storiesData.filter(s => s.id_ubicacion).map(s => s.id_ubicacion));
                  setUserStats((prev: any) => ({ ...prev, locations: uniqueLocs.size }));
                }
              }
            }
          } else {
            await supabase.from('perfiles_jugador').insert({ user_id: user.id });
          }
        };
        loadStats();

        // Polling para actualizar stats (opcional, o usar suscripción)
        const interval = setInterval(loadStats, 30000);
        return () => clearInterval(interval);
      }
    };
    init();
  }, [user]);

  // Traducciones para la barra de navegación
  const navTranslations = {
    es: {
      missions: 'MISIONES',
      contacts: 'CONTACTOS',
      locations: 'TOTAL UBICACIONES',
      merits: 'LOGROS',
      resources: 'RECURSOS'
    },
    en: {
      missions: 'MISSIONS',
      contacts: 'CONTACTS',
      locations: 'TOTAL LOCATIONS',
      merits: 'ACHIEVEMENTS',
      resources: 'RESOURCES'
    }
  };
  const t = navTranslations[language === 'en' ? 'en' : 'es'];

  const handleStatClick = async (type: 'missions' | 'contacts' | 'locations' | 'merits' | 'resources') => {
    if (!user?.id) return;
    setActiveStatModal(type);
    setLoadingStatModal(true);
    try {
      let data;
      switch (type) {
        case 'missions': data = await gameService.getCompletedStories(user.id); break;
        case 'contacts': data = await gameService.getKnownCharacters(user.id); break;
        case 'locations': data = await gameService.getVisitedLocations(user.id); break;
        case 'merits': data = await gameService.getUnlockedRewards(user.id); break;
        case 'resources': data = await gameService.getInventoryItems(user.id); break;
      }
      setStatModalData(data);
    } catch (e) {
      console.error(e);
      setStatModalData([]);
    } finally {
      setLoadingStatModal(false);
    }
  };

  const handleStartNarrative = (historia: Historia) => {
    setFlujoNarrativoHistoriaId(historia.id);
    setCurrentView('historias');
  };

  const handleStartNarrativeFromMap = (historiaId: number) => {
    setFlujoNarrativoHistoriaId(historiaId);
    setCurrentView('historias');
  };

  const handleUpdateProfile = async (pos: number, neg: number, loc: string) => {
    if (userProfile && user) {
      const xp = userProfile.xp_total + pos + neg;
      const nivel = Math.floor(Math.sqrt(xp / 100)) + 1;
      const { data: updatedStats } = await supabase
        .from('perfiles_jugador')
        .update({
          xp_total: xp,
          nivel: nivel
        })
        .eq('user_id', user.id)
        .select()
        .single();

      if (updatedStats) {
        setUserProfile(updatedStats);
        setUserStats((prev: any) => ({
          ...prev,
          xp: updatedStats.xp_total,
          nivel: updatedStats.nivel
        }));
      }
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
        <nav className="term-navbar unified-header" style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          height: '48px', padding: '0 10px', background: '#000', borderBottom: '1px solid #33ff00'
        }}>

          {/* 1. LEFT: LOGO (Home) */}
          <button
            onClick={() => setCurrentView('dashboard')}
            className="term-logo-btn flex items-center gap-2 hover:bg-[#33ff00]/10 px-2 rounded transition-colors group"
            title="DASHBOARD / HOME"
          >
            <span className="term-cursor text-[#33ff00] font-bold">{'>'}</span>
            <h1 className="text-[#33ff00] font-bold font-mono tracking-tighter text-sm md:text-base mb-0">
              <span className="hidden sm:inline">LA_RESISTENCIA</span>
              <span className="sm:hidden">LR</span>
            </h1>
          </button>

          {/* 2. CENTER: COMMAND BAR (Stats + XP) */}
          <div className="flex-1 flex flex-nowrap justify-center items-center gap-1 md:gap-6 mx-1 md:mx-2 overflow-x-auto scrollbar-hide">

            {/* XP WIDGET */}
            <div className="flex flex-col justify-center min-w-[60px] md:min-w-[150px] relative group cursor-help shrink-0">
              <div className="flex justify-between w-full text-[8px] text-[#33ff00]/70 font-mono mb-[2px]">
                {(() => {
                  const currentXP = userStats?.xp || 0;
                  const lvl = Math.floor(Math.sqrt(Math.max(0, currentXP) / 100)) + 1;
                  return (
                    <>
                      <span className="font-bold">LVL.{lvl} - {getRankName(lvl)}</span>
                      <span className="hidden lg:inline">{currentXP} XP</span>
                    </>
                  );
                })()}
              </div>
              <div className="w-full h-1 bg-[#001100] border border-[#33ff00]/30 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#33ff00]"
                  style={{
                    width: (() => {
                      const currentXP = userStats?.xp || 0;
                      const lvl = Math.floor(Math.sqrt(Math.max(0, currentXP) / 100)) + 1;
                      const baseXP = Math.pow(lvl - 1, 2) * 100;
                      const nextXP = Math.pow(lvl, 2) * 100;
                      const progress = ((currentXP - baseXP) / (nextXP - baseXP)) * 100;
                      return `${Math.min(100, Math.max(0, progress))}%`;
                    })()
                  }}
                ></div>
              </div>
            </div>

            {/* STATS ICONS */}
            <div className="flex flex-nowrap items-center gap-1 md:gap-2 shrink-0">
              {[
                { id: 'missions', icon: 'fa-folder', count: userStats?.missions, label: t.missions },
                { id: 'contacts', icon: 'fa-address-book', count: userStats?.contacts, label: t.contacts },
                { id: 'locations', icon: 'fa-map-marker-alt', count: userStats?.locations, label: t.locations },
                { id: 'merits', icon: 'fa-medal', count: userStats?.merits, label: t.merits },
                { id: 'resources', icon: 'fa-box-open', count: userStats?.resources, label: t.resources }
              ].map((stat) => (
                <button
                  key={stat.id}
                  onClick={() => handleStatClick(stat.id as any)}
                  className="flex items-center justify-center w-8 h-8 md:w-auto md:px-2 md:py-1 rounded hover:bg-[#33ff00]/20 transition-all group relative"
                  title={stat.label}
                >
                  <i className={`fas ${stat.icon} text-xs md:text-sm text-[#33ff00] group-hover:scale-110 transition-transform`}></i>
                  <span className="absolute top-0 right-0 md:static md:ml-1 text-[9px] md:text-xs font-bold text-white md:text-[#33ff00] bg-red-600 md:bg-transparent px-1 rounded-full md:px-0 leading-none">
                    {stat.count || 0}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* 3. RIGHT: UTILITIES (OP, Admin, CC, Fullscreen, Hide) */}
          <div className="flex items-center gap-2 md:gap-3 text-[#33ff00]">

            {/* OP INFO (Desktop Only) */}
            <div className="hidden lg:flex items-center text-[10px] font-mono border-r border-[#33ff00]/30 pr-3 mr-1">
              <span className="opacity-50 mr-1">OP:</span> {user?.email?.split('@')[0] || 'GHOST'}
            </div>

            {/* ADMIN */}
            {isAdmin && (
              <button onClick={() => setCurrentView('admin')} className="hover:text-white" title="ADMIN PANEL">
                <i className="fas fa-user-shield text-xs"></i>
              </button>
            )}

            {/* CC / LANG */}
            <button onClick={toggleLanguage} className="hover:text-white font-bold text-[10px]" title="SWITCH LANGUAGE">
              {language === 'es' ? 'ES' : 'EN'}
            </button>

            {/* FULLSCREEN */}
            <button onClick={onRequestFullscreen} className="hover:text-white hidden md:block" title="FULLSCREEN">
              <i className="fas fa-expand text-xs"></i>
            </button>

            {/* HIDE GUI */}
            <button onClick={() => setShowNavBar(false)} className="hover:text-red-500 transition-colors" title="HIDE HEADER">
              <i className="fas fa-eye-slash text-xs"></i>
            </button>

            {/* EXIT */}
            <button
              onClick={() => { if (window.confirm('¿Cerrar sesión?')) signOut(); }}
              className="text-red-600 hover:text-red-400 font-bold ml-1 flex items-center justify-center w-8 h-8 rounded hover:bg-red-600/10 transition-colors"
              title="LOGOUT / SALIR"
            >
              <i className="fas fa-sign-out-alt text-base"></i>
            </button>
          </div>

        </nav>
      )}

      {/* RESTORE BUTTON (Floating) */}
      {!showNavBar && (
        <div className="fixed top-2 right-2 z-50 flex flex-col gap-2">
          <button
            className="bg-black/80 text-[#33ff00] border border-[#33ff00] w-8 h-8 flex items-center justify-center rounded hover:bg-[#33ff00] hover:text-black transition-all"
            onClick={() => setShowNavBar(true)}
            title="SHOW HEADER"
          >
            <i className="fas fa-eye text-xs"></i>
          </button>
          <button
            className="bg-black/80 text-red-600 border border-red-600 w-8 h-8 flex items-center justify-center rounded hover:bg-red-600 hover:text-white transition-all"
            onClick={() => { if (window.confirm('¿Cerrar sesión?')) signOut(); }}
            title="LOGOUT / SALIR"
          >
            <i className="fas fa-sign-out-alt text-xs"></i>
          </button>
        </div>
      )}
      <div className="term-main-content">
        {renderCurrentView()}
      </div>

      {/* STATS MODAL GLOBAL */}
      <StatsModal
        activeModal={activeStatModal}
        onClose={() => setActiveStatModal(null)}
        data={statModalData}
        loading={loadingStatModal}
        language={language}
        onViewDossier={handleViewDossier}
      />

      {selectedCharacterForDossier && (
        <CharacterDossier
          character={selectedCharacterForDossier}
          language={language}
          onClose={() => setSelectedCharacterForDossier(null)}
        />
      )}
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
        <source src="https://archive.org/download/fondo_202511/Fondo.mp4" type="video/mp4" />
      </video>

      {!user ? (
        <LandingPage
          onLoginSuccess={() => { }}
          onRequestFullscreen={requestAppFullscreen}
        />
      ) : (
        <MainContent onRequestFullscreen={requestAppFullscreen} />
      )}
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