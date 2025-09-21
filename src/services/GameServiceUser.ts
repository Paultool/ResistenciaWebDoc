import { supabase } from '../supabaseClient';
import { PlayerStats, InventoryItem } from './GameService';

interface RecompensaData {
    id_recompensa: number;
    nombre: string;
    descripcion: string;
    tipo: string;
    valor: number;
    historia_origen: number | null;
}
interface PersonajeData {
    id_personaje: number;
    nombre: string;
    descripcion: string;
    historia_origen: number | null;
}
interface GameEvent {
    id: string;
    tipo: 'historia_completada' | 'recompensa_obtenida' | 'nivel_subido' | 'otro';
    descripcion: string;
    xp_ganado: number;
    fecha: string;
} 

class GameServiceUser {
    private static instance: GameServiceUser;
    private playerStats: PlayerStats | null = null;
    
    private constructor() {}

    public static getInstance(): GameServiceUser {
        if (!GameServiceUser.instance) {
            GameServiceUser.instance = new GameServiceUser();
        }
        return GameServiceUser.instance;
    }

     /**
     * Obtiene las estadísticas de un usuario.
     * @param userId El ID del usuario.
     */
    async getPlayerStats(userId: string): Promise<PlayerStats | null> {
        try {
            const { data, error } = await supabase
                .from('perfiles_jugador')
                .select('*')
                .eq('user_id', userId)
                .single();

            if (error && error.code === 'PGRST116') {
                return null;
            } else if (error) {
                throw error;
            }

            // Asegurar que el inventario se inicialice como un array
            const playerStats: PlayerStats = {
                ...(data as PlayerStats),
                inventario: data.inventario || [],
            };

            return playerStats;
        } catch (error) {
            console.error('Error al obtener estadísticas del jugador:', error);
            return null;
        }
    }

    /**
     * Incrementa los puntos de experiencia de un usuario.
     * @param userId El ID del usuario.
     * @param xpToAdd La cantidad de XP a añadir.
     */
    async addXP(userId: string, xpToAdd: number): Promise<{ error: any }> {
        try {
            const stats = await this.getPlayerStats(userId);
            if (!stats) {
                // Si el usuario no tiene estadísticas, se crea un registro inicial.
                const { error } = await supabase.from('perfiles_jugador').insert([{
                    user_id: userId,
                    xp_total: xpToAdd,
                }]);
                if (error) throw error;
            } else {
                // Si el usuario ya existe, se actualizan las estadísticas.
                const { error } = await supabase.from('perfiles_jugador')
                    .update({ xp_total: stats.xp_total + xpToAdd })
                    .eq('user_id', userId);
                if (error) throw error;
            }
            return { error: null };
        } catch (error: any) {
            console.error("Error adding XP:", error.message);
            return { error };
        }
    }
    
    /**
     * Agrega un objeto al inventario del jugador y le otorga puntos de experiencia.
     * @param userId El ID del usuario.
     * @param item El objeto de inventario a añadir.
     * @param valorRecompensa Los puntos de experiencia a añadir.
     */
    public async addToInventory(userId: string, item: Omit<InventoryItem, 'fecha_obtencion'>, valorRecompensa: number): Promise<void> {
        try {
            const stats = await this.getPlayerStats(userId);
            if (!stats) throw new Error('No se pudo obtener el perfil del jugador');
      
            const newItem: InventoryItem = {
              ...item,
              fecha_obtencion: new Date().toISOString()
            };
      
            const nuevoInventario = [...(stats.inventario ?? []), newItem];
            const nuevoXP = stats.xp_total + valorRecompensa;
      
            // Actualizar inventario
            const { error: updateError } = await supabase
              .from('perfiles_jugador')
              .update({
                inventario: nuevoInventario,
                xp_total: nuevoXP
              })
              .eq('user_id', userId);
      
            if (updateError) {
              console.error('Error actualizando inventario:', updateError.details);
              throw updateError;
            }
      
            // Actualizar cache
            if (this.playerStats) {
              this.playerStats.inventario = nuevoInventario;
            }
        } catch (error: any) {
            console.error('Error añadiendo objeto al inventario:', error);
            throw error;
        }
    }
    

