import { createClient } from '@supabase/supabase-js'

// URL y clave pública de Supabase
const supabaseUrl = 'https://atogaijnlssrgkvilsyp.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF0b2dhaWpubHNzcmdrdmlsc3lwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY4NTU3NDQsImV4cCI6MjA3MjQzMTc0NH0.4wwaY-aOZMMHstVkSh3uh3awRhv14pPJW9Xv6jGDZ98'

// Crear y exportar el cliente de Supabase
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Función helper para verificar la conexión
export const testConnection = async (): Promise<boolean> => {
  try {
    const { data, error } = await supabase.from('historia').select('count')
    if (error) throw error
    console.log('✅ Conexión a Supabase exitosa')
    return true
  } catch (error: any) {
    console.error('❌ Error conectando a Supabase:', error.message)
    return false
  }
}

// ----------------------------------------------------
// NUEVA INTERFAZ PARA EL DASHBOARD DE ADMIN
// ----------------------------------------------------
export interface AdminDashboardStats {
  totalusuarios: number;    // Antes: totalUsuarios
  totalhistorias: number;   // Antes: totalHistorias
  totalpersonajes: number;  // Antes: totalPersonajes
  totalubicaciones: number; // Antes: totalUbicaciones
  usuariosactivos: number;  // Antes: usuariosActivos
  sesioneshoy: number;      // Antes: sesionesHoy
}

// Definir tipos para las entidades
export interface Historia {
  id_historia: number
  titulo: string
  narrativa: string
  estado: string
  orden: number
  id_ubicacion: number
  id: number
  descripcion: string
  fecha_creacion: string
  nivel_acceso_requerido: number
  es_historia_principal: boolean
  metadata: any
}

export interface Personaje {
  id_personaje: number
  nombre: string
  descripcion: string
  imagen: string
  atributos_json: string
  id: number
  rol: string
  metadata: any
}

export interface Ubicacion {
  id_ubicacion: number
  nombre: string
  descripcion: string
  latitud: number
  longitud: number
  id: number
  coordenadas: string
  tipo: string
  metadata: any
}

export interface Usuario {
  id_usuario: string;
  nombre: string;
  email: string;
  nivel: number;
  rol: 'usuario' | 'admin';
  fecha_registro: string;
}

export interface Recompensa {
  id_recompensa: number
  nombre: string
  tipo: string | null
  descripcion: string | null
  valor: number | null
}

export interface RecursoMultimedia {
  id_recurso: number
  tipo: 'audio' | 'video' | 'imagen' | 'transcripcion' | 'subtitulo' | null
  archivo: string | null
  metadatos: any | null
  id_historia: number | null
  id_personaje: number | null
}

export interface FlujoNarrativo {
  id_flujo: number
  id_historia: number
  orden: number
  tipo_paso: string
  contenido: string
  recursomultimedia_id: number | null
  id_personaje: number | null // <-- ¡Nuevo campo agregado!
  opciones_decision: {
    opciones_siguientes_json: OpcionSiguiente[]
  }
}


// --ficha personajes

export const obtenerFichaPersonajePorId = async (id: number): Promise<Personaje | null> => {
  try {
    const { data: p, error } = await supabase
      .from('personaje') // El nombre de tu tabla
      .select('*')
      .eq('id_personaje', id)
      .single();

    if (error) {
      console.error('Error obteniendo ficha de personaje:', error.message);
      throw error;
    }

    if (!p) return null;

    // Replicamos la misma lógica de 'obtenerPersonajes' para ser consistentes
    // con cómo manejas 'metadata' y 'rol'.
    let atributos: any = {};
    try {
      // Usamos el campo 'atributos_json' de tu DB
      atributos = JSON.parse(p.atributos_json || '{}');
    } catch (e) {
      console.warn('Error parseando atributos_json:', e);
      atributos = {};
    }

    // Mapeamos al tipo 'Personaje' que ya tienes definido
    const personaje: Personaje = {
      ...p,
      id: p.id_personaje, // Asignamos 'id'
      rol: p.rol || (atributos as any).profesion || 'Personaje', // Usamos el 'rol' de la DB
      metadata: atributos // Asignamos los atributos parseados a 'metadata'
    };

    return personaje;

  } catch (error: any) {
    console.error('❌ Error en la función obtenerFichaPersonajePorId:', error.message);
    return null;
  }
};


// --- Operaciones CRUD para HISTORIAS ---

