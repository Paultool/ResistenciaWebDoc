// datos-ciudad/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");

// Fallback datos genéricos (ajustados para Narvarte; en prod, haz dinámico por location)
const FALLBACK_DATA = {
  plusvaliaValor: "+25%",
  rentaValor: 22000,
  gentrificacionValor: "Alto"
};

async function fetchRealData(apiContext: { location: string; referenceValues: { salarioArtista: number; salarioIngeniero: number } }) {
  const { location, referenceValues } = apiContext;
  if (!GEMINI_API_KEY) {
    throw new Error("Error de Configuración: La clave GEMINI_API_KEY no está configurada.");
  }
  const prompt = `Basado en datos reales/estimados 2024-2025 para "${location}" (ej: Narvarte CDMX), proporciona:
1. Aumento de Plusvalía (ej: "+25%").
2. Costo Promedio de Renta Mensual en MXN (número entero, ej: 18000).
3. Nivel de Gentrificación ("Alto", "Medio", "Bajo").

Usa fuentes como INEGI, Lamudi o reportes inmobiliarios.`;
  const model = "gemini-2.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
  const responseSchema = {
    type: "object",
    properties: {
      plusvaliaValor: { type: "string" },
      rentaValor: { type: "number" },
      gentrificacionValor: { type: "string" }
    },
    required: ["plusvaliaValor", "rentaValor", "gentrificacionValor"],
    additionalProperties: false
  };
  const body = JSON.stringify({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0,
      maxOutputTokens: 2000,
      topP: 0.8,
      topK: 40,
      responseMimeType: "application/json",
      _responseJsonSchema: responseSchema  // Usa _responseJsonSchema para soporte completo (incl. additionalProperties)
    }
  });
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body
    });
    if (!response.ok) {
      const errorText = await response.text();
      if (response.status === 404) {
        throw new Error(`Modelo ${model} no encontrado. Verifica: https://generativelanguage.googleapis.com/v1beta/models?key=${GEMINI_API_KEY}.`);
      }
      if (response.status === 400) {
        throw new Error(`HTTP 400 en esquema: ${errorText}. Verifica formato en docs: https://ai.google.dev/api/rest/v1beta.`);
      }
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    const data = await response.json();
    console.log('Full Gemini response for debug:', JSON.stringify(data, null, 2)); // Remover en prod
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    const finishReason = data?.candidates?.[0]?.finishReason ?? 'Desconocida';
    let iaData;
    if (!rawText || finishReason === 'MAX_TOKENS') {
      console.warn(`Respuesta vacía o truncada (Finish: ${finishReason}). Usando fallback.`);
      iaData = FALLBACK_DATA;
    } else {
      iaData = JSON.parse(rawText); // Esquema asegura JSON válido
    }
    return {
      mapaData: {
        titulo: `Aumento de Plusvalía (Valor Inmueble) en ${location}`,
        valor: iaData.plusvaliaValor
      },
      graficaData: {
        renta: iaData.rentaValor,
        artista: referenceValues.salarioArtista,
        ingeniero: referenceValues.salarioIngeniero,
        labelRenta: "Renta Promedio (Real)",
        labelArtista: "Ingreso (Artista)",
        labelIngeniero: "Ingreso (Ingeniero)"
      },
      censoData: {
        titulo: `Nivel de Gentrificación en ${location}`,
        valor: iaData.gentrificacionValor
      }
    };
  } catch (error) {
    console.error("Error en llamada REST a Gemini:", error);
    // Fallback en catch
    console.warn("Usando fallback por error general.");
    const iaData = FALLBACK_DATA;
    return {
      mapaData: {
        titulo: `Aumento de Plusvalía (Valor Inmueble) en ${location}`,
        valor: iaData.plusvaliaValor
      },
      graficaData: {
        renta: iaData.rentaValor,
        artista: referenceValues.salarioArtista,
        ingeniero: referenceValues.salarioIngeniero,
        labelRenta: "Renta Promedio (Real)",
        labelArtista: "Ingreso (Artista)",
        labelIngeniero: "Ingreso (Ingeniero)"
      },
      censoData: {
        titulo: `Nivel de Gentrificación en ${location}`,
        valor: iaData.gentrificacionValor
      }
    };
  }
}

// ---------------------------------------------------------------------
// FUNCIÓN PRINCIPAL (Maneja la Petición, CORS y Errores)
// ---------------------------------------------------------------------
serve(async (req) => {
  const url = new URL(req.url);
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
        "Access-Control-Allow-Headers": "*"
      }
    });
  }
  const contextParam = url.searchParams.get("context");
  if (!contextParam) {
    return new Response(JSON.stringify({ error: "Contexto 'context' no proporcionado" }), {
      status: 400,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    });
  }
  try {
    const apiContext = JSON.parse(contextParam);
    const data = await fetchRealData(apiContext);
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    });
  }
});