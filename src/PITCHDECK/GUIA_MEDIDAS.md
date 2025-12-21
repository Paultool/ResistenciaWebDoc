# GUÍA DE MEDIDAS DE IMÁGENES - PITCH DECK

Para evitar que las imágenes se corten o se vean pixeladas, redimensiona tus archivos a estas resoluciones exactas (Ancho x Alto).

## 1. Fondo Completo (Portada)
*   **Slide 1**: `1440 x 810 px`

## 2. Imágenes Laterales (Layout 2 Columnas)
La mayoría de los slides (2, 3, 5, 10, 11) usan este formato (Texto a la izquierda, Imagen a la derecha).
*   **Columna Derecha (Estándar)**: `570 x 640 px`
    *   *Uso: Contexto, Idea General, Tecnología, Gameplay, Estado Actual.*

*   **Columna Izquierda (Slide 4 - Género)**: `690 x 640 px`
    *   *Uso: Imagen de "Docu-RPG" (Action Shot).*

## 3. Slide 9: Entornos (Doble Imagen)
Este slide tiene dos imágenes lado a lado.
*   **Entorno Izquierdo (Narvarte)**: `690 x 640 px`
*   **Entorno Derecho (Intervención)**: `570 x 640 px`

## 4. Slide 8: Personajes (Grid de 4)
*   **Tarjetas Verticales**: `320 x 400 px`

## 5. Fotos de Equipo
*   **Formato**: Cuadrado (Relación 1:1).
*   **Medida Mínima**: `200 x 200 px`.

---
**Nota Técnica**: El CSS usa `object-fit: cover`, lo que significa que si la imagen no tiene estas proporciones exactas, recortará los bordes sobrantes para rellenar el espacio sin deformar la foto.
