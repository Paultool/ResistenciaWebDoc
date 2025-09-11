import React from 'react';
import { FlujoNarrativo, OpcionSiguiente, RecursoMultimedia, Personaje, Recompensa } from '../supabaseClient';
import './AdminPanel.css';

interface PasoFormProps {
  editingPaso: FlujoNarrativo | null;
  formData: any;
  setFormData: React.Dispatch<React.SetStateAction<any>>;
  handleSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
  historias: any[];
  recursosMultimedia: RecursoMultimedia[];
  personajes: Personaje[];
  recompensas: Recompensa[]; // <-- ¡Nueva prop!
}

const PasoForm: React.FC<PasoFormProps> = ({
  editingPaso,
  formData,
  setFormData,
  handleSubmit,
  onClose,
  recursosMultimedia,
  personajes,
  recompensas, // <-- Usando la nueva prop
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    let newValue: any = value;

    if (name === 'orden' || name === 'recursomultimedia_id' || name === 'id_personaje' || name === 'id_recompensa') {
      newValue = value === '' ? null : parseInt(value);
    }

    setFormData((prev: any) => ({
      ...prev,
      [name]: newValue,
    }));
  };

  const handleOpcionChange = (index: number, field: keyof OpcionSiguiente, value: string) => {
    const newOpciones = [...(formData.metadata?.opciones_siguientes_json || [])];
    if (field === 'siguiente_paso_id') {
      newOpciones[index][field] = parseInt(value) || null;
    } else {
      newOpciones[index][field] = value;
    }
    setFormData((prev: any) => ({
      ...prev,
      metadata: {
        ...prev.metadata,
        opciones_siguientes_json: newOpciones,
      },
    }));
  };

  const addOpcion = () => {
    setFormData((prev: any) => ({
      ...prev,
      metadata: {
        ...prev.metadata,
        opciones_siguientes_json: [
          ...(prev.metadata?.opciones_siguientes_json || []),
          { texto: '', siguiente_paso_id: null },
        ],
      },
    }));
  };

  const removeOpcion = (index: number) => {
    setFormData((prev: any) => ({
      ...prev,
      metadata: {
        ...prev.metadata,
        opciones_siguientes_json: (prev.metadata?.opciones_siguientes_json || []).filter(
          (_: any, i: number) => i !== index
        ),
      },
    }));
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h3>{editingPaso ? '✏️ Editar Paso' : '➕ Crear Nuevo Paso'}</h3>
        <form onSubmit={handleSubmit} className="form-container">
          <div className="form-group">
            <label>Tipo de Paso</label>
            <select
              name="tipo_paso"
              value={formData.tipo_paso}
              onChange={handleChange}
              className="form-control"
              required
            >
              <option value="narrativo">Narrativo</option>
              <option value="pregunta">Pregunta (con opciones)</option>
              <option value="final">Final</option>
            </select>
          </div>
          <div className="form-group">
            <label>Contenido (Texto del Paso)</label>
            <textarea
              name="contenido"
              value={formData.contenido}
              onChange={handleChange}
              className="form-control"
              rows={4}
              required
            />
          </div>
          <div className="form-group">
            <label>Orden</label>
            <input
              type="number"
              name="orden"
              value={formData.orden}
              onChange={handleChange}
              className="form-control"
              required
            />
          </div>
          
          <div className="form-group">
            <label>Recurso Multimedia (opcional)</label>
            <select
              name="recursomultimedia_id"
              value={formData.recursomultimedia_id || ''}
              onChange={handleChange}
              className="form-control"
            >
              <option value="">Sin contenido</option>
              {(recursosMultimedia ?? []).map(recurso => (
                <option key={recurso.id_recurso} value={recurso.id_recurso}>
                  {recurso.tipo.toUpperCase()} - {recurso.archivo}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Personaje (opcional)</label>
            <select
              name="id_personaje"
              value={formData.id_personaje || ''}
              onChange={handleChange}
              className="form-control"
            >
              <option value="">Sin personaje</option>
              {(personajes ?? []).map(personaje => (
                <option key={personaje.id_personaje} value={personaje.id_personaje}>
                  {personaje.nombre}
                </option>
              ))}
            </select>
          </div>
          
          {/* Nuevo campo para la recompensa */}
          <div className="form-group">
            <label>Recompensa (opcional)</label>
            <select
              name="id_recompensa"
              value={formData.id_recompensa || ''}
              onChange={handleChange}
              className="form-control"
            >
              <option value="">Sin recompensa</option>
              {(recompensas ?? []).map(recompensa => (
                <option key={recompensa.id_recompensa} value={recompensa.id_recompensa}>
                  {recompensa.nombre}
                </option>
              ))}
            </select>
          </div>

          {formData.tipo_paso === 'pregunta' && (
            <div className="options-section">
              <h4>Opciones Siguientes</h4>
              {(formData.metadata?.opciones_siguientes_json ?? []).map((opcion: OpcionSiguiente, index: number) => (
                <div key={index} className="option-group">
                  <input
                    type="text"
                    placeholder="Texto de la opción"
                    value={opcion.texto}
                    onChange={(e) => handleOpcionChange(index, 'texto', e.target.value)}
                    className="form-control"
                    required
                  />
                  <input
                    type="number"
                    placeholder="ID del siguiente paso"
                    value={opcion.siguiente_paso_id || ''}
                    onChange={(e) => handleOpcionChange(index, 'siguiente_paso_id', e.target.value)}
                    className="form-control"
                    required
                  />
                  <button type="button" onClick={() => removeOpcion(index)} className="btn btn-sm btn-danger">
                    🗑️
                  </button>
                </div>
              ))}
              <button type="button" onClick={addOpcion} className="btn btn-secondary btn-sm">
                ➕ Añadir Opción
              </button>
            </div>
          )}

          <div className="form-actions">
            <button type="submit" className="btn btn-primary">
              {editingPaso ? 'Guardar Cambios' : 'Crear Paso'}
            </button>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PasoForm;