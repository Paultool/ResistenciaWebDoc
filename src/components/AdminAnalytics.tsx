import React, { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'

interface AnalyticsData {
  totalUsuarios: number
  usuariosActivos: number
  sesionesHoy: number
  historiasMasPopulares: Array<{nombre: string, completadas: number}>
  personajesMasConocidos: Array<{nombre: string, interacciones: number}>
  ubicacionesMasVisitadas: Array<{nombre: string, visitas: number}>
  promedioXP: number
  nivelPromedio: number
}

const AdminAnalytics: React.FC = () => {
  const [analytics, setAnalytics] = useState<AnalyticsData>({
    totalUsuarios: 0,
    usuariosActivos: 0,
    sesionesHoy: 0,
    historiasMasPopulares: [],
    personajesMasConocidos: [],
    ubicacionesMasVisitadas: [],
    promedioXP: 0,
    nivelPromedio: 0
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [timeRange, setTimeRange] = useState<'day' | 'week' | 'month'>('week')

  useEffect(() => {
    cargarAnalytics()
  }, [timeRange])

  const cargarAnalytics = async () => {
    try {
      setLoading(true)
      setError(null)

      // Simular datos analíticos por ahora
      // En una implementación real, estos datos vendrían de consultas a Supabase
      const simulatedData: AnalyticsData = {
        totalUsuarios: 142,
        usuariosActivos: 89,
        sesionesHoy: 34,
        historiasMasPopulares: [
          { nombre: 'Tepito Resiste', completadas: 67 },
          { nombre: 'Voces del Centro', completadas: 45 },
          { nombre: 'La Lucha Continúa', completadas: 38 },
          { nombre: 'Barrio Vivo', completadas: 29 },
          { nombre: 'Resistencia Cultural', completadas: 21 }
        ],
        personajesMasConocidos: [
          { nombre: 'María Elena Martínez', interacciones: 89 },
          { nombre: 'Carlos Tepiteño', interacciones: 76 },
          { nombre: 'Doña Carmen', interacciones: 54 },
          { nombre: 'El Profesor López', interacciones: 43 },
          { nombre: 'Joven Activista Ana', interacciones: 32 }
        ],
        ubicacionesMasVisitadas: [
          { nombre: 'Plaza de Tepito', visitas: 95 },
          { nombre: 'Zócalo Capitalino', visitas: 78 },
          { nombre: 'Mercado de San Juan', visitas: 56 },
          { nombre: 'Centro Histórico', visitas: 49 },
          { nombre: 'Barrio de la Merced', visitas: 34 }
        ],
        promedioXP: 1247,
        nivelPromedio: 3.2
      }

      setAnalytics(simulatedData)
    } catch (err: any) {
      setError('Error cargando analíticas: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="admin-analytics">
        <div className="loading">⏳ Cargando analíticas...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="admin-analytics">
        <div className="error">❌ {error}</div>
      </div>
    )
  }

  return (
    <div className="admin-analytics">
      <div className="admin-content-header">
        <h2>📊 Analíticas y Estadísticas</h2>
        <div className="time-filter">
          <select 
            value={timeRange} 
            onChange={(e) => setTimeRange(e.target.value as any)}
            className="time-select"
          >
            <option value="day">Último día</option>
            <option value="week">Última semana</option>
            <option value="month">Último mes</option>
          </select>
        </div>
      </div>

      <div className="analytics-grid">
        <div className="analytics-section users">
          <h3>👥 Usuarios</h3>
          <div className="stats-cards">
            <div className="stat-card">
              <div className="stat-number">{analytics.totalUsuarios}</div>
              <div className="stat-label">Total Usuarios</div>
            </div>
            <div className="stat-card">
              <div className="stat-number">{analytics.usuariosActivos}</div>
              <div className="stat-label">Usuarios Activos</div>
            </div>
            <div className="stat-card">
              <div className="stat-number">{analytics.sesionesHoy}</div>
              <div className="stat-label">Sesiones Hoy</div>
            </div>
          </div>
        </div>

        <div className="analytics-section progress">
          <h3>📈 Progreso General</h3>
          <div className="stats-cards">
            <div className="stat-card">
              <div className="stat-number">{analytics.promedioXP.toLocaleString()}</div>
              <div className="stat-label">XP Promedio</div>
            </div>
            <div className="stat-card">
              <div className="stat-number">{analytics.nivelPromedio.toFixed(1)}</div>
              <div className="stat-label">Nivel Promedio</div>
            </div>
          </div>
        </div>

        <div className="analytics-section popular-content">
          <h3>🔥 Historias Más Populares</h3>
          <div className="ranking-list">
            {analytics.historiasMasPopulares.map((historia, index) => (
              <div key={historia.nombre} className="ranking-item">
                <div className="rank">#{index + 1}</div>
                <div className="content">
                  <div className="name">{historia.nombre}</div>
                  <div className="metric">{historia.completadas} completadas</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="analytics-section characters">
          <h3>🎭 Personajes Más Conocidos</h3>
          <div className="ranking-list">
            {analytics.personajesMasConocidos.map((personaje, index) => (
              <div key={personaje.nombre} className="ranking-item">
                <div className="rank">#{index + 1}</div>
                <div className="content">
                  <div className="name">{personaje.nombre}</div>
                  <div className="metric">{personaje.interacciones} interacciones</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="analytics-section locations">
          <h3>📍 Ubicaciones Más Visitadas</h3>
          <div className="ranking-list">
            {analytics.ubicacionesMasVisitadas.map((ubicacion, index) => (
              <div key={ubicacion.nombre} className="ranking-item">
                <div className="rank">#{index + 1}</div>
                <div className="content">
                  <div className="name">{ubicacion.nombre}</div>
                  <div className="metric">{ubicacion.visitas} visitas</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="analytics-section insights">
          <h3>💡 Insights Clave</h3>
          <div className="insights-list">
            <div className="insight-item">
              <div className="insight-icon">📈</div>
              <div className="insight-content">
                <h4>Crecimiento de Usuarios</h4>
                <p>+12% más usuarios activos esta semana</p>
              </div>
            </div>
            <div className="insight-item">
              <div className="insight-icon">🎯</div>
              <div className="insight-content">
                <h4>Engagement Alto</h4>
                <p>Los usuarios completan en promedio 3.2 historias</p>
              </div>
            </div>
            <div className="insight-item">
              <div className="insight-icon">🏆</div>
              <div className="insight-content">
                <h4>Sistema RPG Efectivo</h4>
                <p>89% de usuarios han desbloqueado al menos un logro</p>
              </div>
            </div>
            <div className="insight-item">
              <div className="insight-icon">📱</div>
              <div className="insight-content">
                <h4>Uso Móvil Dominante</h4>
                <p>73% de las sesiones provienen de dispositivos móviles</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="analytics-actions">
        <button className="btn btn-primary">📊 Generar Reporte Completo</button>
        <button className="btn btn-secondary">📧 Enviar Reporte por Email</button>
        <button className="btn btn-info">📈 Exportar Datos CSV</button>
      </div>
    </div>
  )
}

export default AdminAnalytics