import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import './AdminPanel.css';

interface RecompensaData {
  id_recompensa: number;
  nombre: string;
  tipo: string | null;
  descripcion: string | null;
  valor: number | null;
}

const AdminRecompensas: React.FC = () => {
  const [recompensas, setRecompensas] = useState<RecompensaData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingRecompensa, setEditingRecompensa] = useState<RecompensaData | null>(null);
  const [formData, setFormData] = useState({
    nombre: '',
    tipo: '',
    descripcion: '',
    valor: ''
  });

  useEffect(() => {
    cargarRecompensas();
  }, []);

  const cargarRecompensas = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('recompensa')
        .select('*')
        .order('id_recompensa', { ascending: true });

      if (error) {
        throw error;
      }
      setRecompensas(data || []);
      setError(null);
    } catch (err: any) {
      setError('Error al cargar las recompensas: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prevState => ({ ...prevState, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (editingRecompensa) {
        const { error } = await supabase
          .from('recompensa')
          .update({
            nombre: formData.nombre,
            tipo: formData.tipo || null,
            descripcion: formData.descripcion || null,
            valor: formData.valor ? parseInt(formData.valor) : null
          })
          .eq('id_recompensa', editingRecompensa.id_recompensa);
        
        if (error) throw error;
        alert('✅ Recompensa actualizada exitosamente');
      } else {
        const { error } = await supabase
          .from('recompensa')
          .insert({
            nombre: formData.nombre,
            tipo: formData.tipo || null,
            descripcion: formData.descripcion || null,
            valor: formData.valor ? parseInt(formData.valor) : null
          });
        
        if (error) throw error;
        alert('✅ Recompensa creada exitosamente');
      }
      
      resetForm();
      cargarRecompensas();
    } catch (err: any) {
      alert('❌ Error: ' + err.message);
    }
  };

  const handleEdit = (recompensa: RecompensaData) => {
    setEditingRecompensa(recompensa);
    setFormData({
      nombre: recompensa.nombre,
      tipo: recompensa.tipo || '',
      descripcion: recompensa.descripcion || '',
      valor: recompensa.valor?.toString() || ''
    });
    setShowForm(true);
  };

  const handleDelete = async (recompensa: RecompensaData) => {
    if (!confirm(`¿Estás seguro de eliminar la recompensa "${recompensa.nombre}"?`)) {
      return;
    }
    
    try {
      const { error } = await supabase
        .from('recompensa')
        .delete()
        .eq('id_recompensa', recompensa.id_recompensa);
      
      if (error) throw error;
      
      alert('✅ Recompensa eliminada exitosamente');
      cargarRecompensas();
    } catch (err: any) {
      alert('❌ Error eliminando recompensa: ' + err.message);
    }
  };

  const resetForm = () => {
    setEditingRecompensa(null);
    setFormData({
      nombre: '',
      tipo: '',
      descripcion: '',
      valor: ''
    });
    setShowForm(false);
  };

  if (loading) {
    return <div className="loading">⏳ Cargando recompensas...</div>;
  }

  if (error) {
    return <div className="error">❌ {error}</div>;
  }

  return (
    <div className="admin-view">
      <div className="view-header">
        <h2>🎁 Gestión de Recompensas</h2>
        <button
          className="btn btn-primary"
          onClick={() => {
            resetForm();
            setShowForm(true);
          }}
        >
          ➕ Nueva Recompensa
        </button>
      </div>

      {showForm && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>{editingRecompensa ? '✏️ Editar Recompensa' : '🆕 Nueva Recompensa'}</h3>
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
                <label htmlFor="tipo">Tipo:</label>
                <input
                  type="text"
                  id="tipo"
                  name="tipo"
                  value={formData.tipo}
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
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="valor">Valor:</label>
                <input
                  type="number"
                  id="valor"
                  name="valor"
                  value={formData.valor}
                  onChange={handleInputChange}
                />
              </div>
              
              <div className="form-actions">
                <button type="submit" className="btn btn-success">
                  💾 {editingRecompensa ? 'Actualizar' : 'Guardar'}
                </button>
                <button type="button" className="btn btn-secondary" onClick={resetForm}>
                  ❌ Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="admin-table-container">
        <table className="admin-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Nombre</th>
              <th>Tipo</th>
              <th>Descripción</th>
              <th>Valor</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {recompensas.map(recompensa => (
              <tr key={recompensa.id_recompensa}>
                <td>#{recompensa.id_recompensa}</td>
                <td><strong>{recompensa.nombre}</strong></td>
                <td>{recompensa.tipo}</td>
                <td>{recompensa.descripcion}</td>
                <td>{recompensa.valor}</td>
                <td className="actions">
                  <button 
                    onClick={() => handleEdit(recompensa)} 
                    className="btn btn-sm btn-info"
                  >
                    ✏️
                  </button>
                  <button 
                    onClick={() => handleDelete(recompensa)} 
                    className="btn btn-sm btn-danger"
                  >
                    🗑️
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      <div className="admin-summary">
        <p>📊 Total de recompensas: <strong>{recompensas.length}</strong></p>
      </div>
    </div>
  );
};

export default AdminRecompensas;