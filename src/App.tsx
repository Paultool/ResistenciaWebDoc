import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import AuthForm from './components/AuthForm';
import UserDashboard from './components/UserDashboard';
import PersonajesView from './components/PersonajesView';
import MapaView from './components/MapaView';
import InventarioView from './components/InventarioView';
import HistoriaDetail from './components/HistoriaDetail';
import AdminPanel from './components/AdminPanel';
import { supabase, testConnection, obtenerHistorias, Historia } from './supabaseClient';
import 'bootstrap/dist/css/bootstrap.min.css';
import '@fortawesome/fontawesome-free/css/all.min.css';
import './App.css';
import './components/HistoriaDetail.css';

// Componente para mostrar una historia individual
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

// Componente principal de contenido (cuando está autenticado)
const MainContent: React.FC = () => {
  const { user } = useAuth();
  
  // Estado para verificar si el usuario es administrador (hardcodeado)
  const [isAdmin, setIsAdmin] = useState(false);
  
  const [currentView, setCurrentView] = useState<'dashboard' | 'historias' | 'personajes' | 'mapa' | 'inventario' | 'admin'>('dashboard');
  const [historias, setHistorias] = useState<Historia[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [conexionOk, setConexionOk] = useState(false);
  const [selectedHistoriaId, setSelectedHistoriaId] = useState<number | null>(null);

  // Efecto para verificar conexión y cargar datos iniciales
  useEffect(() => {
    const inicializar = async () => {
      console.log('🔄 Inicializando aplicación La Resistencia...');
      
      // Verificar conexión a Supabase
      const conexionExitosa = await testConnection();
      setConexionOk(conexionExitosa);
      
      if (conexionExitosa) {
        // Hardcode la verificación del correo electrónico para el rol de administrador
        if (user?.email === 'paultool@gmail.com') {
          setIsAdmin(true);
        }

        await cargarHistorias();
      } else {
        setError('No se pudo conectar a la base de datos');
        setLoading(false);
      }
    };
    
    inicializar();
  }, [user]);

  // Función para cargar historias desde Supabase
  const cargarHistorias = async () => {
    try {
      setLoading(true);
      console.log('📚 Cargando historias...');
      
      const historiasData = await obtenerHistorias();
      setHistorias(historiasData);
      
      console.log(`✅ Se cargaron ${historiasData.length} historias`);
    } catch (err: any) {
      console.error('❌ Error cargando historias:', err);
      setError('Error al cargar las historias: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleNavigateFromDashboard = (view: string) => {
    console.log(`🗺️ Navegando desde dashboard a: ${view}`);
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

  // Renderizar vista actual
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
        return <MapaView onBack={handleBackToDashboard} />;
      
      case 'inventario':
        return <InventarioView onBack={handleBackToDashboard} />;

      case 'admin':
        return <AdminPanel />;
      
      default:
        return <UserDashboard onNavigate={handleNavigateFromDashboard} />;
    }
  };

  return (
    <div className="app-authenticated">
      <nav className="app-navbar">
        <div className="navbar-brand">
          <h1>🏛️ La Resistencia</h1>
        </div>
        <div className="navbar-nav">
          <button
            className={`nav-btn ${currentView === 'dashboard' ? 'active' : ''}`}
            onClick={() => setCurrentView('dashboard')}
          >
            🏠 Dashboard
          </button>
          <button
            className={`nav-btn ${currentView === 'historias' ? 'active' : ''}`}
            onClick={() => setCurrentView('historias')}
          >
            📚 Historias
          </button>
          <button
            className={`nav-btn ${currentView === 'personajes' ? 'active' : ''}`}
            onClick={() => setCurrentView('personajes')}
          >
            🎭 Personajes
          </button>
          <button
            className={`nav-btn ${currentView === 'mapa' ? 'active' : ''}`}
            onClick={() => setCurrentView('mapa')}
          >
            🗺️ Mapa
          </button>
          <button
            className={`nav-btn ${currentView === 'inventario' ? 'active' : ''}`}
            onClick={() => setCurrentView('inventario')}
          >
            🎒 Inventario
          </button>
          {isAdmin && (
            <button
              className={`nav-btn ${currentView === 'admin' ? 'active' : ''}`}
              onClick={() => setCurrentView('admin')}
            >
              🛠️ Admin
            </button>
          )}
        </div>
        <div className="navbar-user">
          <span className="user-email">{user?.email}</span>
        </div>
      </nav>

      <main className="app-main">
        {selectedHistoriaId ? (
          <HistoriaDetail
            historiaId={selectedHistoriaId}
            onClose={closeDetail}
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