export const obtenerHistorias = async (): Promise<Historia[]> => {
  try {
    const { data: historiasRaw, error } = await supabase
      .from('historia')
      // ✅ CORRECCIÓN CLAVE 1: Pedir el ID y el nombre de la ubicacion en el JOIN
      // Ahora, el objeto anidado 'id_ubicacion' contendrá: { id_ubicacion: 5, nombre: '...', coordenadas: '...' }
      .select('*, id_ubicacion(id_ubicacion, nombre, coordenadas)') 
      .order('orden', { ascending: true })
    
    if (error) throw error
    
    // Mapeamos los datos, PERO USAMOS LOS VALORES REALES DE LA DB
    const historias: Historia[] = (historiasRaw || []).map((h: any) => ({
      ...h,
      id: h.id_historia,
      descripcion: h.narrativa,
      // Usar el valor real si existe
      fecha_creacion: h.fecha_creacion || '2024-01-01', 
      nivel_acceso_requerido: h.nivel_acceso_requerido, 
      // ✅ CORRECCIÓN CLAVE 2: Usar el valor REAL de la DB y no una fórmula basada en 'orden'
      es_historia_principal: h.es_historia_principal, 
      id_ubicacion: h.id_ubicacion, 
      metadata: { estado: h.estado }
    }))
    
    return historias
  } catch (error: any) {
    console.error('Error obteniendo historias:', error.message)
    throw error
  }
}
// En tu archivo supabaseClient.ts
export const obtenerFlujoNarrativoDeHistoria = async (idHistoria: number): Promise<any[]> => {
  try {
    const { data, error } = await supabase
      .from('flujo_narrativo')
      .select('id_flujo, contenido, id_personaje, recursomultimedia_id')
      .eq('id_historia', idHistoria)
      .order('orden', { ascending: true });

    if (error) {
      console.error('Error obteniendo el flujo narrativo:', error.message);
      throw error;
    }
    return data;
  } catch (error: any) {
    console.error('❌ Error en la función obtenerFlujoNarrativoDeHistoria:', error.message);
    throw error;
  }
};

//
// --- FUNCIONES PARA OBTENER DATOS RELACIONADOS ---
//

// Esta función obtiene todos los personajes únicos de una historia buscando en la tabla flujo_narrativo.
export const obtenerPersonajesPorHistoriaId = async (historiaId: number) => {
  try {
    // Paso 1: Replicar el `SELECT DISTINCT id_personaje` de tu SQL.
    const { data: flujoData, error: flujoError } = await supabase
      .from('flujo_narrativo')
      .select('id_personaje')
      .eq('id_historia', historiaId)
      .not('id_personaje', 'is', null);

      console.log(`✅ Historia con ID ${historiaId} personajes.`)


    if (flujoError) {
      console.error('Error al obtener IDs de personajes del flujo:', flujoError);
      throw flujoError;
    }

    // Extraer los IDs únicos en un array para el siguiente paso.
    const personajeIds = Array.from(new Set(flujoData.map(paso => paso.id_personaje)));
    console.log(`✅ Numero de Personajes   ${personajeIds} `)

    if (personajeIds.length === 0) {
      return [];
    }

    // Paso 2: Replicar el `SELECT * WHERE id_personaje IN (...)` de tu SQL.
    const { data: personajesData, error: personajesError } = await supabase
      .from('personaje')
      .select('*')
      .in('id_personaje', personajeIds as number[]); // Usamos .in() con el array de IDs.

          console.log(`✅ Personaje data   ${personajesData} `)

    if (personajesError) {
      console.error('Error al obtener detalles de personajes:', personajesError);
      throw personajesError;
    }

     

    return personajesData;
  } catch (err) {
    console.error('Error en obtenerPersonajesPorHistoriaId:', err);
    return [];
  }
};


// Función para obtener recursos multimedia por una lista de IDs
export const obtenerMultimediaPorIds = async (multimediaIds: number[]) => {
  if (multimediaIds.length === 0) {
    return [];
  }
  try {
    const { data, error } = await supabase
      .from('recursomultimedia')
      .select('*')
      .in('id_recurso', multimediaIds);

    if (error) {
      console.error('Error al obtener recursos multimedia:', error);
      throw error;
    }
    return data;
  } catch (err) {
    console.error('Error en obtenerMultimediaPorIds:', err);
    return [];
  }
};

export const obtenerHistoriaDetalle = async (id: number): Promise<any> => {
  const { data, error } = await supabase
    .from('historia')
    .select(`
      *,
      id_ubicacion ( nombre, coordenadas )
    `)
    .eq('id_historia', id)
    .single();

  if (error) throw error;
  return data;
}

export const crearHistoria = async (historiaData: Partial<Historia>): Promise<Historia> => {
  try {
    const { data, error } = await supabase
      .from('historia')
      .insert(historiaData)
      .select()
      .single()
    if (error) throw error
    return data
  } catch (error: any) {
    console.error('❌ Error creando historia:', error.message)
    throw error
  }
}

export const actualizarHistoria = async (
  id: number, 
  historiaData: Partial<Omit<Historia, 'id_historia' | 'fecha_creacion'>> // ¡CORREGIDO AQUÍ!
): Promise<Historia> => {
  try {
    const { data, error } = await supabase
      .from('historia')
      .update(historiaData)
      .eq('id_historia', id)
      .select()
      .single()

    if (error) throw error
    return data as Historia
  } catch (error: any) {
    console.error('❌ Error actualizando historia:', error.message)
    throw error
  }
}

export const eliminarHistoria = async (id: number): Promise<void> => {
  try {
    const { error } = await supabase
      .from('historia')
      .delete()
      .eq('id_historia', id)
    if (error) throw error
    console.log(`✅ Historia con ID ${id} eliminada correctamente.`)
  } catch (error: any) {
    console.error('❌ Error eliminando historia:', error.message)
    throw error
  }
}

// --- Operaciones CRUD para PERSONAJES ---

