import React, { useState, useEffect } from 'react'
import { supabase, obtenerPersonajes, crearPersonaje, actualizarPersonaje, eliminarPersonaje, Personaje } from '../supabaseClient'
import './AdminPanel.css'

const AdminPersonajes: React.FC = () => {
  const [personajes, setPersonajes] = useState<Personaje[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editingPersonaje, setEditingPersonaje] = useState<Personaje | null>(null)
  const [formData, setFormData] = useState({
    nombre: '',
    descripcion: '',
    imagen: '',
    rol: '',
    atributos_json: '{}'
  })

  useEffect(() => {
    cargarPersonajes()
  }, [])

  const cargarPersonajes = async () => {
    try {
      setLoading(true)
      const personajesData = await obtenerPersonajes()
      setPersonajes(personajesData)
    } catch (err: any) {
      setError('Error cargando personajes: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prevState => ({ ...prevState, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      // Validar JSON
      JSON.parse(formData.atributos_json)
      
      const personajeData = {
        nombre: formData.nombre,
        descripcion: formData.descripcion,
        imagen: formData.imagen,
        rol: formData.rol,
        atributos_json: formData.atributos_json
      }
      
      if (editingPersonaje) {
        // Lógica para ACTUALIZAR
        await actualizarPersonaje(editingPersonaje.id, personajeData)
        console.log('✅ Personaje actualizado con éxito!')
      } else {
        // Lógica para CREAR
        await crearPersonaje(personajeData)
        console.log('✅ Personaje creado con éxito!')
      }
      
      // Limpiar el formulario y recargar los datos
      resetForm()
      await cargarPersonajes()
    } catch (err: any) {
      setError('Error al guardar el personaje: ' + err.message)
    }
  }

  const handleCreate = () => {
    resetForm()
    setShowForm(true)
  }

  const handleEdit = (personaje: Personaje) => {
    setEditingPersonaje(personaje)
    setFormData({
      nombre: personaje.nombre,
      descripcion: personaje.descripcion,
      imagen: personaje.imagen,
      rol: personaje.rol || '',
      atributos_json: personaje.atributos_json
    })
    setShowForm(true)
  }

  const handleDelete = async (personaje: Personaje) => {
    const confirmacion = window.confirm(`¿Estás seguro de que deseas eliminar a ${personaje.nombre}?`)
    if (confirmacion) {
      try {
        // Lógica para ELIMINAR
        await eliminarPersonaje(personaje.id)
        await cargarPersonajes()
      } catch (err: any) {
        setError('Error al eliminar personaje: ' + err.message)
      }
    }
  }

  const resetForm = () => {
    setEditingPersonaje(null)
    setFormData({
      nombre: '',
      descripcion: '',
      imagen: '',
      rol: '',
      atributos_json: '{}'
    })
    setShowForm(false)
  }

  return (
    <div className="admin-view">
      <div className="view-header">
        <h2>🎭 Gestión de Personajes</h2>
        <button className="btn btn-primary" onClick={handleCreate}>
          ➕ Crear Nuevo Personaje
        </button>
      </div>

      {/* Formulario de Creación/Edición */}
      {showForm && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>{editingPersonaje ? '✏️ Editar Personaje' : '➕ Nuevo Personaje'}</h3>
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
                <label htmlFor="rol">Rol:</label>
                <input
                  type="text"
                  id="rol"
                  name="rol"
                  value={formData.rol}
                  onChange={handleInputChange}
                />
              </div>
              <div className="form-group">
                <label htmlFor="imagen">URL de Imagen:</label>
                <input
                  type="text"
                  id="imagen"
                  name="imagen"
                  value={formData.imagen}
                  onChange={handleInputChange}
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
                />
              </div>
              <div className="form-group">
                <label htmlFor="atributos_json">Atributos (JSON):</label>
                <textarea
                  id="atributos_json"
                  name="atributos_json"
                  value={formData.atributos_json}
                  onChange={handleInputChange}
                  rows={4}
                  required
                />
                <small className="form-text text-muted">Asegúrate de que el formato sea JSON válido.</small>
              </div>
              {error && <div className="alert alert-danger">{error}</div>}
              <div className="form-actions">
                <button type="submit" className="btn btn-success">
                  💾 {editingPersonaje ? 'Actualizar' : 'Guardar'}
                </button>
                <button type="button" className="btn btn-secondary" onClick={resetForm}>
                  ❌ Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Vista de tabla de personajes */}
      <div className="admin-table-container">
        {loading ? (
          <div className="loading">
            <p>⏳ Cargando personajes...</p>
          </div>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Imagen</th>
                <th>Nombre</th>
                <th>Rol</th>
                <th>Descripción</th>
                <th className="actions-header">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {personajes.map((personaje) => (
                <tr key={personaje.id}>
                  <td>#{personaje.id}</td>
                  <td>
                    {personaje.imagen ? (
                      <img src={personaje.imagen} alt={personaje.nombre} className="thumbnail" />
                    ) : (
                      <div className="no-image">📷</div>
                    )}
                  </td>
                  <td><strong>{personaje.nombre}</strong></td>
                  <td>
                    <span className={`role-badge ${personaje.rol}`}>{personaje.rol}</span>
                  </td>
                  <td>
                    <div className="description-preview">
                      {personaje.descripcion}
                    </div>
                  </td>
                  <td className="actions">
                    <button 
                      onClick={() => handleEdit(personaje)}
                      className="btn btn-sm btn-info"
                      title="Editar"
                    >
                      ✏️
                    </button>
                    <button 
                      onClick={() => handleDelete(personaje)}
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
        <p>📊 Total de personajes: <strong>{personajes.length}</strong></p>
      </div>
    </div>
  )
}

export default AdminPersonajes