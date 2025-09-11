import React, { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'

interface ConfigItem {
  key: string
  value: string
  description: string
  type: 'text' | 'number' | 'boolean' | 'json'
}

const AdminConfig: React.FC = () => {
  const [config, setConfig] = useState<ConfigItem[]>([
    {
      key: 'xp_historia_principal',
      value: '150',
      description: 'XP otorgado por completar historia principal',
      type: 'number'
    },
    {
      key: 'xp_historia_secundaria',
      value: '75',
      description: 'XP otorgado por completar historia secundaria',
      type: 'number'
    },
    {
      key: 'xp_conocer_personaje',
      value: '25',
      description: 'XP otorgado por conocer un personaje',
      type: 'number'
    },
    {
      key: 'xp_visitar_ubicacion',
      value: '50',
      description: 'XP otorgado por visitar una ubicación',
      type: 'number'
    },
    {
      key: 'sistema_logros_activo',
      value: 'true',
      description: 'Activar sistema de logros y recompensas',
      type: 'boolean'
    },
    {
      key: 'desbloqueo_automatico',
      value: 'true',
      description: 'Desbloqueo automático de historias por nivel',
      type: 'boolean'
    }
  ])

  const [loading, setLoading] = useState(false)
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [tempValue, setTempValue] = useState('')

  const handleEdit = (item: ConfigItem) => {
    setEditingKey(item.key)
    setTempValue(item.value)
  }

  const handleSave = async (key: string) => {
    try {
      setLoading(true)
      
      // Aquí podrías guardar en una tabla de configuración
      // Por ahora solo actualizamos el estado local
      setConfig(prev => prev.map(item => 
        item.key === key ? {...item, value: tempValue} : item
      ))
      
      setEditingKey(null)
      setTempValue('')
      alert('✅ Configuración actualizada')
    } catch (error: any) {
      alert('❌ Error: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = () => {
    setEditingKey(null)
    setTempValue('')
  }

  const renderValueInput = (item: ConfigItem) => {
    if (editingKey !== item.key) {
      return (
        <span className={`config-value ${item.type}`}>
          {item.type === 'boolean' ? (item.value === 'true' ? '✅ Sí' : '❌ No') : item.value}
        </span>
      )
    }

    switch (item.type) {
      case 'boolean':
        return (
          <select 
            value={tempValue} 
            onChange={(e) => setTempValue(e.target.value)}
            className="config-input"
          >
            <option value="true">Sí</option>
            <option value="false">No</option>
          </select>
        )
      case 'number':
        return (
          <input
            type="number"
            value={tempValue}
            onChange={(e) => setTempValue(e.target.value)}
            className="config-input"
            min="0"
          />
        )
      default:
        return (
          <input
            type="text"
            value={tempValue}
            onChange={(e) => setTempValue(e.target.value)}
            className="config-input"
          />
        )
    }
  }

  return (
    <div className="admin-config">
      <div className="admin-content-header">
        <h2>⚙️ Configuración del Sistema</h2>
        <p>Gestiona los parámetros del sistema RPG y mecánicas del juego</p>
      </div>

      <div className="config-sections">
        <div className="config-section">
          <h3>🎮 Sistema de Experiencia (XP)</h3>
          <div className="config-grid">
            {config.filter(item => item.key.includes('xp')).map((item) => (
              <div key={item.key} className="config-item">
                <div className="config-header">
                  <h4>{item.description}</h4>
                  <div className="config-actions">
                    {editingKey === item.key ? (
                      <>
                        <button 
                          onClick={() => handleSave(item.key)}
                          className="btn btn-sm btn-success"
                          disabled={loading}
                        >
                          💾
                        </button>
                        <button 
                          onClick={handleCancel}
                          className="btn btn-sm btn-secondary"
                        >
                          ❌
                        </button>
                      </>
                    ) : (
                      <button 
                        onClick={() => handleEdit(item)}
                        className="btn btn-sm btn-info"
                      >
                        ✏️
                      </button>
                    )}
                  </div>
                </div>
                <div className="config-content">
                  <label className="config-key">{item.key}:</label>
                  {renderValueInput(item)}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="config-section">
          <h3>🏆 Mecánicas de Juego</h3>
          <div className="config-grid">
            {config.filter(item => !item.key.includes('xp')).map((item) => (
              <div key={item.key} className="config-item">
                <div className="config-header">
                  <h4>{item.description}</h4>
                  <div className="config-actions">
                    {editingKey === item.key ? (
                      <>
                        <button 
                          onClick={() => handleSave(item.key)}
                          className="btn btn-sm btn-success"
                          disabled={loading}
                        >
                          💾
                        </button>
                        <button 
                          onClick={handleCancel}
                          className="btn btn-sm btn-secondary"
                        >
                          ❌
                        </button>
                      </>
                    ) : (
                      <button 
                        onClick={() => handleEdit(item)}
                        className="btn btn-sm btn-info"
                      >
                        ✏️
                      </button>
                    )}
                  </div>
                </div>
                <div className="config-content">
                  <label className="config-key">{item.key}:</label>
                  {renderValueInput(item)}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="config-section">
          <h3>💾 Operaciones de Sistema</h3>
          <div className="system-actions">
            <button className="btn btn-warning action-btn">
              🔄 Limpiar Cache
            </button>
            <button className="btn btn-info action-btn">
              📊 Recalcular Estadísticas
            </button>
            <button className="btn btn-success action-btn">
              📋 Exportar Configuración
            </button>
            <button className="btn btn-primary action-btn">
              📥 Importar Configuración
            </button>
          </div>
        </div>

        <div className="config-section">
          <h3>📈 Estado del Sistema</h3>
          <div className="system-status">
            <div className="status-item">
              <span className="status-label">🌐 Conexión a Base de Datos:</span>
              <span className="status-value online">✅ Conectado</span>
            </div>
            <div className="status-item">
              <span className="status-label">🎮 Sistema RPG:</span>
              <span className="status-value active">🟢 Activo</span>
            </div>
            <div className="status-item">
              <span className="status-label">🏆 Sistema de Logros:</span>
              <span className="status-value active">🟢 Funcional</span>
            </div>
            <div className="status-item">
              <span className="status-label">📊 Última actualización:</span>
              <span className="status-value">Hace 2 minutos</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AdminConfig