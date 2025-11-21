import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ErrorBoundary } from './components/ErrorBoundary.tsx'
import './index.css'
import App from './App.tsx'

// 1. Importamos el componente de envoltura del Canvas SEOManager.jsx
import { RootComponentWithHelmet } from './SEOManager.jsx';

// 🔑 Aquí se crea la raíz de la aplicación y se renderiza
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      {/* 2. Envolvemos la aplicación con el proveedor de Helmet */}
      <RootComponentWithHelmet>
        <App />
      </RootComponentWithHelmet>
    </ErrorBoundary>
  </StrictMode>,
)