export const obtenerPersonajes = async (): Promise<Personaje[]> => {
  try {
    const { data: personajesRaw, error } = await supabase
      .from('personaje')
      .select('*')
      .order('nombre', { ascending: true })
    
    if (error) throw error
    
    const personajes: Personaje[] = (personajesRaw || []).map((p: any) => {
      let atributos: any = {}
      try {
        atributos = JSON.parse(p.atributos_json || '{}')
      } catch (e) {
        atributos = {}
      }
      
      return {
        ...p,
        id: p.id_personaje,
        rol: (atributos as any).profesion || 'Personaje',
        metadata: atributos
      }
    })
    
    return personajes
  } catch (error: any) {
    console.error('Error obteniendo personajes:', error.message)
    throw error
  }
}

export const crearPersonaje = async (personajeData: Omit<Personaje, 'id' | 'id_personaje' | 'metadata' | 'rol'>): Promise<Personaje> => {
  try {
    const { data, error } = await supabase
      .from('personaje')
      .insert(personajeData)
      .select()
      .single()

    if (error) throw error
    return data
  } catch (error: any) {
    console.error('❌ Error creando personaje:', error.message)
    throw error
  }
}

export const actualizarPersonaje = async (id: number, personajeData: Partial<Omit<Personaje, 'id' | 'id_personaje' | 'metadata' | 'rol'>>): Promise<Personaje> => {
  try {
    const { data, error } = await supabase
      .from('personaje')
      .update(personajeData)
      .eq('id_personaje', id)
      .select()
      .single()

    if (error) throw error
    return data
  } catch (error: any) {
    console.error('❌ Error actualizando personaje:', error.message)
    throw error
  }
}

export const eliminarPersonaje = async (id: number): Promise<void> => {
  try {
    const { error } = await supabase
      .from('personaje')
      .delete()
      .eq('id_personaje', id)
    if (error) throw error
    console.log(`✅ Personaje con ID ${id} eliminado correctamente.`)
  } catch (error: any) {
    console.error('❌ Error eliminando personaje:', error.message)
    throw error
  }
}

// --- Operaciones CRUD para UBICACIONES ---

export const obtenerUbicaciones = async (): Promise<Ubicacion[]> => {
  try {
    const { data: ubicacionesRaw, error } = await supabase
      .from('ubicacion')
      .select('*')
      .order('nombre', { ascending: true })
    
    if (error) throw error
    
    const ubicaciones: Ubicacion[] = (ubicacionesRaw || []).map((u: any) => {
      const [lat, lng] = (u.coordenadas || '0,0').split(',').map(parseFloat)
      return {
        ...u,
        id: u.id_ubicacion,
        latitud: lat || 0,
        longitud: lng || 0,
        metadata: { tipo: u.tipo }
      }
    })
    
    return ubicaciones
  } catch (error: any) {
    console.error('Error obteniendo ubicaciones:', error.message)
    throw error
  }
}

export const obtenerUbicacionPorId = async (id: number): Promise<Ubicacion | null> => {
  try {
    const { data: ubicacionRaw, error } = await supabase
      .from('ubicacion')
      .select('*')
      .eq('id_ubicacion', id)
      .single()
    
    if (error) return null
    
    const [lat, lng] = (ubicacionRaw.coordenadas || '0,0').split(',').map(parseFloat)
    return {
      ...ubicacionRaw,
      id: ubicacionRaw.id_ubicacion,
      latitud: lat || 0,
      longitud: lng || 0,
      metadata: { tipo: ubicacionRaw.tipo }
    }
  } catch (error: any) {
    console.error('Error obteniendo ubicación:', error.message)
    return null
  }
}

export const crearUbicacion = async (ubicacionData: Partial<Ubicacion>): Promise<Ubicacion> => {
  try {
    const { data, error } = await supabase
      .from('ubicacion')
      .insert(ubicacionData)
      .select()
      .single()

    if (error) throw error
    
    // Convertir coordenadas para el tipo `Ubicacion`
    const [lat, lng] = (data.coordenadas || '0,0').split(',').map(parseFloat)
    return {
      ...data,
      id: data.id_ubicacion,
      latitud: lat || 0,
      longitud: lng || 0,
      metadata: { tipo: data.tipo }
    }
  } catch (error: any) {
    console.error('❌ Error creando ubicación:', error.message)
    throw error
  }
}

export const actualizarUbicacion = async (id: number, ubicacionData: Partial<Ubicacion>): Promise<Ubicacion> => {
  try {
    const { data, error } = await supabase
      .from('ubicacion')
      .update(ubicacionData)
      .eq('id_ubicacion', id)
      .select()
      .single()

    if (error) throw error
    
    // Convertir coordenadas para el tipo `Ubicacion`
    const [lat, lng] = (data.coordenadas || '0,0').split(',').map(parseFloat)
    return {
      ...data,
      id: data.id_ubicacion,
      latitud: lat || 0,
      longitud: lng || 0,
      metadata: { tipo: data.tipo }
    }
  } catch (error: any) {
    console.error('❌ Error actualizando ubicación:', error.message)
    throw error
  }
}

