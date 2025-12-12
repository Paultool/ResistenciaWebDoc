import json

# 1. Load KML names (The Target List)
with open('kml_names.json', 'r', encoding='utf-8') as f:
    target_names = json.load(f)

# 2. Load Existing Data
try:
    with open('colonias_data.json', 'r', encoding='utf-8') as f:
        existing_data = json.load(f)
except FileNotFoundError:
    existing_data = {}

# 3. Define New Data provided by User
# Helper to create the object structure
def create_data(plusvalia, renta, gentrificacion):
    return {
        "mapaData": { "titulo": "Aumento de Plusvalía", "valor": plusvalia },
        "graficaData": { 
            "renta": renta, 
            "artista": 15000, 
            "ingeniero": 30000 
        },
        "censoData": { "titulo": "Nivel de Gentrificación", "valor": gentrificacion }
    }

# Mapping of KML Names to the Provided Data
# User provided data mapped to the specific KML names
new_data_map = {}

# Acacias +10% 24,500 Alto
new_data_map["ACACIAS"] = create_data("+10%", 24500, "Alto")

# Álamos I (y II) +15% 18,200 Medio-Alto
# Note: ALAMOS II is potentially in existing data, but we map here for completeness/override if needed.
alamos_data = create_data("+15%", 18200, "Medio-Alto")
new_data_map["ALAMOS I"] = alamos_data
new_data_map["ALAMOS II"] = alamos_data

# Albert +13% 14,500 Medio
new_data_map["ALBERT"] = create_data("+13%", 14500, "Medio")

# Américas Unidas-Del Lago +12% 16,800 Medio
new_data_map["AMERICAS UNIDAS-DEL LAGO"] = create_data("+12%", 16800, "Medio")

# Del Valle (I, III, VI, VII) +9% 23,800 Alto
del_valle_data = create_data("+9%", 23800, "Alto")
new_data_map["DEL VALLE I"] = del_valle_data
new_data_map["DEL VALLE III"] = del_valle_data
new_data_map["DEL VALLE VI"] = del_valle_data
new_data_map["DEL VALLE VII"] = del_valle_data

# Ermita +11% 15,500 Medio
new_data_map["ERMITA"] = create_data("+11%", 15500, "Medio")

# Extremadura Insurgentes +10% 21,500 Alto
new_data_map["EXTREMADURA INSURGENTES"] = create_data("+10%", 21500, "Alto")

# Independencia +13% 17,000 Medio-Alto
new_data_map["INDEPENDENCIA"] = create_data("+13%", 17000, "Medio-Alto")

# Insurgentes Mixcoac +11% 22,000 Alto
new_data_map["INSURGENTES MIXCOAC"] = create_data("+11%", 22000, "Alto")

# Josefa Ortiz de Domínguez +12% 15,200 Medio
new_data_map["JOSEFA ORTIZ DE DOMINGUEZ"] = create_data("+12%", 15200, "Medio")

# Letrán Valle +14% 19,500 Alto
new_data_map["LETRAN VALLE"] = create_data("+14%", 19500, "Alto")

# María del Carmen +13% 16,000 Medio
new_data_map["MARIA DEL CARMEN"] = create_data("+13%", 16000, "Medio")

# Miravalle +11% 14,800 Medio
new_data_map["MIRAVALLE"] = create_data("+11%", 14800, "Medio")

# Mixcoac +12% 19,800 Alto
new_data_map["MIXCOAC"] = create_data("+12%", 19800, "Alto")

# Moderna +14% 16,500 Medio
new_data_map["MODERNA"] = create_data("+14%", 16500, "Medio")

# Nápoles & Ampliación +10% 26,500 Muy Alto
napoles_data = create_data("+10%", 26500, "Muy Alto")
new_data_map["NAPOLES"] = napoles_data
new_data_map["NAPOLES (AMPL)"] = napoles_data

# Narvarte (I a V) +14% 21,500 Alto
narvarte_data = create_data("+14%", 21500, "Alto")
new_data_map["NARVARTE I"] = narvarte_data
new_data_map["NARVARTE II"] = narvarte_data
new_data_map["NARVARTE III"] = narvarte_data
new_data_map["NARVARTE IV"] = narvarte_data
new_data_map["NARVARTE V"] = narvarte_data

