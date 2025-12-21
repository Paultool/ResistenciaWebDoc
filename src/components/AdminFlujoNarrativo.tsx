import React, { useState, useEffect } from 'react';
import {
  obtenerFlujoNarrativoPorHistoria,
  obtenerHistorias,
  obtenerRecursosMultimedia,
  obtenerPersonajes,
  obtenerRecompensas,
  crearPasoFlujo,
  actualizarPasoFlujo,
  eliminarPasoFlujo,
  FlujoNarrativo,
  Historia,
  RecursoMultimedia,
  Personaje,
  Recompensa
} from '../supabaseClient';
import PasoForm from './PasoForm';
import './AdminPanel.css';

const AdminFlujoNarrativo: React.FC = () => {
  const [pasos, setPasos] = useState<FlujoNarrativo[]>([]);
  const [historias, setHistorias] = useState<Historia[]>([]);
  const [recursosMultimedia, setRecursosMultimedia] = useState<RecursoMultimedia[]>([]);
  const [personajes, setPersonajes] = useState<Personaje[]>([]);
  const [recompensas, setRecompensas] = useState<Recompensa[]>([]);
  const [selectedHistoriaId, setSelectedHistoriaId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingPaso, setEditingPaso] = useState<FlujoNarrativo | null>(null);
  const [formData, setFormData] = useState({
    tipo_paso: 'narrativo',
    contenido: '',
    orden: 0,
    recursomultimedia_id: null,
    id_personaje: null,
    id_recompensa: null,
    id_siguiente_paso: null, // <-- Nuevo campo para el siguiente paso
    metadata: {
      opciones_siguientes_json: [],
    },
  });

  useEffect(() => {
    const cargarDatosIniciales = async () => {
      try {
        const [historiasData, recursosData, personajesData, recompensasData] = await Promise.all([
          obtenerHistorias(),
          obtenerRecursosMultimedia(),
          obtenerPersonajes(),
          obtenerRecompensas(),
        ]);

        console.log("Personajes cargados:", personajesData);

        setHistorias(historiasData);
        setRecursosMultimedia(recursosData);
        setPersonajes(personajesData);
        setRecompensas(recompensasData);

      } catch (err: any) {
        console.error("Error en la carga inicial:", err);
        setError('Error al cargar la lista de historias, recursos, personajes o recompensas: ' + err.message);
      }
    };
    cargarDatosIniciales();
  }, []);

  useEffect(() => {
    if (selectedHistoriaId) {
      cargarFlujoNarrativo(selectedHistoriaId);
    } else {
      setPasos([]);
    }
  }, [selectedHistoriaId]);

  const cargarFlujoNarrativo = async (historiaId: number) => {
    try {
      setLoading(true);
      const data = await obtenerFlujoNarrativoPorHistoria(historiaId);
      setPasos(data);
    } catch (err: any) {
      setError('Error al cargar el flujo narrativo: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleHistoriaChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = parseInt(e.target.value);
    setSelectedHistoriaId(id);
  };

  const handleAddPaso = () => {
    if (!selectedHistoriaId) {
      setError('Por favor, selecciona una historia primero.');
      return;
    }
    setEditingPaso(null);
    setFormData({
      tipo_paso: 'narrativo',
      contenido: '',
      orden: pasos.length > 0 ? Math.max(...pasos.map(p => p.orden)) + 1 : 1,
      recursomultimedia_id: null,
      id_personaje: null,
      id_recompensa: null,
      id_siguiente_paso: null, // <-- Inicializar el nuevo campo
      metadata: {
        opciones_siguientes_json: [],
      },
    });
    setShowForm(true);
  };

  const handleEditPaso = (paso: FlujoNarrativo) => {
    setEditingPaso(paso);
    setFormData({
      tipo_paso: paso.tipo_paso,
      contenido: paso.contenido,
      orden: paso.orden,
      recursomultimedia_id: paso.recursomultimedia_id,
      id_personaje: paso.id_personaje,
      id_recompensa: paso.id_recompensa,
      id_siguiente_paso: paso.id_siguiente_paso, // <-- Cargar el nuevo campo
      metadata: paso.opciones_decision || { opciones_siguientes_json: [] },
    });
    setShowForm(true);
  };

  const handleDeletePaso = async (pasoId: number) => {
    // Reemplazando `window.confirm` con una lógica de UI en el futuro
    // ya que no funciona en el entorno de canvas.
    // Aquí solo se muestra un log por ahora.
    console.log(`Paso a eliminar con ID: ${pasoId}`);
    try {
      await eliminarPasoFlujo(pasoId);
      cargarFlujoNarrativo(selectedHistoriaId as number);
    } catch (err: any) {
      setError('Error al eliminar el paso: ' + err.message);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedHistoriaId) return;

    try {
      const dataToSave = {
        tipo_paso: formData.tipo_paso,
        contenido: formData.contenido,
        orden: formData.orden,
        id_historia: selectedHistoriaId,
        recursomultimedia_id: formData.recursomultimedia_id,
        id_personaje: formData.id_personaje,
        id_recompensa: formData.id_recompensa,
        id_siguiente_paso: formData.id_siguiente_paso, // <-- Guardar el nuevo campo
        opciones_decision: formData.metadata,
      };

      if (editingPaso) {
        if (editingPaso.id_flujo === undefined || editingPaso.id_flujo === null) {
          throw new Error("El ID del flujo narrativo a actualizar es inválido.");
        }
        await actualizarPasoFlujo({
          ...dataToSave,
          id_flujo: editingPaso.id_flujo,
        });
      } else {
        await crearPasoFlujo(dataToSave);
      }

      setShowForm(false);
      setEditingPaso(null);
      cargarFlujoNarrativo(selectedHistoriaId);
    } catch (err: any) {
      setError('Error al guardar el paso: ' + err.message);
      console.error(err);
    }
  };

  return (
    <div className="admin-view">
      <div className="view-header">
        <h2>📜 Flujo Narrativo</h2>
        <div className="header-actions">
          <select
            value={selectedHistoriaId || ''}
            onChange={handleHistoriaChange}
            className="form-select"
          >
            <option value="">Selecciona una Historia</option>
            {historias.map((historia) => (
              <option key={historia.id_historia} value={historia.id_historia}>
                {historia.titulo}
              </option>
            ))}
          </select>
          <button className="btn btn-primary" onClick={handleAddPaso} disabled={!selectedHistoriaId}>
            ➕ Añadir Nuevo Paso
          </button>
        </div>
      </div>

      {showForm && (
        <PasoForm
          editingPaso={editingPaso}
          formData={formData}
          setFormData={setFormData}
          handleSubmit={handleSubmit}
          onClose={() => setShowForm(false)}
          historias={historias}
          recursosMultimedia={recursosMultimedia}
          personajes={personajes}
          recompensas={recompensas}
          allPasos={pasos} // <-- ¡Pasando la lista de todos los pasos!
        />
      )}

      {error && (
        <div className="alert alert-danger">
          <strong>Error:</strong> {error}
        </div>
      )}

      {!selectedHistoriaId ? (
        <p>Por favor, selecciona una historia de la lista para ver y editar su flujo narrativo.</p>
      ) : loading ? (
        <div className="admin-loading">
          <h2>Cargando flujo narrativo...</h2>
        </div>
      ) : (
        <div className="admin-table-container">
          {pasos.length === 0 ? (
            <p>No se encontraron pasos para esta historia. ¡Añade el primero!</p>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Orden</th>
                  <th>Tipo</th>
                  <th>Contenido</th>
                  <th>Siguiente Paso</th>
                  <th>Recompensa</th>
                  <th className="actions-header">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {pasos.map((paso) => (
                  <tr key={paso.id_flujo}>
                    <td>{paso.orden}</td>
                    <td><span className={`type-badge ${paso.tipo_paso}`}>{paso.tipo_paso}</span></td>
                    <td>{paso.contenido.substring(0, 100)}...</td>
                    <td>{paso.id_siguiente_paso || 'Ninguno'}</td>
                    <td>
                      {paso.id_recompensa ?
                        recompensas.find(r => r.id_recompensa === paso.id_recompensa)?.nombre || 'Desconocida'
                        : 'Ninguna'}
                    </td>
                    <td className="actions">
                      <button
                        onClick={() => handleEditPaso(paso)}
                        className="btn btn-sm btn-info"
                        title="Editar"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => handleDeletePaso(paso.id_flujo)}
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
    </div>
  );
};

export default AdminFlujoNarrativo;
