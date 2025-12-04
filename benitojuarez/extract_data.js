// Script para extraer datos de colonias desde la API de Gemini
// Uso: node extract_data.js

const fs = require('fs');
const https = require('https');
const { URL } = require('url');

const KML_FILE = './bj.kml';
const BASE_API_URL = 'https://atogaijnlssrgkvilsyp.supabase.co/functions/v1/datos-ciudad';
const OUTPUT_FILE = './colonias_data.json';

// Función para extraer nombres de colonias del KML
function extractColonyNames(kmlContent) {
    const nameRegex = /<name>([^<]+)<\/name>/g;
    const names = new Set();
    let match;

    while ((match = nameRegex.exec(kmlContent)) !== null) {
        const name = match[1].trim();
        // Filtrar el nombre del documento principal
        if (name !== 'BENITO JUÁREZ' && name.length > 0) {
            names.add(name);
        }
    }

    return Array.from(names);
}

// Función para hacer llamada a la API
function fetchColonyData(colonyName, playerXP) {
    return new Promise((resolve) => {
        const referenceValues = {
            salarioIngeniero: 30000,
            salarioArtista: playerXP || 15000
        };

        const context = {
            location: colonyName + ' Benito Juárez CDMX',
            topics: ['renta promedio', 'aumento plusvalia', 'gentrificacion'],
            referenceValues: referenceValues
        };

        const contextString = encodeURIComponent(JSON.stringify(context));
        const fullUrl = BASE_API_URL + '?context=' + contextString;

        console.log('Fetching data for: ' + colonyName + '...');

        const urlObj = new URL(fullUrl);
        const options = {
            hostname: urlObj.hostname,
            path: urlObj.pathname + urlObj.search,
            method: 'GET',
            headers: {
                'User-Agent': 'Node.js'
            }
        };

        const req = https.request(options, (res) => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                try {
                    const jsonData = JSON.parse(data);
                    console.log('✓ Got data for: ' + colonyName);
                    resolve({ name: colonyName, data: jsonData });
                } catch (e) {
                    console.error('✗ Error parsing JSON for ' + colonyName + ':', e.message);
                    resolve({ name: colonyName, data: null, error: e.message });
                }
            });
        });

        req.on('error', (err) => {
            console.error('✗ Error fetching ' + colonyName + ':', err.message);
            resolve({ name: colonyName, data: null, error: err.message });
        });

        req.end();
    });
}

// Función para esperar
function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Función principal
async function main() {
    try {
        console.log('=== Extrayendo datos de colonias ===\n');

        // Leer el archivo KML
        console.log('1. Leyendo archivo KML...');
        if (!fs.existsSync(KML_FILE)) {
            throw new Error('Archivo KML no encontrado: ' + KML_FILE);
        }
        const kmlContent = fs.readFileSync(KML_FILE, 'utf8');

        // Extraer nombres de colonias
        console.log('2. Extrayendo nombres de colonias...');
        const colonyNames = extractColonyNames(kmlContent);
        console.log('   Encontradas ' + colonyNames.length + ' colonias\n');

        // Hacer llamadas a la API para cada colonia
        console.log('3. Obteniendo datos de la API...\n');
        const results = {};

        // Procesar en lotes de 3 para no sobrecargar la API
        const batchSize = 3;
        for (let i = 0; i < colonyNames.length; i += batchSize) {
            const batch = colonyNames.slice(i, i + batchSize);
            const batchPromises = batch.map(name => fetchColonyData(name, 15000));
            const batchResults = await Promise.all(batchPromises);

            batchResults.forEach(result => {
                if (result.data) {
                    results[result.name] = result.data;
                }
            });

            // Pausa entre lotes
            if (i + batchSize < colonyNames.length) {
                console.log('   Esperando 2 segundos...\n');
                await wait(2000);
            }
        }

        // Guardar resultados
        console.log('\n4. Guardando resultados en ' + OUTPUT_FILE + '...');
        fs.writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2), 'utf8');

        console.log('\n✓ Completado! Se obtuvieron datos para ' + Object.keys(results).length + ' colonias.');
        console.log('  Archivo guardado: ' + OUTPUT_FILE);
    } catch (err) {
        console.error('Error fatal:', err.message);
        process.exit(1);
    }
}

// Ejecutar
main();
