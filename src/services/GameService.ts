import { supabase } from '../supabaseClient'

// Tipos para el sistema de juego
export interface PlayerStats {
  id: string
  user_id: string
  nivel: number
  xp_total: number
  historias_completadas: number
  personajes_conocidos: string[]
  ubicaciones_visitadas: string[]
  logros_desbloqueados: string[]
  inventario: InventoryItem[]
  fecha_ultimo_acceso: string
  racha_dias_consecutivos: number
}

export interface InventoryItem {
  id: string
  nombre: string
  descripcion: string
  tipo: 'documento' | 'foto' | 'contacto' | 'evidencia' | 'memoria'
  rareza: 'común' | 'rara' | 'épica' | 'legendaria'
  fecha_obtencion: string
  historia_origen: string
}

export interface GameLogro {
  id: string
  nombre: string
  descripcion: string
  tipo: 'progreso' | 'exploración' | 'social' | 'secreto'
  requisitos: Record<string, any>
  recompensa_xp: number
  icono: string
}

export interface GameEvent {
  id: string
  tipo: 'historia_completada' | 'personaje_conocido' | 'ubicacion_visitada' | 'logro_desbloqueado'
  descripcion: string
  xp_ganado: number
  fecha: string
}

class GameService {
  private static instance: GameService
  private playerStats: PlayerStats | null = null
  private logros: GameLogro[] = []

  private constructor() {}

  static getInstance(): GameService {
    if (!GameService.instance) {
      GameService.instance = new GameService()
    }
    return GameService.instance
  }

