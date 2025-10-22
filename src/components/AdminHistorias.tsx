import React, { useState, useEffect } from 'react'
import {
  supabase,
  obtenerHistorias,
  crearHistoria,
  actualizarHistoria, 
  eliminarHistoria,
  Historia,
  Ubicacion,
  obtenerUbicaciones,
  RecursoMultimedia, 
  obtenerRecursosMultimedia 
} from '../supabaseClient'
import './AdminPanel.css'

// -----------------------------------------------------------
// INTERFACES Y TIPOS
// -----------------------------------------------------------

interface RecursoMultimedia {
    id_recurso: number
    tipo: string
    archivo: string 
}

interface UbicacionAnidada {
    id_ubicacion: number;
    nombre: string;
    coordenadas: string;
}

interface HistoriaExtendida extends Omit<Historia, 'id_ubicacion'> {
    id_ubicacion: number | string | UbicacionAnidada | null | undefined; 
    id_historia_dependencia?: number | null | undefined; 
    id_imagen_historia?: number | null | undefined;
    id_imagen_mapa?: number | null | undefined;
}


const AdminHistorias: React.FC = () => {
  const [historias, setHistorias] = useState<HistoriaExtendida[]>([])
  const [ubicaciones, setUbicaciones] = useState<Ubicacion[]>([])
  // ✅ Estado de Recursos Multimedia RESTAURADO
  const [recursosMultimedia, setRecursosMultimedia] = useState<RecursoMultimedia[]>([]) 
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editingHistoria, setEditingHistoria] = useState<HistoriaExtendida | null>(null)
  
  const getDefaultUbicacionId = () => ubicaciones.length > 0 ? ubicaciones[0].id_ubicacion : 1;

  const [formData, setFormData] = useState({
    titulo: '',
    narrativa: '',
    estado: 'desbloqueado',
    orden: 1,
    id_ubicacion: 1, 
    es_historia_principal: true,
    nivel_acceso_requerido: 1,
    id_imagen_historia: 0, 
    id_imagen_mapa: 0,     
    id_historia_dependencia: 0
  })

  // -----------------------------------------------------------
  // FUNCIONES DE CARGA Y PREVIEW
  // -----------------------------------------------------------

  useEffect(() => {
    cargarHistorias()
    cargarUbicaciones()
    cargarRecursosMultimedia() // ✅ Llamada a la carga de imágenes RESTAURADA
  }, [])

  const cargarHistorias = async () => {
    try {
      setLoading(true)
      const historiasData = await obtenerHistorias() as HistoriaExtendida[]
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
      if (ubicacionesData.length > 0 && formData.id_ubicacion === 1) {
        setFormData(prev => ({
            ...prev,
            id_ubicacion: ubicacionesData[0].id_ubicacion
        }));
      }
    } catch (err: any) {
      console.error('Error cargando ubicaciones para el formulario:', err.message)
    }
  }

  // ✅ Función para cargar recursos multimedia RESTAURADA
  const cargarRecursosMultimedia = async () => {
    try {
      const recursosData = await obtenerRecursosMultimedia()
      setRecursosMultimedia(recursosData)
    } catch (err: any) {
      console.error('Error cargando recursos multimedia para el formulario:', err.message)
    }
  }

  const imagenRecursos = recursosMultimedia.filter(r => r.tipo === 'imagen');

  // ✅ Componente Preview RESTAURADO
  const RecursoPreview: React.FC<{ recursoId: number | null }> = ({ recursoId }) => {
    if (!recursoId || recursoId === 0) return null;
    const recurso = imagenRecursos.find(r => r.id_recurso === recursoId);
    
    // Si la imagen no está cargada, muestra el error que viste
    if (!recurso || !recurso.archivo) return (
        <div style={{ marginTop: '5px', color: '#dc3545', fontSize: 'small' }}>ID: {recursoId} (URL no encontrada)</div>
    );
    
    // Si la imagen existe, muestra el preview
    return (
        <div style={{ margin: '8px 0', border: '1px solid #ddd', maxWidth: '100px', borderRadius: '4px', overflow: 'hidden' }}>
            <img 
                src={recurso.archivo} 
                alt={`Preview ${recurso.archivo}`} 
                style={{ width: '100%', height: 'auto', display: 'block', objectFit: 'cover' }} 
            />
            <div style={{ padding: '4px', backgroundColor: '#f8f9fa', fontSize: '10px', textAlign: 'center' }}>
                ID: {recurso.id_recurso}
            </div>
        </div>
    );
  };

  // Función para extraer el ID de Ubicación de forma robusta
  const extractUbicacionId = (rawUbicacion: HistoriaExtendida['id_ubicacion'], fallbackId: number): number => {
    let ubicacionId: number | null = null;
    
    if (typeof rawUbicacion === 'object' && rawUbicacion !== null) {
        if ('id_ubicacion' in rawUbicacion) {
             ubicacionId = Number((rawUbicacion as UbicacionAnidada).id_ubicacion);
        }
    } else if (typeof rawUbicacion === 'number' || (typeof rawUbicacion === 'string' && rawUbicacion !== '')) {
        ubicacionId = Number(rawUbicacion);
    }
    
    if (ubicacionId === null || isNaN(ubicacionId)) {
        return fallbackId;
    }

    return ubicacionId;
  }
  
  // -----------------------------------------------------------
  // HANDLERS
  // -----------------------------------------------------------

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target
    
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked
      setFormData(prevState => ({
        ...prevState,
        [name]: checked,
        ...(name === 'es_historia_principal' && checked ? { id_historia_dependencia: 0 } : {})
      }))
    } else {
      setFormData(prevState => ({
        ...prevState,
        [name]: name === 'id_ubicacion' || name.startsWith('id_') || name === 'orden' || name === 'nivel_acceso_requerido' 
            ? (value === '' ? 0 : Number(value)) 
            : value
      }))
    }
  }

  const handleCreate = () => {
    setEditingHistoria(null)
    const defaultId = getDefaultUbicacionId()
    
    setFormData({
      titulo: '',
      narrativa: '',
      estado: 'desbloqueado',
      orden: 1,
      id_ubicacion: defaultId,
      es_historia_principal: true,
      nivel_acceso_requerido: 1,
      id_imagen_historia: 0, 
      id_imagen_mapa: 0,     
      id_historia_dependencia: 0
    })
    setShowForm(true)
  }

  const handleEdit = (historia: HistoriaExtendida) => {
    setEditingHistoria(historia)
    
    const ubicacionId = extractUbicacionId(historia.id_ubicacion, getDefaultUbicacionId());
    const esPrincipal = !!historia.es_historia_principal; 
    const dependenciaId = historia.id_historia_dependencia ?? 0;
    
    setFormData({
      titulo: historia.titulo,
      narrativa: historia.narrativa,
      estado: historia.estado,
      orden: historia.orden,
      id_ubicacion: ubicacionId, 
      es_historia_principal: esPrincipal, 
      nivel_acceso_requerido: historia.nivel_acceso_requerido,
      // ✅ Usamos nullish coalescing para asegurar 0 si viene nulo de la DB
      id_imagen_historia: historia.id_imagen_historia ?? 0, 
      id_imagen_mapa: historia.id_imagen_mapa ?? 0,         
      id_historia_dependencia: dependenciaId 
    })
    setShowForm(true)
  }
  
  const handleDelete = async (historia: HistoriaExtendida) => {
    const confirmacion = window.confirm(`¿Estás seguro de que deseas eliminar la historia "${historia.titulo}"?`)
    if (confirmacion) {
      try {
        await eliminarHistoria(historia.id_historia)
        await cargarHistorias()
      } catch (err: any) {
        setError('Error al eliminar historia: ' + err.message)
      }
    }
  }
  
  const resetForm = () => {
    setEditingHistoria(null)
    const defaultId = getDefaultUbicacionId()
    
    setFormData({
      titulo: '',
      narrativa: '',
      estado: 'desbloqueado',
      orden: 1,
      id_ubicacion: defaultId,
      es_historia_principal: true,
      nivel_acceso_requerido: 1,
      id_imagen_historia: 0,
      id_imagen_mapa: 0,
      id_historia_dependencia: 0
    })
  }
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const getNullableId = (id: number) => (id === 0 || id === null ? null : id)
    
    const dependenciaId = formData.es_historia_principal 
      ? null 
      : getNullableId(formData.id_historia_dependencia)

    try {
      if (editingHistoria) {
        const updateData = {
          titulo: formData.titulo,
          narrativa: formData.narrativa,
          estado: formData.estado,
          orden: formData.orden,
          id_ubicacion: formData.id_ubicacion, 
          es_historia_principal: formData.es_historia_principal, 
          nivel_acceso_requerido: formData.nivel_acceso_requerido,
          id_imagen_historia: getNullableId(formData.id_imagen_historia),
          id_imagen_mapa: getNullableId(formData.id_imagen_mapa),
          id_historia_dependencia: dependenciaId
        };
        
        const { error: updateError } = await actualizarHistoria(editingHistoria.id_historia, updateData)
        
        if (updateError) {
             throw new Error(updateError.message || "Error desconocido al actualizar en Supabase.");
        }
        
      } else {
        await crearHistoria({
          titulo: formData.titulo,
          narrativa: formData.narrativa,
          estado: formData.estado,
          orden: formData.orden,
          id_ubicacion: formData.id_ubicacion,
          es_historia_principal: formData.es_historia_principal,
          nivel_acceso_requerido: formData.nivel_acceso_requerido,
          fecha_creacion: new Date().toISOString(),
          id_imagen_historia: getNullableId(formData.id_imagen_historia),
          id_imagen_mapa: getNullableId(formData.id_imagen_mapa),
          id_historia_dependencia: dependenciaId
        })
      }
      
      setShowForm(false)
      resetForm()
      await cargarHistorias()
    } catch (err: any) {
      setError('Error al guardar/actualizar la historia: ' + err.message)
      console.error("Error al actualizar historia:", err);
    }
  }


  // -----------------------------------------------------------
  // RENDERIZADO
  // -----------------------------------------------------------

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
                <input type="text" id="titulo" name="titulo" value={formData.titulo} onChange={handleInputChange} required />
              </div>
              <div className="form-group">
                <label htmlFor="narrativa">Narrativa:</label>
                <textarea id="narrativa" name="narrativa" value={formData.narrativa} onChange={handleInputChange} rows={4} required />
              </div>
              
              <div className="form-group">
                <label htmlFor="estado">Estado:</label>
                <select id="estado" name="estado" value={formData.estado} onChange={handleInputChange}>
                  <option value="desbloqueado">Desbloqueado</option>
                  <option value="bloqueado">Bloqueado</option>
                  <option value="borrador">Borrador</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="orden">Orden de la historia:</label>
                <input type="number" id="orden" name="orden" value={formData.orden} onChange={handleInputChange} required />
              </div>
              <div className="form-group">
                <label htmlFor="nivel_acceso_requerido">Nivel de Acceso Requerido:</label>
                <input type="number" id="nivel_acceso_requerido" name="nivel_acceso_requerido" value={formData.nivel_acceso_requerido} onChange={handleInputChange} required />
              </div>
              
              <div className="form-group">
                <label htmlFor="id_ubicacion">Ubicación:</label>
                <select id="id_ubicacion" name="id_ubicacion" 
                  value={formData.id_ubicacion} 
                  onChange={handleInputChange} required>
                  {ubicaciones.map(ubicacion => (
                    <option key={ubicacion.id_ubicacion} value={ubicacion.id_ubicacion}>
                      {ubicacion.nombre}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="form-group checkbox-group">
                <input type="checkbox" id="es_historia_principal" name="es_historia_principal" 
                  checked={formData.es_historia_principal} 
                  onChange={handleInputChange} />
                <label htmlFor="es_historia_principal">Es Historia Principal</label>
              </div>

              {!formData.es_historia_principal && (
                <div className="form-group">
                  <label htmlFor="id_historia_dependencia">Historia Madre (Dependencia):</label>
                  <select id="id_historia_dependencia" name="id_historia_dependencia" value={formData.id_historia_dependencia} onChange={handleInputChange}>
                    <option value={0}>-- Seleccionar Historia (Opcional) --</option> 
                    {historias
                      .filter(h => h.id_historia !== (editingHistoria?.id_historia ?? -1))
                      .filter(h => !!h.es_historia_principal === true) 
                      .map(historia => (
                      <option key={historia.id_historia} value={historia.id_historia}>
                        {historia.titulo} (ID: {historia.id_historia})
                      </option>
                    ))}
                  </select>
                </div>
              )}
              
              {/* ✅ Campos de Imagenes RESTAURADOS Y FUNCIONALES */}
              <div className="form-group">
                <label htmlFor="id_imagen_historia">ID Imagen Historia:</label>
                <select id="id_imagen_historia" name="id_imagen_historia" value={formData.id_imagen_historia} onChange={handleInputChange}>
                  <option value={0}>-- Seleccionar Imagen (Opcional) --</option> 
                  {imagenRecursos.map(recurso => (
                    <option key={recurso.id_recurso} value={recurso.id_recurso}>
                      {recurso.archivo} (ID: {recurso.id_recurso})
                    </option>
                  ))}
                </select>
                <RecursoPreview recursoId={formData.id_imagen_historia} />
              </div>

              <div className="form-group">
                <label htmlFor="id_imagen_mapa">ID Imagen Mapa:</label>
                <select id="id_imagen_mapa" name="id_imagen_mapa" value={formData.id_imagen_mapa} onChange={handleInputChange}>
                  <option value={0}>-- Seleccionar Imagen (Opcional) --</option>
                  {imagenRecursos.map(recurso => (
                    <option key={recurso.id_recurso} value={recurso.id_recurso}>
                      {recurso.archivo} (ID: {recurso.id_recurso})
                    </option>
                  ))}
                </select>
                <RecursoPreview recursoId={formData.id_imagen_mapa} />
              </div>
              {/* FIN Campos de Imagenes RESTAURADOS Y FUNCIONALES */}

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

      {/* Listado de Historias */}
      <div className="admin-table-container">
        {loading ? (
          <div className="loading"><p>⏳ Cargando historias...</p></div>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Título</th>
                <th>Estado</th>
                <th>Ubicación</th>
                <th>Tipo</th>
                <th className="actions-header">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {historias.map((historia) => (
                <tr key={historia.id_historia}>
                  <td>#{historia.id_historia}</td>
                  <td><strong>{historia.titulo}</strong></td>
                  <td>
                    <span className={`status-badge ${historia.estado}`}>
                      {historia.estado}
                    </span>
                  </td>
                  {/* Listado de ubicación usando la lógica robusta */}
                  <td>
                    {(() => {
                        const ubicacionId = extractUbicacionId(historia.id_ubicacion, -1);
                        
                        if (ubicacionId !== -1) {
                            const found = ubicaciones.find(u => u.id_ubicacion === ubicacionId);
                            return found ? found.nombre : `ID: ${ubicacionId} (Error en Carga)`;
                        }
                        return 'N/A';
                    })()}
                  </td>
                  {/* El tipo de historia refleja correctamente Principal/Secundaria */}
                  <td>
                    <span className={`type-badge ${!!historia.es_historia_principal ? 'principal' : 'secundaria'}`}>
                      {!!historia.es_historia_principal ? '⭐ Principal' : '📝 Secundaria'}
                    </span>
                  </td>
                  <td className="actions">
                    <button onClick={() => handleEdit(historia)} className="btn btn-sm btn-info" title="Editar">✏️</button>
                    <button onClick={() => handleDelete(historia)} className="btn btn-sm btn-danger" title="Eliminar">🗑️</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      
      <div className="admin-summary">
        <p>📊 Total de historias: <strong>{historias.length}</strong></p>
        <p>⭐ Principales: <strong>{historias.filter(h => !!h.es_historia_principal).length}</strong></p>
        <p>📝 Secundarias: <strong>{historias.filter(h => !h.es_historia_principal).length}</strong></p>
      </div>
    </div>
  )
}

export default AdminHistorias