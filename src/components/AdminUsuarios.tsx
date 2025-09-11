import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useAdmin } from '../hooks/useAdmin';
import './AdminPanel.css'; // Asegúrate de tener los estilos importados

interface UsuarioData {
  id_usuario: number;
  nombre: string;
  email: string;
  nivel: number;
  rol: string;
  fecha_registro: string;
}

const AdminUsuarios: React.FC = () => {
  const { isAdmin, loading: adminLoading, promoteToAdmin, revokeAdmin } = useAdmin();
  const [usuarios, setUsuarios] = useState<UsuarioData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingUsuario, setEditingUsuario] = useState<UsuarioData | null>(null);
  const [formData, setFormData] = useState({
    nombre: '',
    email: '',
    rol: 'jugador'
  });

  useEffect(() => {
    if (isAdmin) {
      cargarUsuarios();
    } else if (!adminLoading) {
      setLoading(false);
    }
  }, [isAdmin, adminLoading]);

  const cargarUsuarios = async () => {
    try {
      setLoading(true);
      const { data: usuariosData, error } = await supabase
        .from('usuario')
        .select('*')
        .order('fecha_registro', { ascending: false });
      
      if (error) throw error;
      setUsuarios(usuariosData || []);
    } catch (err: any) {
      setError('Error cargando usuarios: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prevState => ({ ...prevState, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (editingUsuario) {
        const { error } = await supabase
          .from('usuario')
          .update({ nombre: formData.nombre, email: formData.email, rol: formData.rol })
          .eq('id_usuario', editingUsuario.id_usuario);
        
        if (error) throw error;
        alert('✅ Usuario actualizado exitosamente');
      } else {
        const { error } = await supabase
          .from('usuario')
          .insert({
            nombre: formData.nombre,
            email: formData.email,
            nivel: 1,
            rol: formData.rol,
            fecha_registro: new Date().toISOString()
          });
        
        if (error) throw error;
        alert('✅ Usuario creado exitosamente');
      }
      
      resetForm();
      cargarUsuarios();
    } catch (error: any) {
      alert('❌ Error: ' + error.message);
    }
  };

  const handleEdit = (usuario: UsuarioData) => {
    setEditingUsuario(usuario);
    setFormData({
      nombre: usuario.nombre,
      email: usuario.email,
      rol: usuario.rol
    });
    setShowForm(true);
  };

  const handleDeleteUser = async (usuario: UsuarioData) => {
    if (!confirm(`¿Estás seguro de eliminar al usuario "${usuario.nombre}"?`)) {
      return;
    }
    
    try {
      const { error } = await supabase
        .from('usuario')
        .delete()
        .eq('id_usuario', usuario.id_usuario);
      
      if (error) throw error;
      
      alert('✅ Usuario eliminado exitosamente');
      cargarUsuarios();
    } catch (error: any) {
      alert('❌ Error eliminando usuario: ' + error.message);
    }
  };

  const resetForm = () => {
    setEditingUsuario(null);
    setFormData({
      nombre: '',
      email: '',
      rol: 'jugador'
    });
    setShowForm(false);
  };

  if (adminLoading) {
    return <div className="loading">⏳ Verificando permisos...</div>;
  }

  if (!isAdmin) {
    return (
      <div className="admin-restricted">
        <h2>🚫 Acceso Restringido</h2>
        <p>No tienes permisos de administrador para acceder a este panel.</p>
      </div>
    );
  }

  return (
    <div className="admin-view">
      <div className="view-header">
        <h2>👥 Gestión de Usuarios</h2>
        <button
          className="btn btn-primary"
          onClick={() => {
            resetForm();
            setShowForm(true);
          }}
        >
          ➕ Nuevo Usuario
        </button>
      </div>

      {showForm && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>{editingUsuario ? '✏️ Editar Usuario' : '🆕 Nuevo Usuario'}</h3>
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
                <label htmlFor="email">Email:</label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  disabled={!!editingUsuario}
                  title={editingUsuario ? 'El email de un usuario existente no puede ser editado' : ''}
                  required
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="rol">Rol:</label>
                <select
                  id="rol"
                  name="rol"
                  value={formData.rol}
                  onChange={handleInputChange}
                >
                  <option value="jugador">Jugador</option>
                  <option value="admin">Administrador</option>
                  <option value="visitante">Visitante</option>
                </select>
              </div>
              
              {error && <div className="alert alert-danger">{error}</div>}
              
              <div className="form-actions">
                <button type="submit" className="btn btn-success">
                  💾 {editingUsuario ? 'Actualizar' : 'Guardar'}
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
        {loading ? (
          <div className="loading">⏳ Cargando usuarios...</div>
        ) : error ? (
          <div className="error">❌ {error}</div>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Nombre</th>
                <th>Email</th>
                <th>Nivel</th>
                <th>Rol</th>
                <th>Registro</th>
                <th className="actions-header">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map((usuario) => (
                <tr key={usuario.id_usuario}>
                  <td>#{usuario.id_usuario}</td>
                  <td><strong>{usuario.nombre}</strong></td>
                  <td>{usuario.email}</td>
                  <td>{usuario.nivel}</td>
                  <td>
                    <span className={`role-badge ${usuario.rol}`}>
                      {usuario.rol === 'admin' ? '⚡ Admin' : (usuario.rol === 'jugador' ? '🎮 Jugador' : '👀 Visitante')}
                    </span>
                  </td>
                  <td>
                    <small>{new Date(usuario.fecha_registro).toLocaleDateString('es-MX')}</small>
                  </td>
                  <td className="actions">
                    {usuario.rol !== 'admin' ? (
                      <button 
                        onClick={() => promoteToAdmin(usuario.email)}
                        className="btn btn-sm btn-warning"
                        title="Promover a Admin"
                      >
                        ⬆️
                      </button>
                    ) : (
                      <button 
                        onClick={() => revokeAdmin(usuario.email)}
                        className="btn btn-sm btn-warning"
                        title="Revocar Admin"
                      >
                        ⬇️
                      </button>
                    )}
                    <button 
                      onClick={() => handleEdit(usuario)}
                      className="btn btn-sm btn-info"
                      title="Editar"
                    >
                      ✏️
                    </button>
                    <button 
                      onClick={() => handleDeleteUser(usuario)}
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
        <p>📊 Total de usuarios: <strong>{usuarios.length}</strong></p>
        <p>⚡ Administradores: <strong>{usuarios.filter(u => u.rol === 'admin').length}</strong></p>
        <p>🎮 Jugadores: <strong>{usuarios.filter(u => u.rol === 'jugador').length}</strong></p>
        <p>👀 Visitantes: <strong>{usuarios.filter(u => u.rol === 'visitante').length}</strong></p>
      </div>
    </div>
  );
};

export default AdminUsuarios;