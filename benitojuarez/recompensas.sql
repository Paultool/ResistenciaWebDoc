-- =========================================
-- RECOMPENSAS PARA BENITO JUÁREZ MICROGAME
-- =========================================
-- Este script registra todas las recompensas necesarias para el microjuego
-- Benito Juárez y sus eventos únicos.
--
-- ESQUEMA DE LA TABLA:
-- - id_recompensa: serial (auto-increment)
-- - nombre: text
-- - tipo: text
-- - descripcion: text
-- - valor: integer (XP ganado/perdido)
-- - metadata: jsonb (items, flags, etc.)

-- =========================================
-- RECOMPENSAS EXISTENTES (RENTAL APP)
-- =========================================
-- ID 10: Contrato de arrendamiento (SUCCESS)
-- ID 7: Adios dinero (FAILURE, -25 XP)

-- =========================================
-- RECOMPENSAS PRINCIPALES (BENITO JUÁREZ)
-- =========================================

-- RECOMPENSA 14: Exploración Normal (6-9 colonias)
INSERT INTO public.recompensa (id_recompensa, nombre, tipo, descripcion, valor, metadata)
VALUES 
(14, 
 'Memoria del Desplazamiento', 
 'Documento', 
 'Exploraste Benito Juárez y documentaste el desplazamiento urbano. Visitaste 6+ colonias y confirmaste que la delegación ya no es viable para Pablo.', 
 0, 
 '{
   "items": ["Memoria del Desplazamiento"],
   "flags": ["BJ_exploration_complete", "BJDeny"],
   "categoria": "narrativo",
   "rareza": "unico"
 }'::jsonb)
ON CONFLICT (id_recompensa) DO UPDATE SET
    nombre = EXCLUDED.nombre,
    tipo = EXCLUDED.tipo,
    descripcion = EXCLUDED.descripcion,
    valor = EXCLUDED.valor,
    metadata = EXCLUDED.metadata;

-- RECOMPENSA 15: Exploración Exhaustiva (10+ colonias)
INSERT INTO public.recompensa (id_recompensa, nombre, tipo, descripcion, valor, metadata)
VALUES 
(15, 
 'Mapa de Gentrificación BJ 2024', 
 'Documento', 
 'Documentaste TODAS las colonias de Benito Juárez. Has creado un mapa completo del desplazamiento urbano en la delegación.', 
 0, 
 '{
   "items": ["Memoria del Desplazamiento", "Mapa de Gentrificación BJ 2024"],
   "flags": ["BJ_exploration_complete", "BJDeny", "BJ_complete_survey"],
   "categoria": "narrativo",
   "rareza": "legendario"
 }'::jsonb)
ON CONFLICT (id_recompensa) DO UPDATE SET
    nombre = EXCLUDED.nombre,
    tipo = EXCLUDED.tipo,
    descripcion = EXCLUDED.descripcion,
    valor = EXCLUDED.valor,
    metadata = EXCLUDED.metadata;

-- RECOMPENSA 16: Exploración Abandonada (<6 colonias)
INSERT INTO public.recompensa (id_recompensa, nombre, tipo, descripcion, valor, metadata)
VALUES 
(16, 
 'Búsqueda Abandonada', 
 'Penalización', 
 'Abandonaste la exploración de Benito Juárez antes de completarla. Los costos de búsqueda fueron demasiado altos.', 
 -100, 
 '{
   "items": [],
   "flags": ["BJ_abandoned"],
   "categoria": "penalizacion",
   "razon": "abandono_exploracion"
 }'::jsonb)
ON CONFLICT (id_recompensa) DO UPDATE SET
    nombre = EXCLUDED.nombre,
    tipo = EXCLUDED.tipo,
    descripcion = EXCLUDED.descripcion,
    valor = EXCLUDED.valor,
    metadata = EXCLUDED.metadata;

-- =========================================
-- RECOMPENSAS DE EVENTOS ÚNICOS
-- =========================================

-- RECOMPENSA 17: Testimonio de Desplazamiento (evento único - 4ta visita)
INSERT INTO public.recompensa (id_recompensa, nombre, tipo, descripcion, valor, metadata)
VALUES 
(17, 
 'Testimonio de Desplazamiento', 
 'Documento', 
 'Escuchaste la historia de otro vecino desplazado de Narvarte. Un momento de solidaridad en medio de la crisis de vivienda.', 
 0, 
 '{
   "items": ["Testimonio de desplazamiento"],
   "flags": ["solidarity_moment"],
   "categoria": "narrativo",
   "rareza": "raro",
   "evento": "encuentro_vecino"
 }'::jsonb)
