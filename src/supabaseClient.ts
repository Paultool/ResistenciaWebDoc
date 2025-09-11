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

// --- Operaciones CRUD para HISTORIAS ---

export const obtenerHistorias = async (): Promise<Historia[]> => {
  try {
    const { data: historiasRaw, error } = await supabase
      .from('historia')
      .select('*')
      .order('orden', { ascending: true })
    
    if (error) throw error
    
    const historias: Historia[] = (historiasRaw || []).map((h: any) => ({
      ...h,
      id: h.id_historia,
      descripcion: h.narrativa,
      fecha_creacion: '2024-01-01',
      nivel_acceso_requerido: h.orden <= 2 ? 1 : 2,
      es_historia_principal: h.orden <= 2,
      metadata: { estado: h.estado, ubicacion_id: h.id_ubicacion }
    }))
    
    return historias
  } catch (error: any) {
    console.error('Error obteniendo historias:', error.message)
    throw error
  }
}

export const obtenerHistoriaDetalle = async (id: number): Promise<any> => {
  try {
    const { data: historiaRaw, error } = await supabase
      .from('historia')
      .select('*')
      .eq('id_historia', id)
      .single()
    
    if (error) throw error
    
    const personajes = await obtenerPersonajes()
    const ubicacion = await obtenerUbicacionPorId(historiaRaw.id_ubicacion)
    
    const historia = {
      ...historiaRaw,
      id: historiaRaw.id_historia,
      descripcion: historiaRaw.narrativa,
      fecha_creacion: '2024-01-01',
      nivel_acceso_requerido: historiaRaw.orden <= 2 ? 1 : 2,
      es_historia_principal: historiaRaw.orden <= 2,
      metadata: { estado: historiaRaw.estado, ubicacion_id: historiaRaw.id_ubicacion },
      personaje: personajes.slice(0, 2),
      recursomultimedia: [],
      ubicacion: ubicacion ? [ubicacion] : []
    }
    
    return historia
  } catch (error: any) {
    console.error('Error obteniendo historia detalle:', error.message)
    throw error
  }
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

export const actualizarHistoria = async (id: number, historiaData: Partial<Omit<Historia, 'id' | 'id_historia' | 'descripcion' | 'fecha_creacion' | 'nivel_acceso_requerido' | 'es_historia_principal'>>): Promise<Historia> => {
  try {
    const { data, error } = await supabase
      .from('historia')
      .update(historiaData)
      .eq('id_historia', id)
      .select()
      .single()
    if (error) throw error
    return data
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