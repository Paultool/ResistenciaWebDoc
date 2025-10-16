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

      case 'cine':
          return <FlujoNarrativoUsuario onBack={handleBackToDashboard} />;
      
      default:
        return <UserDashboard onNavigate={handleNavigateFromDashboard} />;
    }
  };

  return (
    <div className="app-authenticated">
      {/* Usa el nuevo componente Navbar aquí */}
   
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