    /**
     * Otorga una recompensa a un usuario, la agrega a su inventario y actualiza su XP.
     * Si la recompensa ya existe, incrementa su cantidad.
     * @param userId El ID del usuario.
     * @param recompensaId El ID de la recompensa.
     * @param historiaId El ID de la historia que se está completando.
     */
    async otorgarRecompensa(userId: string, recompensaId: number, historiaId: number) {
        try {
            const { data: recompensa, error: recompensaError } = await supabase
                .from('recompensa')
                .select('*')
                .eq('id_recompensa', recompensaId)
                .single();

            if (recompensaError) throw recompensaError;

            const { data: currentProfile, error: profileError } = await supabase
                .from('perfiles_jugador')
                .select('xp_total, historias_visitadas, inventario')
                .eq('user_id', userId)
                .single();

            if (profileError) throw profileError;

            const newXp = currentProfile.xp_total + (recompensa.valor || 0);

            const inventarioActual: InventoryItem[] = currentProfile.inventario || [];
            const recompensaExistenteIndex = inventarioActual.findIndex(item => item.id === recompensaId);

            let nuevoInventario = [...inventarioActual];

            if (recompensaExistenteIndex !== -1) {
                nuevoInventario[recompensaExistenteIndex].cantidad += 1;
            } else {
                const nuevoItem: InventoryItem = {
                    id: recompensa.id_recompensa,
                    nombre: recompensa.nombre,
                    descripcion: recompensa.descripcion,
                    valor: recompensa.valor,
                    cantidad: 1,
                    tipo: recompensa.tipo,
                    historia_origen: recompensa.historia_origen,
                    fecha_obtencion: new Date().toISOString(),
                    rareza: 'común' // Asumiendo que la rareza no está en la tabla de recompensas                        
                };
                nuevoInventario.push(nuevoItem);
            }

            const historiasActuales = currentProfile.historias_visitadas || [];
            let nuevasHistorias = [...historiasActuales];
            if (!nuevasHistorias.includes(historiaId)) {
                nuevasHistorias.push(historiaId);
            }

            const { data, error } = await supabase
                .from('perfiles_jugador')
                .update({
                    xp_total: newXp,
                    inventario: nuevoInventario,
                    historias_visitadas: nuevasHistorias
                })
                .eq('user_id', userId);

            if (error) {
                console.error("Error al otorgar recompensa y actualizar inventario:", error);
                return { data: null, error };
            }

            return { data, error: null };
        } catch (error) {
            console.error('Error en otorgarRecompensa:', error);
            return { data: null, error };
        }
    }

    /**
     * Registra que un usuario ha conocido a un personaje.
     * @param userId El ID del usuario.
     * @param characterName El nombre del personaje conocido.
     */
    async knowCharacter(userId: string, characterName: string): Promise<{ error: any }> {
        try {
            const stats = await this.getPlayerStats(userId);
            if (!stats) {
                // Si no hay estadísticas, se crea un registro con el nuevo personaje.
                const { error } = await supabase.from('perfiles_jugador').insert([{
                    user_id: userId,
                    personajes_conocidos: [characterName],
                }]);
                if (error) throw error;
            } else {
                // Si ya existe, se verifica si el personaje ya está en la lista.
                if (!stats.personajes_conocidos.includes(characterName)) {
                    const { error } = await supabase.from('perfiles_jugador')
                        .update({ personajes_conocidos: [...stats.personajes_conocidos, characterName] })
                        .eq('user_id', userId);
                    if (error) throw error;
                }
            }
            return { error: null };
        } catch (error: any) {
            console.error("Error registrando personaje:", error.message);
            return { error };
        }
    }
    
