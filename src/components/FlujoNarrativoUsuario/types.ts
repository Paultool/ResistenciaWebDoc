// Define las interfaces para tipar los datos

export interface FlujoNarrativoUsuarioProps {
    historiaId: number; // ID de la historia a mostrar
    onBack: () => void;
    onUpdateProfile: (recompensaPositiva: number, recompensaNegativa: number, ubicacion: string) => void;
}

// Definición de la estructura del resultado de la aplicación (rental.html)
export interface AppResult {
    source: 'RentalApp' | 'Simulador' | 'ReparaApp' | 'BenitoJuarez';
    type: 'app-result';
    status: 'success' | 'failure';
    // Standard Protocol Fields
    xpDelta?: number;      // CAMBIO NETO DE XP (Positivo=Ganancia, Negativo=Costo/Multa). Reemplaza a costoXP.
    recompensaId?: number; // ID del Item/Logro a entregar

    // Deprecated fields (Mantener soporte temporal si es necesario, o eliminar si migramos todo de una vez)
    costoXP?: number;
    message: string;
}

export interface RecursoMultimediaData {
    id_recurso: number;
    tipo: 'imagen' | 'video' | 'audio' | 'transcripcion' | 'subtitulo' | 'interactive' | '3d_model' | 'app';
    archivo: string;
    metadatos: string | null;
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
        }[] | null;
    } | null;
    app_url?: string | null; // URL de la app para tipo_paso 'app'
}

export interface HistoriaData {
    id_historia: number;
    titulo: string;
    descripcion: string;
    narrativa?: string;
    id_imagen_historia?: number;
    id_historia_dependencia?: number | null;
    estado?: 'bloqueado' | 'desbloqueado';
    id_ubicacion: { coordenadas: string } | null;
    orden?: number;
}

// Type for historia with lock state computed
export type HistoriaConEstado = HistoriaData & {
    isLocked: boolean;
};

export interface RecompensaData {
    id_recompensa: number;
    nombre: string;
    valor: number;
    descripcion: string | null;
}

// Interfaz para la data básica (la que ya usas en el estado 'personajesData')
export interface PersonajeData {
    id_personaje: number;
    nombre: string;
}

// Nueva interfaz para la configuración de la App de Renta
export interface RentalAppConfig {
    difficulty: "Facil" | "Medio" | "Dificil";
    price: number;
    requiredItem?: string; // Nombre del item requerido para éxito en STANDARD/HARD
}

// Interfaz para la Ficha Completa personaje (para el modal detallado )
export interface PersonajeFicha {
    id_personaje: number;
    nombre: string;
    descripcion: string | null;
    imagen: string | null; // Tu campo se llama 'imagen'
    atributos_json: string | null; // Tu campo es un string JSON
    rol: string | null;
}

// Nueva interfaz para definir un Hotspot de Interacción
export interface HotspotConfig {
    meshName: string; // El nombre de la malla dentro del GLB (ej: 'bidek')
    contentType: 'imagen' | 'video' | 'audio' | 'interactive' | 'backgroundMusic'; // Tipo de contenido
    title: string;
    title_en?: string; // Título en inglés para localización
    url: string; // URL del contenido (imagen, video, audio)
    subtitlesUrl?: string; // Opcional: URL del archivo SRT
    recompensaId?: number; // Opcional: Recompensa asociada
    personajeId?: number; // Opcional: Personaje a conocer
    successRecompensaId?: number; //app recompensa positiva
    failureRecompensaId?: number; //app recompensa negativa
    rentalAppConfig?: RentalAppConfig; // Configuración específica si contentType es 'interactive'
    position?: {  // Opcional: Posición específica del hotspot
        x: number;
        y: number;
        z: number;
    };
    backgroundMusic?: string; // Opcional: URL del audio de fondo para el modelo 3D
}

// Nueva interfaz para las props de MapaView
export interface MapaViewProps {
    historias: HistoriaData[];
    historiasVisitadas: number[];
    onStartNarrativeFromMap: (historiaId: number) => void;
    onBack: () => void;
    initialCenter: [number, number];
    recursos: RecursoMultimediaData[];
}