  /**
   * Inicializa el perfil de juego para un usuario
   */
  async initializePlayerProfile(userId: string): Promise<PlayerStats> {
    try {
      // Verificar si ya existe un perfil
      const { data: existingProfile, error: fetchError } = await supabase
        .from('perfiles_jugador')
        .select('*')
        .eq('user_id', userId)
        .single()

      if (existingProfile && !fetchError) {
        this.playerStats = {
          ...existingProfile,
          personajes_conocidos: existingProfile.personajes_conocidos || [],
          ubicaciones_visitadas: existingProfile.ubicaciones_visitadas || [],
          logros_desbloqueados: existingProfile.logros_desbloqueados || [],
          inventario: existingProfile.inventario || []
        }
        return this.playerStats
      }

      // Crear nuevo perfil si no existe
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
      }

      const { data: createdProfile, error: createError } = await supabase
        .from('perfiles_jugador')
        .insert(newProfile)
        .select()
        .single()

      if (createError) {
        throw new Error(`Error creando perfil: ${createError.message}`)
      }

      this.playerStats = createdProfile as PlayerStats
      return this.playerStats
    } catch (error: any) {
      console.error('Error inicializando perfil de jugador:', error)
      throw error
    }
  }

  /**
   * Obtiene las estadísticas del jugador
   */
  async getPlayerStats(userId: string): Promise<PlayerStats | null> {
    try {
      if (this.playerStats && this.playerStats.user_id === userId) {
        return this.playerStats
      }

      const { data: profile, error } = await supabase
        .from('perfiles_jugador')
        .select('*')
        .eq('user_id', userId)
        .single()

      if (error || !profile) {
        // Si no existe perfil, lo creamos
        return await this.initializePlayerProfile(userId)
      }

      this.playerStats = {
        ...profile,
        personajes_conocidos: profile.personajes_conocidos || [],
        ubicaciones_visitadas: profile.ubicaciones_visitadas || [],
        logros_desbloqueados: profile.logros_desbloqueados || [],
        inventario: profile.inventario || []
      }

      return this.playerStats
    } catch (error: any) {
      console.error('Error obteniendo estadísticas:', error)
      return null
    }
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
   * Otorga XP al jugador por completar una historia
   */
  async completeStory(userId: string, historiaId: string, esHistoriaPrincipal: boolean = false): Promise<GameEvent> {
    try {
      const stats = await this.getPlayerStats(userId)
      if (!stats) throw new Error('No se pudo obtener el perfil del jugador')

      const xpGanado = esHistoriaPrincipal ? 150 : 75
      const nuevoXP = stats.xp_total + xpGanado
      const nuevoNivel = this.calculateLevel(nuevoXP)
      const historiasCompletadas = stats.historias_completadas + 1

      // Actualizar estadísticas
      const { error: updateError } = await supabase
        .from('perfiles_jugador')
        .update({
          xp_total: nuevoXP,
          nivel: nuevoNivel,
          historias_completadas: historiasCompletadas,
          fecha_ultimo_acceso: new Date().toISOString()
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
   * Registra que un jugador conoció un personaje
   */
  async meetCharacter(userId: string, personajeId: string): Promise<GameEvent | null> {
    try {
      const stats = await this.getPlayerStats(userId)
      if (!stats) throw new Error('No se pudo obtener el perfil del jugador')

      // Verificar si ya conoce el personaje
      if (stats.personajes_conocidos.includes(personajeId)) {
        return null // Ya lo conoce
      }

      const xpGanado = 25
      const nuevoXP = stats.xp_total + xpGanado
      const nuevoNivel = this.calculateLevel(nuevoXP)
      const nuevosPersonajes = [...stats.personajes_conocidos, personajeId]

      // Actualizar estadísticas
      const { error: updateError } = await supabase
        .from('perfiles_jugador')
        .update({
          xp_total: nuevoXP,
          nivel: nuevoNivel,
          personajes_conocidos: nuevosPersonajes
        })
        .eq('user_id', userId)

      if (updateError) throw updateError

      // Crear evento
      const gameEvent: GameEvent = {
        id: `${Date.now()}-${Math.random()}`,
        tipo: 'personaje_conocido',
        descripcion: '¡Has conocido a un nuevo personaje!',
        xp_ganado: xpGanado,
        fecha: new Date().toISOString()
      }

      // Actualizar cache
      if (this.playerStats) {
        this.playerStats.xp_total = nuevoXP
        this.playerStats.nivel = nuevoNivel
        this.playerStats.personajes_conocidos = nuevosPersonajes
      }

      return gameEvent
    } catch (error: any) {
      console.error('Error registrando personaje conocido:', error)
      throw error
    }
  }

  /**
   * Registra que un jugador visitó una ubicación
   */
  async visitLocation(userId: string, ubicacionId: string): Promise<GameEvent | null> {
    try {
      const stats = await this.getPlayerStats(userId)
      if (!stats) throw new Error('No se pudo obtener el perfil del jugador')

      // Verificar si ya visitó la ubicación
      if (stats.ubicaciones_visitadas.includes(ubicacionId)) {
        return null // Ya la visitó
      }

      const xpGanado = 50
      const nuevoXP = stats.xp_total + xpGanado
      const nuevoNivel = this.calculateLevel(nuevoXP)
      const nuevasUbicaciones = [...stats.ubicaciones_visitadas, ubicacionId]

      // Actualizar estadísticas
      const { error: updateError } = await supabase
        .from('perfiles_jugador')
        .update({
          xp_total: nuevoXP,
          nivel: nuevoNivel,
          ubicaciones_visitadas: nuevasUbicaciones
        })
        .eq('user_id', userId)

      if (updateError) throw updateError

      // Crear evento
      const gameEvent: GameEvent = {
        id: `${Date.now()}-${Math.random()}`,
        tipo: 'ubicacion_visitada',
        descripcion: '¡Has explorado una nueva ubicación!',
        xp_ganado: xpGanado,
        fecha: new Date().toISOString()
      }

      // Actualizar cache
      if (this.playerStats) {
        this.playerStats.xp_total = nuevoXP
        this.playerStats.nivel = nuevoNivel
        this.playerStats.ubicaciones_visitadas = nuevasUbicaciones
      }

      return gameEvent
    } catch (error: any) {
      console.error('Error registrando ubicación visitada:', error)
      throw error
    }
  }

  /**
   * Añade un objeto al inventario
   */
  async addToInventory(userId: string, item: Omit<InventoryItem, 'fecha_obtencion'>): Promise<void> {
    try {
      const stats = await this.getPlayerStats(userId)
      if (!stats) throw new Error('No se pudo obtener el perfil del jugador')

      const newItem: InventoryItem = {
        ...item,
        fecha_obtencion: new Date().toISOString()
      }

      const nuevoInventario = [...stats.inventario, newItem]

      // Actualizar inventario
      const { error: updateError } = await supabase
        .from('perfiles_jugador')
        .update({
          inventario: nuevoInventario
        })
        .eq('user_id', userId)

      if (updateError) throw updateError

      // Actualizar cache
      if (this.playerStats) {
        this.playerStats.inventario = nuevoInventario
      }
    } catch (error: any) {
      console.error('Error añadiendo objeto al inventario:', error)
      throw error
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
    if (currentStats.ubicaciones_visitadas.length >= 10 && !currentStats.logros_desbloqueados.includes('explorador_urbano')) {
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
   * Actualiza la racha de días consecutivos
   */
  async updateDailyStreak(userId: string): Promise<void> {
    try {
      const stats = await this.getPlayerStats(userId)
      if (!stats) return

      const hoy = new Date()
      const ultimoAcceso = new Date(stats.fecha_ultimo_acceso)
      const diferenciaDias = Math.floor((hoy.getTime() - ultimoAcceso.getTime()) / (1000 * 60 * 60 * 24))

      let nuevaRacha = stats.racha_dias_consecutivos

      if (diferenciaDias === 1) {
        // Día consecutivo
        nuevaRacha += 1
      } else if (diferenciaDias > 1) {
        // Se rompió la racha
        nuevaRacha = 1
      }
      // Si diferenciaDias === 0, es el mismo día, no cambiar racha

      if (diferenciaDias >= 1) {
        const { error: updateError } = await supabase
          .from('perfiles_jugador')
          .update({
            fecha_ultimo_acceso: hoy.toISOString(),
            racha_dias_consecutivos: nuevaRacha
          })
          .eq('user_id', userId)

        if (!updateError && this.playerStats) {
          this.playerStats.fecha_ultimo_acceso = hoy.toISOString()
          this.playerStats.racha_dias_consecutivos = nuevaRacha
        }
      }
    } catch (error: any) {
      console.error('Error actualizando racha diaria:', error)
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
      const stats = await this.getPlayerStats(userId)
      if (!stats) return null

      // Actualizar racha diaria
      await this.updateDailyStreak(userId)

      const xpSiguienteNivel = this.getXPForNextLevel(stats.nivel)
      const xpParaSiguienteNivel = Math.max(0, xpSiguienteNivel - stats.xp_total)

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
      }
    } catch (error: any) {
      console.error('Error obteniendo estadísticas del dashboard:', error)
      return null
    }
  }

  /**
   * Resetea el cache (útil para testing o cuando el usuario cambia)
   */
  clearCache(): void {
    this.playerStats = null
  }
}

// Exportar instancia singleton
export const gameService = GameService.getInstance()
export default gameService