export const eliminarUbicacion = async (id: number): Promise<void> => {
  try {
    const { error } = await supabase
      .from('ubicacion')
      .delete()
      .eq('id_ubicacion', id)
    if (error) throw error
    console.log(`✅ Ubicación con ID ${id} eliminada correctamente.`)
  } catch (error: any) {
    console.error('❌ Error eliminando ubicación:', error.message)
    throw error
  }
}

// Funciones para Recompensa
export const obtenerRecompensas = async (): Promise<Recompensa[]> => {
  const { data, error } = await supabase.from('recompensa').select('*')
  if (error) throw error
  return data
}

export const crearRecompensa = async (recompensa: Omit<Recompensa, 'id_recompensa'>): Promise<Recompensa> => {
  const { data, error } = await supabase.from('recompensa').insert([recompensa]).select().single()
  if (error) throw error
  return data
}

export const actualizarRecompensa = async (id: number, recompensa: Partial<Omit<Recompensa, 'id_recompensa'>>): Promise<Recompensa> => {
  const { data, error } = await supabase.from('recompensa').update(recompensa).eq('id_recompensa', id).select().single()
  if (error) throw error
  return data
}

export const eliminarRecompensa = async (id: number): Promise<void> => {
  const { error } = await supabase.from('recompensa').delete().eq('id_recompensa', id)
  if (error) throw error
}

// Función para obtener todos los recursos multimedia
export const obtenerRecursosMultimedia = async (): Promise<RecursoMultimedia[]> => {
  try {
    const { data, error } = await supabase
      .from('recursomultimedia')
      .select('id_recurso, tipo, archivo, metadatos');

    if (error) throw error;

    return data as RecursoMultimedia[];
  } catch (error: any) {
    console.error('Error obteniendo recursos multimedia:', error.message);
    throw error;
  }
};


// Nuevas funciones para la tabla 'recursomultimedia'
export const crearRecursoMultimedia = async (recurso: Omit<RecursoMultimedia, 'id_recurso'>): Promise<RecursoMultimedia> => {
  try {
    const { data, error } = await supabase
      .from('recursomultimedia')
      .insert([recurso])
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error: any) {
    console.error('Error creando recurso multimedia:', error.message);
    throw error;
  }
};

export const actualizarRecursoMultimedia = async (recurso: RecursoMultimedia): Promise<RecursoMultimedia> => {
  try {
    const { data, error } = await supabase
      .from('recursomultimedia')
      .update(recurso)
      .eq('id_recurso', recurso.id_recurso)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error: any) {
    console.error('Error actualizando recurso multimedia:', error.message);
    throw error;
  }
};

export const eliminarRecursoMultimedia = async (recursoId: number): Promise<void> => {
  try {
    const { error } = await supabase
      .from('recursomultimedia')
      .delete()
      .eq('id_recurso', recursoId);
    if (error) throw error;
  } catch (error: any) {
    console.error('Error eliminando recurso multimedia:', error.message);
    throw error;
  }
};

// Nuevas interfaces para el flujo narrativo
export interface OpcionSiguiente {
  texto: string;
  siguiente_paso_id: number;
}

export interface FlujoNarrativo {
  id_flujo: number
  id_historia: number
  orden: number
  tipo_paso: string
  contenido: string
  recursomultimedia_id: number | null
  opciones_decision: {
    opciones_siguientes_json: OpcionSiguiente[]
  }
}

// Funciones para el CRUD de pasos del flujo narrativo
export const obtenerFlujoNarrativoPorHistoria = async (historiaId: number): Promise<FlujoNarrativo[]> => {
  try {
    const { data, error } = await supabase
      .from('flujo_narrativo')
      .select('*')
      .eq('id_historia', historiaId)
      .order('orden', { ascending: true });

    if (error) throw error;
    
    return data as FlujoNarrativo[];
  } catch (error: any) {
    console.error('Error obteniendo flujo narrativo:', error.message);
    throw error;
  }
};

// Función para crear un nuevo paso en el flujo narrativo
export const crearPasoFlujo = async (paso: {
  id_historia: number;
  orden: number;
  tipo_paso: string;
  contenido: string;
  recursomultimedia_id: number | null;
  id_personaje: number | null; 
  id_recompensa: number | null; 
  id_siguiente_paso: number | null;
  opciones_decision: any;
}) => {
  try {
    const { error } = await supabase.from('flujo_narrativo').insert([
      {
        id_historia: paso.id_historia,
        orden: paso.orden,
        tipo_paso: paso.tipo_paso,
        contenido: paso.contenido,
        recursomultimedia_id: paso.recursomultimedia_id ?? null,
        id_personaje: paso.id_personaje ?? null, 
        id_recompensa: paso.id_recompensa ?? null, 
        id_siguiente_paso: paso.id_siguiente_paso ?? null,
        opciones_decision: paso.opciones_decision,
      },
    ]);
    if (error) throw error;
  } catch (error: any) {
    console.error('Error creando paso:', error.message);
    throw error;
  }
};

