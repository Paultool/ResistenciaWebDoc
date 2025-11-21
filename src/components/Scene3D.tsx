import React, { useEffect, useRef } from 'react';
import 'aframe';
import { HotspotConfig } from './types';

interface Scene3DProps {
    modelUrl: string;
    hotspotData: string; 
    cameraHeight: number;
    onHotspotClick: (config: HotspotConfig) => void;
}

const Scene3D: React.FC<Scene3DProps> = ({ modelUrl, hotspotData, cameraHeight, onHotspotClick }) => {
    const sceneRef = useRef<any>(null);

    useEffect(() => {
        const COMPONENT_NAME = 'gltf-hotspot-logic';

        const register = () => {
            if (typeof window !== 'undefined' && (window as any).AFRAME) {
                // Limpieza previa para evitar conflictos
                if ((window as any).AFRAME.components[COMPONENT_NAME]) {
                    delete (window as any).AFRAME.components[COMPONENT_NAME];
                }

                (window as any).AFRAME.registerComponent(COMPONENT_NAME, {
                    schema: {
                        hotspotData: { type: 'string' }
                    },
                    
                    init: function() {
                        this.hotspotsConfigured = false;
                        this.retryCount = 0;
                        // Vinculamos el contexto
                        this.scanMesh = this.scanMesh.bind(this);
                    },

                    // Usamos tick() que se ejecuta en cada frame para garantizar que pille el modelo
                    tick: function() {
                        // Si ya terminamos, no hacer nada más.
                        if (this.hotspotsConfigured) {
                            this.handleHover(); // Mantener lógica de hover
                            return;
                        }

                        // Intentar configurar hotspots
                        const mesh = this.el.getObject3D('mesh');
                        
                        // Validamos no solo que exista el mesh, sino que tenga geometría interna
                        if (mesh && mesh.children && mesh.children.length > 0) {
                            this.scanMesh(mesh);
                        } else {
                            // Log ligero para debugging si tarda mucho
                            this.retryCount++;
                            if(this.retryCount % 100 === 0) console.log("⏳ Esperando geometría del modelo...");
                        }
                    },

                    scanMesh: function(mesh: any) {
                        try {
                            const allHotspotConfigs = JSON.parse(this.data.hotspotData);
                            const interactiveHotspots = allHotspotConfigs.filter((h: any) => h.contentType !== 'backgroundMusic');
                            
                            if (interactiveHotspots.length === 0) {
                                this.hotspotsConfigured = true;
                                return;
                            }

                            let foundCount = 0;

                            mesh.traverse((child: any) => {
                                if (child.isMesh) {
                                    const config = interactiveHotspots.find((c: any) => c.meshName === child.name);
                                    if (config) {
                                        // Configuración del Hotspot
                                        child.userData.isHotspot = true;
                                        child.userData.hotspotConfig = config;
                                        // Clonar material para efectos de hover/click sin afectar al original permanentemente
                                        child.userData.originalMaterial = child.material.clone();
                                        
                                        // Hacemos el material "emisivo" levemente para que se note que es interactivo si lo deseas, 
                                        // si no, quitamos esta línea.
                                        // child.material = child.userData.originalMaterial; 
                                        
                                        console.log(`✅ Hotspot activado: ${child.name}`);
                                        foundCount++;
                                    }
                                }
                            });

                            if (foundCount > 0) {
                                console.log(`🎉 Se configuraron ${foundCount} hotspots correctamente.`);
                                this.hotspotsConfigured = true; // DETENER ESCANEO
                            }

                        } catch (e) {
                            console.error("Error configurando hotspots:", e);
                            this.hotspotsConfigured = true; // Evitar bucle infinito de errores
                        }
                    },

                    handleHover: function() {
                        const cursor = document.querySelector('a-cursor');
                        const raycaster = (cursor as any)?.components?.raycaster;
                        
                        if (raycaster && raycaster.intersections && raycaster.intersections.length > 0) {
                            const intersection = raycaster.intersections[0];
                            const obj = intersection.object;
                            
                            if (obj.userData.isHotspot && !obj.userData.isHovered) {
                                // Crear material hover si no existe
                                if (!obj.userData.hoverMaterial) {
                                    obj.userData.hoverMaterial = obj.userData.originalMaterial.clone();
                                    obj.userData.hoverMaterial.emissive.setHex(0xffff00);
                                    obj.userData.hoverMaterial.emissiveIntensity = 0.8;
                                }
                                obj.material = obj.userData.hoverMaterial;
                                obj.userData.isHovered = true;
                            }
                        } else {
                            // Restaurar materiales
                            const mesh = this.el.getObject3D('mesh');
                            if (mesh) {
                                mesh.traverse((child: any) => {
                                    if (child.userData.isHotspot && child.userData.isHovered) {
                                        child.material = child.userData.originalMaterial;
                                        child.userData.isHovered = false;
                                    }
                                });
                            }
                        }
                    },
                    
                    remove: function() {
                        this.hotspotsConfigured = false;
                    }
                });
            } else {
                setTimeout(register, 100);
            }
        };
        register();
    }, []); // Solo al montar

    // Listener Global de Clicks (Raycaster)
    useEffect(() => {
        const handleCursorClick = () => {
            const cursor = document.querySelector('a-cursor');
            const raycaster = (cursor as any)?.components?.raycaster;
            
            if (raycaster && raycaster.intersections && raycaster.intersections.length > 0) {
                const intersection = raycaster.intersections[0];
                const obj = intersection.object;
                
                if (obj && obj.userData && obj.userData.isHotspot) {
                    console.log("🖱️ Click en hotspot:", obj.userData.hotspotConfig.title);
                    
                    // Feedback Visual (Flash Rojo)
                    const originalMat = obj.material;
                    const clickMat = obj.userData.originalMaterial.clone();
                    clickMat.emissive.setHex(0xff0000); // Rojo
                    clickMat.emissiveIntensity = 1;
                    obj.material = clickMat;

                    setTimeout(() => {
                        if (obj) obj.material = originalMat; // Restaurar
                    }, 200);

                    // Comunicar al padre
                    onHotspotClick(obj.userData.hotspotConfig);
                }
            }
        };

        // Delay para asegurar que A-Frame está listo en el DOM
        const t = setTimeout(() => {
            document.addEventListener('click', handleCursorClick);
        }, 1000);

        return () => {
            clearTimeout(t);
            document.removeEventListener('click', handleCursorClick);
        };
    }, [onHotspotClick]);

    return (
        <div style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0, zIndex: 0 }}>
            <a-scene ref={sceneRef} embedded vr-mode-ui="disabled: true" renderer="antialias: true; colorManagement: true; logarithmicDepthBuffer: true;">
                
                {/* MODELO GLTF */}
                <a-entity
                    id="gltf-model-entity"
                    gltf-model={modelUrl}
                    position="0 0 0"
                    // Pasamos la data
                    gltf-hotspot-logic={`hotspotData: ${hotspotData}`}
                />
                
                {/* CÁMARA RIG */}
                <a-entity id="player-rig" position={`0 ${cameraHeight} 3`}>
                    <a-camera 
                        wasd-controls="acceleration: 25" 
                        look-controls="pointerLockEnabled: false"
                        position="0 0 0"
                    >
                        {/* Raycaster ajustado para mejor precisión */}
                        <a-cursor 
                            fuse="false" 
                            raycaster="objects: #gltf-model-entity; interval: 50; far: 100" 
                            color="#FFFFFF"
                            scale="1 1 1"
                        />
                    </a-camera>
                </a-entity>

                {/* ILUMINACIÓN BASE */}
                <a-light type="ambient" color="#FFF" intensity="0.8" />
                <a-light type="directional" position="1 4 2" intensity="0.6" />
                <a-light type="point" position="-2 2 2" intensity="0.4" color="#90cdf4" />

            </a-scene>
        </div>
    );
};

export default Scene3D;