import React, { useState, useEffect, useRef } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import AuthForm from './components/AuthForm';
import UserDashboard from './components/UserDashboard';
import PersonajesView from './components/PersonajesView';
import MapaView from './components/MapaView';
import InventarioView from './components/InventarioView';
import HistoriaDetail from './components/HistoriaDetail';
import AdminPanel from './components/AdminPanel';
import FlujoNarrativoUsuario from './components/FlujoNarrativoUsuario';
import Navbar from './components/Navbar'; // Importa el nuevo componente Navbar

import { supabase, testConnection, obtenerHistorias, Historia, obtenerRecursosMultimedia } from './supabaseClient';
import 'bootstrap/dist/css/bootstrap.min.css';
import '@fortawesome/fontawesome-free/css/all.min.css';
import './App.css';
import './components/HistoriaDetail.css';

// ==========================================================
// --- Componentes y hooks de la experiencia cinematográfica ---
// ==========================================================
const supabaseUrl = 'https://atogaijnlssrgkvilsyp.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF0b2dhaWpubHNzcmdrdmlsc3lwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY4NTU3NDQsImV4cCI6MjA3MjQzMTc0NH0.4wwaY-aOZMMHstVkSh3uh3awRhv14pPJW9Xv6jGDZ98'; 

const useCinematicTransition = (view, setView) => {
  const [inTransition, setInTransition] = React.useState(false);
  const [nextView, setNextView] = React.useState(null);

  const navigateTo = (targetView) => {
    setInTransition(true);
    setNextView(targetView);
    setTimeout(() => {
      setView(targetView);
      setInTransition(false);
    }, 1000);
  };

  return { navigateTo, inTransition, nextView };
};

const IntroScreen = ({ navigateTo }) => (
  <div className="cinematic-view">
    <div className="intro-container">
      <h1 className="cinematic-title">LA RESISTENCIA</h1>
      <p className="cinematic-subtitle">Una experiencia interactiva cinematográfica</p>
      <div className="flex flex-col md:flex-row gap-4 mt-8">
        <button 
          className="cinematic-btn"
          onClick={() => navigateTo('story-selection')}
        >
          <span>Explorar la Narrativa</span>
        </button>
        <button 
          className="cinematic-btn cinematic-btn-map"
          onClick={() => navigateTo('mapa')}
        >
          <span>Ver Historias en el Mapa</span>
        </button>
      </div>
    </div>
  </div>
);

const StorySelection = ({ navigateTo, onSelectStory, historias, loading, error }) => {
  if (loading) {
    return (
      <div className="cinematic-view flex items-center justify-center">
        <div className="loading-spinner"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="cinematic-view flex items-center justify-center text-center p-4">
        <p className="error-message text-red-400">{error}</p>
      </div>
    );
  }

  return (
    <div className="cinematic-view">
      <div className="story-selection-container">
        <h2 className="section-title">SELECCIONA UNA HISTORIAS</h2>
        <div className="story-cards-grid">
          {historias.map(story => (
            <div key={story.id} className="story-card" onClick={() => onSelectStory(story)}>
              <div className="story-card-overlay"></div>
              <img src={`https://placehold.co/1200x800/333/fff?text=${encodeURIComponent(story.titulo)}`} alt={story.titulo} className="story-card-image" />
              <div className="story-card-content">
                <h3>{story.titulo}</h3>
                <p className="narrative-snippet">{story.descripcion}</p>
                <button className="cinematic-btn-sm">
                  <span>INICIAR</span>
                </button>
              </div>
            </div>
          ))}
        </div>
        <button 
          className="btn-back"
          onClick={() => navigateTo('intro')}
        >
          ← Volver
        </button>
      </div>
    </div>
  );
};

