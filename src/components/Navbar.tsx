// src/components/Navbar.tsx
import React from 'react';

interface NavbarProps {
  currentView: string;
  isAdmin: boolean;
  userEmail: string | undefined;
  onNavigate: (view: string) => void;
}

const Navbar: React.FC<NavbarProps> = ({ currentView, isAdmin, userEmail, onNavigate }) => {
  return (
    <nav className="elegant-navbar">
      <div className="navbar-logo">
        <h1>🏛️ La Resistencia</h1>
      </div>
      <div className="navbar-links">
        <button
          className={`nav-link-btn ${currentView === 'dashboard' ? 'active' : ''}`}
          onClick={() => onNavigate('dashboard')}
        >
          <span>🏠 Dashboard</span>
        </button>
        <button
          className={`nav-link-btn ${currentView === 'historias' ? 'active' : ''}`}
          onClick={() => onNavigate('historias')}
        >
          <span>📚 Historias</span>
        </button>
        <button
          className={`nav-link-btn ${currentView === 'mapa' ? 'active' : ''}`}
          onClick={() => onNavigate('mapa')}
        >
          <span>🗺️ Mapa</span>
        </button>
        <button
          className={`nav-link-btn ${currentView === 'inventario' ? 'active' : ''}`}
          onClick={() => onNavigate('inventario')}
        >
          <span>🎒 Inventario</span>
        </button>
        <button
          className={`nav-link-btn ${currentView === 'personajes' ? 'active' : ''}`}
          onClick={() => onNavigate('personajes')}
        >
          <span>🎭 Personajes</span>
        </button>
        
        
        {isAdmin && (
          <button
            className={`nav-link-btn ${currentView === 'admin' ? 'active' : ''}`}
            onClick={() => onNavigate('admin')}
          >
            <span>🛠️ Admin</span>
          </button>
        )}
        <button
          className={`nav-link-btn ${currentView === 'cine' ? 'active' : ''}`}
          onClick={() => onNavigate('cine')}
        >
          <span>🎬 Cine</span>
        </button>
      </div>
      <div className="navbar-user-info">
        <span>{userEmail}</span>
      </div>
    </nav>
  );
};

export default Navbar;