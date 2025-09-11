import React, { useState, useEffect } from 'react';
import {
  RecursoMultimedia,
  obtenerRecursosMultimedia,
  crearRecursoMultimedia,
  actualizarRecursoMultimedia,
  eliminarRecursoMultimedia,
} from '../supabaseClient';
import './AdminPanel.css'; // Asegúrate de importar los estilos

interface AdminRecursosMultimediaProps {}

const AdminRecursosMultimedia: React.FC<AdminRecursosMultimediaProps> = () => {
  const [recursos, setRecursos] = useState<RecursoMultimedia[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingRecurso, setEditingRecurso] = useState<RecursoMultimedia | null>(null);
  const [formData, setFormData] = useState({
    tipo: 'imagen',
    archivo: '',
    metadatos: '',
  });

  useEffect(() => {
    cargarRecursos();
  }, []);

  const cargarRecursos = async () => {
    try {
      setLoading(true);
      const data = await obtenerRecursosMultimedia();
      setRecursos(data);
    } catch (err: any) {
      setError('Error al cargar los recursos: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleAddRecurso = () => {
    setEditingRecurso(null);
    setFormData({ tipo: 'imagen', archivo: '', metadatos: '' });
    setShowForm(true);
  };

  const handleEditRecurso = (recurso: RecursoMultimedia) => {
    setEditingRecurso(recurso);
    setFormData({
      tipo: recurso.tipo,
      archivo: recurso.archivo,
      metadatos: JSON.stringify(recurso.metadatos, null, 2),
    });
    setShowForm(true);
  };

  const handleDeleteRecurso = async (recursoId: number) => {
    if (window.confirm('¿Estás seguro de que quieres eliminar este recurso?')) {
      try {
        await eliminarRecursoMultimedia(recursoId);
        cargarRecursos();
      } catch (err: any) {
        setError('Error al eliminar el recurso: ' + err.message);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      let parsedMetadatos: any = {};
      try {
        parsedMetadatos = JSON.parse(formData.metadatos);
      } catch (jsonError) {
        setError('Error de formato JSON en Metadatos. Por favor, asegúrate de que sea un JSON válido.');
        console.error('JSON Parse Error:', jsonError);
        return;
      }

      if (editingRecurso) {
        await actualizarRecursoMultimedia({
          ...formData,
          id_recurso: editingRecurso.id_recurso,
          metadatos: parsedMetadatos,
        });
      } else {
        await crearRecursoMultimedia({
          ...formData,
          metadatos: parsedMetadatos,
        });
      }
      setShowForm(false);
      setEditingRecurso(null);
      cargarRecursos();
    } catch (err: any) {
      setError('Error al guardar el recurso: ' + err.message);
    }
  };

  return (
    <div className="admin-view">
      <div className="view-header">
        <h2>🖼️ Gestión de Recursos Multimedia</h2>
        <button className="btn btn-primary" onClick={handleAddRecurso}>
          ➕ Añadir Nuevo Recurso
        </button>
      </div>
      
      {showForm && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>{editingRecurso ? '✏️ Editar Recurso' : '➕ Crear Nuevo Recurso'}</h3>
            <form onSubmit={handleSubmit} className="form-container">
              <div className="form-group">
                <label htmlFor="recursoTipo">Tipo de Recurso</label>
                <select
                  id="recursoTipo"
                  name="tipo"
                  value={formData.tipo}
                  onChange={handleChange}
                  className="form-control"
                  required
                >
                  <option value="imagen">Imagen</option>
                  <option value="audio">Audio</option>
                  <option value="video">Video</option>
                  <option value="transcripcion">Transcripción</option>
                  <option value="subtitulo">Subtítulo</option>
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="recursoArchivo">Archivo (URL o nombre)</label>
                <input
                  id="recursoArchivo"
                  type="text"
                  name="archivo"
                  value={formData.archivo}
                  onChange={handleChange}
                  className="form-control"
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="recursoMetadatos">Metadatos (JSON)</label>
                <textarea
                  id="recursoMetadatos"
                  name="metadatos"
                  value={formData.metadatos}
                  onChange={handleChange}
                  className="form-control"
                  rows={5}
                  placeholder='Ej: {"autor": "John Doe", "licencia": "CC BY"}'
                ></textarea>
              </div>
              <div className="form-actions">
                <button type="submit" className="btn btn-primary">
                  {editingRecurso ? 'Guardar Cambios' : 'Crear Recurso'}
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {error && (
        <div className="alert alert-danger">
          <strong>Error:</strong> {error}
        </div>
      )}

      {loading ? (
        <div className="admin-loading">
          <h2>Cargando recursos multimedia...</h2>
        </div>
      ) : (
        <div className="admin-table-container">
          {recursos.length === 0 ? (
            <p>No se encontraron recursos. ¡Añade el primero!</p>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th>Archivo</th>
                  <th className="actions-header">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {recursos.map((recurso) => (
                  <tr key={recurso.id_recurso}>
                    <td><span className={`type-badge ${recurso.tipo}`}>{recurso.tipo}</span></td>
                    <td>{recurso.archivo}</td>
                    <td className="actions">
                      <button
                        onClick={() => handleEditRecurso(recurso)}
                        className="btn btn-sm btn-info"
                        title="Editar"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => handleDeleteRecurso(recurso.id_recurso)}
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
      )}
      <div className="admin-summary">
        <p>📊 Total de recursos: <strong>{recursos.length}</strong></p>
      </div>
    </div>
  );
};

export default AdminRecursosMultimedia;