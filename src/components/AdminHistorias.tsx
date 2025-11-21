import React, { useState, useEffect } from 'react'
import {
  obtenerHistorias,
  crearHistoria,
  actualizarHistoria, 
  eliminarHistoria,
  obtenerUbicaciones,
  obtenerRecursosMultimedia,
  Historia, Ubicacion, RecursoMultimedia
} from '../supabaseClient'
import './AdminPanel.css'

// Tipos extendidos para manejo seguro de nulos
interface HistoriaForm extends Omit<Historia, 'id_ubicacion' | 'id_historia'> {
    id_historia?: number;
    id_ubicacion: number | string; // Permitimos string temporalmente para el manejo del form
    id_historia_dependencia: number; 
    id_imagen_historia: number;
    id_imagen_mapa: number;
}

const AdminHistorias: React.FC = () => {
  const [historias, setHistorias] = useState<any[]>([])
  const [ubicaciones, setUbicaciones] = useState<Ubicacion[]>([])
  const [imagenes, setImagenes] = useState<RecursoMultimedia[]>([]) 
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)

  // Estado inicial del formulario
  const initialForm: HistoriaForm = {
    titulo: '',
    narrativa: '',
    estado: 'desbloqueado',
    orden: 1,
    id_ubicacion: 0, 
    es_historia_principal: true,
    nivel_acceso_requerido: 1,
    id_imagen_historia: 0, 
    id_imagen_mapa: 0,     
    id_historia_dependencia: 0
  }

  const [formData, setFormData] = useState<HistoriaForm>(initialForm)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
        const [hData, uData, rData] = await Promise.all([
            obtenerHistorias(),
            obtenerUbicaciones(),
            obtenerRecursosMultimedia()
        ]);
        setHistorias(hData || []);
        setUbicaciones(uData || []);
        // Filtrar solo imágenes para los selectores de imagen
        setImagenes((rData || []).filter(r => r.tipo === 'imagen'));
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }

  // Componente local para previsualizar imagen seleccionada
  const ImagePreview = ({ id }: { id: number }) => {
      if (!id) return null;
      const img = imagenes.find(i => i.id_recurso === id);
      if (!img) return <small className="text-danger">Imagen no encontrada</small>;
      return (
          <div className="img-preview-box">
              <img src={img.archivo} alt="Preview" />
              <span style={{fontSize:'0.7rem', display:'block'}}>ID: {id}</span>
          </div>
      );
  }

  const handleCreate = () => {
      setEditingId(null);
      // Preseleccionar la primera ubicación si existe para evitar el 0
      const defaultUbicacion = ubicaciones.length > 0 ? ubicaciones[0].id_ubicacion : 0;
      setFormData({ ...initialForm, id_ubicacion: defaultUbicacion });
      setShowForm(true);
  }

  const handleEdit = (historia: any) => {
      setEditingId(historia.id_historia);
      
      // 🚨 CORRECCIÓN CRÍTICA: Verificar si id_ubicacion es un objeto o un número
      let ubicacionId = 0;
      if (historia.id_ubicacion) {
          if (typeof historia.id_ubicacion === 'object') {
              // Si Supabase devolvió el objeto completo (join), extraemos el ID
              ubicacionId = historia.id_ubicacion.id_ubicacion || 0;
          } else {
              // Si es un número, lo usamos directo
              ubicacionId = historia.id_ubicacion;
          }
      }

      setFormData({
          titulo: historia.titulo,
          narrativa: historia.narrativa || '',
          estado: historia.estado,
          orden: historia.orden,
          id_ubicacion: ubicacionId, // Usamos el ID limpio
          es_historia_principal: historia.es_historia_principal,
          nivel_acceso_requerido: historia.nivel_acceso_requerido,
          id_imagen_historia: historia.id_imagen_historia || 0,
          id_imagen_mapa: historia.id_imagen_mapa || 0,
          id_historia_dependencia: historia.id_historia_dependencia || 0
      });
      setShowForm(true);
  }

  const handleChange = (e: any) => {
      const { name, value, type, checked } = e.target;
      setFormData(prev => ({
          ...prev,
          [name]: type === 'checkbox' ? checked : value
      }));
  }

  const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      
      // 🚨 CORRECCIÓN CRÍTICA: Asegurar que enviamos ENTEROS a la base de datos
      const payload = {
          ...formData,
          orden: Number(formData.orden),
          nivel_acceso_requerido: Number(formData.nivel_acceso_requerido),
          id_ubicacion: Number(formData.id_ubicacion), // Forzamos conversión a número
          
          // Convertir 0 a null para claves foráneas opcionales
          id_historia_dependencia: formData.es_historia_principal ? null : (Number(formData.id_historia_dependencia) || null),
          id_imagen_historia: Number(formData.id_imagen_historia) || null,
          id_imagen_mapa: Number(formData.id_imagen_mapa) || null,
      };

      console.log("Enviando payload:", payload); // Para depuración

      try {
          if (editingId) {
              await actualizarHistoria(editingId, payload);
          } else {
              await crearHistoria({ ...payload, fecha_creacion: new Date().toISOString() });
          }
          setShowForm(false);
          loadData();
      } catch (e: any) { 
          alert("Error al guardar: " + e.message); 
          console.error(e);
      }
  }

  const handleDelete = async (id: number) => {
      if(confirm("¿Eliminar historia?")) {
          await eliminarHistoria(id);
          loadData();
      }
  }

  return (
    <div className="admin-view">
      <div className="view-header">
        <h2>📚 Historias y Capítulos</h2>
        <button className="btn btn-primary" onClick={handleCreate}>➕ Nueva Historia</button>
      </div>
      
      {showForm && (
        <div className="modal-overlay">
          <div className="modal-content large-modal">
            <h3>{editingId ? '✏️ Editar' : '➕ Nueva'} Historia</h3>
            <form onSubmit={handleSubmit}>
              
              <div className="form-row">
                 <div className="form-group" style={{flex: 2}}>
                    <label>Título</label>
                    <input name="titulo" value={formData.titulo} onChange={handleChange} required />
                 </div>
                 <div className="form-group">
                    <label>Estado</label>
                    <select name="estado" value={formData.estado} onChange={handleChange}>
                        <option value="desbloqueado">Publicada</option>
                        <option value="bloqueado">Bloqueada</option>
                        <option value="borrador">Borrador</option>
                    </select>
                 </div>
              </div>

              <div className="form-group">
                 <label>Narrativa / Sinopsis</label>
                 <textarea name="narrativa" value={formData.narrativa} onChange={handleChange} rows={4} required />
              </div>

              <div className="form-row">
                  <div className="form-group">
                      <label>Orden</label>
                      <input type="number" name="orden" value={formData.orden} onChange={handleChange} />
                  </div>
                  <div className="form-group">
                      <label>Nivel Acceso</label>
                      <input type="number" name="nivel_acceso_requerido" value={formData.nivel_acceso_requerido} onChange={handleChange} />
                  </div>
                  <div className="form-group" style={{flex:2}}>
                      <label>Ubicación</label>
                      <select name="id_ubicacion" value={formData.id_ubicacion} onChange={handleChange} required>
                          <option value="">-- Seleccionar Ubicación --</option>
                          {ubicaciones.map(u => (
                              <option key={u.id_ubicacion} value={u.id_ubicacion}>
                                  {u.nombre}
                              </option>
                          ))}
                      </select>
                  </div>
              </div>

              <div className="form-row checkbox-row">
                  <div className="form-group checkbox-group">
                      <input type="checkbox" id="es_principal" name="es_historia_principal" checked={formData.es_historia_principal} onChange={handleChange} />
                      <label htmlFor="es_principal">Es Historia Principal</label>
                  </div>
                  
                  {!formData.es_historia_principal && (
                      <div className="form-group" style={{flex: 2}}>
                          <label>Historia Madre (Dependencia)</label>
                          <select name="id_historia_dependencia" value={formData.id_historia_dependencia} onChange={handleChange}>
                              <option value="0">-- Seleccionar --</option>
                              {historias.filter(h => h.es_historia_principal && h.id_historia !== editingId).map(h => (
                                  <option key={h.id_historia} value={h.id_historia}>{h.titulo}</option>
                              ))}
                          </select>
                      </div>
                  )}
              </div>

              <hr style={{borderColor: '#444', margin: '20px 0'}}/>
              <h4 style={{color: '#cbd5e0', marginTop:0}}>🖼️ Imágenes de Portada</h4>

              <div className="form-row">
                  <div className="form-group" style={{flex:1}}>
                      <label>Imagen Principal</label>
                      <select name="id_imagen_historia" value={formData.id_imagen_historia} onChange={handleChange}>
                          <option value="0">-- Ninguna --</option>
                          {imagenes.map(img => <option key={img.id_recurso} value={img.id_recurso}>{img.archivo.substring(0, 30)}...</option>)}
                      </select>
                      <ImagePreview id={Number(formData.id_imagen_historia)} />
                  </div>

                  <div className="form-group" style={{flex:1}}>
                      <label>Imagen Mapa (Icono)</label>
                      <select name="id_imagen_mapa" value={formData.id_imagen_mapa} onChange={handleChange}>
                          <option value="0">-- Ninguna --</option>
                          {imagenes.map(img => <option key={img.id_recurso} value={img.id_recurso}>{img.archivo.substring(0, 30)}...</option>)}
                      </select>
                      <ImagePreview id={Number(formData.id_imagen_mapa)} />
                  </div>
              </div>

              <div className="form-actions">
                 <button type="submit" className="btn btn-success">💾 Guardar</button>
                 <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TABLA DE DATOS */}
      <div className="admin-table-container">
        <table className="admin-table">
          <thead>
             <tr>
                 <th>ID</th>
                 <th>Título</th>
                 <th>Tipo</th>
                 <th>Ubicación</th>
                 <th>Estado</th>
                 <th style={{textAlign:'right'}}>Acciones</th>
             </tr>
          </thead>
          <tbody>
             {historias.map(h => (
                 <tr key={h.id_historia}>
                     <td>#{h.id_historia}</td>
                     <td>
                         <strong style={{color: '#fff'}}>{h.titulo}</strong>
                         <div style={{fontSize:'0.8rem', color:'#888'}}>Ord: {h.orden} | Lvl: {h.nivel_acceso_requerido}</div>
                     </td>
                     <td>
                         {h.es_historia_principal 
                             ? <span style={{background:'#6b46c1', color:'white', padding:'2px 6px', borderRadius:'4px', fontSize:'0.7rem'}}>Principal</span>
                             : <span style={{background:'#2c5282', color:'white', padding:'2px 6px', borderRadius:'4px', fontSize:'0.7rem'}}>Sub-trama</span>
                         }
                     </td>
                     <td>
                         {/* Lógica visual para mostrar nombre aunque venga el objeto */}
                         {typeof h.id_ubicacion === 'object' 
                            ? h.id_ubicacion.nombre 
                            : ubicaciones.find(u => u.id_ubicacion === h.id_ubicacion)?.nombre || 'N/A'}
                     </td>
                     <td>
                         <span style={{
                             padding: '4px 8px', 
                             borderRadius: '4px', 
                             background: h.estado === 'desbloqueado' ? '#2f855a' : '#742a2a',
                             color: 'white',
                             fontSize: '0.8rem'
                         }}>
                             {h.estado}
                         </span>
                     </td>
                     <td style={{textAlign:'right'}}>
                        <button onClick={() => handleEdit(h)} className="btn btn-sm btn-info">✏️</button>
                        <button onClick={() => handleDelete(h.id_historia)} className="btn btn-sm btn-danger">🗑️</button>
                     </td>
                 </tr>
             ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default AdminHistorias;