# Nativitas +13% 16,200 Medio
new_data_map["NATIVITAS"] = create_data("+13%", 16200, "Medio")

# Niños Héroes de Chapultepec +12% 17,500 Medio
# Map to KML name "NIOS HEROES DE CHAPULTEPEC"
new_data_map["NIOS HEROES DE CHAPULTEPEC"] = create_data("+12%", 17500, "Medio")

# Ocho de Agosto +11% 18,500 Medio-Alto
new_data_map["OCHO DE AGOSTO"] = create_data("+11%", 18500, "Medio-Alto")

# Periodista Francisco Zarco +12% 16,800 Medio
new_data_map["PERIODISTA FRANCISCO ZARCO"] = create_data("+12%", 16800, "Medio")

# Piedad Narvarte +13% 20,000 Alto
new_data_map["PIEDAD NARVARTE"] = create_data("+13%", 20000, "Alto")

# Portales (II, III, IV, Oriente) +16% 16,800 Medio-Alto
portales_data = create_data("+16%", 16800, "Medio-Alto")
new_data_map["PORTALES II"] = portales_data
new_data_map["PORTALES III"] = portales_data
new_data_map["PORTALES IV"] = portales_data
new_data_map["PORTALES ORIENTE"] = portales_data

# Postal +12% 14,200 Bajo-Medio
new_data_map["POSTAL"] = create_data("+12%", 14200, "Bajo-Medio")

# Residencial Emperadores +11% 17,000 Medio
new_data_map["RESIDENCIAL EMPERADORES"] = create_data("+11%", 17000, "Medio")

# San Juan +10% 19,200 Alto
new_data_map["SAN JUAN"] = create_data("+10%", 19200, "Alto")

# San Simón Ticumac +15% 16,500 Medio
new_data_map["SAN SIMON TICUMAC"] = create_data("+15%", 16500, "Medio")

# Santa Cruz Atoyac +12% 20,500 Alto
# Map to KML name "STA CRUZ ATOYAC"
new_data_map["STA CRUZ ATOYAC"] = create_data("+12%", 20500, "Alto")

# Tlacoquemécatl Del Valle +9% 24,000 Alto
new_data_map["TLACOQUEMECATL DEL VALLE"] = create_data("+9%", 24000, "Alto")

# Vértiz Narvarte +13% 19,800 Alto
new_data_map["VERTIZ NARVARTE"] = create_data("+13%", 19800, "Alto")

# Villa de Cortés +12% 15,800 Medio
new_data_map["VILLA DE CORTES"] = create_data("+12%", 15800, "Medio")

# Xoco +14% 27,500 Muy Alto
new_data_map["XOCO"] = create_data("+14%", 27500, "Muy Alto")

# Zacahuitzco +13% 17,200 Medio
new_data_map["ZACAHUITZCO"] = create_data("+13%", 17200, "Medio")


# 4. Merge Data
final_data = {}
merged_count = 0
new_entry_count = 0

for name in target_names:
    if name in existing_data:
        # Keep existing
        final_data[name] = existing_data[name]
    elif name in new_data_map:
        # Use new data
        final_data[name] = new_data_map[name]
        new_entry_count += 1
    else:
        # Fallback (should not happen if map is complete)
        print(f"WARNING: No data found for {name}")
        final_data[name] = {
             "mapaData": { "titulo": "Aumento de Plusvalía", "valor": "N/A" },
             "graficaData": { "renta": 0, "artista": 15000, "ingeniero": 30000 },
             "censoData": { "titulo": "Nivel de Gentrificación", "valor": "Desconocido" }
        }
    merged_count += 1

# 5. Write Result
with open('colonias_data.json', 'w', encoding='utf-8') as f:
    json.dump(final_data, f, indent=2, ensure_ascii=False)

print(f"Successfully homogenized colonias_data.json")
print(f"Total Colonies: {merged_count}")
print(f"New Data Entries Added: {new_entry_count}")
