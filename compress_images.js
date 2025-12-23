import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
    const args = process.argv.slice(2);
    if (args.length < 2) {
        console.error('Usage: node compress_images.js <image_dir> <html_file>');
        process.exit(1);
    }

    const imageDir = path.resolve(process.cwd(), args[0]);
    const htmlFile = path.resolve(process.cwd(), args[1]);

    if (!fs.existsSync(imageDir)) {
        console.error(`Error: Image directory not found: ${imageDir}`);
        process.exit(1);
    }

    if (!fs.existsSync(htmlFile)) {
        console.error(`Error: HTML file not found: ${htmlFile}`);
        process.exit(1);
    }

    console.log(`Processing images in: ${imageDir}`);
    console.log(`Updating HTML file: ${htmlFile}`);

    try {
        const files = fs.readdirSync(imageDir).filter(file => file.toLowerCase().endsWith('.png'));
        let htmlContent = fs.readFileSync(htmlFile, 'utf-8');
        let processedCount = 0;

        for (const file of files) {
            const inputPath = path.join(imageDir, file);
            const outputFilename = file.replace(/\.png$/i, '.webp');
            const outputPath = path.join(imageDir, outputFilename);

            // Compress image
            try {
                await sharp(inputPath)
                    .webp({ quality: 80 })
                    .toFile(outputPath);

                console.log(`Compressed: ${file} -> ${outputFilename}`);

                // Update HTML content
                // Replace all occurrences of the filename
                if (htmlContent.includes(file)) {
                    htmlContent = htmlContent.replaceAll(file, outputFilename);
                    console.log(`Updated reference in HTML for: ${file}`);
                }

                processedCount++;
            } catch (err) {
                console.error(`Failed to process ${file}:`, err);
            }
        }

        if (processedCount > 0) {
            fs.writeFileSync(htmlFile, htmlContent, 'utf-8');
            console.log(`\nSuccess! Processed ${processedCount} images and updated ${htmlFile}`);
        } else {
            console.log('\nNo PNG images found or processed.');
        }

    } catch (err) {
        console.error('An error occurred:', err);
    }
}

main();
