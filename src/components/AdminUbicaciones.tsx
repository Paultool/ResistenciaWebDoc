import React, { useState, useEffect } from 'react'
import {
  obtenerUbicaciones,
  crearUbicacion,
  actualizarUbicacion,
  eliminarUbicacion,
  Ubicacion
} from '../supabaseClient'
import './AdminPanel.css'

const AdminUbicaciones: React.FC = () => {
  const [ubicaciones, setUbicaciones] = useState<Ubicacion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editingUbicacion, setEditingUbicacion] = useState<Ubicacion | null>(null)
  const [formData, setFormData] = useState({
    nombre: '',
    descripcion: '',
    latitud: 0,
    longitud: 0,
    coordenadas: '',
    tipo: 'Plaza'
  })

  // Tipos de ubicaciones permitidos
  const tiposUbicaciones = [
    'Plaza',
    'Mercado',
    'Barrio',
    'Centro',
    'Parque',
    'Cultural',
    'Histórico',
    'Comunidad',
    'Resistencia'
  ]

  useEffect(() => {
    cargarUbicaciones()
  }, [])

  const cargarUbicaciones = async () => {
    try {
      setLoading(true)
      const ubicacionesData = await obtenerUbicaciones()
      setUbicaciones(ubicacionesData)
    } catch (err: any) {
      setError('Error cargando ubicaciones: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target
    setFormData(prevState => ({
      ...prevState,
      [name]: type === 'number' ? Number(value) : value
    }))
  }

  const handleCreate = () => {
    setEditingUbicacion(null)
    setFormData({
      nombre: '',
      descripcion: '',
      latitud: 0,
      longitud: 0,
      coordenadas: '',
      tipo: 'Plaza'
    })
    setShowForm(true)
  }

  const handleEdit = (ubicacion: Ubicacion) => {
    setEditingUbicacion(ubicacion)
    setFormData({
      nombre: ubicacion.nombre,
      descripcion: ubicacion.descripcion,
      latitud: ubicacion.latitud,
      longitud: ubicacion.longitud,
      coordenadas: `${ubicacion.latitud}, ${ubicacion.longitud}`,
      tipo: ubicacion.metadata?.tipo || 'Plaza'
    })
    setShowForm(true)
  }

  const handleDelete = async (ubicacion: Ubicacion) => {
    const confirmacion = window.confirm(`¿Estás seguro de que deseas eliminar la ubicación "${ubicacion.nombre}"?`)
    if (confirmacion) {
      try {
        await eliminarUbicacion(ubicacion.id)
        await cargarUbicaciones()
      } catch (err: any) {
        setError('Error al eliminar ubicación: ' + err.message)
      }
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Convertir coordenadas a latitud y longitud antes de enviar
    const [lat, lng] = formData.coordenadas.split(',').map(parseFloat)
    if (isNaN(lat) || isNaN(lng)) {
      setError('Las coordenadas deben ser números válidos (ej: 19.4326, -99.1332)')
      return
    }

    try {
      const ubicacionData = {
        nombre: formData.nombre,
        descripcion: formData.descripcion,
        coordenadas: formData.coordenadas,
        tipo: formData.tipo
      }

      if (editingUbicacion) {
        await actualizarUbicacion(editingUbicacion.id_ubicacion, ubicacionData)
      } else {
        await crearUbicacion(ubicacionData)
      }
      
      setShowForm(false)
      await cargarUbicaciones()
    } catch (err: any) {
      setError('Error al guardar la ubicación: ' + err.message)
    }
  }

  const openInGoogleMaps = (ubicacion: Ubicacion) => {
    const url = `https://maps.google.com/?q=${ubicacion.latitud},${ubicacion.longitud}`
    window.open(url, '_blank')
  }

  return (
    <div className="admin-view">
      <div className="view-header">
        <h2>🗺️ Gestión de Ubicaciones</h2>
        <button className="btn btn-primary" onClick={handleCreate}>
          ➕ Crear Nueva Ubicación
        </button>
      </div>
      
      {showForm && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>{editingUbicacion ? '✏️ Editar Ubicación' : '➕ Nueva Ubicación'}</h3>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="nombre">Nombre:</label>
                <input
                  type="text"
                  id="nombre"
                  name="nombre"
                  value={formData.nombre}
                  onChange={handleInputChange}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="descripcion">Descripción:</label>
                <textarea
                  id="descripcion"
                  name="descripcion"
                  value={formData.descripcion}
                  onChange={handleInputChange}
                  rows={4}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="coordenadas">Coordenadas (Latitud, Longitud):</label>
                <input
                  type="text"
                  id="coordenadas"
                  name="coordenadas"
                  value={formData.coordenadas}
                  onChange={handleInputChange}
                  placeholder="ej: 19.4326, -99.1332"
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="tipo">Tipo de Ubicación:</label>
                <select
                  id="tipo"
                  name="tipo"
                  value={formData.tipo}
                  onChange={handleInputChange}
                  required
                >
                  {tiposUbicaciones.map(tipo => (
                    <option key={tipo} value={tipo}>
                      {tipo}
                    </option>
                  ))}
                </select>
              </div>
              {error && <div className="alert alert-danger">{error}</div>}
              <div className="form-actions">
                <button type="submit" className="btn btn-success">
                  💾 {editingUbicacion ? 'Actualizar' : 'Guardar'}
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>
                  ❌ Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="admin-table-container">
        {loading ? (
          <div className="loading">
            <p>⏳ Cargando ubicaciones...</p>
          </div>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Nombre</th>
                <th>Tipo</th>
                <th>Coordenadas</th>
                <th>Descripción</th>
                <th className="actions-header">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {ubicaciones.map((ubicacion) => (
                <tr key={ubicacion.id}>
                  <td>#{ubicacion.id}</td>
                  <td><strong>{ubicacion.nombre}</strong></td>
                  <td>
                    <span className={`type-badge ${ubicacion.metadata?.tipo}`}>
                      {ubicacion.metadata?.tipo}
                    </span>
                  </td>
                  <td>
                    <div className="coordenadas-cell">
                      <span>{ubicacion.coordenadas}</span>
                      <button
                        onClick={() => openInGoogleMaps(ubicacion)}
                        className="btn btn-xs btn-link"
                        title="Ver en Google Maps"
                      >
                        🗺️
                      </button>
                    </div>
                  </td>
                  <td>
                    <div className="description-preview">
                      {ubicacion.descripcion?.substring(0, 30)}...
                    </div>
                  </td>
                  <td className="actions">
                    <button
                      onClick={() => handleEdit(ubicacion)}
                      className="btn btn-sm btn-info"
                      title="Editar"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => handleDelete(ubicacion)}
                      className="btn btn-sm btn-danger"
                      title="Eliminar"
                    >
                      🗑️
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      
      <div className="admin-summary">
        <p>📊 Total de ubicaciones: <strong>{ubicaciones.length}</strong></p>
        <p>📍 Tipos disponibles: {tiposUbicaciones.join(', ')}</p>
      </div>
    </div>
  )
}

export default AdminUbicaciones