import React, { useState, useEffect } from 'react';
import { FlujoNarrativo, OpcionSiguiente, RecursoMultimedia, Personaje, Recompensa, Historia } from '../supabaseClient';
import './AdminPanel.css';

interface PasoFormProps {
  editingPaso: FlujoNarrativo | null;
  formData: any;
  setFormData: React.Dispatch<React.SetStateAction<any>>;
  handleSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
  historias: Historia[]; // <-- Ahora recibe la lista de historias
  recursosMultimedia: RecursoMultimedia[];
  personajes: Personaje[];
  recompensas: Recompensa[];
  allPasos: FlujoNarrativo[];
}

const PasoForm: React.FC<PasoFormProps> = ({
  editingPaso,
  formData,
  setFormData,
  handleSubmit,
  onClose,
  recursosMultimedia,
  personajes,
  recompensas,
  historias, // <-- Usando la nueva prop
  allPasos,
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    let newValue: any = value;

    if (['orden', 'recursomultimedia_id', 'id_personaje', 'id_recompensa', 'id_siguiente_paso'].includes(name)) {
      newValue = value === '' ? null : parseInt(value, 10);
    }

    setFormData((prev: any) => ({
      ...prev,
      [name]: newValue,
    }));
  };

  const handleOpcionChange = (index: number, field: keyof OpcionSiguiente, value: string) => {
    const newOpciones = [...(formData.metadata?.opciones_siguientes_json || [])];
    if (!newOpciones[index]) {
      newOpciones[index] = { texto: '', siguiente_paso_id: null };
    }
    if (field === 'siguiente_paso_id') {
      newOpciones[index][field] = value === '' ? null : parseInt(value, 10);
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

  useEffect(() => {
    if (editingPaso) {
      setFormData({
        ...editingPaso,
        metadata: {
          ...editingPaso.metadata,
          opciones_siguientes_json: editingPaso.metadata?.opciones_siguientes_json || [],
        },
      });
    }
  }, [editingPaso, setFormData]);

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
              <option value="app">APP</option>
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

          {/* Campo para el siguiente paso, visible si NO es una pregunta */}
          {formData.tipo_paso !== 'pregunta' && (
            <div className="form-group">
              {formData.tipo_paso === 'final' ? (
                <label>Historia a continuar</label>
              ) : (
                <label>Siguiente Paso (opcional)</label>
              )}
              
              <select
                name="id_siguiente_paso"
                value={formData.id_siguiente_paso || ''}
                onChange={handleChange}
                className="form-control"
              >
                <option value="">Ninguno</option>
                {formData.tipo_paso === 'final' ? (
                  // Si es final, muestra las historias
                  (historias ?? []).map(historia => (
                    <option key={historia.id_historia} value={historia.id_historia}>
                      {historia.titulo}
                    </option>
                  ))
                ) : (
                  // Si es narrativo, muestra los pasos
                  (allPasos ?? []).map(paso => (
                    <option key={paso.id_flujo} value={paso.id_flujo}>
                      Paso #{paso.orden} ({paso.tipo_paso})
                    </option>
                  ))
                )}
              </select>
            </div>
          )}

          {(formData.tipo_paso === 'pregunta' || formData.tipo_paso === 'app') && (
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
                  <select
                    name="siguiente_paso_id"
                    value={opcion.siguiente_paso_id || ''}
                    onChange={(e) => handleOpcionChange(index, 'siguiente_paso_id', e.target.value)}
                    className="form-control"
                    required
                  >
                    <option value="">Seleccionar Paso</option>
                    {(allPasos ?? []).map(paso => (
                      <option key={paso.id_flujo} value={paso.id_flujo}>
                        Paso #{paso.orden} ({paso.tipo_paso})
                      </option>
                    ))}
                  </select>
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