    /**
     * Otorga XP al jugador por completar una historia
     */
    async completeStory(userId: string, historiaId: string, esHistoriaPrincipal: boolean = false): Promise<GameEvent> {
        try {
        const stats = await this.getPlayerStats(userId)
        if (!stats) throw new Error('No se pudo obtener el perfil del jugador')

        const xpGanado = 25
        const nuevoXP = stats.xp_total + xpGanado
        const nuevoNivel = this.calculateLevel(nuevoXP)
        const historiasCompletadas = stats.historias_completadas + 1
        const historiasVisitadas = stats.historias_visitadas.includes(historiaId) ? stats.historias_visitadas : [...stats.historias_visitadas, historiaId]

        console.log(`SCORE ACTUAL :`, stats.xp_total);

        console.log(`Historia ${historiaId} completada por ${userId}. XP ganado: ${xpGanado}. Nuevo XP: ${nuevoXP}, Nuevo Nivel: ${nuevoNivel}`)
        // Actualizar estadísticas
        const { error: updateError } = await supabase
            .from('perfiles_jugador')
            .update({
            xp_total: nuevoXP,
            nivel: nuevoNivel,
            historias_completadas: historiasCompletadas,
            fecha_ultimo_acceso: new Date().toISOString(),
            historias_visitadas: historiasVisitadas
            })
            .eq('user_id', userId)

        if (updateError) throw updateError

        // Crear evento de juego
        const gameEvent: GameEvent = {
            id: `${Date.now()}-${Math.random()}`,
            tipo: 'historia_completada',
            descripcion: `¡Historia completada! ${esHistoriaPrincipal ? 'Historia Principal' : 'Historia Secundaria'}`,
            xp_ganado: xpGanado,
            fecha: new Date().toISOString()
        }

        // Actualizar cache local
        if (this.playerStats) {
            this.playerStats.xp_total = nuevoXP
            this.playerStats.nivel = nuevoNivel
            this.playerStats.historias_completadas = historiasCompletadas
        }

        // Verificar logros
        await this.checkAndUnlockAchievements(userId, stats)

        return gameEvent
        } catch (error: any) {
        console.error('Error completando historia:', error)
        throw error
        }
    }
    
    /**
    * Registra una interacción del jugador con el flujo narrativo.
    * @param userId El ID del usuario.
    * @param flujoId El ID del paso del flujo narrativo.
    * @param tipoInteraccion El tipo de interacción ('navegacion', 'decision', etc.).
    */
    public async registrarInteraccion(userId: string, flujoId: number, tipoInteraccion: string): Promise<void> {
        try {
            const { error } = await supabase
                .from('interaccionusuario')
                .insert({
                    user_id: userId,
                    id_flujo: flujoId,
                    tipo: tipoInteraccion,
                    fecha_interaccion: new Date().toISOString()
                })
            
            if (error) throw error

            console.log(`✅ Interacción de ${userId} registrada para el paso ${flujoId}.`)
        } catch (error) {
            console.error('Error al registrar interacción:', error)
            throw error
        }
    }

    /**
     * Obtiene una lista de todas las historias disponibles.
     */
    async fetchHistorias(): Promise<{ data: any[] | null; error: any }> {
        try {
            const { data, error } = await supabase
                .from('historia')
                .select('*');
            return { data, error };
        } catch (error: any) {
            console.error("Error fetching historias:", error.message);
            return { data: null, error };
        }
    }

    /**
     * Obtiene el flujo narrativo para una historia específica.
     * @param historiaId El ID de la historia.
     */
    async fetchNarrativeFlowByHistoriaId(historiaId: number): Promise<{ data: any[] | null; error: any }> {
        try {
            const { data, error } = await supabase
                .from('flujo_narrativo')
                .select(`
                    id_flujo, orden, tipo_paso, contenido, id_recompensa, id_personaje, recursomultimedia_id, id_siguiente_paso, id_historia,
                    opciones_decision
                `)
                .eq('id_historia', historiaId)
                .order('orden', { ascending: true });
            return { data, error };
        } catch (error: any) {
            console.error("Error fetching narrative flow:", error.message);
            return { data: null, error };
        }
    }