// Función para actualizar un paso existente
export const actualizarPasoFlujo = async (paso: {
  id_flujo: number;
  id_historia: number;
  orden: number;
  tipo_paso: string;
  contenido: string;
  recursomultimedia_id: number | null;
  id_personaje: number | null; 
  id_recompensa: number | null;
  id_siguiente_paso: number | null;
  opciones_decision: any;
}) => {
  try {
    const { error } = await supabase
      .from('flujo_narrativo')
      .update({
        orden: paso.orden,
        tipo_paso: paso.tipo_paso,
        contenido: paso.contenido,
        recursomultimedia_id: paso.recursomultimedia_id ?? null,
        id_personaje: paso.id_personaje ?? null, 
        id_recompensa: paso.id_recompensa ?? null,
        id_siguiente_paso: paso.id_siguiente_paso ?? null,
        opciones_decision: paso.opciones_decision,
      })
      .eq('id_flujo', paso.id_flujo);
    if (error) throw error;
  } catch (error: any) {
    console.error('Error actualizando paso:', error.message);
    throw error;
  }
};

// Función para eliminar un paso del flujo narrativo
export const eliminarPasoFlujo = async (pasoId: number) => {
  try {
    const { error } = await supabase
      .from('flujo_narrativo')
      .delete()
      .eq('id_flujo', pasoId); // <-- ¡Corrección: Usar id_flujo!
    if (error) throw error;
  } catch (error: any) {
    console.error('Error eliminando paso:', error.message);
    throw error;
  }
};

export const revokeAdmin = async (userEmail: string) => {
  try {
    // 1. Obtener el ID del usuario actual para prevenir la auto-revocación
    const { data: { user: currentUser } } = await supabase.auth.getUser();

    if (currentUser?.email === userEmail) {
      throw new Error("No puedes revocar tus propios permisos de administrador.");
    }

    // 2. Actualizar el rol del usuario en la tabla 'usuario'
    const { data, error } = await supabase
      .from('usuario')
      .update({ rol: 'jugador' }) // <-- Asignamos el rol por defecto
      .eq('email', userEmail);

    if (error) {
      console.error('Error al revocar permisos de administrador:', error.message);
      throw error;
    }

    console.log(`✅ Permisos de administrador revocados para ${userEmail}.`);
    return data;
  } catch (err: any) {
    console.error('❌ Error en la función revokeAdmin:', err.message);
    throw err;
  }
};

// ----------------------------------------------------
// FUNCIÓN PARA EL DASHBOARD DE ADMIN
// ----------------------------------------------------
export const fetchDashboardStats = async (): Promise<AdminDashboardStats> => {
    try {
        // Cambia 'get_admin_dashboard_stats' por el nombre real de tu RPC si es diferente
        const { data, error } = await supabase.rpc('get_admin_dashboard_stats'); 
        
        if (error) {
            console.error('Error al llamar al RPC get_admin_dashboard_stats:', error);
            throw new Error(`Error en el servidor de base de datos: ${error.message}`);
        }
        
        if (data && data.length > 0) {
            // El resultado de un RPC es a menudo un array
            return data[0] as AdminDashboardStats; 
        }

        return {
            totalusuarios: 0,
            totalhistorias: 0,
            totalpersonajes: 0,
            totalubicaciones: 0,
            usuariosactivos: 0,
            sesioneshoy: 0,
        };

    } catch (error: any) {
        console.error('Fallo en la obtención de estadísticas del dashboard:', error);
        throw new Error(`No se pudieron obtener las estadísticas: ${error.message}`);
    }
}


// --- Nuevas funciones para Recompensas y Eventos de Juego ---

// Tipos para el sistema de juego
export interface PlayerStats {
  id: string;
  user_id: string;
  nivel: number;
  xp_total: number;
  historias_completadas: number;
  personajes_conocidos: string[];
  ubicaciones_visitadas: string[];
  logros_desbloqueados: string[];
  inventario: InventoryItem[];
  fecha_ultimo_acceso: string;
  racha_dias_consecutivos: number;
}

export interface InventoryItem {
  id: string;
  nombre: string;
  descripcion: string;
  tipo: 'documento' | 'foto' | 'contacto' | 'evidencia' | 'memoria';
  rareza: 'común' | 'rara' | 'épica' | 'legendaria';
  fecha_obtencion: string;
  historia_origen: string;
}

export interface GameLogro {
  id: string;
  nombre: string;
  descripcion: string;
  tipo: 'progreso' | 'exploración' | 'social' | 'secreto';
  requisitos: Record<string, any>;
  recompensa_xp: number;
  icono: string;
}

export interface GameEvent {
  id: string;
  tipo: 'historia_completada' | 'personaje_conocido' | 'ubicacion_visitada' | 'logro_desbloqueado' | 'recompensa_otorgada' | 'interaccion_registrada';
  descripcion: string;
  xp_ganado: number;
  fecha: string;
  detalles?: Record<string, any>;
}

class GameService {
  private static instance: GameService;
  private playerStats: PlayerStats | null = null;
  private logros: GameLogro[] = [];

  private constructor() {}

  static getInstance(): GameService {
    if (!GameService.instance) {
      GameService.instance = new GameService();
    }
    return GameService.instance;
  }

