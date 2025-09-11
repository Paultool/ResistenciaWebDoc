import React, { useState, useEffect } from 'react'
import {
  supabase,
  obtenerHistorias,
  crearHistoria,
  actualizarHistoria,
  eliminarHistoria,
  Historia,
  Ubicacion,
  obtenerUbicaciones
} from '../supabaseClient'
import './AdminPanel.css'

const AdminHistorias: React.FC = () => {
  const [historias, setHistorias] = useState<Historia[]>([])
  const [ubicaciones, setUbicaciones] = useState<Ubicacion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editingHistoria, setEditingHistoria] = useState<Historia | null>(null)
  const [formData, setFormData] = useState({
    titulo: '',
    narrativa: '',
    estado: 'activa',
    orden: 1,
    id_ubicacion: 1,
    es_historia_principal: false,
    nivel_acceso_requerido: 1
  })

  useEffect(() => {
    cargarHistorias()
    cargarUbicaciones()
  }, [])

  const cargarHistorias = async () => {
    try {
      setLoading(true)
      const historiasData = await obtenerHistorias()
      setHistorias(historiasData)
    } catch (err: any) {
      setError('Error cargando historias: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const cargarUbicaciones = async () => {
    try {
      const ubicacionesData = await obtenerUbicaciones()
      setUbicaciones(ubicacionesData)
    } catch (err: any) {
      console.error('Error cargando ubicaciones para el formulario:', err.message)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked
      setFormData(prevState => ({
        ...prevState,
        [name]: checked
      }))
    } else {
      setFormData(prevState => ({
        ...prevState,
        [name]: type === 'number' ? Number(value) : value
      }))
    }
  }

  const handleCreate = () => {
    setEditingHistoria(null)
    setFormData({
      titulo: '',
      narrativa: '',
      estado: 'activa',
      orden: 1,
      id_ubicacion: ubicaciones.length > 0 ? ubicaciones[0].id_ubicacion : 1,
      es_historia_principal: false,
      nivel_acceso_requerido: 1
    })
    setShowForm(true)
  }

  const handleEdit = (historia: Historia) => {
    setEditingHistoria(historia)
    setFormData({
      titulo: historia.titulo,
      narrativa: historia.narrativa,
      estado: historia.estado,
      orden: historia.orden,
      id_ubicacion: historia.id_ubicacion,
      es_historia_principal: historia.es_historia_principal,
      nivel_acceso_requerido: historia.nivel_acceso_requerido
    })
    setShowForm(true)
  }

  const handleDelete = async (historia: Historia) => {
    const confirmacion = window.confirm(`¿Estás seguro de que deseas eliminar la historia "${historia.titulo}"?`)
    if (confirmacion) {
      try {
        await eliminarHistoria(historia.id)
        await cargarHistorias()
      } catch (err: any) {
        setError('Error al eliminar historia: ' + err.message)
      }
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      if (editingHistoria) {
        await actualizarHistoria(editingHistoria.id_historia, {
          titulo: formData.titulo,
          narrativa: formData.narrativa,
          estado: formData.estado,
          orden: formData.orden,
          id_ubicacion: formData.id_ubicacion
        })
      } else {
        await crearHistoria({
          titulo: formData.titulo,
          narrativa: formData.narrativa,
          estado: formData.estado,
          orden: formData.orden,
          id_ubicacion: formData.id_ubicacion,
          es_historia_principal: formData.es_historia_principal,
          nivel_acceso_requerido: formData.nivel_acceso_requerido,
          fecha_creacion: new Date().toISOString()
        })
      }
      
      setShowForm(false)
      resetForm()
      await cargarHistorias()
    } catch (err: any) {
      setError('Error al guardar la historia: ' + err.message)
    }
  }

  const resetForm = () => {
    setEditingHistoria(null)
    setFormData({
      titulo: '',
      narrativa: '',
      estado: 'activa',
      orden: 1,
      id_ubicacion: ubicaciones.length > 0 ? ubicaciones[0].id_ubicacion : 1,
      es_historia_principal: false,
      nivel_acceso_requerido: 1
    })
  }

  return (
    <div className="admin-view">
      <div className="view-header">
        <h2>📚 Gestión de Historias</h2>
        <button className="btn btn-primary" onClick={handleCreate}>
          ➕ Crear Nueva Historia
        </button>
      </div>
      
      {showForm && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>{editingHistoria ? '✏️ Editar Historia' : '➕ Nueva Historia'}</h3>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="titulo">Título:</label>
                <input
                  type="text"
                  id="titulo"
                  name="titulo"
                  value={formData.titulo}
                  onChange={handleInputChange}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="narrativa">Narrativa:</label>
                <textarea
                  id="narrativa"
                  name="narrativa"
                  value={formData.narrativa}
                  onChange={handleInputChange}
                  rows={4}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="estado">Estado:</label>
                <select
                  id="estado"
                  name="estado"
                  value={formData.estado}
                  onChange={handleInputChange}
                >
                  <option value="activa">Activa</option>
                  <option value="inactiva">Inactiva</option>
                  <option value="borrador">Borrador</option>
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="orden">Orden de la historia:</label>
                <input
                  type="number"
                  id="orden"
                  name="orden"
                  value={formData.orden}
                  onChange={handleInputChange}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="nivel_acceso_requerido">Nivel de Acceso Requerido:</label>
                <input
                  type="number"
                  id="nivel_acceso_requerido"
                  name="nivel_acceso_requerido"
                  value={formData.nivel_acceso_requerido}
                  onChange={handleInputChange}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="id_ubicacion">Ubicación:</label>
                <select
                  id="id_ubicacion"
                  name="id_ubicacion"
                  value={formData.id_ubicacion}
                  onChange={handleInputChange}
                  required
                >
                  {ubicaciones.map(ubicacion => (
                    <option key={ubicacion.id_ubicacion} value={ubicacion.id_ubicacion}>
                      {ubicacion.nombre}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group checkbox-group">
                <input
                  type="checkbox"
                  id="es_historia_principal"
                  name="es_historia_principal"
                  checked={formData.es_historia_principal}
                  onChange={handleInputChange}
                />
                <label htmlFor="es_historia_principal">Es Historia Principal</label>
              </div>
              {error && <div className="alert alert-danger">{error}</div>}
              <div className="form-actions">
                <button type="submit" className="btn btn-success">
                  💾 {editingHistoria ? 'Actualizar' : 'Guardar'}
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
            <p>⏳ Cargando historias...</p>
          </div>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Título</th>
                <th>Estado</th>
                <th>Ubicación ID</th>
                <th>Tipo</th>
                <th className="actions-header">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {historias.map((historia) => (
                <tr key={historia.id}>
                  <td>#{historia.id}</td>
                  <td><strong>{historia.titulo}</strong></td>
                  <td>
                    <span className={`status-badge ${historia.estado}`}>
                      {historia.estado}
                    </span>
                  </td>
                  <td>{historia.id_ubicacion}</td>
                  <td>
                    <span className={`type-badge ${historia.es_historia_principal ? 'principal' : 'secundaria'}`}>
                      {historia.es_historia_principal ? '⭐ Principal' : '📝 Secundaria'}
                    </span>
                  </td>
                  <td className="actions">
                    <button
                      onClick={() => handleEdit(historia)}
                      className="btn btn-sm btn-info"
                      title="Editar"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => handleDelete(historia)}
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
        <p>📊 Total de historias: <strong>{historias.length}</strong></p>
        <p>⭐ Principales: <strong>{historias.filter(h => h.es_historia_principal).length}</strong></p>
        <p>📝 Secundarias: <strong>{historias.filter(h => !h.es_historia_principal).length}</strong></p>
      </div>
    </div>
  )
}

export default AdminHistorias