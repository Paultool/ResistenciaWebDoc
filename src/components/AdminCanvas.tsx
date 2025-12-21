import React, { useState, useCallback, useEffect, useRef } from 'react';
import ReactFlow, {
    addEdge, MiniMap, Controls, Background, useNodesState, useEdgesState,
    Connection, Edge, Node, ReactFlowProvider, MarkerType, ReactFlowInstance,
    OnEdgesDelete, OnNodesDelete, NodeDragHandler
} from 'reactflow';
import 'reactflow/dist/style.css';

import { supabase } from '../supabaseClient';
import { StoryNode, StepNode, LocationNode, CharacterNode, RewardNode, MultimediaNode } from './CustomNodes';
import { CanvasSidebar } from './CanvasSidebar';
import { CanvasInspector } from './CanvasInspector';
import './AdminPanel.css';

const nodeTypes = {
    story: StoryNode, step: StepNode, location: LocationNode,
    character: CharacterNode, reward: RewardNode, multimedia: MultimediaNode
};

const AdminCanvasContent: React.FC = () => {
    const reactFlowWrapper = useRef<HTMLDivElement>(null);
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);

    // Cast ReactFlow components to any to avoid React 19 type issues
    const RF = ReactFlow as any;
    const RFBackground = Background as any;
    const RFControls = Controls as any;
    const RFMiniMap = MiniMap as any;

    // Datos
    const [historias, setHistorias] = useState<any[]>([]);
    const [allPersonajes, setAllPersonajes] = useState<any[]>([]);
    const [allRecompensas, setAllRecompensas] = useState<any[]>([]);
    const [allMultimedia, setAllMultimedia] = useState<any[]>([]);
    const [allUbicaciones, setAllUbicaciones] = useState<any[]>([]);
    const [allPasosRaw, setAllPasosRaw] = useState<any[]>([]);

    const [activeHistoriaId, setActiveHistoriaId] = useState<number | null>(null);
    const [selectedNode, setSelectedNode] = useState<Node | null>(null);

    // 2. Construir Grafo
    const loadStoryGraph = useCallback(async (historiaId: number) => {
        setNodes([]); setEdges([]);

        const { data: historia } = await supabase.from('historia').select('*').eq('id_historia', historiaId).single();
        if (!historia) return;

        const { data: pasos } = await supabase.from('flujo_narrativo').select('*').eq('id_historia', historiaId).order('orden');
        setAllPasosRaw(pasos || []);

        const newNodes: Node[] = [];
        const newEdges: Edge[] = [];

        // Helper para leer posición guardada
        const getPos = (meta: any, defaultX: number, defaultY: number) => {
            if (meta && meta.position && typeof meta.position.x === 'number') {
                return meta.position;
            }
            return { x: defaultX, y: defaultY };
        };

        // --- A. HISTORIA ---
        const storyId = `hist-${historia.id_historia}`;
        newNodes.push({
            id: storyId, type: 'story',
            position: getPos(historia.metadata, 600, 50),
            data: { label: historia.titulo, originalData: historia }, draggable: false
        });

        // --- B. UBICACIÓN ---
        if (historia.id_ubicacion) {
            const u = allUbicaciones.find(x => x.id_ubicacion === historia.id_ubicacion);
            if (u) {
                newNodes.push({
                    id: `loc-${u.id_ubicacion}`, type: 'location',
                    position: getPos(u.metadata, 300, 50),
                    data: { label: u.nombre, originalData: u }
                });
                newEdges.push({ id: 'e-loc', source: `loc-${u.id_ubicacion}`, target: storyId, sourceHandle: 'location-out', targetHandle: 'location-in', animated: true, style: { stroke: '#ff0072' } });
            }
        }

        // --- C. PASOS ---
        if (pasos) {
            pasos.forEach((paso: any, i: number) => {
                const stepId = `step-${paso.id_flujo}`;
                const defaultPos = { x: 600, y: 300 + (i * 350) };
                const finalPos = getPos(paso.metadata, defaultPos.x, defaultPos.y);

                // Nodo Paso
                newNodes.push({
                    id: stepId, type: 'step', position: finalPos,
                    data: { label: paso.contenido, orden: paso.orden, tipo: paso.tipo_paso, originalData: paso }
                });

                // Conexiones de Flujo
                if (i === 0) newEdges.push({ id: 'e-start', source: storyId, target: stepId, sourceHandle: 'flow-out', style: { stroke: '#777', strokeDasharray: 5 } });
                if (paso.id_siguiente_paso) {
                    newEdges.push({
                        id: `e-seq-${paso.id_flujo}`, source: stepId, target: `step-${paso.id_siguiente_paso}`,
                        type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed }, style: { stroke: '#fff', strokeWidth: 2 }
                    });
                }
                // Decisiones
                if ((paso.tipo_paso === 'decision' || paso.tipo_paso === 'pregunta') && paso.opciones_decision) {
                    let opciones = paso.opciones_decision;
                    if (typeof opciones === 'string') try { opciones = JSON.parse(opciones) } catch { opciones = null; }
                    if (Array.isArray(opciones)) {
                        opciones.forEach((opt: any, idx: number) => {
                            if (opt.id_siguiente) {
                                newEdges.push({
                                    id: `e-dec-${paso.id_flujo}-${idx}`, source: stepId, target: `step-${opt.id_siguiente}`,
                                    type: 'smoothstep', label: opt.texto, labelStyle: { fill: '#000', fontWeight: 700, fontSize: 10 }, labelBgStyle: { fill: '#FFCC00' },
                                    markerEnd: { type: MarkerType.ArrowClosed }, style: { stroke: '#FFCC00', strokeWidth: 2 }
                                });
                            }
                        });
                    }
                }

                // --- D. ACTIVOS SATÉLITE (Personajes, Recompensas, Multimedia) ---
                const assetPositions = paso.metadata?.positions || {};

                if (paso.id_personaje) {
                    const char = allPersonajes.find(x => x.id_personaje === paso.id_personaje);
                    if (char) {
                        const cId = `char-${char.id_personaje}-step-${paso.id_flujo}`;
                        const cPos = assetPositions.character || { x: finalPos.x - 350, y: finalPos.y };
                        newNodes.push({ id: cId, type: 'character', position: cPos, data: { label: char.nombre, originalData: char } });
                        newEdges.push({ id: `e-c-${paso.id_flujo}`, source: cId, target: stepId, targetHandle: 'char-in', style: { stroke: '#28a745', strokeDasharray: 5 } });
                    }
                }
                if (paso.recursomultimedia_id) {
                    const m = allMultimedia.find(x => x.id_recurso === paso.recursomultimedia_id);
                    if (m) {
                        const mId = `med-${m.id_recurso}-step-${paso.id_flujo}`;
                        const mPos = assetPositions.multimedia || { x: finalPos.x - 350, y: finalPos.y + 150 };
                        newNodes.push({ id: mId, type: 'multimedia', position: mPos, data: { tipo: m.tipo, archivo: m.archivo, originalData: m } });
                        newEdges.push({ id: `e-m-${paso.id_flujo}`, source: mId, target: stepId, targetHandle: 'media-in', style: { stroke: '#17a2b8' } });
                    }
                }
                if (paso.id_recompensa) {
                    const r = allRecompensas.find(x => x.id_recompensa === paso.id_recompensa);
                    if (r) {
                        const rId = `rew-${r.id_recompensa}-step-${paso.id_flujo}`;
                        const rPos = assetPositions.reward || { x: finalPos.x + 350, y: finalPos.y };
                        newNodes.push({ id: rId, type: 'reward', position: rPos, data: { label: r.nombre, valor: r.valor, originalData: r } });
                        newEdges.push({ id: `e-r-${paso.id_flujo}`, source: rId, target: stepId, targetHandle: 'reward-in', style: { stroke: '#ffc107' } });
                    }
                }
            });
        }
        setNodes(newNodes);
        setEdges(newEdges);
    }, [allMultimedia, allPersonajes, allRecompensas, allUbicaciones, setEdges, setNodes]);

    // 1. Carga Inicial
    const loadGlobalAssets = useCallback(async () => {
        const [h, p, r, m, u] = await Promise.all([
            supabase.from('historia').select('*').order('id_historia'),
            supabase.from('personaje').select('*').order('nombre'),
            supabase.from('recompensa').select('*').order('nombre'),
            supabase.from('recursomultimedia').select('*').order('id_recurso'),
            supabase.from('ubicacion').select('*').order('nombre')
        ]);
        setHistorias(h.data || []);
        setAllPersonajes(p.data || []);
        setAllRecompensas(r.data || []);
        setAllMultimedia(m.data || []);
        setAllUbicaciones(u.data || []);

        if (!activeHistoriaId && h.data && h.data.length > 0) setActiveHistoriaId(h.data[0].id_historia);
    }, [activeHistoriaId]);

    useEffect(() => { loadGlobalAssets(); }, [loadGlobalAssets]);
    useEffect(() => { if (activeHistoriaId) loadStoryGraph(activeHistoriaId); }, [activeHistoriaId, loadStoryGraph]);

    // ✅ 3. GUARDAR POSICIÓN (LOGICA MEJORADA PARA ACTIVOS)
    const onNodeDragStop: NodeDragHandler = useCallback(async (_: React.MouseEvent, node: Node) => {
        const data = node.data.originalData;
        if (!data) return;

        if (node.type === 'story') {
            const meta = { ...data.metadata, position: node.position };
            await supabase.from('historia').update({ metadata: meta }).eq('id_historia', data.id_historia);
        }
        else if (node.type === 'location') {
            const meta = { ...data.metadata, position: node.position };
            await supabase.from('ubicacion').update({ metadata: meta }).eq('id_ubicacion', data.id_ubicacion);
        }
        else if (node.type === 'step') {
            const meta = { ...data.metadata, position: node.position };
            await supabase.from('flujo_narrativo').update({ metadata: meta }).eq('id_flujo', data.id_flujo);
        }
        else if (['character', 'reward', 'multimedia'].includes(node.type || '')) {
            const parts = node.id.split('-step-');
            if (parts.length === 2) {
                const stepId = parseInt(parts[1]);
                const { data: pasoData } = await supabase.from('flujo_narrativo').select('metadata').eq('id_flujo', stepId).single();

                if (pasoData) {
                    const currentMeta = pasoData.metadata || {};
                    const currentPositions = currentMeta.positions || {};
                    const newPositions = {
                        ...currentPositions,
                        [node.type || 'unknown']: node.position
                    };
                    const newMeta = {
                        ...currentMeta,
                        positions: newPositions
                    };
                    await supabase.from('flujo_narrativo').update({ metadata: newMeta }).eq('id_flujo', stepId);
                    console.log(`📍 Posición de ${node.type} guardada en paso ${stepId}`);
                }
            }
        }
    }, []);

    // 4. GUARDAR DATOS EDITADOS EN INSPECTOR
    const handleSaveNodeData = async (nodeId: string, newData: any) => {
        const node = nodes.find(n => n.id === nodeId);
        if (!node) return;

        let table = '', idField = '', idValue = 0;

        if (node.type === 'step') { table = 'flujo_narrativo'; idField = 'id_flujo'; idValue = newData.id_flujo; }
        else if (node.type === 'story') { table = 'historia'; idField = 'id_historia'; idValue = newData.id_historia; }
        else if (node.type === 'character') { table = 'personaje'; idField = 'id_personaje'; idValue = newData.id_personaje; }
        else if (node.type === 'location') { table = 'ubicacion'; idField = 'id_ubicacion'; idValue = newData.id_ubicacion; }
        else if (node.type === 'reward') { table = 'recompensa'; idField = 'id_recompensa'; idValue = newData.id_recompensa; }
        else if (node.type === 'multimedia') { table = 'recursomultimedia'; idField = 'id_recurso'; idValue = newData.id_recurso; }

        if (table) {
            const { label, originalData, tipo, metadata, [idField]: _, ...dbData } = newData;
            const finalDbData: any = { ...dbData };

            if (['location', 'reward', 'multimedia'].includes(node.type || '')) {
                finalDbData.tipo = tipo;
            }

            if (['step', 'story', 'location'].includes(node.type || '')) {
                const prevMeta = originalData.metadata || {};
                const newMeta = metadata || {};
                finalDbData.metadata = { ...prevMeta, ...newMeta };
            }

            if (node.type === 'character' && newData.atributos_json) {
                finalDbData.atributos_json = newData.atributos_json;
            }

            if (node.type === 'multimedia' && newData.metadatos) {
                finalDbData.metadatos = newData.metadatos;
            }

            if (node.type === 'step' && (dbData.tipo_paso === 'decision' || dbData.tipo_paso === 'pregunta')) {
                if (newData.opciones_decision) finalDbData.opciones_decision = newData.opciones_decision;
            }

            const { error } = await supabase.from(table).update(finalDbData).eq(idField, idValue);
            if (error) {
                alert("Error al guardar: " + error.message);
                return;
            }

            setNodes((nds) => nds.map((n) => {
                if (n.id === nodeId) {
                    return {
                        ...n,
                        data: {
                            ...n.data,
                            label: newData.nombre || newData.contenido || newData.titulo || newData.archivo,
                            tipo: finalDbData.tipo || finalDbData.tipo_paso || n.data.tipo,
                            valor: finalDbData.valor !== undefined ? finalDbData.valor : n.data.valor,
                            originalData: { ...n.data.originalData, ...finalDbData }
                        }
                    };
                }
                return n;
            }));

            if (node.type === 'step' && activeHistoriaId) {
                await loadStoryGraph(activeHistoriaId);
            } else {
                console.log("Guardado exitoso");
            }
        }
    };

    const onNodesDelete: OnNodesDelete = useCallback(async (deletedNodes) => {
        for (const node of deletedNodes) {
            if (node.type === 'step') {
                const id = node.data.originalData.id_flujo;
                await supabase.from('flujo_narrativo').update({ id_siguiente_paso: null }).eq('id_siguiente_paso', id);
                const { error } = await supabase.from('flujo_narrativo').delete().eq('id_flujo', id);
                if (error) console.error("Error borrando paso:", error);
            }
        }
    }, []);

    const onConnect = useCallback(async (params: Connection) => {
        const sourceNode = nodes.find(n => n.id === params.source);
        const targetNode = nodes.find(n => n.id === params.target);
        if (!sourceNode || !targetNode || !activeHistoriaId) return;
        setEdges(eds => addEdge(params, eds));

        if (sourceNode.type === 'step' && targetNode.type === 'step') {
            const sData = sourceNode.data.originalData;
            if (sData.tipo_paso === 'narrativo') {
                await supabase.from('flujo_narrativo').update({ id_siguiente_paso: targetNode.data.originalData.id_flujo }).eq('id_flujo', sData.id_flujo);
            } else {
                alert("Para decisiones, usa el inspector.");
                loadStoryGraph(activeHistoriaId);
            }
        }
        if (targetNode.type === 'step') {
            if (sourceNode.type === 'character') await supabase.from('flujo_narrativo').update({ id_personaje: sourceNode.data.originalData.id_personaje }).eq('id_flujo', targetNode.data.originalData.id_flujo);
            if (sourceNode.type === 'reward') await supabase.from('flujo_narrativo').update({ id_recompensa: sourceNode.data.originalData.id_recompensa }).eq('id_flujo', targetNode.data.originalData.id_flujo);
            if (sourceNode.type === 'multimedia') await supabase.from('flujo_narrativo').update({ recursomultimedia_id: sourceNode.data.originalData.id_recurso }).eq('id_flujo', targetNode.data.originalData.id_flujo);
        }
        if (targetNode.type === 'story' && sourceNode.type === 'location') {
            await supabase.from('historia').update({ id_ubicacion: sourceNode.data.originalData.id_ubicacion }).eq('id_historia', targetNode.data.originalData.id_historia);
        }
    }, [nodes, activeHistoriaId, loadStoryGraph, setEdges]);

    const onEdgesDelete: OnEdgesDelete = useCallback(async (eds) => {
        for (const e of eds) {
            const src = nodes.find(n => n.id === e.source);
            const tgt = nodes.find(n => n.id === e.target);
            if (src?.type === 'step' && tgt?.type === 'step' && src.data.originalData.tipo_paso === 'narrativo') {
                await supabase.from('flujo_narrativo').update({ id_siguiente_paso: null }).eq('id_flujo', src.data.originalData.id_flujo);
            }
            if (tgt?.type === 'step') {
                if (src?.type === 'character') await supabase.from('flujo_narrativo').update({ id_personaje: null }).eq('id_flujo', tgt.data.originalData.id_flujo);
                if (src?.type === 'reward') await supabase.from('flujo_narrativo').update({ id_recompensa: null }).eq('id_flujo', tgt.data.originalData.id_flujo);
                if (src?.type === 'multimedia') await supabase.from('flujo_narrativo').update({ recursomultimedia_id: null }).eq('id_flujo', tgt.data.originalData.id_flujo);
            }
            if (tgt?.type === 'story' && src?.type === 'location') await supabase.from('historia').update({ id_ubicacion: null }).eq('id_historia', tgt.data.originalData.id_historia);
        }
    }, [nodes]);

    const onDragOver = useCallback((e: any) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }, []);
    const onDrop = useCallback((e: any) => {
        e.preventDefault();
        const type = e.dataTransfer.getData('application/reactflow');
        const data = JSON.parse(e.dataTransfer.getData('application/json-data'));
        const position = reactFlowInstance?.screenToFlowPosition({ x: e.clientX, y: e.clientY }) || { x: 0, y: 0 };
        setNodes(nds => nds.concat({ id: `${type}-${Date.now()}`, type, position, data: { label: data.nombre || data.archivo, originalData: data, ...data } }));
    }, [reactFlowInstance, setNodes]);

    // --- 5. CREAR NUEVOS ACTIVOS ---
    const handleCreateAsset = async (type: string) => {
        const name = prompt(`Nombre/URL para nuevo ${type}:`);
        if (!name) return;

        try {
            let res;
            if (type === 'character') {
                res = await supabase.from('personaje').insert({ nombre: name, rol: 'Nuevo' }).select();
            }
            else if (type === 'location') {
                const desc = prompt("Descripción de la ubicación:", "") || "";
                let tipoLoc = prompt("Tipo (ej: interior, exterior, punto_interes, region):", "exterior");
                if (!tipoLoc) tipoLoc = 'exterior';
                const coords = prompt("Coordenadas (Lat, Long) ej: 19.432,-99.133:", "") || "";
                res = await supabase.from('ubicacion').insert({
                    nombre: name,
                    descripcion: desc,
                    tipo: tipoLoc,
                    coordenadas: coords
                }).select();
            }
            else if (type === 'reward') {
                const xpInput = prompt("¿Valor en XP de la recompensa?", "10");
                const xpVal = xpInput ? parseInt(xpInput) : 10;
                let tipoReward = prompt("Tipo de recompensa (ej: xp, item, moneda, medalla):", "xp");
                if (!tipoReward) tipoReward = 'xp';
                res = await supabase.from('recompensa').insert({
                    nombre: name,
                    valor: xpVal,
                    tipo: tipoReward
                }).select();
            }
            else if (type === 'multimedia') {
                let mediaType = prompt("¿Tipo de recurso? (imagen, video, audio, 3d_model)", "imagen");
                if (!mediaType) mediaType = 'imagen';
                res = await supabase.from('recursomultimedia').insert({
                    tipo: mediaType,
                    archivo: name,
                    metadatos: {}
                }).select();
            }

            if (res?.data) {
                await loadGlobalAssets();
                alert(`${type.toUpperCase()} creado. Selecciona el nodo o ve al menú lateral para editar detalles.`);
            }
        } catch (e: any) {
            alert("Error: " + e.message);
        }
    };

    const createNewStep = async () => {
        if (!activeHistoriaId) return;
        const order = nodes.filter(n => n.type === 'step').length + 1;
        const { data } = await supabase.from('flujo_narrativo').insert({ id_historia: activeHistoriaId, orden: order, tipo_paso: 'narrativo', contenido: '...' }).select().single();
        if (data) {
            setNodes(nds => nds.concat({ id: `step-${data.id_flujo}`, type: 'step', position: { x: 600, y: order * 300 }, data: { label: data.contenido, orden: order, tipo: 'narrativo', originalData: data } }));
        }
    };

    return (
        <div className="admin-canvas-layout">
            <div className="canvas-header-controls">
                <select className="historia-selector" onChange={(e) => setActiveHistoriaId(Number(e.target.value))} value={activeHistoriaId || ''}>
                    {historias.map(h => <option key={h.id_historia} value={h.id_historia}>{h.titulo}</option>)}
                </select>
                <button className="btn-action" onClick={createNewStep}>➕ Paso</button>
            </div>
            <div className="canvas-body">
                <CanvasSidebar personajes={allPersonajes} recompensas={allRecompensas} multimedia={allMultimedia} ubicaciones={allUbicaciones} onCreateNew={handleCreateAsset as any} />
                <div className="reactflow-wrapper" ref={reactFlowWrapper}>
                    <RF
                        nodes={nodes} edges={edges}
                        onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
                        onConnect={onConnect}
                        onEdgesDelete={onEdgesDelete}
                        onNodesDelete={onNodesDelete}
                        onNodeDragStop={onNodeDragStop}
                        onInit={setReactFlowInstance}
                        onDrop={onDrop} onDragOver={onDragOver}
                        onNodeClick={(_: any, n: Node) => setSelectedNode(n)}
                        nodeTypes={nodeTypes} fitView
                        deleteKeyCode={['Backspace', 'Delete']}
                    >
                        <RFBackground gap={16} color="#444" style={{ backgroundColor: '#1a1a1a' }} />
                        <RFControls style={{ filter: 'invert(1)' }} />
                        <RFMiniMap style={{ background: '#333' }} nodeColor={() => '#fff'} />
                    </RF>
                </div>
                {selectedNode && <CanvasInspector node={selectedNode} onSave={handleSaveNodeData} onClose={() => setSelectedNode(null)} allSteps={allPasosRaw} allLocations={allUbicaciones} allImages={allMultimedia} />}

            </div>
        </div>
    );
};

const AdminCanvas: React.FC = () => (<ReactFlowProvider><AdminCanvasContent /></ReactFlowProvider>);
export default AdminCanvas;