ON CONFLICT (id_recompensa) DO UPDATE SET
    nombre = EXCLUDED.nombre,
    tipo = EXCLUDED.tipo,
    descripcion = EXCLUDED.descripcion,
    valor = EXCLUDED.valor,
    metadata = EXCLUDED.metadata;

-- RECOMPENSA 18: Recorte Histórico (evento raro - 8% probabilidad)
INSERT INTO public.recompensa (id_recompensa, nombre, tipo, descripcion, valor, metadata)
VALUES 
(18, 
 'Recorte Histórico BJ', 
 'Documento', 
 'Encontraste un periódico viejo con rentas de Benito Juárez en 1995: $800 pesos. Un recordatorio brutal del cambio económico.', 
 0, 
 '{
   "items": ["Recorte histórico BJ"],
   "flags": ["historical_awareness"],
   "categoria": "narrativo",
   "rareza": "raro",
   "evento": "hallazgo_historico",
   "probabilidad": 0.08
 }'::jsonb)
ON CONFLICT (id_recompensa) DO UPDATE SET
    nombre = EXCLUDED.nombre,
    tipo = EXCLUDED.tipo,
    descripcion = EXCLUDED.descripcion,
    valor = EXCLUDED.valor,
    metadata = EXCLUDED.metadata;

-- =========================================
-- VERIFICACIÓN
-- =========================================

-- Verificar que todas las recompensas se registraron correctamente
SELECT 
    id_recompensa,
    nombre,
    tipo,
    valor,
    metadata
FROM public.recompensa
WHERE id_recompensa IN (7, 10, 14, 15, 16, 17, 18)
ORDER BY id_recompensa;

-- =========================================
-- RESUMEN DE RECOMPENSAS
-- =========================================

/*
┌────────────────────────────────────────────────────────────────┐
│ RECOMPENSAS RENTAL APP (Existentes)                           │
├────────────────────────────────────────────────────────────────┤
│ ID 10: Contrato de arrendamiento (SUCCESS, 0 XP)              │
│ ID 7:  Adios dinero (FAILURE, -25 XP)                         │
└────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│ RECOMPENSAS BENITO JUÁREZ (Nuevas)                            │
├────────────────────────────────────────────────────────────────┤
│ ID 14: Memoria del Desplazamiento (6-9 colonias, 0 XP)        │
│ ID 15: Mapa de Gentrificación BJ 2024 (10+ colonias, 0 XP)    │
│ ID 16: Búsqueda Abandonada (<6 colonias, -100 XP)             │
│ ID 17: Testimonio de Desplazamiento (evento único, 0 XP)      │
│ ID 18: Recorte Histórico BJ (evento raro 8%, 0 XP)            │
└────────────────────────────────────────────────────────────────┘

FLUJO NARRATIVO:
═══════════════

1. Modelo 3D Narvarte
   ↓
2. rental.html
   ├─ SUCCESS → ID 10 (Contrato, 0 XP)
   └─ FAILURE → ID 7 (Adios dinero, -25 XP)
   ↓
3. benitojuarez.html
   ├─ NORMAL (6-9 colonias) → ID 14
   ├─ EXHAUSTIVO (10+ colonias) → ID 15
   └─ ABANDONADO (<6 colonias) → ID 16
   
   Eventos durante exploración:
   - Visita 4 → ID 17 (Testimonio)
   - Random 8% → ID 18 (Recorte histórico)

COSTOS POR VISITA (descontados del XP del jugador):
═══════════════════════════════════════════════════

Renta $15k-17k: -350 XP (transporte + comida + copias)
Renta $18k-20k: -450 XP (+ trámites adicionales)
Renta $21k-23k: -600 XP (+ costo de solicitud)
Renta $24k+:    -750 XP (pérdida total)

TOTAL GASTADO (6 colonias): ~2,000-2,500 XP

NOTA: Los costos de visita NO son recompensas, se descuentan
directamente del XP del jugador mediante costoXP en el mensaje
postMessage enviado a FlujoNarrativoUsuario.
*/
