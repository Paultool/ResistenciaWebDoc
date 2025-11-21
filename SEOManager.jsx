import React from 'react';
// Importamos HelmetProvider y Helmet
import { Helmet, HelmetProvider } from 'react-helmet-async';

// Componente reutilizable para gestionar el SEO de cualquier página
// Props:
// - title: El título único de la página (¡CRUCIAL para Google!)
// - description: La descripción breve para los resultados de búsqueda
// - canonicalUrl: La URL definitiva de esta página (evita contenido duplicado)
const SEOManager = ({ 
    title = "La Resistencia | Experiencia Narrativa", 
    description = "Únete a La Resistencia y navega por una experiencia interactiva en la Ciudad de México.",
    canonicalUrl = "https://tu-dominio.com/" // Cambia a tu dominio base
}) => {
    return (
        <Helmet>
            {/* Título de la página, aparece en la pestaña del navegador y en los resultados de Google */}
            <title>{title}</title>

            {/* Meta Descripción: El snippet que muestra Google */}
            <meta name="description" content={description} />
            
            {/* Etiqueta canónica: Le dice a Google cuál es la URL principal para este contenido */}
            <link rel="canonical" href={canonicalUrl} />

            {/* Metadatos Open Graph (para compartir en redes sociales como Facebook/Twitter) */}
            <meta property="og:title" content={title} />
            <meta property="og:description" content={description} />
            <meta property="og:url" content={canonicalUrl} />
            <meta property="og:type" content="website" />
            
            {/* Puedes agregar aquí etiquetas específicas de Twitter (twitter:card, twitter:image, etc.) */}
            
            {/* Asegúrate de que Google NO deba indexar esta página durante el desarrollo */}
            {/* <meta name="robots" content="noindex" /> */} 
            
            {/* Una vez en producción, asegúrate de que esté habilitado para indexar */}
            <meta name="robots" content="index, follow" />
        </Helmet>
    );
};

// Necesitas envolver tu componente raíz (ej: App.jsx) con HelmetProvider una sola vez.
// Esto es esencial para que Helmet funcione correctamente en toda tu app.
const RootComponentWithHelmet = ({ children }) => (
    <HelmetProvider>
        {children}
    </HelmetProvider>
);

export { SEOManager, RootComponentWithHelmet };