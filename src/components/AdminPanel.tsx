import React, { useState } from 'react'
import AdminHistorias from './AdminHistorias'
import AdminPersonajes from './AdminPersonajes'
import AdminUbicaciones from './AdminUbicaciones'
import AdminUsuarios from './AdminUsuarios'
import AdminConfig from './AdminConfig'
import AdminRecursosMultimedia from './AdminRecursosMultimedia'
import AdminRecompensas from './AdminRecompensas'
import AdminFlujoNarrativo from './AdminFlujoNarrativo'
import AdminCanvas from './AdminCanvas'
import './AdminPanel.css'

// Todas las vistas posibles
type AdminView = 
  | 'canvas' 
  | 'historias' 
  | 'personajes' 
  | 'ubicaciones' 
  | 'flujo_tabla' 
  | 'recursos' 
  | 'recompensas' 
  | 'usuarios' 
  | 'config';

const AdminPanel: React.FC = () => {
  const [currentView, setCurrentView] = useState<AdminView>('canvas');

  const renderContent = () => {
    switch (currentView) {
      case 'canvas': return <AdminCanvas />;
      case 'historias': return <AdminHistorias />;
      case 'personajes': return <AdminPersonajes />;
      case 'ubicaciones': return <AdminUbicaciones />;
      case 'flujo_tabla': return <AdminFlujoNarrativo />;
      case 'recursos': return <AdminRecursosMultimedia />;
      case 'recompensas': return <AdminRecompensas />;
      case 'usuarios': return <AdminUsuarios />;
      case 'config': return <AdminConfig />;
      default: return <div className="admin-welcome">Seleccione una opción del menú</div>;
    }
  }

  const isActive = (view: AdminView) => currentView === view ? 'active' : '';

  return (
    <div className="admin-layout-container">
      {/* SUB-NAVBAR: Menú completo */}
      <div className="admin-sub-navbar">
        <div className="admin-brand">🛠️ ADMIN PANEL</div>
        <nav className="admin-nav-links">
          <button className={isActive('canvas')} onClick={() => setCurrentView('canvas')}>🎨 Editor Visual</button>
          <div className="nav-separator">|</div>
          <button className={isActive('historias')} onClick={() => setCurrentView('historias')}>📚 Historias</button>
          <button className={isActive('flujo_tabla')} onClick={() => setCurrentView('flujo_tabla')}>📜 Flujo (Tabla)</button>
          <button className={isActive('personajes')} onClick={() => setCurrentView('personajes')}>🎭 Personajes</button>
          <button className={isActive('ubicaciones')} onClick={() => setCurrentView('ubicaciones')}>🗺️ Ubicaciones</button>
          <button className={isActive('recursos')} onClick={() => setCurrentView('recursos')}>🖼️ Multimedia</button>
          <button className={isActive('recompensas')} onClick={() => setCurrentView('recompensas')}>🎁 Recompensas</button>
          <div className="nav-separator">|</div>
          <button className={isActive('config')} onClick={() => setCurrentView('config')}>⚙️ Sistema</button>
        </nav>
      </div>

      {/* AREA PRINCIPAL */}
      <div className="admin-main-content">
        {renderContent()}
      </div>
    </div>
  )
}

export default AdminPanel;