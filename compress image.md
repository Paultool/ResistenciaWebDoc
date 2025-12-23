# Image Compression Walkthrough

I have successfully created a reusable script to compress images and update HTML references, and applied it to the `repara` application.

## Changes

### 1. Reusable Script
I created [compress_images.js](file:///c:/Users/pault/Desktop/LA%20RESISTENCIA%20RESERVORIO/Resistencia%20Spartane%202/agent_workspace/resistencia-app%20101025/resistencia-app/compress_images.js) which:
- Accepts an input directory and a target HTML file.
- Converts PNGs to WebP using `sharp`.
- Updates the HTML file to point to the new WebP images.

### 2. Repara App Optimization
I ran the script on the `repara` folder:
`node compress_images.js repara/images repara/index.html`

**Results:**
- **Files Compressed**: 14 images converted from PNG to WebP.
- **Reference Updates**: references in [repara/index.html](file:///c:/Users/pault/Desktop/LA%20RESISTENCIA%20RESERVORIO/Resistencia%20Spartane%202/agent_workspace/resistencia-app%20101025/resistencia-app/repara/index.html) were updated to [.webp](file:///c:/Users/pault/Desktop/LA%20RESISTENCIA%20RESERVORIO/Resistencia%20Spartane%202/agent_workspace/resistencia-app%20101025/resistencia-app/repara/images/tv.webp).

## Verification Results

### File Check
The following WebP files were generated in `repara/images`:
- `ampli.webp`
- `cctv.webp`
- `impresora.webp`
- `laptop.webp`
- ... and others.

### HTML Check
`repara/index.html` now contains references like:
```html
image: "images/ampli.webp",
```
instead of `.png`.
