/**
 * Convierte contenido SRT a WebVTT (formato requerido por navegadores).
 * @param srtContent El contenido de texto del archivo .srt
 * @returns El contenido convertido a formato WebVTT
 */
export function srtToVtt(srtContent: string): string {
    // 1. Reemplazar comas de tiempo por puntos (00:00:00,000 -> 00:00:00.000)
    let vtt = srtContent.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2');

    // 2. Añadir cabecera WEBVTT
    vtt = "WEBVTT\n\n" + vtt;

    return vtt;
}

/**
 * Descarga un archivo .srt de una URL, lo convierte a VTT y devuelve una URL de Blob.
 * @param srtUrl URL del archivo .srt (ej: Archive.org)
 * @returns Promesa que resuelve a una URL de Blob (blob:...) lista para usar en <track src="...">
 */
export async function fetchAndConvertSubtitle(srtUrl: string): Promise<string | null> {
    try {
        const response = await fetch(srtUrl);
        if (!response.ok) throw new Error(`Error fetching subtitles: ${response.statusText}`);

        const srtText = await response.text();
        const vttText = srtToVtt(srtText);

        const blob = new Blob([vttText], { type: 'text/vtt' });
        return URL.createObjectURL(blob);
    } catch (error) {
        console.error("Error converting subtitles:", error);
        return null;
    }
}
