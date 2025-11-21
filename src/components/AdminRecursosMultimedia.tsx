import React, { useState, useEffect } from 'react';
import {
  RecursoMultimedia,
  obtenerRecursosMultimedia,
  crearRecursoMultimedia,
  actualizarRecursoMultimedia,
  eliminarRecursoMultimedia,
} from '../supabaseClient';
import './AdminPanel.css';
// NUEVO: Importar el editor y los esquemas
import Editor from '@monaco-editor/react';
import { getSchemaForResource, FormField } from '../schemas/appSchemas'; // Ajusta la ruta

interface AdminRecursosMultimediaProps {}

const AdminRecursosMultimedia: React.FC<AdminRecursosMultimediaProps> = () => {
  const [recursos, setRecursos] = useState<RecursoMultimedia[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingRecurso, setEditingRecurso] = useState<RecursoMultimedia | null>(null);
  
  // ACTUALIZADO: El estado base
  const [formData, setFormData] = useState({
    tipo: 'imagen',
    archivo: '',
  });

  // NUEVO: Estado para el constructor dinámico
  // 'dynamicData' es el OBJETO que se está construyendo
  const [dynamicData, setDynamicData] = useState<any>({});
  // 'metadatosString' es el JSON que se muestra en el editor fallback
  const [metadatosString, setMetadatosString] = useState<string>('');
  
  // NUEVO: Estado para el esquema actual
  const [currentSchema, setCurrentSchema] = useState<FormField[] | null>(null);

  useEffect(() => {
    cargarRecursos();
  }, []);

  // NUEVO: Efecto que reacciona a los cambios de 'tipo' y 'archivo'
  useEffect(() => {
    const schema = getSchemaForResource(formData.tipo, formData.archivo);
    setCurrentSchema(schema);

    // Si encontramos un schema, los 'dynamicData' son la fuente de verdad.
    // Si no, 'metadatosString' es la fuente de verdad.
    if (schema) {
      // Si ya había datos dinámicos, los mantenemos.
      // Si no, (ej. al editar) los poblamos desde el string.
      try {
        const parsed = JSON.parse(metadatosString);
        setDynamicData(parsed);
      } catch (e) {
        // No era un JSON válido, empezamos de cero
        setDynamicData({});
      }
    }
  }, [formData.tipo, formData.archivo, metadatosString]); // Depende de metadatosString para la carga inicial al editar

  const cargarRecursos = async () => {
    setLoading(true);
    const data = await obtenerRecursosMultimedia();
    setRecursos(data);
    setLoading(false);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // NUEVO: Manejador para los campos del formulario dinámico
  const handleDynamicChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const finalValue = type === 'number' ? parseFloat(value) : value;

    setDynamicData((prev: any) => ({
      ...prev,
      [name]: finalValue,
    }));
  };

  // NUEVO: Manejador para el editor JSON (fallback)
  const handleJsonEditorChange = (value: string | undefined) => {
    setMetadatosString(value || '');
  };
  
  // NUEVO: Manejador para los campos 'json' dentro del formulario dinámico
  const handleDynamicJsonChange = (fieldName: string, value: string | undefined) => {
    let parsedValue: any = null;
    try {
      // Intentamos parsear para guardarlo como objeto
      parsedValue = JSON.parse(value || 'null');
    } catch (e) {
      // Si no es un JSON válido, lo guardamos como string (o decidimos mostrar error)
      parsedValue = value; // Guardar el string con errores
    }
    setDynamicData((prev: any) => ({
      ...prev,
      [fieldName]: parsedValue,
    }));
  };


  const handleAddRecurso = () => {
    setEditingRecurso(null);
    setFormData({ tipo: 'imagen', archivo: '' });
    setMetadatosString('');
    setDynamicData({});
    setCurrentSchema(null);
    setShowForm(true);
  };

  const handleEditRecurso = (recurso: RecursoMultimedia) => {
    setEditingRecurso(recurso);
    // Poblar el estado base
    setFormData({
      tipo: recurso.tipo,
      archivo: recurso.archivo,
    });
    // Poblar los dos estados de metadatos
    const prettyJson = JSON.stringify(recurso.metadatos, null, 2);
    setMetadatosString(prettyJson); // Para el editor fallback
    setDynamicData(recurso.metadatos || {}); // Para el formulario dinámico
    
    // El useEffect se encargará de setear 'currentSchema'
    setShowForm(true);
  };

  const handleDeleteRecurso = async (recursoId: number) => {
    if (window.confirm('¿Seguro que quieres eliminar este recurso?')) {
      try {
        await eliminarRecursoMultimedia(recursoId);
        cargarRecursos();
      } catch (err: any) {
        setError('Error al eliminar: ' + err.message);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    let metadatosParaGuardar: any = {};

    try {
      // Si hay un schema, la fuente de verdad es 'dynamicData'
      if (currentSchema) {
        metadatosParaGuardar = dynamicData;
      } else {
        // Si no hay schema, usamos el editor JSON.
        // Si está vacío, guardamos un objeto vacío.
        if (metadatosString.trim() === '') {
          metadatosParaGuardar = {};
        } else {
          metadatosParaGuardar = JSON.parse(metadatosString);
        }
      }

      if (editingRecurso) {
        await actualizarRecursoMultimedia({
          ...formData,
          id_recurso: editingRecurso.id_recurso,
          metadatos: metadatosParaGuardar,
        });
      } else {
        await crearRecursoMultimedia({
          ...formData,
          metadatos: metadatosParaGuardar,
        });
      }
      setShowForm(false);
      cargarRecursos();
    } catch (err: any) {
      if (err instanceof SyntaxError) {
        setError('Error de formato JSON en Metadatos. Revisa el editor JSON.');
      } else {
        setError('Error al guardar el recurso: ' + (err as Error).message);
      }
    }
  };

  // NUEVO: Función que renderiza el formulario de metadatos
  const renderMetadataForm = () => {
    // Caso 1: Hay un schema, renderizamos el formulario dinámico
    if (currentSchema) {
      return (
        <div className="dynamic-form">
          <p className="form-schema-title">Constructor para: <strong>{formData.tipo} ({formData.archivo.split('/').pop()})</strong></p>
          {currentSchema.map((field) => (
            <div className="form-group" key={field.name}>
              <label htmlFor={field.name}>{field.label}</label>
              {field.type === 'textarea' && (
                <textarea
                  id={field.name}
                  name={field.name}
                  value={dynamicData[field.name] || ''}
                  onChange={handleDynamicChange}
                  className="form-control"
                  rows={3}
                  placeholder={field.placeholder}
                />
              )}
              {field.type === 'text' && (
                <input
                  id={field.name}
                  type="text"
                  name={field.name}
                  value={dynamicData[field.name] || ''}
                  onChange={handleDynamicChange}
                  className="form-control"
                  placeholder={field.placeholder}
                />
              )}
              {field.type === 'number' && (
                <input
                  id={field.name}
                  type="number"
                  name={field.name}
                  value={dynamicData[field.name] || 0}
                  onChange={handleDynamicChange}
                  className="form-control"
                  placeholder={field.placeholder}
                />
              )}
              {field.type === 'json' && (
                <Editor
                  height="150px"
                  language="json"
                  theme="vs-dark"
                  value={JSON.stringify(dynamicData[field.name], null, 2) || ''}
                  options={{ minimap: { enabled: false }, wordWrap: 'on' }}
                  onChange={(value) => handleDynamicJsonChange(field.name, value)}
                />
              )}
            </div>
          ))}
        </div>
      );
    }

    // Caso 2: No hay schema, renderizamos el Editor JSON (Fallback)
    return (
      <div className="form-group">
        <label htmlFor="recursoMetadatos">Metadatos (JSON Genérico)</label>
        <Editor
          height="200px"
          language="json"
          theme="vs-dark"
          value={metadatosString}
          options={{ minimap: { enabled: false }, wordWrap: 'on' }}
          onChange={handleJsonEditorChange}
        />
      </div>
    );
  };


  // ... (JSX del componente principal)
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
                  <option value="3d_model">Modelo 3D</option>
                  <option value="app">Aplicación (app)</option>
                  <option value="transcripcion">Transcripción</option>
                  <option value="subtitulo">Subtítulo</option>
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="recursoArchivo">Archivo (URL)</label>
                <input
                  id="recursoArchivo"
                  type="text"
                  name="archivo"
                  value={formData.archivo}
                  onChange={handleChange}
                  className="form-control"
                  required
                  placeholder="https://.../reparacion/"
                />
              </div>
              
              {/* === RENDERIZADO DINÁMICO DE METADATOS === */}
              {renderMetadataForm()}
              
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
        <div className="alert alert-danger" onClick={() => setError(null)} style={{cursor: 'pointer'}}>
          <strong>Error:</strong> {error} (clic para cerrar)
        </div>
      )}

      {loading ? (
        <div className="admin-loading"><h2>Cargando...</h2></div>
      ) : (
        <div className="admin-table-container">
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
        </div>
      )}
    </div>
  );
};

export default AdminRecursosMultimedia;