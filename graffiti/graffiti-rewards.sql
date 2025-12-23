-- SQL para insertar nuevas recompensas de Graffiti

-- Recompensa por ÉXITO: Graffiti Bomber Master
INSERT INTO recompensa (id_recompensa, nombre, tipo, valor, descripcion)
VALUES (
    26, 
    'Graffiti Bomber Master', 
    'logro', 
    150, 
    'Completaste el graffiti de la camioneta con maestría. Eres un verdadero artista urbano.'
);

-- Recompensa por FALLO: Graffiti Toy
INSERT INTO recompensa (id_recompensa, nombre, tipo, valor, descripcion)
VALUES (
    27, 
    'Graffiti Toy', 
    'logro', 
    -30, 
    'No lograste completar el graffiti a tiempo. Aún eres un novato en el arte callejero.'
);

-- Item: Lata de Spray (tipo 'item' en tabla recompensa)
INSERT INTO recompensa (id_recompensa, nombre, tipo, valor, descripcion)
VALUES (
    28,
    'Lata de Spray',
    'item',
    -50,
    'Lata de pintura en aerosol para graffiti. Se agota con el uso. Costo: 50 XP.'
);

-- Verificar las inserciones
SELECT * FROM recompensa WHERE id_recompensa IN (26, 27, 28);