  /**
   * Inicializa el perfil de juego para un usuario
   */
  async initializePlayerProfile(userId: string): Promise<PlayerStats> {
    try {
      console.log(`⏳ Iniciando perfil para el usuario ${userId}...`);
      const { data: existingProfile, error: fetchError } = await supabase
        .from('perfiles_jugador')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (existingProfile && !fetchError) {
        this.playerStats = {
          ...existingProfile,
          personajes_conocidos: existingProfile.personajes_conocidos || [],
          ubicaciones_visitadas: existingProfile.ubicaciones_visitadas || [],
          logros_desbloqueados: existingProfile.logros_desbloqueados || [],
          inventario: existingProfile.inventario || []
        };
        console.log(`✅ Perfil existente cargado para ${userId}.`);
        return this.playerStats;
      }

      const newProfile: Partial<PlayerStats> = {
        user_id: userId,
        nivel: 1,
        xp_total: 0,
        historias_completadas: 0,
        personajes_conocidos: [],
        ubicaciones_visitadas: [],
        logros_desbloqueados: [],
        inventario: [],
        fecha_ultimo_acceso: new Date().toISOString(),
        racha_dias_consecutivos: 1
      };

      const { data: createdProfile, error: createError } = await supabase
        .from('perfiles_jugador')
        .insert(newProfile)
        .select()
        .single();

      if (createError) {
        throw new Error(`Error creando perfil: ${createError.message}`);
      }

      this.playerStats = createdProfile as PlayerStats;
      console.log(`🎉 Nuevo perfil creado para ${userId}.`);
      return this.playerStats;
    } catch (error: any) {
      console.error('❌ Error inicializando perfil de jugador:', error);
      throw error;
    }
  }

