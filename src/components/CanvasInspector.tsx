import React, { useState, useEffect } from 'react';
import { PlusCircle, Trash2 } from 'lucide-react';

interface InspectorProps {
  node: any;
  onSave: (nodeId: string, data: any) => void;
  onClose: () => void;
  allSteps: any[];
  // Nuevas props para llenar selectores de historia
  allLocations?: any[];
  allImages?: any[];
}

export const CanvasInspector: React.FC<InspectorProps> = ({
  node,
  onSave,
  onClose,
  allSteps,
  allLocations = [],
  allImages = []
}) => {
  const [formData, setFormData] = useState<any>({});
  const [metadataString, setMetadataString] = useState<string>('{}');
  const originalData = node.data.originalData || {};
  const type = node.type;

  // B. useEffect Actualizado (Carga de datos)
  useEffect(() => {
    let initialData = { ...node.data.originalData, ...node.data };

    // 1. Detectar nombre del campo JSON
    const jsonField = getJsonFieldName(node.type);

    // 2. Obtener el objeto JSON raw (desde BD o local)
    const rawJson = node.data.originalData?.[jsonField] || node.data[jsonField] || {};

    // Lógica específica de Pasos (decisiones)
    if (node.type === 'step') {
      let opciones = initialData.opciones_decision || [];
      if (typeof opciones === 'string') {
        try { opciones = JSON.parse(opciones); } catch { opciones = []; }
      }
      // Nota: Los pasos siguen usando 'metadata' internamente para posiciones
      initialData = {
        ...initialData,
        metadata: { ...rawJson, opciones_siguientes_json: opciones }
      };
    }

    // 3. Convertir a String para el editor de texto negro
    if (rawJson && Object.keys(rawJson).length > 0) {
      if (typeof rawJson === 'object') {
        setMetadataString(JSON.stringify(rawJson, null, 2));
      } else if (typeof rawJson === 'string') {
        setMetadataString(rawJson);
      }
    } else {
      setMetadataString('{}');
    }

    setFormData(initialData);
  }, [node]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type: inputType } = e.target;
    let finalValue: any = value;

    if (inputType === 'checkbox') {
      finalValue = (e.target as HTMLInputElement).checked;
    } else if (['orden', 'id_siguiente_paso', 'nivel_acceso_requerido', 'id_ubicacion', 'id_imagen_historia', 'id_imagen_mapa'].includes(name)) {
      finalValue = value === '' ? null : parseInt(value, 10);
    }
    // AGREGAMOS 'valor' A ESTA LISTA
    else if (['orden', 'id_siguiente_paso', 'nivel_acceso_requerido', 'id_ubicacion', 'id_imagen_historia', 'id_imagen_mapa', 'valor'].includes(name)) {
      finalValue = value === '' ? null : parseInt(value, 10);
    }

    setFormData((prev: any) => ({ ...prev, [name]: finalValue }));
  };

  // ... (Lógica de opciones de Pregunta se mantiene igual) ...
  const handleOpcionChange = (index: number, field: string, value: string) => {
    const newOpciones = [...(formData.metadata?.opciones_siguientes_json || [])];
    if (!newOpciones[index]) newOpciones[index] = { texto: '', id_siguiente: null };

    if (field === 'id_siguiente') {
      newOpciones[index][field] = value === '' ? null : parseInt(value, 10);
    } else {
      newOpciones[index][field] = value;
    }

    setFormData((prev: any) => ({
      ...prev,
      metadata: { ...prev.metadata, opciones_siguientes_json: newOpciones }
    }));
  };

  const addOpcion = () => {
    setFormData((prev: any) => ({
      ...prev,
      metadata: {
        ...prev.metadata,
        opciones_siguientes_json: [
          ...(prev.metadata?.opciones_siguientes_json || []),
          { texto: '', id_siguiente: null }
        ]
      }
    }));
  };

  const removeOpcion = (index: number) => {
    setFormData((prev: any) => ({
      ...prev,
      metadata: {
        ...prev.metadata,
        opciones_siguientes_json: (prev.metadata?.opciones_siguientes_json || []).filter((_: any, i: number) => i !== index)
      }
    }));
  };

  // A. Helper para saber el nombre del campo JSON según el tipo
  const getJsonFieldName = (nodeType: string) => {
    if (nodeType === 'multimedia') return 'metadatos';
    if (nodeType === 'character') return 'atributos_json';
    return 'metadata'; // Default para steps/story
  };

  // NUEVO: Función especial para validar y guardar
  const handleSave = () => {
    const dataToSave = { ...formData };
    const jsonField = getJsonFieldName(node.type);

    // 1. Validar y Asignar JSON al campo correcto (metadatos, atributos_json, metadata)
    try {
      const parsedJson = JSON.parse(metadataString);
      dataToSave[jsonField] = parsedJson;

      // Limpieza: si usamos un campo específico, asegurarnos de no enviar 'metadata' genérico si no es necesario
      if (jsonField !== 'metadata') delete dataToSave.metadata;

    } catch (e) {
      alert(`❌ Error: El formato JSON en el campo ${jsonField} es inválido.`);
      return;
    }

    // 2. Lógica de Pasos (Decisiones)
    if (node.type === 'step' && (formData.tipo_paso === 'pregunta' || formData.tipo_paso === 'decision')) {
      dataToSave.opciones_decision = formData.metadata?.opciones_siguientes_json || [];
    }

    onSave(node.id, dataToSave);
  };

  const renderFields = () => {
    switch (type) {
      case 'step':
        // ... (Código del paso se mantiene igual, asegurando mostrar tipo_paso correcto) ...
        return (
          <>
            <div className="inspector-group">
              <label>Tipo de Paso</label>
              <select name="tipo_paso" value={formData.tipo_paso || 'narrativo'} onChange={handleChange}>
                <option value="narrativo">Narrativo</option>
                <option value="pregunta">Decisión / Pregunta</option>
                <option value="app">APP / Juego</option>
                <option value="final">Final</option>
              </select>
            </div>
            {/* ... resto de campos de paso ... */}
            <div className="inspector-group">
              <label>Contenido</label>
              <textarea name="contenido" value={formData.contenido || ''} onChange={handleChange} rows={5} />
            </div>

            <div className="inspector-group">
              <label>Orden</label>
              <input type="number" name="orden" value={formData.orden || 0} onChange={handleChange} />
            </div>

            {(formData.tipo_paso === 'narrativo' || formData.tipo_paso === 'app' || !formData.tipo_paso) && (
              <div className="inspector-group">
                <label>Siguiente Paso (Default)</label>
                <select name="id_siguiente_paso" value={formData.id_siguiente_paso || ''} onChange={handleChange}>
                  <option value="">-- Fin del camino --</option>
                  {allSteps
                    .filter(s => s.id_flujo !== formData.id_flujo)
                    .map(step => (
                      <option key={step.id_flujo} value={step.id_flujo}>
                        #{step.orden} - {step.contenido?.substring(0, 20)}...
                      </option>
                    ))}
                </select>
              </div>
            )}

            {(formData.tipo_paso === 'decision' || formData.tipo_paso === 'pregunta') && (
              <div className="inspector-group options-container">
                <label>Opciones de Respuesta</label>
                <div style={{ background: '#333', padding: 10, borderRadius: 5 }}>
                  {(formData.metadata?.opciones_siguientes_json || []).map((opcion: any, idx: number) => (
                    <div key={idx} style={{ marginBottom: 10, borderBottom: '1px solid #555', paddingBottom: 10 }}>
                      <input
                        type="text"
                        placeholder="Texto opción"
                        value={opcion.texto}
                        onChange={(e) => handleOpcionChange(idx, 'texto', e.target.value)}
                        style={{ marginBottom: 5 }}
                      />
                      <div style={{ display: 'flex', gap: 5 }}>
                        <select
                          value={opcion.id_siguiente || ''}
                          onChange={(e) => handleOpcionChange(idx, 'id_siguiente', e.target.value)}
                        >
                          <option value="">-- Destino --</option>
                          {allSteps.map(step => (
                            <option key={step.id_flujo} value={step.id_flujo}>
                              ➡️ #{step.orden}
                            </option>
                          ))}
                        </select>
                        <button type="button" onClick={() => removeOpcion(idx)} className="btn-danger" style={{ padding: '0 8px' }}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                  <button type="button" onClick={addOpcion} className="btn-secondary" style={{ width: '100%', fontSize: 12 }}>
                    <PlusCircle size={12} style={{ marginRight: 5 }} /> Agregar Opción
                  </button>
                </div>
              </div>
            )}
          </>
        );

      // --- CASO HISTORIA (AMPLIADO) ---
      case 'story':
        return (
          <>
            <div className="inspector-group">
              <label>Título</label>
              <input name="titulo" value={formData.titulo || ''} onChange={handleChange} />
            </div>
            <div className="inspector-group">
              <label>Estado</label>
              <select name="estado" value={formData.estado || 'borrador'} onChange={handleChange}>
                <option value="borrador">Borrador</option>
                <option value="publicado">Publicado</option>
                <option value="archivado">Archivado</option>
              </select>
            </div>
            <div className="inspector-group">
              <label>Narrativa / Sinopsis</label>
              <textarea name="narrativa" value={formData.narrativa || ''} onChange={handleChange} rows={4} />
            </div>

            <div className="inspector-row" style={{ display: 'flex', gap: 10 }}>
              <div className="inspector-group" style={{ flex: 1 }}>
                <label>Orden</label>
                <input type="number" name="orden" value={formData.orden || 1} onChange={handleChange} />
              </div>
              <div className="inspector-group" style={{ flex: 1 }}>
                <label>Nivel Acceso</label>
                <input type="number" name="nivel_acceso_requerido" value={formData.nivel_acceso_requerido || 1} onChange={handleChange} />
              </div>
            </div>

            <div className="inspector-group">
              <label>Ubicación</label>
              <select name="id_ubicacion" value={formData.id_ubicacion || ''} onChange={handleChange}>
                <option value="">-- Seleccionar --</option>
                {allLocations.map((u: any) => (
                  <option key={u.id_ubicacion} value={u.id_ubicacion}>{u.nombre}</option>
                ))}
              </select>
            </div>

            <div className="inspector-group" style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
              <input
                type="checkbox"
                id="es_principal"
                name="es_historia_principal"
                checked={formData.es_historia_principal || false}
                onChange={handleChange}
                style={{ width: 'auto' }}
              />
              <label htmlFor="es_principal" style={{ margin: 0, cursor: 'pointer' }}>Es Historia Principal</label>
            </div>

            <div className="inspector-group">
              <label>Imagen Portada</label>
              <select name="id_imagen_historia" value={formData.id_imagen_historia || ''} onChange={handleChange}>
                <option value="">-- Ninguna --</option>
                {allImages.filter((i: any) => i.tipo === 'imagen').map((img: any) => (
                  <option key={img.id_recurso} value={img.id_recurso}>{img.Nombre || img.archivo}</option>
                ))}
              </select>
            </div>

            <div className="inspector-group">
              <label>Icono Mapa</label>
              <select name="id_imagen_mapa" value={formData.id_imagen_mapa || ''} onChange={handleChange}>
                <option value="">-- Ninguna --</option>
                {allImages.filter((i: any) => i.tipo === 'imagen').map((img: any) => (
                  <option key={img.id_recurso} value={img.id_recurso}>{img.Nombre || img.archivo}</option>
                ))}
              </select>
            </div>
          </>
        );

      // --- CASO MULTIMEDIA (NUEVO) ---  
      case 'multimedia':
        return (
          <>
            <div className="inspector-group">
              <label>Nombre (Identificador)</label>
              <input
                name="Nombre"
                value={formData.Nombre || ''}
                onChange={handleChange}
                placeholder="ej: mapa_base, audio_intro"
              />
            </div>

            <div className="inspector-group">
              <label>Archivo / URL</label>
              <input
                name="archivo"
                value={formData.archivo || ''}
                onChange={handleChange}
                placeholder="https://..."
              />
            </div>

            <div className="inspector-group">
              <label>Tipo de Recurso</label>
              <select name="tipo" value={formData.tipo || 'imagen'} onChange={handleChange}>
                <option value="imagen">Imagen</option>
                <option value="video">Video</option>
                <option value="audio">Audio</option>
                <option value="3d_model">Modelo 3D</option>
                <option value="documento">Documento</option>
              </select>
            </div>

            <div className="inspector-group">
              <label>Metadatos (JSON)</label>
              <textarea
                value={metadataString}
                onChange={(e) => setMetadataString(e.target.value)}
                rows={8}
                style={{ fontFamily: 'monospace', fontSize: 12, background: '#222', color: '#0f0' }}
                placeholder='{"creditos": "Autor", "duracion": 120}'
              />
              <small style={{ color: '#888' }}>Escribe formato JSON válido.</small>
            </div>
          </>
        );

      // ... (Resto de casos character, location, reward sin cambios) ...
      case 'character':
        return (
          <>
            {/* Campos Básicos */}
            <div className="inspector-group">
              <label>Nombre</label>
              <input name="nombre" value={formData.nombre || ''} onChange={handleChange} />
            </div>

            <div className="inspector-group">
              <label>Rol</label>
              <input name="rol" value={formData.rol || ''} onChange={handleChange} />
            </div>

            {/* NUEVO: URL Imagen */}
            <div className="inspector-group">
              <label>URL Imagen</label>
              <input
                name="imagen"
                value={formData.imagen || ''}
                onChange={handleChange}
                placeholder="https://ejemplo.com/avatar.png"
              />
            </div>

            {/* NUEVO: Descripción */}
            <div className="inspector-group">
              <label>Descripción</label>
              <textarea
                name="descripcion"
                value={formData.descripcion || ''}
                onChange={handleChange}
                rows={3}
              />
            </div>

            {/* NUEVO: Editor JSON para atributos_json */}
            <div className="inspector-group">
              <label>Atributos (JSON)</label>
              <textarea
                value={metadataString}
                onChange={(e) => setMetadataString(e.target.value)}
                rows={6}
                style={{ fontFamily: 'monospace', fontSize: 12, background: '#222', color: '#0f0' }}
                placeholder='{"fuerza": 10, "bando": "aliado"}'
              />
              <small style={{ color: '#888' }}>Ej: {"{"}"edad": 25, "fuerza": 100{"}"}</small>
            </div>
          </>
        );

      case 'location':
        return (
          <>
            <div className="inspector-group">
              <label>Nombre</label>
              <input name="nombre" value={formData.nombre || ''} onChange={handleChange} />
            </div>

            {/* CAMPO TIPO (NUEVO) */}
            <div className="inspector-group">
              <label>Tipo</label>
              <select name="tipo" value={formData.tipo || 'exterior'} onChange={handleChange}>
                <option value="exterior">Exterior (Aire libre)</option>
                <option value="interior">Interior (Edificio/Cueva)</option>
                <option value="histórico">Histórico</option>
                <option value="cultural">Cultural</option>
                <option value="plaza">Plaza</option>
                <option value="mercado">Mercado</option>
                <option value="barrio">Barrio</option>
                <option value="centro">Centro</option>
                <option value="parque">Parque</option>
                <option value="resistencia">Resistencia</option>
                <option value="punto_interes">Punto de Interés (Landmark)</option>
                <option value="region">Región / Mapa entero</option>
              </select>
            </div>

            {/* CAMPO COORDENADAS (NUEVO) */}
            <div className="inspector-group">
              <label>Coordenadas (Lat, Long)</label>
              <input
                name="coordenadas"
                value={formData.coordenadas || ''}
                onChange={handleChange}
                placeholder="Ej: 19.432608, -99.133209"
              />
              <small style={{ color: '#888' }}>Formato decimal GPS</small>
            </div>

            <div className="inspector-group">
              <label>Descripción</label>
              <textarea
                name="descripcion"
                value={formData.descripcion || ''}
                onChange={handleChange}
                rows={4}
              />
            </div>
          </>
        );

      case 'reward':
        return (
          <>
            <div className="inspector-group">
              <label>Nombre</label>
              <input name="nombre" value={formData.nombre || ''} onChange={handleChange} />
            </div>

            {/* CAMPO TIPO (NUEVO) */}
            <div className="inspector-group">
              <label>Tipo</label>
              <select name="tipo" value={formData.tipo || 'xp'} onChange={handleChange}>
                <option value="xp">XP (Experiencia)</option>
                <option value="moneda">Moneda / Gold</option>
                <option value="item">Objeto / Item</option>
                <option value="medalla">Medalla / Logro</option>
                <option value="potenciador">Potenciador</option>
              </select>
            </div>

            <div className="inspector-group">
              <label>Valor</label>
              <input type="number" name="valor" value={formData.valor || 0} onChange={handleChange} />
            </div>
          </>
        );

      default: return <p>Sin campos editables.</p>;
    }
  };

  return (
    <div className="canvas-inspector">
      <div className="inspector-header">
        <h3>✏️ {type?.toUpperCase()}</h3>
        <button className="btn-close-inspector" onClick={onClose}>✖</button>
      </div>
      <div className="inspector-scroll-area">
        <div className="inspector-group"><label style={{ fontSize: 10, color: '#666' }}>ID: {node.id}</label></div>
        {renderFields()}
      </div>
      <div className="inspector-footer">
        <button className="btn-save-inspector" onClick={handleSave}>💾 GUARDAR CAMBIOS</button>
      </div>
    </div>
  );
};