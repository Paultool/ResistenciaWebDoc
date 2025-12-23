import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { useResistenciaSDK } from '../hooks/useResistenciaSDK';

// ----------------------------------------------------
// CONSTANTES
// ----------------------------------------------------
const MODEL_URL = 'https://atogaijnlssrgkvilsyp.supabase.co/storage/v1/object/public/videos/camioneta%20compress.glb';
const TEXTURE_SIZE = 1024; // Reducido para estabilizar WebGL
const PIXELS_TO_WIN = TEXTURE_SIZE * TEXTURE_SIZE * 0.6;

// Funciones auxiliares movidas dentro del componente o usando refs
// Se eliminan las funciones globales initGraffitiTexture, paintStroke, getIntersection 
// para evitar conflictos de closure y referencias nulas.

// ----------------------------------------------------
// EL COMPONENTE DE REACT
// ----------------------------------------------------

const GraffitiCanvas = () => {
    // SDK Integration
    const sdk = useResistenciaSDK({
        appName: 'GraffitiCamioneta',
        requiredItems: ['Spray de Pintura'],
        onInit: (appData, playerStats) => {
            console.log('🎨 Graffiti Camioneta inicializada', appData, playerStats);
        },
        onComplete: (success) => {
            console.log('🎨 Graffiti completado:', success ? 'Éxito' : 'Fallo');
        }
    });

    // ESTADO
    const [brushColor, setBrushColor] = useState('#00ff00'); // Verde neón por defecto
    const [brushSize, setBrushSize] = useState(15);
    const [progress, setProgress] = useState(0);
    const [timeLeft, setTimeLeft] = useState(60); // 60 segundos
    const [gameStatus, setGameStatus] = useState('playing'); // 'playing', 'won', 'lost'
    const [showInventoryError, setShowInventoryError] = useState(false);
    const [photoCaptured, setPhotoCaptured] = useState(false);
    const [paintRemaining, setPaintRemaining] = useState(500); // Capacidad inicial
    const [totalCans, setTotalCans] = useState(1);

    // REFERENCIAS DE THREE.JS Y CANVAS
    const mountRef = useRef(null);
    const rendererRef = useRef(null);
    const cameraRef = useRef(null);
    const controlsRef = useRef(null);
    const sceneRef = useRef(null);

    // REFERENCIAS DE PINTURA (Evitar globals)
    const paintCanvasRef = useRef(null);
    const paintContextRef = useRef(null);
    const graffitiTextureRef = useRef(null);
    const modelRef = useRef(null);
    const raycasterRef = useRef(new THREE.Raycaster());
    const pointerRef = useRef(new THREE.Vector2());
    const totalPixelsPaintedRef = useRef(0);
    const isPaintingRef = useRef(false);

    // CONSTANTES DE JUEGO (Refs)
    const timerRef = useRef(null);

    // UI DATA
    const COLORS = [
        '#00ff00', '#ff3333', '#00ffff', '#ffff00',
        '#ff00ff', '#ffffff', '#000000', '#CD853F'
    ];
    // Ajustado para textura de 1024 (mitad de tamaño para mantener escala visual)
    const SIZES = [5, 12, 22];
    const SPRAY_CAN_CAPACITY = 500;
    const SPRAY_CAN_COST = 50;

    // Validar inventario al inicializar y simular entorno DEV
    useEffect(() => {
        // Simulación para DEV: Si no hay padre, inicializar con datos falsos
        if (import.meta.env.DEV) {
            console.log("🔧 MODO DEV DETECTADO: Simulando mensaje del orquestador...");
            const timer = setTimeout(() => {
                window.postMessage({
                    source: 'FlujoNarrativoUsuario',
                    appData: JSON.stringify({
                        title: 'Graffiti Dev',
                        timeLimit: 90,
                        sprayCanCost: 50
                    }),
                    playerStats: {
                        xp: 500, // XP suficiente para pruebas
                        inventario: ['Lata de Spray']
                    },
                    cc: 'es'
                }, window.location.origin);
            }, 1000);
            return () => clearTimeout(timer);
        }

        // Validación normal
        if (sdk.initialized) {
            const { valid, missing } = sdk.validateInventory();
            if (!valid) {
                setShowInventoryError(true);
                handleGameEnd(false, `Faltan items requeridos: ${missing.join(', ')}`);
            }
        }
    }, [sdk.initialized]);

    // Timer
    useEffect(() => {
        if (gameStatus !== 'playing' || !sdk.initialized || showInventoryError) return;

        timerRef.current = setInterval(() => {
            setTimeLeft((prev) => {
                if (prev <= 1) {
                    clearInterval(timerRef.current);
                    handleGameEnd(false, 'Tiempo agotado');
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [gameStatus, sdk.initialized, showInventoryError]);

    // Verificar victoria cuando cambia el progreso
    useEffect(() => {
        if (progress >= 60 && gameStatus === 'playing') {
            handleGameEnd(true, '¡Graffiti completado!');
        }
    }, [progress, gameStatus]);

    // Verificar si se acaba la pintura NO MATA AL JUGADOR
    // Solo le impide pintar (manejado en handlePointerDown)
    // El jugador pierde solo si se acaba el tiempo
    /* 
    useEffect(() => {
        if (paintRemaining <= 0 && gameStatus === 'playing') {
            // No matar al jugador, dejar que compre más o pierda por tiempo
        }
    }, [paintRemaining, gameStatus]);
    */

    const handleGameEnd = (won, message) => {
        setGameStatus(won ? 'won' : 'lost');
        if (timerRef.current) clearInterval(timerRef.current);

        // No enviar resultado inmediatamente si ganó (esperar a que tome foto)
        if (!won) {
            setTimeout(() => {
                sdk.sendResult('failure', -50, message);
            }, 2000);
        }
    };

    const handleCaptureAndFinish = () => {
        if (!rendererRef.current || !sceneRef.current || !cameraRef.current) return;

        // Renderizar un frame limpio para la foto
        rendererRef.current.render(sceneRef.current, cameraRef.current);
        const dataURL = rendererRef.current.domElement.toDataURL('image/png');

        const link = document.createElement('a');
        link.download = `graffiti-resistencia-${Date.now()}.png`;
        link.href = dataURL;
        link.click();

        setPhotoCaptured(true);
        sdk.sendResult('success', 150, 'Graffiti bomber style completado'); // ID 26
    };

    const handleResetCamera = () => {
        if (controlsRef.current) {
            controlsRef.current.reset();
        }
    };

    const handleProgressUpdate = (newProgress) => {
        setProgress(newProgress);

        // Consumir pintura PROPORCIONAL al tamaño del pincel
        // Pincel pequeño (5) = 0.5 puntos
        // Pincel medio (12) = 1 punto
        // Pincel grande (22) = 2 puntos
        // Esto asegura que pintar rápido gaste más lata
        const consumption = brushSize <= 5 ? 0.5 : (brushSize <= 12 ? 1 : 2.5);

        setPaintRemaining(prev => Math.max(0, prev - consumption));
    };

    const handleBuySprayCan = () => {
        if (sdk.playerStats && sdk.playerStats.xp >= SPRAY_CAN_COST) {
            sdk.spendXP(SPRAY_CAN_COST);
            setPaintRemaining(prev => prev + SPRAY_CAN_CAPACITY);
            setTotalCans(prev => prev + 1);
        } else {
            console.warn('No tienes suficiente XP para comprar otra lata de pintura.');
        }
    };

    // ----------------------------------------------------
    // LÓGICA DE THREE.JS + PINTURA LOCAL
    // ----------------------------------------------------

    // Inicializar Textura
    const initTexture = (model) => {
        const canvas = document.createElement('canvas');
        canvas.width = TEXTURE_SIZE;
        canvas.height = TEXTURE_SIZE;
        const ctx = canvas.getContext('2d', { willReadFrequently: true }); // Optimización

        ctx.fillStyle = 'rgba(0, 0, 0, 0)';
        ctx.fillRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE);

        const texture = new THREE.CanvasTexture(canvas);
        texture.generateMipmaps = false; // CRÍTICO: Desactivar mipmaps para evitar crash
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.needsUpdate = true;

        paintCanvasRef.current = canvas;
        paintContextRef.current = ctx;
        graffitiTextureRef.current = texture;

        const paintMaterial = new THREE.MeshStandardMaterial({
            map: texture,
            transparent: true,
            opacity: 1.0,
            side: THREE.DoubleSide,
            depthWrite: false, // Mejor performance en blending
        });

        model.traverse((child) => {
            if (child.isMesh) {
                // Clonar material para no afectar original si es compartido
                const paintMesh = child.clone();
                paintMesh.material = paintMaterial;
                // Ajustar render order si necesario ?
                model.add(paintMesh);
            }
        });

        modelRef.current = model;
        totalPixelsPaintedRef.current = 0;
    };

    // Pintar
    const doPaintStroke = (uv, color, size) => {
        const ctx = paintContextRef.current;
        const texture = graffitiTextureRef.current;

        if (!ctx || !texture) return;

        const x = uv.x * TEXTURE_SIZE;
        const y = (1 - uv.y) * TEXTURE_SIZE;

        ctx.beginPath();
        ctx.fillStyle = color;
        ctx.globalAlpha = 1.0;
        ctx.arc(x, y, size / 2, 0, Math.PI * 2);
        ctx.fill();

        // Actualizar progreso
        totalPixelsPaintedRef.current += Math.PI * (size / 2) * (size / 2);
        const newProgress = Math.min((totalPixelsPaintedRef.current / PIXELS_TO_WIN) * 100, 100);
        handleProgressUpdate(newProgress);

        texture.needsUpdate = true;
    };

    // Raycast
    const doRaycast = (clientX, clientY, rect) => {
        if (!cameraRef.current || !modelRef.current) return null;

        const x = (clientX - rect.left) / rect.width;
        const y = (clientY - rect.top) / rect.height;

        const pointer = pointerRef.current;
        pointer.x = (x * 2) - 1;
        pointer.y = - (y * 2) + 1;

        const raycaster = raycasterRef.current;
        raycaster.setFromCamera(pointer, cameraRef.current);

        const intersects = raycaster.intersectObject(modelRef.current, true);
        if (intersects.length > 0 && intersects[0].uv) {
            return intersects[0];
        }
        return null;
    };

    // MANEJO DE EVENTOS POINTER
    useEffect(() => {
        const currentMount = mountRef.current;
        if (!currentMount || gameStatus !== 'playing' || paintRemaining <= 0) return;

        const handlePointerDown = (event) => {
            if (event.button !== 0) return;

            // Pintar un punto inicial
            const rect = currentMount.getBoundingClientRect();
            const intersection = doRaycast(event.clientX, event.clientY, rect);

            if (intersection) {
                isPaintingRef.current = true;
                doPaintStroke(intersection.uv, brushColor, brushSize);

                // Desactivar rotación mientras se pinta
                if (controlsRef.current) {
                    controlsRef.current.enabled = false;
                }
            } else {
                // Si no golpea el modelo, no estamos pintando, permitimos rotación
                isPaintingRef.current = false;
            }
        };

        const handlePointerMove = (event) => {
            if (!isPaintingRef.current) return;

            const rect = currentMount.getBoundingClientRect();
            const intersection = doRaycast(event.clientX, event.clientY, rect);

            if (intersection) {
                doPaintStroke(intersection.uv, brushColor, brushSize);
            }
        };

        const handlePointerUp = () => {
            isPaintingRef.current = false;
            // Reactivar rotación al soltar
            if (controlsRef.current) {
                controlsRef.current.enabled = true;
            }
        };

        currentMount.addEventListener('pointerdown', handlePointerDown);
        currentMount.addEventListener('pointermove', handlePointerMove);
        currentMount.addEventListener('pointerup', handlePointerUp);
        currentMount.addEventListener('pointerleave', handlePointerUp);

        return () => {
            currentMount.removeEventListener('pointerdown', handlePointerDown);
            currentMount.removeEventListener('pointermove', handlePointerMove);
            currentMount.removeEventListener('pointerup', handlePointerUp);
            currentMount.removeEventListener('pointerleave', handlePointerUp);
        };
    }, [brushColor, brushSize, gameStatus, paintRemaining]);

    // FIX: Asegurar que los controles se reactiven si el juego termina
    useEffect(() => {
        if (gameStatus !== 'playing' && controlsRef.current) {
            controlsRef.current.enabled = true;
            document.body.style.cursor = 'default';
        }
    }, [gameStatus]);

    // -------------------------------------------------------------------
    // EFECTO DE INICIALIZACIÓN DE THREE.JS
    // -------------------------------------------------------------------
    useEffect(() => {
        const currentMount = mountRef.current;
        if (!currentMount) return;

        const containerWidth = currentMount.clientWidth;
        const containerHeight = currentMount.clientHeight;

        // Renderer
        const renderer = new THREE.WebGLRenderer({
            antialias: true,
            alpha: true,
            powerPreference: "high-performance" // Solicitar GPU dedicada
        });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Limitar DPR por performance
        renderer.setSize(containerWidth, containerHeight);
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        rendererRef.current = renderer;

        currentMount.appendChild(renderer.domElement);

        // Scene
        const scene = new THREE.Scene();
        sceneRef.current = scene;
        // scene.background = new THREE.Color('#000000'); // Dejar transparente para el fondo CSS

        // Camera
        const camera = new THREE.PerspectiveCamera(75, containerWidth / containerHeight, 0.1, 1000);
        camera.position.set(2, 1.5, 4); // Mejor ángulo inicial
        cameraRef.current = camera;

        // Controls
        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;
        controls.minDistance = 2; // Zoom in límite
        controls.maxDistance = 8; // Zoom out límite
        controlsRef.current = controls;

        // Lights
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
        scene.add(ambientLight);

        const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
        dirLight.position.set(5, 5, 5);
        scene.add(dirLight);

        const fillLight = new THREE.DirectionalLight(0xff00ff, 0.5); // Luz neón relleno
        fillLight.position.set(-5, 0, 5);
        scene.add(fillLight);

        // Load Model
        const loader = new GLTFLoader();
        loader.load(MODEL_URL, (gltf) => {
            const model = gltf.scene;

            const scaleFactor = 2.3;
            model.scale.set(scaleFactor, scaleFactor, scaleFactor);

            scene.add(model);

            const box = new THREE.Box3().setFromObject(model);
            const center = box.getCenter(new THREE.Vector3());
            model.position.sub(center);

            initTexture(model); // Usar función interna con refs
        }, undefined, (error) => {
            console.error('Error al cargar el modelo 3D:', error);
        });

        const animate = () => {
            if (!rendererRef.current) return; // FIX: Evitar render si ya se desmontó

            requestAnimationFrame(animate);
            if (controlsRef.current) controlsRef.current.update();
            renderer.render(scene, camera);
        };
        animate();

        return () => {
            const renderer = rendererRef.current;
            if (renderer && currentMount) {
                const rendererElement = renderer.domElement;
                if (rendererElement && currentMount.contains(rendererElement)) {
                    currentMount.removeChild(rendererElement);
                }

                // LIMPIEZA EXHAUSTIVA
                renderer.dispose();

                if (graffitiTextureRef.current) graffitiTextureRef.current.dispose();

                scene.traverse((object) => {
                    if (object.geometry) object.geometry.dispose();
                    if (object.material) {
                        if (Array.isArray(object.material)) {
                            object.material.forEach(material => material.dispose());
                        } else {
                            material.dispose();
                        }
                    }
                });
            }
        };
    }, []);

    // ----------------------------------------------------
    // RENDERIZADO DE LA INTERFAZ (HACKER STYLE)
    // ----------------------------------------------------
    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            height: '100vh',
            width: '100%',
            fontFamily: "'Courier New', monospace",
            position: 'relative'
        }}>
            {/* Scanlines Overlay */}
            <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                background: 'repeating-linear-gradient(0deg, rgba(0, 0, 0, 0.15), rgba(0, 0, 0, 0.15) 1px, transparent 1px, transparent 2px)',
                pointerEvents: 'none',
                zIndex: 1000
            }} />

            {/* Game Over Overlay - Solo para derrota */}
            {(gameStatus === 'lost' || showInventoryError) && (
                <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    backgroundColor: 'rgba(0, 0, 0, 0.9)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 999,
                    flexDirection: 'column',
                    gap: '20px'
                }}>
                    <div style={{
                        fontSize: '3rem',
                        color: showInventoryError ? '#ff3333' : (gameStatus === 'won' ? '#00ff00' : '#ff3333'),
                        textShadow: `0 0 20px ${showInventoryError ? '#ff3333' : (gameStatus === 'won' ? '#00ff00' : '#ff3333')}`,
                        animation: 'pulse 1s infinite'
                    }}>
                        {showInventoryError ? '❌ ACCESO DENEGADO' : (gameStatus === 'won' ? '✅ MISIÓN COMPLETADA' : '❌ TIEMPO AGOTADO')}
                    </div>
                    {showInventoryError && (
                        <div style={{ color: '#ff3333', fontSize: '1.2rem', textAlign: 'center' }}>
                            ITEM REQUERIDO: Spray de Pintura
                        </div>
                    )}
                    {!showInventoryError && (
                        <div style={{ color: '#00ff00', fontSize: '1.5rem' }}>
                            Progreso: {progress.toFixed(1)}%
                        </div>
                    )}
                </div>
            )}

            {/* Contenedor Flex */}
            <div style={{
                display: 'flex',
                flexGrow: 1,
                minHeight: '100%',
                width: '100%',
                padding: '0 20px 0 0'
            }}>
                {/* Panel de Controles */}
                <aside style={{
                    width: '280px',
                    padding: '15px',
                    backgroundColor: '#0a0a0a',
                    border: '2px solid #00ff00',
                    boxShadow: '0 0 20px rgba(0, 255, 0, 0.3)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    marginRight: '15px',
                    color: '#00ff00',
                    height: '100%'
                }}>
                    {/* Header Compacto / Victoria */}
                    <div style={{ borderBottom: '2px solid #00ff00', paddingBottom: '8px' }}>
                        {gameStatus === 'won' && !photoCaptured ? (
                            <h3 style={{
                                margin: '0',
                                fontSize: '1em',
                                textTransform: 'uppercase',
                                letterSpacing: '1px',
                                color: '#ffff00',
                                textShadow: '0 0 10px #ffff00',
                                animation: 'pulse 2s infinite'
                            }}>
                                ✅ MISIÓN COMPLETADA
                            </h3>
                        ) : (
                            <h3 style={{ margin: '0', fontSize: '1em', textTransform: 'uppercase', letterSpacing: '1px' }}>
                                🎨 GRAFFITI v2.0
                            </h3>
                        )}
                    </div>

                    {/* Stats Compactos */}
                    <div style={{ backgroundColor: 'rgba(0, 255, 0, 0.1)', padding: '8px', border: '1px solid #00ff00' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                            <div style={{ fontSize: '0.75em', opacity: 0.7 }}>PROGRESO</div>
                            <div style={{ fontSize: '1.2em', fontWeight: 'bold' }}>{progress.toFixed(1)}%</div>
                        </div>
                        <div style={{
                            width: '100%',
                            height: '8px',
                            backgroundColor: '#1a1a1a',
                            border: '1px solid #00ff00',
                            marginBottom: '6px'
                        }}>
                            <div style={{
                                width: `${progress}%`,
                                height: '100%',
                                backgroundColor: progress >= 60 ? '#00ff00' : '#ffff00',
                                transition: 'width 0.3s',
                                boxShadow: `0 0 10px ${progress >= 60 ? '#00ff00' : '#ffff00'}`
                            }} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                            <div style={{ fontSize: '0.75em', opacity: 0.7 }}>PINTURA</div>
                            <div style={{
                                fontSize: '1.2em',
                                fontWeight: 'bold',
                                color: paintRemaining < 100 ? '#ff3333' : '#00ff00'
                            }}>
                                {paintRemaining}
                            </div>
                        </div>
                        <div style={{
                            width: '100%',
                            height: '6px',
                            backgroundColor: '#1a1a1a',
                            border: '1px solid #00ff00',
                            marginBottom: '6px'
                        }}>
                            <div style={{
                                width: `${Math.min((paintRemaining / SPRAY_CAN_CAPACITY) * 100, 100)}%`,
                                height: '100%',
                                backgroundColor: paintRemaining < 100 ? '#ff3333' : '#00ff00',
                                transition: 'width 0.3s'
                            }} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ fontSize: '0.75em', opacity: 0.7 }}>TIEMPO</div>
                            <div style={{
                                fontSize: '1.2em',
                                fontWeight: 'bold',
                                color: timeLeft < 20 ? '#ff3333' : '#00ff00'
                            }}>
                                {timeLeft}s
                            </div>
                        </div>
                    </div>

                    {/* Instrucciones Compactas */}
                    <div style={{ fontSize: '0.75em', backgroundColor: 'rgba(205, 133, 63, 0.1)', padding: '6px', border: '1px solid #CD853F' }}>
                        <strong>META:</strong> 60% pintado | <strong>LATAS:</strong> {totalCans}
                    </div>

                    {/* Botón Comprar Lata */}
                    {gameStatus === 'playing' && paintRemaining < 200 && (
                        <div style={{ borderTop: '1px solid #00ff00', paddingTop: '8px' }}>
                            <button
                                onClick={handleBuySprayCan}
                                disabled={!sdk.playerStats || sdk.playerStats.xp < SPRAY_CAN_COST}
                                style={{
                                    padding: '8px',
                                    backgroundColor: sdk.playerStats && sdk.playerStats.xp >= SPRAY_CAN_COST ? '#CD853F' : '#333',
                                    color: sdk.playerStats && sdk.playerStats.xp >= SPRAY_CAN_COST ? '#000' : '#666',
                                    border: '1px solid #CD853F',
                                    cursor: sdk.playerStats && sdk.playerStats.xp >= SPRAY_CAN_COST ? 'pointer' : 'not-allowed',
                                    fontSize: '0.75em',
                                    width: '100%',
                                    fontFamily: "'Courier New', monospace",
                                    fontWeight: 'bold'
                                }}
                            >
                                💰 COMPRAR LATA (-{SPRAY_CAN_COST} XP)
                            </button>
                        </div>
                    )}

                    {/* Controles / Botón de Captura */}
                    <div style={{ borderTop: '1px solid #00ff00', paddingTop: '8px' }}>
                        {gameStatus === 'won' && !photoCaptured ? (
                            <>
                                <div style={{
                                    fontSize: '0.75em',
                                    color: '#CD853F',
                                    marginBottom: '8px',
                                    textAlign: 'center',
                                    lineHeight: '1.3'
                                }}>
                                    Rota el modelo para elegir el mejor ángulo
                                </div>
                                <button
                                    onClick={handleCaptureAndFinish}
                                    style={{
                                        padding: '12px',
                                        backgroundColor: '#00ff00',
                                        color: '#000',
                                        border: 'none',
                                        cursor: 'pointer',
                                        fontSize: '0.85em',
                                        width: '100%',
                                        fontFamily: "'Courier New', monospace",
                                        fontWeight: 'bold',
                                        boxShadow: '0 0 15px #00ff00',
                                        textTransform: 'uppercase'
                                    }}
                                >
                                    📸 CAPTURAR FOTO Y FINALIZAR
                                </button>
                            </>
                        ) : (
                            <button
                                onClick={handleResetCamera}
                                style={{
                                    padding: '6px',
                                    backgroundColor: '#1a1a1a',
                                    color: '#00ff00',
                                    border: '1px solid #00ff00',
                                    cursor: 'pointer',
                                    fontSize: '0.75em',
                                    width: '100%',
                                    fontFamily: "'Courier New', monospace"
                                }}
                            >
                                🔄 RESET CÁMARA
                            </button>
                        )}
                    </div>

                    {/* Paleta Ultra-Compacta */}
                    <div style={{ borderTop: '1px solid #00ff00', paddingTop: '8px' }}>
                        <h4 style={{ margin: '0 0 6px 0', fontSize: '0.75em', letterSpacing: '1px' }}>COLOR</h4>
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(4, 1fr)',
                            gap: '4px',
                            padding: '6px',
                            backgroundColor: '#1a1a1a',
                            border: '1px solid #00ff00'
                        }}>
                            {COLORS.map((color) => (
                                <button
                                    key={color}
                                    onClick={() => setBrushColor(color)}
                                    title={color}
                                    style={{
                                        backgroundColor: color,
                                        width: '100%',
                                        height: '24px',
                                        border: brushColor === color ? '2px solid #fff' : '1px solid #333',
                                        cursor: 'pointer',
                                        boxShadow: brushColor === color ? `0 0 10px ${color}` : 'none',
                                        transition: 'all 0.2s'
                                    }}
                                />
                            ))}
                        </div>
                    </div>

                    {/* Tamaño Ultra-Compacto */}
                    <div style={{ borderTop: '1px solid #00ff00', paddingTop: '8px' }}>
                        <h4 style={{ margin: '0 0 6px 0', fontSize: '0.75em', letterSpacing: '1px' }}>TAMAÑO</h4>
                        <div style={{
                            display: 'flex',
                            gap: '6px',
                            padding: '6px',
                            backgroundColor: '#1a1a1a',
                            border: '1px solid #00ff00',
                            justifyContent: 'space-between'
                        }}>
                            {SIZES.map((size) => (
                                <button
                                    key={size}
                                    onClick={() => setBrushSize(size)}
                                    style={{
                                        flex: 1,
                                        padding: '8px 4px',
                                        backgroundColor: brushSize === size ? '#00ff00' : '#0a0a0a',
                                        color: brushSize === size ? '#000' : '#00ff00',
                                        fontSize: '0.8em',
                                        border: brushSize === size ? '2px solid #00ff00' : '1px solid #333',
                                        cursor: 'pointer',
                                        boxShadow: brushSize === size ? '0 0 10px #00ff00' : 'none',
                                        fontFamily: "'Courier New', monospace",
                                        fontWeight: 'bold',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    {size}
                                </button>
                            ))}
                        </div>
                    </div>
                </aside>

                {/* Canvas 3D */}
                <div
                    ref={mountRef}
                    style={{
                        width: '75%',
                        border: '2px solid #00ff00',
                        boxShadow: '0 0 20px rgba(0, 255, 0, 0.3)',
                        overflow: 'hidden',
                        backgroundColor: '#050505'
                    }}
                />
            </div>
        </div>
    );
};

export default GraffitiCanvas;