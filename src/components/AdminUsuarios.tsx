import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
// Asume que useAdmin existe y proporciona isAdmin y loading: adminLoading
import { useAdmin } from '../hooks/useAdmin'; 
import './AdminPanel.css'; 

// Interfaz para la data del perfil de jugador
interface PerfilJugadorData {
  id: string; // UUID del perfil de jugador
  user_id: string; 
  nivel: number;
  xp_total: number;
  historias_completadas: number;
  // Campos de lista
  personajes_conocidos: string[] | null; 
  historias_visitadas: string[] | null;  
  logros_desbloqueados: string[] | null; 
  // Otros campos
  racha_dias_consecutivos: number; 
  rol: string; 
  email: string; 
  nombre: string;
  fecha_ultimo_acceso: string;
}

const AdminUsuarios: React.FC = () => {
  const { isAdmin, loading: adminLoading, promoteToAdmin, revokeAdmin } = useAdmin();
  const [usuarios, setUsuarios] = useState<PerfilJugadorData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingUsuario, setEditingUsuario] = useState<PerfilJugadorData | null>(null);
  
  // Estado 'formData' para el formulario de edición
  const [formData, setFormData] = useState({
    email: '', 
    rol: 'jugador', 
    nivel: 1,
    xp_total: 0,
    historias_completadas: 0,
    personajes_conocidos: '',
    historias_visitadas: '',
    logros_desbloqueados: '',
    racha_dias_consecutivos: 1, 
  });

  useEffect(() => {
    if (isAdmin) {
      cargarUsuarios();
    } else if (!adminLoading) {
      setLoading(false);
    }
  }, [isAdmin, adminLoading]);

  // ✅ FUNCIÓN CORREGIDA Y ROBUSTA: cargarUsuarios
  const cargarUsuarios = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // La clave está en la VIEW 'perfiles_con_email'
      const { data: perfilesData, error } = await supabase
        .from('perfiles_con_email') 
        .select('*') 
        .order('fecha_ultimo_acceso', { ascending: false }); 
      
      if (error) throw error;
      
      const usuariosConEmail = (perfilesData || []).map((p: any) => ({
        id: p.id,
        user_id: p.user_id, 
        email: p.email || 'N/A', 
        nombre: p.email ? p.email.split('@')[0] : 'Usuario Desconocido', 
        nivel: p.nivel,
        xp_total: p.xp_total,
        historias_completadas: p.historias_completadas,
        rol: p.rol || 'jugador',
        fecha_ultimo_acceso: p.fecha_ultimo_acceso,
        // ✅ Protección contra 'undefined' de la DB
        personajes_conocidos: Array.isArray(p.personajes_conocidos) ? p.personajes_conocidos : [],
        historias_visitadas: Array.isArray(p.historias_visitadas) ? p.historias_visitadas : [],
        logros_desbloqueados: Array.isArray(p.logros_desbloqueados) ? p.logros_desbloqueados : [],
        racha_dias_consecutivos: p.racha_dias_consecutivos || 1,
      })) as PerfilJugadorData[];
      
      setUsuarios(usuariosConEmail);
      
    } catch (err: any) {
      // ✅ Logueamos el error para ver la razón (casi seguro RLS)
      console.error('❌ Error al cargar perfiles (RLS o VIEW):', err);
      setError('Error al cargar perfiles: ' + (err.message || 'Error desconocido. Verifique RLS de SELECT.'));
    } finally {
      // ✅ Esto se ejecuta siempre, terminando el estado de carga
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const { name, value } = e.target;
      const numericFields = ['nivel', 'xp_total', 'historias_completadas', 'racha_dias_consecutivos'];
      
      const newValue = numericFields.includes(name) ? parseInt(value) || 0 : value;
      
      setFormData(prevState => ({ ...prevState, [name]: newValue }));
  };

  // Función helper para array a CSV
  const arrayToCSV = (arr: string[] | null) => (arr || []).join(', ');

  const handleEdit = (perfil: PerfilJugadorData) => {
    console.log('--- Datos del Perfil Obtenidos de la DB para Edición (handleEdit) ---');
    console.log(perfil);
    console.log(`Personajes (debería ser array o []): ${arrayToCSV(perfil.personajes_conocidos)}`);
    
    setEditingUsuario(perfil);
    
    setFormData({
      email: perfil.email,
      rol: perfil.rol || 'jugador', 
      nivel: perfil.nivel,
      xp_total: perfil.xp_total,
      historias_completadas: perfil.historias_completadas,
      personajes_conocidos: arrayToCSV(perfil.personajes_conocidos),
      historias_visitadas: arrayToCSV(perfil.historias_visitadas),
      logros_desbloqueados: arrayToCSV(perfil.logros_desbloqueados),
      racha_dias_consecutivos: perfil.racha_dias_consecutivos,
    });
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      
      if (!editingUsuario) return;

      try {
          const { 
              nivel, xp_total, historias_completadas, personajes_conocidos, historias_visitadas,
              logros_desbloqueados, racha_dias_consecutivos, rol 
          } = formData;

          const stringToArray = (str: string): string[] => {
              return str
                  .split(',')
                  .map(s => s.trim())
                  .filter(s => s.length > 0);
          };
          
          const safeRol = rol === 'usuario' ? 'jugador' : rol;
          
          const dataToUpdate = { 
              nivel: nivel, 
              xp_total: xp_total, 
              historias_completadas: historias_completadas,
              racha_dias_consecutivos: racha_dias_consecutivos,
              rol: safeRol, 
              personajes_conocidos: stringToArray(personajes_conocidos),
              historias_visitadas: stringToArray(historias_visitadas),
              logros_desbloqueados: stringToArray(logros_desbloqueados),
              fecha_ultimo_acceso: new Date().toISOString(),
          };
          
          console.log('--- Datos a Enviar a Supabase (handleSubmit) ---');
          console.log(dataToUpdate);
          
          // Ejecutamos el UPDATE
          const { error: updateError } = await supabase
              .from('perfiles_jugador')
              .update(dataToUpdate)
              .eq('id', editingUsuario.id); 
          
          if (updateError) throw updateError;
          alert('✅ Perfil de jugador actualizado exitosamente');
          
          resetForm();
          cargarUsuarios();
      } catch (error: any) {
          alert('❌ Error al actualizar perfil: ' + error.message);
          console.error('❌ Error de Supabase en UPDATE (Revisar RLS):', error); 
      }
  };

  const handleDeleteUser = async (perfil: PerfilJugadorData) => {
    // Lógica de eliminación (dejada como estaba)
    if (!confirm(`¿Estás seguro de eliminar el perfil de "${perfil.nombre}" (ID: ${perfil.id})?`)) {
      return;
    }
    
    try {
      const { error } = await supabase
        .from('perfiles_jugador')
        .delete()
        .eq('id', perfil.id);
      
      if (error) throw error;
      
      alert('✅ Perfil de jugador eliminado exitosamente');
      cargarUsuarios();
    } catch (error: any) {
      alert('❌ Error eliminando perfil de jugador: ' + error.message);
    }
  };

  const resetForm = () => {
    setEditingUsuario(null);
    setFormData({
      email: '', rol: 'jugador', nivel: 1, xp_total: 0, historias_completadas: 0,
      personajes_conocidos: '', historias_visitadas: '', logros_desbloqueados: '',
      racha_dias_consecutivos: 1,
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

  // ✅ Mostrar el error en la interfaz si el fetch falla
  if (error && !loading) {
      return (
          <div className="admin-view">
              <h2>⚠️ Error al Cargar Usuarios</h2>
              <p>{error}</p>
              <button onClick={cargarUsuarios} className="btn btn-primary">Reintentar Carga</button>
          </div>
      );
  }

  return (
    <div className="admin-view">
      <div className="view-header">
        <h2>👥 Gestión de Perfiles de Jugador</h2>
        {/* ... Botón de Nuevo Perfil ... */}
      </div>

      {showForm && (
        // ... Contenedor del Modal/Formulario de Edición ...
        <div className="modal-overlay">
          <div className="modal-content">
            {/* ... Contenido del Formulario ... */}
            <form onSubmit={handleSubmit}>
              <div className="modal-form-body">
                {/* ... Campos del Formulario (email, rol, nivel, xp, listas) ... */}
                
                <div className="form-group">
                  <label htmlFor="email">Email:</label>
                  <input type="email" id="email" name="email" value={formData.email} onChange={handleInputChange} disabled={true} required />
                </div>
                
                <div className="form-group">
                  <label htmlFor="rol">Rol:</label>
                  <select id="rol" name="rol" value={formData.rol} onChange={handleInputChange}>
                    <option value="jugador">Jugador</option>
                    <option value="admin">Administrador</option>
                    <option value="visitante">Visitante</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="nivel">Nivel:</label>
                  <input type="number" id="nivel" name="nivel" value={formData.nivel} onChange={handleInputChange} min="1" required />
                </div>

                <div className="form-group">
                  <label htmlFor="xp_total">XP Total:</label>
                  <input type="number" id="xp_total" name="xp_total" value={formData.xp_total} onChange={handleInputChange} min="0" required />
                </div>

                <div className="form-group">
                  <label htmlFor="historias_completadas">Historias Completadas:</label>
                  <input type="number" id="historias_completadas" name="historias_completadas" value={formData.historias_completadas} onChange={handleInputChange} min="0" required />
                </div>

                <div className="form-group">
                  <label htmlFor="personajes_conocidos">Personajes Conocidos (Separar por comas):</label>
                  <textarea id="personajes_conocidos" name="personajes_conocidos" value={formData.personajes_conocidos} onChange={(e) => setFormData(p => ({ ...p, personajes_conocidos: e.target.value }))} rows={2} placeholder="Ej: personaje1, personaje2, personaje3" />
                </div>

                <div className="form-group">
                  <label htmlFor="historias_visitadas">Historias Visitadas (Separar por comas):</label>
                  <textarea id="historias_visitadas" name="historias_visitadas" value={formData.historias_visitadas} onChange={(e) => setFormData(p => ({ ...p, historias_visitadas: e.target.value }))} rows={2} placeholder="Ej: historia_a, historia_b" />
                </div>

                <div className="form-group">
                  <label htmlFor="logros_desbloqueados">Logros Desbloqueados (Separar por comas):</label>
                  <textarea id="logros_desbloqueados" name="logros_desbloqueados" value={formData.logros_desbloqueados} onChange={(e) => setFormData(p => ({ ...p, logros_desbloqueados: e.target.value }))} rows={2} placeholder="Ej: logro_nivel_10, primer_oro" />
                </div>

                <div className="form-group">
                  <label htmlFor="racha_dias_consecutivos">Racha Días Consecutivos:</label>
                  <input type="number" id="racha_dias_consecutivos" name="racha_dias_consecutivos" value={formData.racha_dias_consecutivos} onChange={handleInputChange} min="1" required />
                </div>
              </div>
              
              {/* ... Botones de Guardar/Cancelar ... */}
              <div className="form-actions">
                <button type="submit" className="btn btn-success" disabled={!editingUsuario}>
                  💾 {editingUsuario ? 'Actualizar Perfil' : 'Guardar (Deshabilitado)'}
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
          <div className="loading">⏳ Cargando perfiles de jugador...</div>
        ) : (
          // ... Contenido de la Tabla ...
          <table className="admin-table">
            <thead>
              <tr><th>UUID Perfil</th>
                <th>Email / User</th> 
                <th>Rol</th>
                <th>Nivel</th>
                <th>XP Total</th> 
                <th>Historias Comp.</th> 
                <th>Último Acceso</th> 
                <th className="actions-header">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map((perfil) => (
                <tr key={perfil.id}>
                  <td><small>#{perfil.id.substring(0, 8)}...</small></td> 
                  <td><strong>{perfil.email}</strong></td> 
                  <td>
                    <span className={`role-badge ${perfil.rol}`}>
                      {perfil.rol === 'admin' ? '⚡ Admin' : (perfil.rol === 'jugador' ? '🎮 Jugador' : '👀 Visitante')}
                    </span>
                  </td>
                  <td>{perfil.nivel}</td> 
                  <td>{perfil.xp_total}</td> 
                  <td>{perfil.historias_completadas}</td> 
                  <td>
                    <small>{new Date(perfil.fecha_ultimo_acceso).toLocaleDateString('es-MX')}</small>
                  </td>
                  <td className="actions">
                    {/* ... Botones de Promover/Revocar/Editar/Eliminar ... */}
                    <button onClick={() => perfil.rol !== 'admin' ? promoteToAdmin(perfil.email) : revokeAdmin(perfil.email)} className="btn btn-sm btn-warning" title={perfil.rol !== 'admin' ? "Promover a Admin" : "Revocar Admin"}>
                      {perfil.rol !== 'admin' ? '⬆️' : '⬇️'}
                    </button>
                    <button onClick={() => handleEdit(perfil)} className="btn btn-sm btn-info" title="Editar">✏️</button>
                    <button onClick={() => handleDeleteUser(perfil)} className="btn btn-sm btn-danger" title="Eliminar Perfil">🗑️</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      
      <div className="admin-summary">
        <p>📊 Total de Perfiles: <strong>{usuarios.length}</strong></p>
        <p>⚡ Administradores (rol de perfil): <strong>{usuarios.filter(u => u.rol === 'admin').length}</strong></p>
        <p>🎮 Jugadores (rol de perfil): <strong>{usuarios.filter(u => u.rol === 'jugador').length}</strong></p>
        <p>👀 Otros (rol de perfil): <strong>{usuarios.filter(u => u.rol === 'visitante').length}</strong></p>
      </div>
    </div>
  );
};

export default AdminUsuarios;