const NarrativeFlow = ({ navigateTo, currentStory, userProfile, onUpdateProfile }) => {
  const [pasos, setPasos] = React.useState([]);
  const [pasoIndex, setPasoIndex] = React.useState(0);
  const [isLoading, setIsLoading] = React.useState(true);
  const currentPaso = pasos[pasoIndex];
  const supabaseClient = supabase;

  React.useEffect(() => {
    const fetchNarrativeFlow = async () => {
      setIsLoading(true);
      if (!supabaseClient || !currentStory) {
        setIsLoading(false);
        return;
      }
      try {
        const { data, error } = await supabaseClient
          .from('flujo_narrativo')
          .select('*, recursomultimedia(*), recompensa(*)')
          .eq('id_historia', currentStory.id_historia)
          .order('orden', { ascending: true });

        if (error) {
          console.error("Supabase error fetching narrative flow:", error.message);
          throw error;
        }
        
        setPasos(data);
        setPasoIndex(0);
      } catch (err) {
        console.error("Error fetching narrative flow:", err.message);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchNarrativeFlow();
  }, [currentStory, supabaseClient]);

  const handleNextStep = (nextPasoId) => {
    const nextIndex = pasos.findIndex(p => p.id_flujo === nextPasoId);
    
    if (nextIndex !== -1) {
      setPasoIndex(nextIndex);
    } else {
      navigateTo('profile');
    }
  };
  
  const handleDecision = async (opcion) => {
    setIsLoading(true);
    
    const recompensa = currentPaso?.recompensa;

    if (currentPaso.tipo_paso === 'pregunta' && recompensa) {
      if (opcion.recompensa_positiva === recompensa.id_recompensa) {
        console.log(`¡Has ganado una recompensa positiva: ${recompensa.nombre}!`);
        onUpdateProfile(recompensa.valor, 0, currentStory.id_ubicacion?.nombre);
      } else if (opcion.recompensa_negativa === recompensa.id_recompensa) {
        console.log(`¡Has ganado una recompensa negativa: ${recompensa.nombre}!`);
        onUpdateProfile(0, recompensa.valor, currentStory.id_ubicacion?.nombre);
      }
    }
    
    setTimeout(() => {
      handleNextStep(opcion.siguiente_paso_id);
      setIsLoading(false);
    }, 1000);
  };
  
  const renderMedia = (recurso) => {
    if (!recurso || !recurso.archivo) {
      return null;
    }
    
    let mediaUrl;
    if (recurso.archivo.startsWith('http')) {
      mediaUrl = recurso.archivo;
    } else {
      mediaUrl = `${supabaseUrl}/storage/v1/object/public/Recursos_Multimedia/${recurso.archivo}`;
    }
    
    switch (recurso.tipo) {
      case 'imagen':
        return <img src={mediaUrl} alt="Media" className="narrative-media" onError={() => console.error(`Error al cargar la imagen: ${mediaUrl}`)} />;
      case 'video':
        return <video src={mediaUrl} controls className="narrative-media" onError={() => console.error(`Error al cargar el video: ${mediaUrl}`)} />;
      case 'audio':
        return <audio src={mediaUrl} controls className="w-full mt-4" onError={() => console.error(`Error al cargar el audio: ${mediaUrl}`)} />;
      default:
        return null;
    }
  };

  if (isLoading || !currentPaso) {
    return (
      <div className="cinematic-view flex items-center justify-center">
        <div className="loading-spinner"></div>
      </div>
    );
  }

  const opciones = currentPaso.opciones_decision?.opciones_siguientes_json || [];

  return (
    <div className="cinematic-view">
      <div className="narrative-container">
        <h2 className="narrative-title">{currentStory.titulo}</h2>
        <div className="narrative-box">
          {renderMedia(currentPaso.recursomultimedia)}
          <p className="narrative-text">
            {currentPaso.contenido}
          </p>
          {currentPaso.recompensa && (
            <div className="recompensa-box">
              <span role="img" aria-label="recompensa">🎁</span> Recompensa: {currentPaso.recompensa.nombre}
            </div>
          )}
          {currentPaso.tipo_paso === 'pregunta' && (
            <div className="options-container">
              {opciones.map((opcion, index) => (
                <button 
                  key={index} 
                  className="option-btn"
                  onClick={() => handleDecision(opcion)}
                >
                  {opcion.texto}
                </button>
              ))}
            </div>
          )}
          {currentPaso.tipo_paso !== 'pregunta' && (
            <button 
              className="cinematic-btn mt-8"
              onClick={() => {
                if (currentPaso.id_siguiente_paso) {
                  handleNextStep(currentPaso.id_siguiente_paso);
                } else {
                  navigateTo('profile');
                }
              }}
            >
              <span>{currentPaso.id_siguiente_paso === null ? 'Ver mi Perfil' : 'Siguiente'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

const UserCineProfile = ({ navigateTo, profile }) => (
  <div className="cinematic-view">
    <div className="profile-container">
      <h2 className="section-title">TU PERFIL DE RESISTENCIA</h2>
      <div className="profile-chart">
        <div className="chart-bar positive">
          <div className="bar-fill" style={{ width: `${(profile.xp_total > 0 ? profile.xp_total : 0) * 1}%` }}></div>
          <span className="bar-label">ACUMULACIÓN POSITIVA: {profile.xp_total}</span>
        </div>
        <div className="chart-bar negative">
          <div className="bar-fill" style={{ width: `0%` }}></div>
          <span className="bar-label">ACUMULACIÓN NEGATIVA: 0</span>
        </div>
      </div>
      <p className="profile-summary">
        Tus decisiones han forjado un perfil de carácter único. Dependiendo de los valores que has acumulado, tu perspectiva sobre la resistencia se ha definido. Este análisis nos ayuda a comprender cómo te posicionas en el entorno de la ciudad.
      </p>
      <button 
        className="cinematic-btn mt-12"
        onClick={() => navigateTo('dashboard')}
      >
        <span>Volver al Dashboard</span>
      </button>
    </div>
  </div>
);

// ==========================================================
// --- Componente para mostrar una historia individual ---
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
  const [historias, setHistorias] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [conexionOk, setConexionOk] = useState(false);
  const [selectedHistoriaId, setSelectedHistoriaId] = useState<number | null>(null);
  const [selectedStory, setSelectedStory] = useState(null);
  const [userProfile, setUserProfile] = useState({ user_id: null, xp_total: 0, ubicaciones_visitadas: [] });
  const { navigateTo } = useCinematicTransition(currentView, setCurrentView);
  const [flujoNarrativoHistoriaId, setFlujoNarrativoHistoriaId] = useState<number | null>(null);
  const [view, setView] = useState('dashboard');
  const [historiaId, setHistoriaId] = useState<number | null>(null);
  const supabaseClient = supabase;

  const handleStartNarrative = (historia: Historia) => {
    setFlujoNarrativoHistoriaId(historia.id_historia);
  };

  useEffect(() => {
    const inicializar = async () => {
      console.log('🔄 Inicializando aplicación La Resistencia...');
      
      const conexionExitosa = await testConnection();
      setConexionOk(conexionExitosa);
      
      if (conexionExitosa) {
        if (user?.email === 'paultool@gmail.com') {
          setIsAdmin(true);
        }

        await cargarHistorias();
        await setupProfile();
      } else {
        setError('No se pudo conectar a la base de datos');
        setLoading(false);
      }
    };
    
    inicializar();
  }, [user]);

  const cargarHistorias = async () => {
    try {
      setLoading(true);
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

  const handleUpdateProfile = async (recompensaPositiva, recompensaNegativa, ubicacion) => {
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
  };

  const handleViewDetail = (historiaId: number) => {
    setSelectedHistoriaId(historiaId);
  };

  const handleSelectStory = (story) => {
    setSelectedStory(story);
    navigateTo('narrative-flow');
  };

  const closeDetail = () => {
    setSelectedHistoriaId(null);
  };

  const renderCurrentView = () => {
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
            
            {loading && (
              <div className="loading">
                <p>⏳ Cargando historias...</p>
              </div>
            )}

            {error && (
              <div className="error">
                <p>❌ {error}</p>
                <button onClick={cargarHistorias} className="retry-btn">
                  🔄 Reintentar
                </button>
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
                      <HistoriaCard
                        key={historia.id}
                        historia={historia}
                        onViewDetail={handleViewDetail}
                      />
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
        return <AdminPanel />;
      
      // Nuevas vistas cinematográficas
      case 'intro':
          return <IntroScreen navigateTo={navigateTo} />;
      case 'story-selection':
          return <StorySelection 
              navigateTo={navigateTo} 
              onSelectStory={handleSelectStory}
              historias={historias}
              loading={loading}
              error={error}
          />;
      case 'narrative-flow':
          return <NarrativeFlow 
              navigateTo={navigateTo} 
              currentStory={selectedStory}
              userProfile={userProfile}
              onUpdateProfile={handleUpdateProfile}
          />;
      case 'profile':
          return <UserCineProfile navigateTo={navigateTo} profile={userProfile} />;
      case 'cine':
          return <FlujoNarrativoUsuario onBack={handleBackToDashboard} />;
      
      default:
        return <UserDashboard onNavigate={handleNavigateFromDashboard} />;
    }
  };

  return (
    <div className="app-authenticated">
      {/* Usa el nuevo componente Navbar aquí */}
      <Navbar
        currentView={currentView}
        isAdmin={isAdmin}
        userEmail={user?.email}
        onNavigate={setCurrentView}
      />

      <main className="app-main">
        {selectedHistoriaId ? (
          <HistoriaDetail
            historiaId={selectedHistoriaId}
            onClose={closeDetail}
            onStartNarrative={handleStartNarrative} 
          />
        ) : (
          renderCurrentView()
        )}
      </main>
    </div>
  );
};

// Componente principal de la aplicación
function App(): JSX.Element {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

// Contenido de la aplicación que usa el contexto de auth
const AppContent: React.FC = () => {
  const { user, loading } = useAuth();

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
    <div className="App">
      {user ? (
        <MainContent />
      ) : (
        <>
          <div className="hero-section">
            <div className="hero-content">
              <h1>🏛️ WebDoc La Resistencia</h1>
              <p className="hero-subtitle">
                Narrativa urbana interactiva sobre la resistencia social en Ciudad de México
              </p>
              <div className="hero-features">
                <span className="feature">📚 Historias Interactivas</span>
                <span className="feature">🎭 Personajes Memorables</span>
                <span className="feature">🗺️ Mapas Georeferenciados</span>
                <span className="feature">🎆 Sistema RPG</span>
              </div>
            </div>
          </div>
          <AuthForm />
        </>
      )}
    </div>
  );
};

export default App;