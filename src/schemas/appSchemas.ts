/**
 * Define la estructura de un campo para el
 * constructor dinámico de formularios.
 */
export interface FormField {
  name: string;      // El 'key' en el JSON (ej: "deviceName")
  label: string;     // Etiqueta para el usuario (ej: "Nombre del Dispositivo")
  type: 'text' | 'number' | 'textarea' | 'json';
  placeholder?: string;
  defaultValue?: any;
}

/**
 * ESQUEMA PARA: Aplicación "Taller de Reparaciones"
 * Se identifica por la URL que incluye 'reparacion'.
 */
export const tallerSchema: FormField[] = [
  { name: 'title', label: 'Título Principal (App)', type: 'text', placeholder: 'Taller de Reparaciones' },
  { name: 'deviceName', label: 'Nombre del Dispositivo', type: 'text', placeholder: 'Droide K-09' },
  { name: 'clientName', label: 'Nombre del Cliente', type: 'text', placeholder: 'Cliente: Sector 7G' },
  { name: 'deviceImage', label: 'URL de Imagen del Dispositivo', type: 'text', placeholder: 'https://i.imgur.com/...' },
  { name: 'timeLimit', label: 'Límite de Tiempo (ms)', type: 'number', defaultValue: 30000 },
  { name: 'costoExito', label: 'XP por Éxito', type: 'number', defaultValue: 50 },
  { name: 'costoFracaso', label: 'XP por Fracaso', type: 'number', defaultValue: -10 },
  {
    name: 'stages',
    label: 'Etapas (Diagnosis, Parts, Puzzle)',
    type: 'json',
    placeholder: 'Pega aquí el array JSON de "stages"...'
  }
];

/**
 * ESQUEMA PARA: Aplicación "Simulador de Ganancias"
 * Se identifica por la URL que incluye 'simulador'.
 */
export const simuladorSchema: FormField[] = [
  { name: 'title', label: 'Título Principal (App)', type: 'text', placeholder: 'Simulador de Ganancias' },
  { name: 'message', label: 'Mensaje Inicial', type: 'textarea', placeholder: '¡Haz clic para ganar fondos!' },
  { name: 'buttonText', label: 'Texto del Botón', type: 'text', placeholder: '¡Clic para fondos!' },
  { name: 'gastos', label: 'Gastos por Segundo', type: 'number', defaultValue: 500 },
  { name: 'ganancia', label: 'Ganancia por Clic', type: 'number', defaultValue: 100 },
  { name: 'duracion', label: 'Duración (ms)', type: 'number', defaultValue: 20000 },
  { name: 'minSurvival', label: 'Balance Mín. Supervivencia', type: 'number', defaultValue: 0 },
  { name: 'costoExito', label: 'XP por Éxito', type: 'number', defaultValue: 150 },
  { name: 'costoFracaso', label: 'XP por Fracaso', type: 'number', defaultValue: -10 },
];

/**
 * ESQUEMA PARA: Modelo 3D
 * Se identifica por el tipo '3d_model'.
 */
export const model3DSchema: FormField[] = [
  {
    name: 'hotspots',
    label: 'Configuración de Hotspots (Array JSON)',
    type: 'json',
    placeholder: '[ { "meshName": "pablo", "contentType": "video", ... } ]'
  },
  {
    name: 'backgroundMusic',
    label: 'URL Música de Fondo (Opcional)',
    type: 'text',
    placeholder: 'https://.../musica.mp3'
  }
];

// Mapa para una búsqueda fácil de esquemas
export const schemaMap: Record<string, FormField[]> = {
  'reparacion': tallerSchema,
  'simulador': simuladorSchema,
  '3d_model': model3DSchema
};

/**
 * Función helper para identificar qué esquema usar.
 */
export const getSchemaForResource = (tipo: string, archivoUrl: string): FormField[] | null => {
  if (tipo === '3d_model') {
    return model3DSchema;
  }
  if (tipo === 'app') {
    if (archivoUrl.includes('reparacion')) {
      return tallerSchema;
    }
    if (archivoUrl.includes('simulador')) {
      return simuladorSchema;
    }
  }
  // No hay un esquema dinámico para 'imagen', 'video', etc.
  return null;
};