    /**
     * Obtiene todos los recursos multimedia.
     */
    async fetchMultimediaResources(): Promise<{ data: any[] | null; error: any }> {
        try {
            const { data, error } = await supabase
                .from('recursomultimedia')
                .select('*');
            return { data, error };
        } catch (error: any) {
            console.error("Error fetching multimedia resources:", error.message);
            return { data: null, error };
        }
    }

    /**
     * Obtiene todas las recompensas disponibles.
     */
    async fetchRewards(): Promise<{ data: RecompensaData[] | null; error: any }> {
        try {
            const { data, error } = await supabase
                .from('recompensa')
                .select('*');
            return { data, error };
        } catch (error: any) {
            console.error("Error fetching rewards:", error.message);
            return { data: null, error };
        }
    }

    /**
     * Obtiene todos los personajes del juego.
     */
    async fetchCharacters(): Promise<{ data: PersonajeData[] | null; error: any }> {
        try {
            const { data, error } = await supabase
                .from('personaje')
                .select('*');
            return { data, error };
        } catch (error: any) {
            console.error("Error fetching characters:", error.message);
            return { data: null, error };
        }
    }


    /**
   * Verifica y desbloquea logros
   */
    async checkAndUnlockAchievements(userId: string, currentStats: PlayerStats): Promise<string[]> {
        const newAchievements: string[] = []

        // Logros por historias completadas
        if (currentStats.historias_completadas >= 1 && !currentStats.logros_desbloqueados.includes('primera_historia')) {
        newAchievements.push('primera_historia')
        }
        if (currentStats.historias_completadas >= 5 && !currentStats.logros_desbloqueados.includes('explorador_novato')) {
        newAchievements.push('explorador_novato')
        }
        if (currentStats.historias_completadas >= 10 && !currentStats.logros_desbloqueados.includes('narrador_experto')) {
        newAchievements.push('narrador_experto')
        }

        // Logros por nivel
        if (currentStats.nivel >= 5 && !currentStats.logros_desbloqueados.includes('resistente_veterano')) {
        newAchievements.push('resistente_veterano')
        }

        // Logros por personajes conocidos
        if (currentStats.personajes_conocidos.length >= 5 && !currentStats.logros_desbloqueados.includes('socialite_urbano')) {
        newAchievements.push('socialite_urbano')
        }

        // Logros por ubicaciones
        if (currentStats.historias_visitadas.length >= 10 && !currentStats.logros_desbloqueados.includes('explorador_urbano')) {
        newAchievements.push('explorador_urbano')
        }

        // Actualizar logros si hay nuevos
        if (newAchievements.length > 0) {
        const logrosActualizados = [...currentStats.logros_desbloqueados, ...newAchievements]
        
        const { error: updateError } = await supabase
            .from('perfiles_jugador')
            .update({
            logros_desbloqueados: logrosActualizados
            })
            .eq('user_id', userId)

        if (!updateError && this.playerStats) {
            this.playerStats.logros_desbloqueados = logrosActualizados
        }
        }

        return newAchievements
    }

    /**
   * Calcula el nivel basado en XP
   */
  calculateLevel(xp: number): number {
    // Fórmula: Nivel = √(XP / 100) + 1
    // Nivel 1: 0-99 XP, Nivel 2: 100-399 XP, Nivel 3: 400-899 XP, etc.
    return Math.floor(Math.sqrt(xp / 100)) + 1
  }

  /**
   * Calcula XP requerido para el siguiente nivel
   */
  getXPForNextLevel(currentLevel: number): number {
    return Math.pow(currentLevel, 2) * 100
  }
}



export const gameServiceUser = GameServiceUser.getInstance();
