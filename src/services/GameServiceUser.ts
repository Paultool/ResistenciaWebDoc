import { supabase } from '../supabaseClient';

export interface InventoryItem {
    id: string | number;
    nombre: string;
    descripcion: string;
    tipo: string;
    rareza?: string;
    fecha_obtencion: string;
    historia_origen?: string | number | null;
    cantidad?: number;
    valor?: number;
}

export interface PlayerStats {
    id: string;
    user_id: string;
    nivel: number;
    xp_total: number;
    historias_completadas: number;
    historias_visitadas: string[];
    personajes_conocidos: string[];
    ubicaciones_visitadas: string[];
    logros_desbloqueados: string[];
    inventario: InventoryItem[];
    fecha_ultimo_acceso: string;
    racha_dias_consecutivos: number;
    historias_favoritas: string[];
}

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

    private constructor() { }

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

            // Asegurar que todos los arrays se inicialicen correctamente
            const playerStats: PlayerStats = {
                ...(data as PlayerStats),
                inventario: data.inventario || [],
                historias_visitadas: data.historias_visitadas || [],
                personajes_conocidos: data.personajes_conocidos || [],
                ubicaciones_visitadas: data.ubicaciones_visitadas || [],
                logros_desbloqueados: data.logros_desbloqueados || [],
                historias_favoritas: data.historias_favoritas || [],
            };

            console.log('📊 [getPlayerStats] Datos recuperados:', playerStats);
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

    // Esta función verifica si el usuario existe, y si no, lo crea.
    async initializePlayerProfile(userId: string) {
        try {
            // 1. Verificar si ya existe
            const { data: existing } = await supabase
                .from('perfiles_jugador')
                .select('*')
                .eq('user_id', userId)
                .single();

            if (existing) {
                return { ...existing, puntuacion: existing.xp_total };
            }

            // 2. Insertar SIN el campo email
            const { data, error } = await supabase
                .from('perfiles_jugador')
                .insert([
                    {
                        user_id: userId,
                        historias_completadas: 0, // Obligatorio según tu esquema
                        xp_total: 0,
                        nivel: 1,
                        inventario: [],
                        historias_visitadas: [],
                        personajes_conocidos: []
                    }
                ])
                .select()
                .single();

            if (error) throw error;

            return {
                ...data,
                puntuacion: data.xp_total
            };

        } catch (error: any) {
            console.error("Error creando perfil:", error.message);
            return null;
        }
    }
    // Funcion para aplicar XP directamente
    async aplicarXPDirecto(userId: string, xpAmount: number, razon: string) {
        console.log(`[SERVICE] Modificando XP: ${xpAmount} para usuario: ${userId}. Razón: ${razon}`);

        try {
            // 1. LEER EL XP ACTUAL
            // IMPORTANTE: Cambia 'perfiles' por el nombre real de tu tabla si es 'users' o 'profiles'
            const { data: currentData, error: readError } = await supabase
                .from('perfiles_jugador')
                .select('xp_total') // Asegúrate que la columna se llama 'puntuacion' o 'xp_total'
                .eq('user_id', userId)
                .single();

            if (readError) {
                console.error("Error leyendo XP actual:", readError);
                throw readError;
            }

            const currentXP = currentData?.xp_total || 0;
            const newXP = currentXP + xpAmount; // Suma algebraica (si xpAmount es -150, restará)

            // 2. ACTUALIZAR EL XP EN LA BASE DE DATOS
            const { error: updateError } = await supabase
                .from('perfiles_jugador')
                .update({ xp_total: newXP }) // Asegúrate que la columna se llama 'puntuacion'
                .eq('user_id', userId);

            if (updateError) {
                console.error("Error actualizando XP:", updateError);
                throw updateError;
            }

            console.log(`[SERVICE] XP actualizado en BD de ${currentXP} a ${newXP}`);

            // 3. MAGIA: LLAMAR A getPlayerStats PARA DEVOLVER EL FORMATO CORRECTO
            // Esto elimina los errores de tipo porque usa tu función que ya funciona.
            const updatedStats = await this.getPlayerStats(userId);
            return { data: updatedStats, error: null };

        } catch (error: any) {
            console.error("[SERVICE] Error crítico en aplicarXPDirecto:", error.message);
            // Devolvemos la estructura de error estándar
            return { data: null, error };
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
    async otorgarRecompensa(userId: string, recompensaId: number, historiaId: string, marcarComoVisitada: boolean = false) {
        try {
            console.log('🔵 [otorgarRecompensa] INICIO');
            console.log('🔵 [otorgarRecompensa] userId:', userId, 'tipo:', typeof userId);
            console.log('🔵 [otorgarRecompensa] recompensaId:', recompensaId, 'tipo:', typeof recompensaId);
            console.log('🔵 [otorgarRecompensa] historiaId:', historiaId, 'tipo:', typeof historiaId);

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

            console.log('🔵 [otorgarRecompensa] historias_visitadas actuales:', currentProfile.historias_visitadas);
            console.log('🔵 [otorgarRecompensa] historias_visitadas tipo:', typeof currentProfile.historias_visitadas);

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
                    historia_origen: historiaId, // ✅ FIX: Usar el parámetro historiaId en lugar de recompensa.historia_origen
                    fecha_obtencion: new Date().toISOString(),
                    rareza: 'común' // Asumiendo que la rareza no está en la tabla de recompensas                        
                };
                nuevoInventario.push(nuevoItem);
            }
            const historiasActuales = currentProfile.historias_visitadas || [];
            let nuevasHistorias = [...historiasActuales];

            // ✅ Solo agregar si se especifica explícitamente
            if (marcarComoVisitada && !nuevasHistorias.includes(historiaId)) {
                nuevasHistorias.push(historiaId);
            }
            console.log('🔵 [otorgarRecompensa] nuevoInventario:', JSON.stringify(nuevoInventario, null, 2));

            const updateData = {
                xp_total: newXp,
                inventario: nuevoInventario,
                ...(marcarComoVisitada ? { historias_visitadas: nuevasHistorias } : {})  // ✅ Condicional
            };
            console.log('🔵 [otorgarRecompensa] Datos a enviar a Supabase:', JSON.stringify(updateData, null, 2));
            const { data, error } = await supabase
                .from('perfiles_jugador')
                .update(updateData)
                .eq('user_id', userId);

            if (error) {
                console.error("🔴 [otorgarRecompensa] Error al otorgar recompensa:", error);
                return { data: null, error };
            }

            console.log('🟢 [otorgarRecompensa] ÉXITO');
            return { data, error: null };
        } catch (error) {
            console.error('🔴 [otorgarRecompensa] Error en otorgarRecompensa:', error);
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
     * Registra el encuentro de un usuario con un personaje y otorga XP.
     * @param userId El ID del usuario.
     * @param characterId El ID del personaje conocido.
     * @returns GameEvent con información del XP ganado, o null si ya se conocía.
     */
    async meetCharacter(userId: string, characterId: string): Promise<GameEvent | null> {
        try {
            console.log(`🤝 [meetCharacter] Usuario ${userId} conociendo personaje ${characterId}`);

            const stats = await this.getPlayerStats(userId);
            if (!stats) {
                throw new Error('No se pudo obtener el perfil del jugador');
            }

            // Verificar si ya conoce al personaje
            if (stats.personajes_conocidos.includes(characterId)) {
                console.log(`⚠️ [meetCharacter] El usuario ya conoce al personaje ${characterId}`);
                return null;
            }

            // XP por conocer un personaje
            const xpGanado = 25;
            const nuevoXP = stats.xp_total + xpGanado;
            const nuevoNivel = this.calculateLevel(nuevoXP);
            const nuevosPersonajes = [...stats.personajes_conocidos, characterId];

            // Actualizar estadísticas
            const { error: updateError } = await supabase
                .from('perfiles_jugador')
                .update({
                    xp_total: nuevoXP,
                    nivel: nuevoNivel,
                    personajes_conocidos: nuevosPersonajes,
                    fecha_ultimo_acceso: new Date().toISOString()
                })
                .eq('user_id', userId);

            if (updateError) {
                console.error('❌ [meetCharacter] Error actualizando perfil:', updateError);
                throw updateError;
            }

            // Actualizar cache local
            if (this.playerStats) {
                this.playerStats.xp_total = nuevoXP;
                this.playerStats.nivel = nuevoNivel;
                this.playerStats.personajes_conocidos = nuevosPersonajes;
            }

            console.log(`✅ [meetCharacter] Personaje conocido. XP: ${stats.xp_total} → ${nuevoXP}`);

            // Crear evento de juego
            const gameEvent: GameEvent = {
                id: `${Date.now()}-${Math.random()}`,
                tipo: 'otro',
                descripcion: `¡Has conocido a un nuevo personaje!`,
                xp_ganado: xpGanado,
                fecha: new Date().toISOString()
            };

            // Verificar logros
            await this.checkAndUnlockAchievements(userId, stats);

            return gameEvent;
        } catch (error: any) {
            console.error('❌ [meetCharacter] Error en meetCharacter:', error);
            throw error;
        }
    }

    /**
     * Otorga XP al jugador por completar una historia
     */
    async completeStory(userId: string, historiaId: string, esHistoriaPrincipal: boolean = false): Promise<GameEvent> {
        try {
            console.log('🟡 [completeStory] INICIO');
            console.log('🟡 [completeStory] userId:', userId, 'tipo:', typeof userId);
            console.log('🟡 [completeStory] historiaId:', historiaId, 'tipo:', typeof historiaId);
            console.log('🟡 [completeStory] esHistoriaPrincipal:', esHistoriaPrincipal);

            const stats = await this.getPlayerStats(userId)
            if (!stats) throw new Error('No se pudo obtener el perfil del jugador')

            console.log('🟡 [completeStory] historias_visitadas actuales:', stats.historias_visitadas);
            console.log('🟡 [completeStory] historias_visitadas tipo:', typeof stats.historias_visitadas);
            console.log('🟡 [completeStory] historias_visitadas.includes(historiaId):', stats.historias_visitadas.includes(historiaId));

            const xpGanado = 25
            const nuevoXP = stats.xp_total + xpGanado
            const nuevoNivel = this.calculateLevel(nuevoXP)
            const historiasCompletadas = stats.historias_completadas + 1
            const historiasVisitadas = stats.historias_visitadas.includes(historiaId) ? stats.historias_visitadas : [...stats.historias_visitadas, historiaId]

            console.log('🟡 [completeStory] historiasVisitadas DESPUÉS de lógica:', historiasVisitadas);
            console.log('🟡 [completeStory] Cada elemento:', historiasVisitadas.map(h => `${h} (${typeof h})`));

            console.log(`SCORE ACTUAL :`, stats.xp_total);

            console.log(`Historia ${historiaId} completada por ${userId}. XP ganado: ${xpGanado}. Nuevo XP: ${nuevoXP}, Nuevo Nivel: ${nuevoNivel}`)

            const updateData = {
                xp_total: nuevoXP,
                nivel: nuevoNivel,
                historias_completadas: historiasCompletadas,
                fecha_ultimo_acceso: new Date().toISOString(),
                historias_visitadas: historiasVisitadas
            };
            console.log('🟡 [completeStory] Datos a enviar a Supabase:', JSON.stringify(updateData, null, 2));

            // Actualizar estadísticas
            const { error: updateError } = await supabase
                .from('perfiles_jugador')
                .update(updateData)
                .eq('user_id', userId)

            if (updateError) {
                console.error('🔴 [completeStory] Error en update:', updateError);
                throw updateError;
            }

            console.log('🟢 [completeStory] ÉXITO');

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
            console.error('🔴 [completeStory] Error completando historia:', error)
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
                .select('*, id_ubicacion ( coordenadas )');
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

    /**
     * Verifica y actualiza la racha de días consecutivos
     */
    private async checkAndUpdateStreak(userId: string, currentStats: PlayerStats): Promise<void> {
        try {
            const now = new Date();
            const lastAccess = new Date(currentStats.fecha_ultimo_acceso);

            // Normalizar fechas a medianoche para comparar días
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const lastDate = new Date(lastAccess.getFullYear(), lastAccess.getMonth(), lastAccess.getDate());

            const diffTime = Math.abs(today.getTime() - lastDate.getTime());
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            console.log(`📅 [Streak] Hoy: ${today.toISOString()}, Último: ${lastDate.toISOString()}, Diff: ${diffDays} días`);

            let newStreak = currentStats.racha_dias_consecutivos;
            let shouldUpdate = false;

            if (diffDays === 0) {
                // Mismo día, no hacer nada (excepto actualizar fecha_ultimo_acceso si queremos precisión de hora)
                console.log('📅 [Streak] Mismo día, racha se mantiene.');
            } else if (diffDays === 1) {
                // Día consecutivo, aumentar racha
                newStreak += 1;
                shouldUpdate = true;
                console.log(`📅 [Streak] Día consecutivo! Racha aumenta a ${newStreak}`);
            } else {
                // Se rompió la racha (más de 1 día de diferencia)
                newStreak = 1;
                shouldUpdate = true;
                console.log(`📅 [Streak] Racha rota. Reiniciando a 1.`);
            }

            // Siempre actualizamos fecha_ultimo_acceso al entrar
            const updateData: any = {
                fecha_ultimo_acceso: now.toISOString()
            };

            if (shouldUpdate) {
                updateData.racha_dias_consecutivos = newStreak;
            }

            // Actualizar en DB
            const { error } = await supabase
                .from('perfiles_jugador')
                .update(updateData)
                .eq('user_id', userId);

            if (error) {
                console.error('❌ [Streak] Error actualizando racha:', error);
            } else {
                // Actualizar objeto local
                currentStats.fecha_ultimo_acceso = updateData.fecha_ultimo_acceso;
                if (shouldUpdate) {
                    currentStats.racha_dias_consecutivos = newStreak;
                }
                console.log('✅ [Streak] Racha y/o fecha actualizadas correctamente.');
            }

        } catch (error) {
            console.error('❌ [Streak] Error en checkAndUpdateStreak:', error);
        }
    }
    /**
 * Alterna el estado de favorito de una historia para un usuario.
 * @param userId El ID del usuario.
 * @param storyId El ID de la historia.
 * @returns true si la historia es ahora favorita, false si se eliminó de favoritos.
 */
    async toggleFavoriteStory(userId: string, storyId: string): Promise<boolean> {
        try {
            const stats = await this.getPlayerStats(userId);
            if (!stats) throw new Error("Usuario no encontrado");

            const favorites = stats.historias_favoritas || [];
            const index = favorites.indexOf(storyId);
            let newFavorites: string[];
            let isFavorite: boolean;

            if (index > -1) {
                // Eliminar de favoritos
                newFavorites = favorites.filter(id => id !== storyId);
                isFavorite = false;
                console.log(`💔 [Favorites] Eliminando historia ${storyId} de favoritos.`);
            } else {
                // Agregar a favoritos
                newFavorites = [...favorites, storyId];
                isFavorite = true;
                console.log(`❤️ [Favorites] Agregando historia ${storyId} a favoritos.`);
            }

            const { error } = await supabase
                .from('perfiles_jugador')
                .update({ historias_favoritas: newFavorites })
                .eq('user_id', userId);

            if (error) throw error;

            // Actualizar cache local
            if (this.playerStats) {
                this.playerStats.historias_favoritas = newFavorites;
            }

            return isFavorite;
        } catch (error: any) {
            console.error("❌ [Favorites] Error toggling favorite:", error.message);
            throw error;
        }
    }

    /**
     * Obtiene los detalles completos de las historias favoritas del usuario.
     */
    async getFavoriteStoriesDetails(userId: string): Promise<any[]> {
        try {
            const stats = await this.getPlayerStats(userId);
            if (!stats || !stats.historias_favoritas || stats.historias_favoritas.length === 0) {
                return [];
            }

            // Convertir IDs a números si es necesario (asumiendo que en DB son numéricos o strings consistentes)
            // El fix anterior mostró que 'id_historia' es la columna correcta y espera números si los IDs son numéricos.
            // Sin embargo, 'historias_favoritas' es string[]. Vamos a intentar convertir.
            const favoriteIds = stats.historias_favoritas
                .map(id => Number(id))
                .filter(id => !isNaN(id));

            if (favoriteIds.length === 0) return [];

            const { data, error } = await supabase
                .from('historia')
                .select('*, id_ubicacion ( nombre, coordenadas )') // Traemos detalles de ubicación también
                .in('id_historia', favoriteIds);

            if (error) throw error;

            return data || [];
        } catch (error: any) {
            console.error("❌ [Favorites] Error fetching favorite stories details:", error.message);
            return [];
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
            console.log('📊 [getDashboardStats] Iniciando para usuario:', userId);
            const stats = await this.getPlayerStats(userId)

            if (!stats) {
                console.error('❌ [getDashboardStats] No se pudieron obtener las estadísticas del jugador');
                return null
            }

            // Verificar y actualizar racha antes de devolver datos
            await this.checkAndUpdateStreak(userId, stats);
            console.log('📊 [getDashboardStats] Stats obtenidos:', stats);
            console.log('📊 [getDashboardStats] historias_visitadas:', stats.historias_visitadas);

            const xpSiguienteNivel = this.getXPForNextLevel(stats.nivel)
            const xpParaSiguienteNivel = Math.max(0, xpSiguienteNivel - stats.xp_total)

            // Calcular ubicaciones únicas visitadas
            let uniqueLocationsCount = 0;
            console.log('🔍 [getDashboardStats] Historias visitadas (raw):', stats.historias_visitadas);

            if (stats.historias_visitadas && stats.historias_visitadas.length > 0) {
                // Convertimos a números para evitar error 400 si la columna id es numérica
                const historiasIds = stats.historias_visitadas
                    .map(id => Number(id))
                    .filter(id => !isNaN(id));

                console.log('🔍 [getDashboardStats] Ejecutando query con IDs numéricos:', historiasIds);

                if (historiasIds.length > 0) {
                    const { data: storiesData, error: storiesError } = await supabase
                        .from('historia')
                        .select('id_ubicacion')
                        .in('id_historia', historiasIds);

                    console.log('🔍 [getDashboardStats] Resultado query historia- Error:', storiesError);
                    console.log('🔍 [getDashboardStats] Resultado query historia- Data:', storiesData);

                    if (!storiesError && storiesData) {
                        // Filtramos nulos por si acaso
                        const validLocations = storiesData.filter(s => s.id_ubicacion !== null && s.id_ubicacion !== undefined);
                        const uniqueLocations = new Set(validLocations.map(s => s.id_ubicacion));
                        uniqueLocationsCount = uniqueLocations.size;
                        console.log('🔍 [getDashboardStats] Ubicaciones únicas calculadas:', uniqueLocationsCount);
                    } else {
                        console.log('❌ [getDashboardStats] Falló la query de historias.');
                    }
                } else {
                    console.log('⚠️ [getDashboardStats] No hay IDs válidos tras conversión.');
                }
            } else {
                console.log('⚠️ [getDashboardStats] No hay historias visitadas en el perfil.');
            }

            const result = {
                nivel: stats.nivel,
                xpTotal: stats.xp_total,
                xpParaSiguienteNivel,
                historiasCompletadas: stats.historias_visitadas?.length || 0,
                personajesConocidos: stats.personajes_conocidos?.length || 0,
                ubicacionesVisitadas: uniqueLocationsCount,
                logrosDesbloqueados: stats.logros_desbloqueados?.length || 0,
                rachaDias: stats.racha_dias_consecutivos,
                inventarioItems: stats.inventario?.length || 0
            };

            console.log('✅ [getDashboardStats] Resultado calculado:', result);
            return result;
        } catch (error: any) {
            console.error('❌ [getDashboardStats] Error obteniendo estadísticas del dashboard:', error)
            return null
        }
    }

    // Método para limpiar caché al cerrar sesión
    public clearCache(): void {
        console.log('Limpiando caché de servicio de juego...');
        // Si implementamos caché en memoria en el futuro, limpiarlo aquí
        this.playerStats = null;
    }

    /**
     * Obtiene las historias completadas con detalles completos
     */
    async getCompletedStories(userId: string): Promise<any[]> {
        try {
            const stats = await this.getPlayerStats(userId);
            if (!stats || !stats.historias_visitadas || stats.historias_visitadas.length === 0) {
                return [];
            }

            const historiasIds = stats.historias_visitadas
                .map(id => Number(id))
                .filter(id => !isNaN(id));

            if (historiasIds.length === 0) return [];

            const { data, error } = await supabase
                .from('historia')
                .select('id_historia, titulo, narrativa, id_ubicacion ( nombre )')
                .in('id_historia', historiasIds);

            if (error) throw error;
            return data || [];
        } catch (error: any) {
            console.error("Error fetching completed stories:", error.message);
            return [];
        }
    }

    /**
     * Obtiene los personajes conocidos con detalles completos
     */
    async getKnownCharacters(userId: string): Promise<any[]> {
        try {
            console.log('🔍 [getKnownCharacters] Obteniendo personajes conocidos para usuario:', userId);
            const stats = await this.getPlayerStats(userId);
            if (!stats || !stats.personajes_conocidos || stats.personajes_conocidos.length === 0) {
                console.log('🔍 [getKnownCharacters] No se encontraron personajes conocidos para el usuario');
                return [];
            }
            console.log('🔍 [getKnownCharacters] Personajes conocidos obtenidos:', stats.personajes_conocidos);

            // Intentamos identificar si son IDs numéricos
            const characterIds = stats.personajes_conocidos
                .map(id => Number(id))
                .filter(id => !isNaN(id));

            // Si encontramos IDs numéricos, consultamos la base de datos
            if (characterIds.length > 0) {
                console.log('🔍 [getKnownCharacters] IDs numéricos encontrados:', characterIds);
                const { data, error } = await supabase
                    .from('personaje')
                    .select('id_personaje, nombre, descripcion')
                    .in('id_personaje', characterIds);

                if (error) throw error;
                return data || [];
            }

            // Si NO hay IDs numéricos (son nombres de texto), los devolvemos directamente
            // El Dashboard espera objetos con la propiedad 'nombre'
            console.log('🔍 [getKnownCharacters] Usando nombres almacenados directamente');
            return stats.personajes_conocidos.map(nombre => ({
                nombre: nombre,
                descripcion: 'Personaje conocido'
            }));

        } catch (error: any) {
            console.error("Error fetching known characters:", error.message);
            return [];
        }
    }

    /**
     * Obtiene las ubicaciones visitadas con detalles completos
     */
    async getVisitedLocations(userId: string): Promise<any[]> {
        try {
            const stats = await this.getPlayerStats(userId);
            if (!stats || !stats.historias_visitadas || stats.historias_visitadas.length === 0) {
                return [];
            }

            const historiasIds = stats.historias_visitadas
                .map(id => Number(id))
                .filter(id => !isNaN(id));

            if (historiasIds.length === 0) return [];

            const { data: storiesData, error: storiesError } = await supabase
                .from('historia')
                .select('id_ubicacion')
                .in('id_historia', historiasIds);

            if (storiesError) throw storiesError;

            // Obtener IDs únicos de ubicaciones
            const locationIds = [...new Set(storiesData
                ?.filter(s => s.id_ubicacion)
                .map(s => s.id_ubicacion))];

            if (locationIds.length === 0) return [];

            const { data, error } = await supabase
                .from('ubicacion')
                .select('id_ubicacion, nombre, descripcion, coordenadas')
                .in('id_ubicacion', locationIds);

            if (error) throw error;
            return data || [];
        } catch (error: any) {
            console.error("Error fetching visited locations:", error.message);
            return [];
        }
    }

    /**
     * Obtiene los logros desbloqueados con detalles
     */
    async getUnlockedRewards(userId: string): Promise<any[]> {
        try {
            const stats = await this.getPlayerStats(userId);
            if (!stats || !stats.logros_desbloqueados || stats.logros_desbloqueados.length === 0) {
                return [];
            }

            // Los logros desbloqueados son strings descriptivos
            return stats.logros_desbloqueados.map(logro => ({
                nombre: this.getAchievementName(logro),
                descripcion: this.getAchievementDescription(logro),
                id: logro
            }));
        } catch (error: any) {
            console.error("Error fetching unlocked rewards:", error.message);
            return [];
        }
    }

    /**
     * Obtiene los items del inventario
     */
    async getInventoryItems(userId: string): Promise<any[]> {
        try {
            const stats = await this.getPlayerStats(userId);
            if (!stats || !stats.inventario || stats.inventario.length === 0) {
                return [];
            }

            return stats.inventario;
        } catch (error: any) {
            console.error("Error fetching inventory items:", error.message);
            return [];
        }
    }

    /**
     * Obtiene el nombre amigable de un logro
     */
    private getAchievementName(achievementId: string): string {
        const names: { [key: string]: string } = {
            'primera_historia': 'Primera Historia',
            'explorador_novato': 'Explorador Novato',
            'narrador_experto': 'Narrador Experto',
            'resistente_veterano': 'Resistente Veterano',
            'socialite_urbano': 'Socialite Urbano',
            'explorador_urbano': 'Explorador Urbano'
        };
        return names[achievementId] || achievementId;
    }

    /**
     * Obtiene la descripción de un logro
     */
    private getAchievementDescription(achievementId: string): string {
        const descriptions: { [key: string]: string } = {
            'primera_historia': 'Completaste tu primera historia',
            'explorador_novato': 'Completaste 5 historias',
            'narrador_experto': 'Completaste 10 historias',
            'resistente_veterano': 'Alcanzaste el nivel 5',
            'socialite_urbano': 'Conociste 5 personajes',
            'explorador_urbano': 'Visitaste 10 ubicaciones diferentes'
        };
        return descriptions[achievementId] || 'Logro desbloqueado';
    }
}

export const gameServiceUser = GameServiceUser.getInstance();

