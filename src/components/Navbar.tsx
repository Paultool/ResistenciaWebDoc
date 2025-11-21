// src/components/Navbar.tsx
import React from 'react'
import '../styles/resistance-theme.css'
import './Navbar.css'

interface NavbarProps {
  currentView: string
  isAdmin: boolean
  userEmail: string | undefined
  onNavigate: (view: string) => void
  playerLevel?: number
}

const Navbar: React.FC<NavbarProps> = ({
  currentView,
  isAdmin,
  userEmail,
  onNavigate,
  playerLevel = 1
}) => {
  return (
    <nav className="resistance-navbar scanlines">
      {/* Logo/Brand */}
      <div className="navbar-brand">
        <span className="brand-bracket mono-text-green">[</span>
        <span className="brand-text mono-text-amber">RESISTENCIA</span>
        <span className="brand-bracket mono-text-green">]</span>
      </div>

      {/* Navigation Links */}
      <div className="navbar-links">
        <button
          className={`nav-link ${currentView === 'dashboard' ? 'active' : ''}`}
          onClick={() => onNavigate('dashboard')}
        >
          <span className="nav-prefix">&gt;</span>
          <span className="nav-text">DASHBOARD</span>
        </button>

        <button
          className={`nav-link ${currentView === 'historias' ? 'active' : ''}`}
          onClick={() => onNavigate('historias')}
        >
          <span className="nav-prefix">&gt;</span>
          <span className="nav-text">HISTORIAS</span>
        </button>

        <button
          className={`nav-link ${currentView === 'mapa' ? 'active' : ''}`}
          onClick={() => onNavigate('mapa')}
        >
          <span className="nav-prefix">&gt;</span>
          <span className="nav-text">MAPA</span>
        </button>

        <button
          className={`nav-link ${currentView === 'inventario' ? 'active' : ''}`}
          onClick={() => onNavigate('inventario')}
        >
          <span className="nav-prefix">&gt;</span>
          <span className="nav-text">INVENTARIO</span>
        </button>

        <button
          className={`nav-link ${currentView === 'personajes' ? 'active' : ''}`}
          onClick={() => onNavigate('personajes')}
        >
          <span className="nav-prefix">&gt;</span>
          <span className="nav-text">PERSONAJES</span>
        </button>

        {isAdmin && (
          <button
            className={`nav-link ${currentView === 'admin' ? 'active' : ''}`}
            onClick={() => onNavigate('admin')}
          >
            <span className="nav-prefix">&gt;</span>
            <span className="nav-text">ADMIN</span>
          </button>
        )}

        <button
          className={`nav-link ${currentView === 'cine' ? 'active' : ''}`}
          onClick={() => onNavigate('cine')}
        >
          <span className="nav-prefix">&gt;</span>
          <span className="nav-text">CINE</span>
        </button>
      </div>

      {/* User Info */}
      <div className="navbar-user">
        <div className="user-level terminal-badge">
          LVL {playerLevel}
        </div>
        <div className="user-email mono-text-muted">
          {userEmail?.split('@')[0] || 'AGENTE'}
        </div>
      </div>
    </nav>
  )
}

export default Navbar