  /**
   * Obtiene las estadísticas del jugador
   */
  async getPlayerStats(userId: string): Promise<PlayerStats | null> {
    try {
      if (this.playerStats && this.playerStats.user_id === userId) {
        console.log('📈 Devolviendo estadísticas desde el caché.');
        return this.playerStats;
      }

      const { data: profile, error } = await supabase
        .from('perfiles_jugador')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error || !profile) {
        console.log('⚠️ Perfil no encontrado. Iniciando uno nuevo...');
        return await this.initializePlayerProfile(userId);
      }

      this.playerStats = {
        ...profile,
        personajes_conocidos: profile.personajes_conocidos || [],
        ubicaciones_visitadas: profile.ubicaciones_visitadas || [],
        logros_desbloqueados: profile.logros_desbloqueados || [],
        inventario: profile.inventario || []
      };
      console.log('✅ Estadísticas obtenidas desde la base de datos.');
      return this.playerStats;
    } catch (error: any) {
      console.error('❌ Error obteniendo estadísticas:', error);
      return null;
    }
  }

  /**
   * Registra un evento de juego en la base de datos.
   * @param userId El ID del usuario.
   * @param eventType El tipo de evento (ej. 'historia_completada').
   * @param details Detalles adicionales del evento.
   */
  async logGameEvent(userId: string, eventType: string, details: any) {
    try {
      console.log(`📡 Registrando evento: ${eventType} para el usuario ${userId}`, details);
      const { data, error } = await supabase
        .from('eventos_juego')
        .insert({ user_id: userId, tipo: eventType, descripcion: details });
      if (error) throw error;
      console.log('✅ Evento de juego registrado con éxito.');
      return data;
    } catch (err: any) {
      console.error('❌ Error al registrar evento de juego:', err);
      throw err;
    }
  }

  /**
   * Otorga una recompensa a un jugador, actualizando su perfil.
   * @param userId El ID del usuario.
   * @param rewardId El ID de la recompensa.
   */
  async grantReward(userId: string, recompensaId: number) {
    try {
      console.log(`🎁 Otorgando recompensa ${recompensaId} al usuario ${userId}`);
      const { data, error } = await supabase.rpc('otorgar_recompensa', {
        p_jugador_id: userId,
        p_recompensa_id: recompensaId,
      });
      if (error) throw error;
      console.log('✅ Recompensa otorgada con éxito.');
      return data;
    } catch (err: any) {
      console.error('❌ Error al otorgar recompensa:', err);
      throw err;
    }
  }
  
  /**
   * Registra una interacción del jugador con un paso narrativo.
   * @param userId El ID del usuario.
   * @param pasoId El ID del paso narrativo.
   * @param interactionType El tipo de interacción (ej. 'avanzar', 'opcion_seleccionada').
   */
  async logInteraction(userId: string, pasoId: number, interactionType: string) {
    try {
      console.log(`✍️ Registrando interacción '${interactionType}' para el paso ${pasoId} del usuario ${userId}`);
      const { data, error } = await supabase
        .from('interacciones_jugador')
        .insert({ id_jugador: userId, id_flujo_narrativo: pasoId, tipo_interaccion: interactionType });
      if (error) throw error;
      console.log('✅ Interacción registrada con éxito.');
      return data;
    } catch (err: any) {
      console.error('❌ Error al registrar interacción:', err);
      throw err;
    }
  }

  /**
   * Calcula el nivel basado en XP
   */
  calculateLevel(xp: number): number {
    return Math.floor(Math.sqrt(xp / 100)) + 1;
  }

  /**
   * Calcula XP requerido para el siguiente nivel
   */
  getXPForNextLevel(currentLevel: number): number {
    return Math.pow(currentLevel, 2) * 100;
  }

  /**
   * Otorga XP al jugador por completar una historia
   */
  async completeStory(userId: string, historiaId: string, esHistoriaPrincipal: boolean = false): Promise<GameEvent> {
    try {
      const stats = await this.getPlayerStats(userId);
      if (!stats) throw new Error('No se pudo obtener el perfil del jugador');

      const xpGanado = esHistoriaPrincipal ? 150 : 75;
      const nuevoXP = stats.xp_total + xpGanado;
      const nuevoNivel = this.calculateLevel(nuevoXP);
      const historiasCompletadas = stats.historias_completadas + 1;

      const { error: updateError } = await supabase
        .from('perfiles_jugador')
        .update({
          xp_total: nuevoXP,
          nivel: nuevoNivel,
          historias_completadas: historiasCompletadas,
          fecha_ultimo_acceso: new Date().toISOString()
        })
        .eq('user_id', userId);

      if (updateError) throw updateError;

      const gameEvent: GameEvent = {
        id: `${Date.now()}-${Math.random()}`,
        tipo: 'historia_completada',
        descripcion: `¡Historia completada! ${esHistoriaPrincipal ? 'Historia Principal' : 'Historia Secundaria'}`,
        xp_ganado: xpGanado,
        fecha: new Date().toISOString()
      };

      if (this.playerStats) {
        this.playerStats.xp_total = nuevoXP;
        this.playerStats.nivel = nuevoNivel;
        this.playerStats.historias_completadas = historiasCompletadas;
      }

      await this.checkAndUnlockAchievements(userId, stats);

      return gameEvent;
    } catch (error: any) {
      console.error('Error completando historia:', error);
      throw error;
    }
  }

  /**
   * Registra que un jugador conoció un personaje
   */
  async meetCharacter(userId: string, personajeId: string): Promise<GameEvent | null> {
    try {
      const stats = await this.getPlayerStats(userId);
      if (!stats) throw new Error('No se pudo obtener el perfil del jugador');

      if (stats.personajes_conocidos.includes(personajeId)) {
        return null;
      }

      const xpGanado = 25;
      const nuevoXP = stats.xp_total + xpGanado;
      const nuevoNivel = this.calculateLevel(nuevoXP);
      const nuevosPersonajes = [...stats.personajes_conocidos, personajeId];

      const { error: updateError } = await supabase
        .from('perfiles_jugador')
        .update({
          xp_total: nuevoXP,
          nivel: nuevoNivel,
          personajes_conocidos: nuevosPersonajes
        })
        .eq('user_id', userId);

      if (updateError) throw updateError;

      const gameEvent: GameEvent = {
        id: `${Date.now()}-${Math.random()}`,
        tipo: 'personaje_conocido',
        descripcion: '¡Has conocido a un nuevo personaje!',
        xp_ganado: xpGanado,
        fecha: new Date().toISOString()
      };

      if (this.playerStats) {
        this.playerStats.xp_total = nuevoXP;
        this.playerStats.nivel = nuevoNivel;
        this.playerStats.personajes_conocidos = nuevosPersonajes;
      }

      return gameEvent;
    } catch (error: any) {
      console.error('Error registrando personaje conocido:', error);
      throw error;
    }
  }

  /**
   * Registra que un jugador visitó una ubicación
   */
  async visitLocation(userId: string, ubicacionId: string): Promise<GameEvent | null> {
    try {
      const stats = await this.getPlayerStats(userId);
      if (!stats) throw new Error('No se pudo obtener el perfil del jugador');

      if (stats.ubicaciones_visitadas.includes(ubicacionId)) {
        return null;
      }

      const xpGanado = 50;
      const nuevoXP = stats.xp_total + xpGanado;
      const nuevoNivel = this.calculateLevel(nuevoXP);
      const nuevasUbicaciones = [...stats.ubicaciones_visitadas, ubicacionId];

      const { error: updateError } = await supabase
        .from('perfiles_jugador')
        .update({
          xp_total: nuevoXP,
          nivel: nuevoNivel,
          ubicaciones_visitadas: nuevasUbicaciones
        })
        .eq('user_id', userId);

      if (updateError) throw updateError;

      const gameEvent: GameEvent = {
        id: `${Date.now()}-${Math.random()}`,
        tipo: 'ubicacion_visitada',
        descripcion: '¡Has explorado una nueva ubicación!',
        xp_ganado: xpGanado,
        fecha: new Date().toISOString()
      };

      if (this.playerStats) {
        this.playerStats.xp_total = nuevoXP;
        this.playerStats.nivel = nuevoNivel;
        this.playerStats.ubicaciones_visitadas = nuevasUbicaciones;
      }

      return gameEvent;
    } catch (error: any) {
      console.error('Error registrando ubicación visitada:', error);
      throw error;
    }
  }

  /**
   * Añade un objeto al inventario
   */
  async addToInventory(userId: string, item: Omit<InventoryItem, 'fecha_obtencion'>): Promise<void> {
    try {
      const stats = await this.getPlayerStats(userId);
      if (!stats) throw new Error('No se pudo obtener el perfil del jugador');

      const newItem: InventoryItem = {
        ...item,
        fecha_obtencion: new Date().toISOString()
      };

      const nuevoInventario = [...stats.inventario, newItem];

      const { error: updateError } = await supabase
        .from('perfiles_jugador')
        .update({
          inventario: nuevoInventario
        })
        .eq('user_id', userId);

      if (updateError) throw updateError;

      if (this.playerStats) {
        this.playerStats.inventario = nuevoInventario;
      }
    } catch (error: any) {
      console.error('Error añadiendo objeto al inventario:', error);
      throw error;
    }
  }

  /**
   * Verifica y desbloquea logros
   */
  async checkAndUnlockAchievements(userId: string, currentStats: PlayerStats): Promise<string[]> {
    const newAchievements: string[] = [];

    if (currentStats.historias_completadas >= 1 && !currentStats.logros_desbloqueados.includes('primera_historia')) {
      newAchievements.push('primera_historia');
    }
    if (currentStats.historias_completadas >= 5 && !currentStats.logros_desbloqueados.includes('explorador_novato')) {
      newAchievements.push('explorador_novato');
    }
    if (currentStats.historias_completadas >= 10 && !currentStats.logros_desbloqueados.includes('narrador_experto')) {
      newAchievements.push('narrador_experto');
    }

    if (currentStats.nivel >= 5 && !currentStats.logros_desbloqueados.includes('resistente_veterano')) {
      newAchievements.push('resistente_veterano');
    }

    if (currentStats.personajes_conocidos.length >= 5 && !currentStats.logros_desbloqueados.includes('socialite_urbano')) {
      newAchievements.push('socialite_urbano');
    }

    if (currentStats.ubicaciones_visitadas.length >= 10 && !currentStats.logros_desbloqueados.includes('explorador_urbano')) {
      newAchievements.push('explorador_urbano');
    }

    if (newAchievements.length > 0) {
      const logrosActualizados = [...currentStats.logros_desbloqueados, ...newAchievements];
      
      const { error: updateError } = await supabase
        .from('perfiles_jugador')
        .update({
          logros_desbloqueados: logrosActualizados
        })
        .eq('user_id', userId);

      if (!updateError && this.playerStats) {
        this.playerStats.logros_desbloqueados = logrosActualizados;
      }
    }

    return newAchievements;
  }

  /**
   * Actualiza la racha de días consecutivos
   */
  async updateDailyStreak(userId: string): Promise<void> {
    try {
      const stats = await this.getPlayerStats(userId);
      if (!stats) return;

      const hoy = new Date();
      const ultimoAcceso = new Date(stats.fecha_ultimo_acceso);
      const diferenciaDias = Math.floor((hoy.getTime() - ultimoAcceso.getTime()) / (1000 * 60 * 60 * 24));

      let nuevaRacha = stats.racha_dias_consecutivos;

      if (diferenciaDias === 1) {
        nuevaRacha += 1;
      } else if (diferenciaDias > 1) {
        nuevaRacha = 1;
      }

      if (diferenciaDias >= 1) {
        const { error: updateError } = await supabase
          .from('perfiles_jugador')
          .update({
            fecha_ultimo_acceso: hoy.toISOString(),
            racha_dias_consecutivos: nuevaRacha
          })
          .eq('user_id', userId);

        if (!updateError && this.playerStats) {
          this.playerStats.fecha_ultimo_acceso = hoy.toISOString();
          this.playerStats.racha_dias_consecutivos = nuevaRacha;
        }
      }
    } catch (error: any) {
      console.error('Error actualizando racha diaria:', error);
    }
  }
  

  

  /**
   * Obtiene estadísticas resumidas para el dashboard
   */
  async getDashboardStats(userId: string): Promise<{
    nivel: number
    xpTotal: number
    xpParaSiguienteNivel: number
    historiasCompletadas: number
    personajesConocidos: number
    ubicacionesVisitadas: number
    logrosDesbloqueados: number
    rachaDias: number
    inventarioItems: number
  } | null> {
    try {
      const stats = await this.getPlayerStats(userId);
      if (!stats) return null;

      await this.updateDailyStreak(userId);

      const xpSiguienteNivel = this.getXPForNextLevel(stats.nivel);
      const xpParaSiguienteNivel = Math.max(0, xpSiguienteNivel - stats.xp_total);

      return {
        nivel: stats.nivel,
        xpTotal: stats.xp_total,
        xpParaSiguienteNivel,
        historiasCompletadas: stats.historias_completadas,
        personajesConocidos: stats.personajes_conocidos.length,
        ubicacionesVisitadas: stats.ubicaciones_visitadas.length,
        logrosDesbloqueados: stats.logros_desbloqueados.length,
        rachaDias: stats.racha_dias_consecutivos,
        inventarioItems: stats.inventario.length
      };
    } catch (error: any) {
      console.error('Error obteniendo estadísticas del dashboard:', error);
      return null;
    }
  }

  /**
   * Resetea el cache (útil para testing o cuando el usuario cambia)
   */
  clearCache(): void {
    this.playerStats = null;
  }
}

// Exportar instancia singleton
export const gameService = GameService.getInstance();
export default gameService;
