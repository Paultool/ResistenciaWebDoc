// types.ts

// =========================================
// 1. TIPOS DE HISTORIA Y NARRATIVA
// =========================================

export interface HistoriaData {
    id_historia: number;
    titulo: string;
    descripcion: string;
    narrativa?: string;
    id_imagen_historia?: number;
    id_historia_dependencia?: number | null;
    estado?: 'bloqueado' | 'desbloqueado';
    id_ubicacion: { coordenadas: string } | null;
    orden?: number; // ✅ Campo añadido para el ordenamiento visual de las historias
}

export interface FlujoNarrativoData {
    id_flujo: number;
    orden: number;
    tipo_paso: 'narrativo' | 'pregunta' | 'final' | 'app';
    contenido: string | null;
    id_recompensa: number | null;
    id_personaje: number | null;
    recursomultimedia_id: number | null;
    id_siguiente_paso: number | null;
    id_historia: number;
    opciones_decision: {
        opciones_siguientes_json: {
            texto: string;
            siguiente_paso_id: number;
            recompensaId?: number; // Recompensa específica por elegir esta opción
        }[] | null;
    } | null;
    app_url?: string | null;
}

// =========================================
// 2. RECURSOS MULTIMEDIA Y 3D
// =========================================

export interface RecursoMultimediaData {
    id_recurso: number;
    tipo: 'imagen' | 'video' | 'audio' | 'transcripcion' | 'subtitulo' | 'interactive' | '3d_model' | 'app';
    archivo: string; // URL del archivo
    metadatos: string | null; // JSON stringified (contiene HotspotConfig[] o AppConfig)
}

// Configuración para aplicaciones integradas (ej. RentalApp) dentro de hotspots
export interface RentalAppConfig {
    difficulty: "Facil" | "Medio" | "Dificil";
    price: number;
    requiredItem?: string;
}

// Configuración de Puntos de Interés (Hotspots) en modelos 3D
export interface HotspotConfig {
    meshName: string; // Nombre del nodo/malla en el archivo GLB
    contentType: 'imagen' | 'video' | 'audio' | 'interactive' | 'backgroundMusic';
    title: string;
    url: string;
    recompensaId?: number;      // Recompensa simple al descubrir
    personajeId?: number;       // Personaje desbloqueado al descubrir
    successRecompensaId?: number; // Recompensa por éxito en app interactiva
    failureRecompensaId?: number; // Penalización/Recompensa por fallo
    rentalAppConfig?: RentalAppConfig; // Config extra si es una App
    position?: { 
        x: number; 
        y: number; 
        z: number; 
    };
    backgroundMusic?: string;
}

// =========================================
// 3. JUGADOR Y GAMIFICACIÓN
// =========================================

export interface RecompensaData {
    id_recompensa: number;
    nombre: string;
    valor: number; // Valor en XP
    descripcion: string | null;
}

export interface PersonajeData {
    id_personaje: number;
    nombre: string;
}

export interface PersonajeFicha extends PersonajeData {
    descripcion: string | null;
    imagen: string | null;
    atributos_json: string | null;
    rol: string | null;
    metadata?: Record<string, any>; // Para atributos parseados del JSON
}

export interface PlayerStats {
    xp_total: number;
    nivel?: number;
    inventario: {
        nombre: string;
        descripcion?: string;
        cantidad?: number;
    }[];
    historias_visitadas: string[] | number[]; // Puede venir como array de strings "1" o números
    personajes_conocidos: string[]; // Lista de nombres
}

// =========================================
// 4. COMUNICACIÓN CON APPS EXTERNAS (IFRAMES)
// =========================================

export interface AppResult {
    source: 'RentalApp' | 'Simulador' | string;
    type: 'app-result';
    status: 'success' | 'failure';
    recompensaId: number | undefined; // ID de la recompensa a aplicar
    costoXP?: number; // Costo (negativo) o ganancia (positivo) directa
    message: string;
}

// =========================================
// 5. UI Y COMPONENTES VISUALES
// =========================================

export interface MapaViewProps {
    historias: HistoriaData[];
    historiasVisitadas: number[];
    onStartNarrativeFromMap: (historiaId: number) => void;
    onBack: () => void;
    initialCenter: [number, number];
}