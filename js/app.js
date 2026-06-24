/**
 * ImageAnalyzer — Lógica principal del Analizador de Imágenes
 * Incluye: carga de modelo, drag & drop, clasificación, toasts y barras de progreso.
 */

/**
 * StyleAnalyzer — Extrae el estilo visual de una imagen y genera un prompt descriptivo.
 * Analiza: paleta de colores, luminosidad, contraste, temperatura, saturación, brillo, composición.
 */
class StyleAnalyzer {

    /**
     * Analizar una imagen y devolver el estilo completo.
     * @param {HTMLImageElement|HTMLCanvasElement} source - Imagen o canvas fuente
     * @returns {object} { palette, attributes, prompt, promptEN }
     */
    static analyze(source) {
        const ctx = StyleAnalyzer._getCanvas(source);
        const imageData = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height);
        const pixels = imageData.data;

        const palette = StyleAnalyzer._extractPalette(pixels, 10);
        const stats = StyleAnalyzer._computeStats(pixels);
        const attributes = StyleAnalyzer._classifyAttributes(stats, palette, source);
        const prompt = StyleAnalyzer._generatePrompt(attributes, palette, stats, 'es');
        const promptEN = StyleAnalyzer._generatePrompt(attributes, palette, stats, 'en');

        return { palette, attributes, stats, prompt, promptEN };
    }

    /** Obtener un contexto 2D con la imagen dibujada (redimensionada para performance) */
    static _getCanvas(source) {
        const canvas = document.createElement('canvas');
        const maxSize = 300;
        let w = source.naturalWidth || source.width || source.videoWidth;
        let h = source.naturalHeight || source.height || source.videoHeight;
        if (w === 0 || h === 0) { w = source.width; h = source.height; }
        const ratio = Math.min(maxSize / w, maxSize / h, 1);
        w = Math.round(w * ratio);
        h = Math.round(h * ratio);
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(source, 0, 0, w, h);
        return ctx;
    }

    /** Extraer paleta de colores dominantes usando k-means simplificado */
    static _extractPalette(pixels, k = 10) {
        const step = Math.max(1, Math.floor(pixels.length / 4 / 8000));
        const samples = [];
        for (let i = 0; i < pixels.length; i += step * 4) {
            const a = pixels[i + 3];
            if (a < 128) continue;
            samples.push([pixels[i], pixels[i + 1], pixels[i + 2]]);
        }
        if (samples.length === 0) return [{ r: 128, g: 128, b: 128, percent: 100 }];

        let centroids = StyleAnalyzer._initCentroids(samples, k);
        for (let iter = 0; iter < 15; iter++) {
            const clusters = Array.from({ length: k }, () => []);
            for (const px of samples) {
                let minDist = Infinity, minIdx = 0;
                for (let c = 0; c < centroids.length; c++) {
                    const dr = px[0] - centroids[c][0];
                    const dg = px[1] - centroids[c][1];
                    const db = px[2] - centroids[c][2];
                    const dist = dr * dr + dg * dg + db * db;
                    if (dist < minDist) { minDist = dist; minIdx = c; }
                }
                clusters[minIdx].push(px);
            }
            for (let c = 0; c < k; c++) {
                if (clusters[c].length === 0) continue;
                centroids[c] = [
                    clusters[c].reduce((s, p) => s + p[0], 0) / clusters[c].length,
                    clusters[c].reduce((s, p) => s + p[1], 0) / clusters[c].length,
                    clusters[c].reduce((s, p) => s + p[2], 0) / clusters[c].length,
                ];
            }
        }

        const counts = new Array(k).fill(0);
        for (const px of samples) {
            let minDist = Infinity, minIdx = 0;
            for (let c = 0; c < centroids.length; c++) {
                const dr = px[0] - centroids[c][0];
                const dg = px[1] - centroids[c][1];
                const db = px[2] - centroids[c][2];
                const dist = dr * dr + dg * dg + db * db;
                if (dist < minDist) { minDist = dist; minIdx = c; }
            }
            counts[minIdx]++;
        }

        const total = samples.length;
        return centroids.map((c, i) => ({
            r: Math.round(c[0]),
            g: Math.round(c[1]),
            b: Math.round(c[2]),
            percent: Math.round((counts[i] / total) * 100)
        }))
        .filter(c => c.percent > 0)
        .sort((a, b) => b.percent - a.percent)
        .slice(0, 10);
    }

    static _initCentroids(samples, k) {
        const centroids = [];
        centroids.push([...samples[Math.floor(Math.random() * samples.length)]]);
        for (let i = 1; i < k; i++) {
            const distances = samples.map(px => {
                return Math.min(...centroids.map(c =>
                    (px[0] - c[0]) ** 2 + (px[1] - c[1]) ** 2 + (px[2] - c[2]) ** 2
                ));
            });
            const totalDist = distances.reduce((a, b) => a + b, 0);
            let rand = Math.random() * totalDist;
            for (let j = 0; j < distances.length; j++) {
                rand -= distances[j];
                if (rand <= 0) {
                    centroids.push([...samples[j]]);
                    break;
                }
            }
            if (centroids.length <= i) centroids.push([...samples[0]]);
        }
        return centroids;
    }

    static _computeStats(pixels) {
        let totalR = 0, totalG = 0, totalB = 0;
        let totalLum = 0;
        let lumValues = [];
        let satValues = [];
        let tempValues = [];
        let edgeValues = [];
        const count = pixels.length / 4;

        for (let i = 0; i < pixels.length; i += 4) {
            const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];
            totalR += r; totalG += g; totalB += b;

            const lum = 0.299 * r + 0.587 * g + 0.114 * b;
            totalLum += lum;
            lumValues.push(lum);

            const max = Math.max(r, g, b), min = Math.min(r, g, b);
            const l = (max + min) / 2 / 255;
            const d = (max - min) / 255;
            const sat = d === 0 ? 0 : (l > 0.5 ? d / (2 - 2 * l) : d / (2 * l));
            satValues.push(sat);

            const temp = (r * 1.2 - b) / 255;
            tempValues.push(temp);
        }

        for (let i = 4; i < pixels.length - 4; i += 4) {
            const lum1 = 0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2];
            const lum2 = 0.299 * pixels[i - 4] + 0.587 * pixels[i - 3] + 0.114 * pixels[i - 2];
            edgeValues.push(Math.abs(lum1 - lum2));
        }

        const avgLum = totalLum / count / 255;
        const meanLum = totalLum / count;
        let varianceSum = 0;
        for (const l of lumValues) varianceSum += (l - meanLum) ** 2;
        const contrast = Math.sqrt(varianceSum / lumValues.length) / 255;

        const avgSat = satValues.reduce((a, b) => a + b, 0) / satValues.length;
        const avgTemp = tempValues.reduce((a, b) => a + b, 0) / tempValues.length;
        const avgEdge = edgeValues.length > 0 ? edgeValues.reduce((a, b) => a + b, 0) / edgeValues.length : 0;

        return {
            avgR: totalR / count,
            avgG: totalG / count,
            avgB: totalB / count,
            brightness: avgLum,
            contrast,
            saturation: avgSat,
            temperature: avgTemp,
            sharpness: avgEdge / 255,
            lumHistogram: StyleAnalyzer._buildHistogram(lumValues, 12)
        };
    }

    static _buildHistogram(values, bins) {
        const hist = new Array(bins).fill(0);
        for (const v of values) {
            const idx = Math.min(bins - 1, Math.floor(v / 255 * bins));
            hist[idx]++;
        }
        const total = values.length;
        return hist.map(c => c / total);
    }

    static _colorName(r, g, b) {
        const hsl = StyleAnalyzer._rgbToHsl(r, g, b);
        const h = hsl[0], s = hsl[1], l = hsl[2];

        if (l < 0.08) return 'negro profundo';
        if (l > 0.95 && s < 0.1) return 'blanco puro';
        if (s < 0.1) {
            if (l < 0.25) return 'gris carbón';
            if (l < 0.45) return 'gris oscuro';
            if (l < 0.65) return 'gris medio';
            if (l < 0.85) return 'gris claro';
            return 'gris perla';
        }

        let hueName;
        if (h < 10 || h >= 350) hueName = 'rojo';
        else if (h < 20) hueName = 'rojo anaranjado';
        else if (h < 40) hueName = 'naranja';
        else if (h < 50) hueName = 'amarillo anaranjado';
        else if (h < 65) hueName = 'amarillo';
        else if (h < 80) hueName = 'amarillo verdoso';
        else if (h < 140) hueName = 'verde';
        else if (h < 170) hueName = 'verde azulado';
        else if (h < 200) hueName = 'cian';
        else if (h < 220) hueName = 'azul cielo';
        else if (h < 250) hueName = 'azul';
        else if (h < 270) hueName = 'azul violeta';
        else if (h < 290) hueName = 'violeta';
        else if (h < 320) hueName = 'magenta';
        else if (h < 340) hueName = 'rosa';
        else hueName = 'rojo rosado';

        if (l < 0.25) hueName = hueName + ' oscuro';
        else if (l < 0.4) hueName = hueName + ' medio-oscuro';
        else if (l > 0.75) hueName = hueName + ' pastel';
        else if (l > 0.6) hueName = hueName + ' claro';

        if (s > 0.7) hueName = hueName + ' intenso';
        else if (s > 0.4) hueName = hueName + ' vibrante';
        else if (s < 0.25) hueName = hueName + ' apagado';

        return hueName;
    }

    static _colorNameEN(r, g, b) {
        const hsl = StyleAnalyzer._rgbToHsl(r, g, b);
        const h = hsl[0], s = hsl[1], l = hsl[2];

        if (l < 0.08) return 'deep black';
        if (l > 0.95 && s < 0.1) return 'pure white';
        if (s < 0.1) {
            if (l < 0.25) return 'charcoal gray';
            if (l < 0.45) return 'dark gray';
            if (l < 0.65) return 'medium gray';
            if (l < 0.85) return 'light gray';
            return 'pearl gray';
        }

        let hueName;
        if (h < 10 || h >= 350) hueName = 'red';
        else if (h < 20) hueName = 'reddish-orange';
        else if (h < 40) hueName = 'orange';
        else if (h < 50) hueName = 'orange-yellow';
        else if (h < 65) hueName = 'yellow';
        else if (h < 80) hueName = 'yellowish-green';
        else if (h < 140) hueName = 'green';
        else if (h < 170) hueName = 'teal';
        else if (h < 200) hueName = 'cyan';
        else if (h < 220) hueName = 'sky blue';
        else if (h < 250) hueName = 'blue';
        else if (h < 270) hueName = 'violet-blue';
        else if (h < 290) hueName = 'violet';
        else if (h < 320) hueName = 'magenta';
        else if (h < 340) hueName = 'pink';
        else hueName = 'pinkish-red';

        if (l < 0.25) hueName = 'dark ' + hueName;
        else if (l < 0.4) hueName = 'medium-dark ' + hueName;
        else if (l > 0.75) hueName = 'pastel ' + hueName;
        else if (l > 0.6) hueName = 'light ' + hueName;

        if (s > 0.7) hueName = hueName + ' intense';
        else if (s > 0.4) hueName = hueName + ' vibrant';
        else if (s < 0.25) hueName = hueName + ' muted';

        return hueName;
    }

    static _rgbToHsl(r, g, b) {
        r /= 255; g /= 255; b /= 255;
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        let h, s, l = (max + min) / 2;
        if (max === min) {
            h = s = 0;
        } else {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            switch (max) {
                case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
                case g: h = ((b - r) / d + 2) / 6; break;
                case b: h = ((r - g) / d + 4) / 6; break;
            }
        }
        return [h * 360, s, l];
    }

    static _rgbToHex(r, g, b) {
        return '#' + [r, g, b].map(c => c.toString(16).padStart(2, '0')).join('');
    }

    static _classifyAttributes(stats, palette, source) {
        const attrs = [];
        const w = source.naturalWidth || source.width || 800;
        const h = source.naturalHeight || source.height || 600;
        const aspectRatio = w / h;

        // === ILUMINACIÓN DETALLADA ===
        if (stats.brightness < 0.2) attrs.push({ icon: 'fa-moon', label: 'Iluminación nocturna, muy oscura', labelEN: 'Night lighting, very dark' });
        else if (stats.brightness < 0.35) attrs.push({ icon: 'fa-cloud-moon', label: 'Iluminación tenue, low-key cinematográfico', labelEN: 'Dim lighting, cinematic low-key' });
        else if (stats.brightness < 0.5) attrs.push({ icon: 'fa-cloud', label: 'Iluminación suave y difusa', labelEN: 'Soft and diffused lighting' });
        else if (stats.brightness < 0.65) attrs.push({ icon: 'fa-cloud-sun', label: 'Iluminación natural equilibrada', labelEN: 'Balanced natural lighting' });
        else if (stats.brightness < 0.8) attrs.push({ icon: 'fa-sun', label: 'Iluminación brillante, ambiente luminoso', labelEN: 'Bright lighting, luminous environment' });
        else attrs.push({ icon: 'fa-bolt', label: 'Iluminación high-key, extremadamente brillante', labelEN: 'High-key lighting, extremely bright' });

        // === TEMPERATURA ESPECÍFICA ===
        if (stats.temperature < -0.15) attrs.push({ icon: 'fa-temperature-low', label: 'Temperatura de color fría (azulada)', labelEN: 'Cool color temperature (blueish)' });
        else if (stats.temperature < -0.05) attrs.push({ icon: 'fa-temperature-half', label: 'Temperatura de color neutro-fría', labelEN: 'Neutral-cool color temperature' });
        else if (stats.temperature < 0.05) attrs.push({ icon: 'fa-temperature-arrow-right', label: 'Temperatura de color neutra balanceada', labelEN: 'Balanced neutral color temperature' });
        else if (stats.temperature < 0.15) attrs.push({ icon: 'fa-temperature-arrow-up', label: 'Temperatura de color cálida (amarilla/naranja)', labelEN: 'Warm color temperature (yellow/orange)' });
        else attrs.push({ icon: 'fa-fire', label: 'Temperatura de color muy cálida (dorada/rojiza)', labelEN: 'Very warm color temperature (golden/reddish)' });

        // === CONTRASTE ===
        if (stats.contrast < 0.15) attrs.push({ icon: 'fa-circle-half-stroke', label: 'Contraste muy bajo, imagen suave', labelEN: 'Very low contrast, soft image' });
        else if (stats.contrast < 0.25) attrs.push({ icon: 'fa-circle-half-stroke', label: 'Contraste bajo, atmósfera delicada', labelEN: 'Low contrast, delicate atmosphere' });
        else if (stats.contrast < 0.4) attrs.push({ icon: 'fa-circle-half-stroke', label: 'Contraste moderado-natural', labelEN: 'Moderate-natural contrast' });
        else if (stats.contrast < 0.55) attrs.push({ icon: 'fa-circle-half-stroke', label: 'Contraste alto, definición marcada', labelEN: 'High contrast, sharp definition' });
        else attrs.push({ icon: 'fa-circle-half-stroke', label: 'Contraste dramático, estilo cinematográfico', labelEN: 'Dramatic contrast, cinematic style' });

        // === SATURACIÓN ===
        if (stats.saturation < 0.08) attrs.push({ icon: 'fa-droplet-slash', label: 'Monocromático / blanco y negro', labelEN: 'Monochromatic / black and white' });
        else if (stats.saturation < 0.18) attrs.push({ icon: 'fa-droplet-slash', label: 'Muy desaturado, estilo vintage', labelEN: 'Very desaturated, vintage style' });
        else if (stats.saturation < 0.35) attrs.push({ icon: 'fa-droplet', label: 'Colores naturales y realistas', labelEN: 'Natural and realistic colors' });
        else if (stats.saturation < 0.55) attrs.push({ icon: 'fa-droplet', label: 'Colores vibrantes y enérgicos', labelEN: 'Vibrant and energetic colors' });
        else if (stats.saturation < 0.75) attrs.push({ icon: 'fa-droplet', label: 'Colores saturados, estilo pop-art', labelEN: 'Saturated colors, pop-art style' });
        else attrs.push({ icon: 'fa-droplet', label: 'Colores extremadamente intensos y neon', labelEN: 'Extremely intense neon colors' });

        // === NITIDEZ / ENFOQUE ===
        if (stats.sharpness < 0.05) attrs.push({ icon: 'fa-eye-slash', label: 'Enfoque suave, bokeh fuerte', labelEN: 'Soft focus, strong bokeh' });
        else if (stats.sharpness < 0.12) attrs.push({ icon: 'fa-eye', label: 'Enfoque moderado, dreamy', labelEN: 'Moderate focus, dreamy' });
        else if (stats.sharpness < 0.2) attrs.push({ icon: 'fa-eye', label: 'Enfoque natural y equilibrado', labelEN: 'Natural and balanced focus' });
        else if (stats.sharpness < 0.3) attrs.push({ icon: 'fa-eye', label: 'Enfoque nítido y detallado', labelEN: 'Sharp and detailed focus' });
        else attrs.push({ icon: 'fa-eye', label: 'Enfoque ultra-nítido, hiperdetallado', labelEN: 'Ultra-sharp focus, hyper-detailed' });

        // === RELACIÓN DE ASPECTO / COMPOSICIÓN ===
        if (aspectRatio > 1.8) attrs.push({ icon: 'fa-image', label: 'Formato panorámico widescreen', labelEN: 'Widescreen panoramic format' });
        else if (aspectRatio > 1.3) attrs.push({ icon: 'fa-image', label: 'Formato horizontal apaisado', labelEN: 'Landscape horizontal format' });
        else if (aspectRatio > 0.85) attrs.push({ icon: 'fa-image', label: 'Formato cuadrado/near-square', labelEN: 'Square/near-square format' });
        else if (aspectRatio > 0.6) attrs.push({ icon: 'fa-image', label: 'Formato vertical portrait', labelEN: 'Vertical portrait format' });
        else attrs.push({ icon: 'fa-image', label: 'Formato vertical super-alto', labelEN: 'Super tall vertical format' });

        // === ESTILO ARTÍSTICO ===
        if (stats.saturation < 0.15 && stats.contrast > 0.35) attrs.push({ icon: 'fa-camera-retro', label: 'Estilo: Documental street photography', labelEN: 'Style: Documentary street photography' });
        else if (stats.saturation < 0.25 && stats.brightness > 0.65) attrs.push({ icon: 'fa-wand-magic-sparkles', label: 'Estilo: Fine art etéreo y luminoso', labelEN: 'Style: Ethereal and luminous fine art' });
        else if (stats.saturation > 0.6 && stats.contrast > 0.4) attrs.push({ icon: 'fa-gem', label: 'Estilo: Editorial fashion de alta costura', labelEN: 'Style: High fashion editorial' });
        else if (stats.temperature > 0.1 && stats.saturation < 0.45) attrs.push({ icon: 'fa-portrait', label: 'Estilo: Retrato de estudio cálido y profesional', labelEN: 'Style: Warm professional studio portrait' });
        else if (stats.temperature < -0.08 && stats.saturation < 0.35 && stats.contrast > 0.35) attrs.push({ icon: 'fa-film', label: 'Estilo: Cinematográfico film noir', labelEN: 'Style: Cinematic film noir' });
        else if (stats.brightness > 0.7 && stats.saturation > 0.5) attrs.push({ icon: 'fa-store', label: 'Estilo: Publicidad comercial brillante', labelEN: 'Style: Bright commercial advertising' });
        else if (stats.sharpness < 0.1 && stats.saturation < 0.3) attrs.push({ icon: 'fa-palette', label: 'Estilo: Pictorialista, pintura-like', labelEN: 'Style: Pictorialist, painting-like' });
        else attrs.push({ icon: 'fa-leaf', label: 'Estilo: Natural lifestyle cotidiano', labelEN: 'Style: Everyday natural lifestyle' });

        // === EFECTOS ESTIMADOS ===
        if (stats.contrast > 0.45 && stats.brightness < 0.4) attrs.push({ icon: 'fa-star', label: 'Efecto: Grano cinematográfico', labelEN: 'Effect: Cinematic grain' });
        if (stats.saturation < 0.2 && stats.brightness > 0.5) attrs.push({ icon: 'fa-fade', label: 'Efecto: Matte vintage', labelEN: 'Effect: Vintage matte' });
        if (stats.contrast > 0.35 && stats.saturation > 0.5) attrs.push({ icon: 'fa-bolt', label: 'Efecto: Contraste cruzado (cross-processing)', labelEN: 'Effect: Cross-processing contrast' });
        if (stats.sharpness < 0.08) attrs.push({ icon: 'fa-circle-dot', label: 'Efecto: Bokeh artístico', labelEN: 'Effect: Artistic bokeh' });

        return attrs;
    }

    static _generatePrompt(attributes, palette, stats, lang = 'es') {
        const topColors = palette.slice(0, 6);
        const colorNames = topColors.map(c =>
            lang === 'es' ? StyleAnalyzer._colorName(c.r, c.g, c.b) : StyleAnalyzer._colorNameEN(c.r, c.g, c.b)
        );
        const colorHexes = topColors.map(c => StyleAnalyzer._rgbToHex(c.r, c.g, c.b));
        const attrLabels = attributes.map(a => lang === 'es' ? a.label : a.labelEN);

        const lighting = attrLabels[0];
        const temperature = attrLabels[1];
        const contrast = attrLabels[2];
        const saturation = attrLabels[3];
        const sharpness = attrLabels[4];
        const aspectRatio = attrLabels[5];
        const style = attrLabels[6] || '';
        const effects = attrLabels.slice(7).join(', ');

        if (lang === 'es') {
            return `Recrea el sujeto, la composición y la pose exactos de la imagen de referencia, pero transforma completamente el estilo visual. ${style}, ${lighting}, ${temperature}, ${contrast}, ${saturation}, ${sharpness}, ${aspectRatio}.

Perfil de color: Paleta dominante ${colorNames.join(', ')}, con códigos hexadecimales: ${colorHexes.join(', ')}. ${stats.brightness < 0.4 ? 'Sombreado dramático chiaroscuro con profundidad en las sombras negras y luces de borde vibrantes que resaltan cada contorno.' : stats.brightness > 0.7 ? 'Iluminación brillante y equilibrada con suaves gradientes y luces naturales.' : 'Iluminación natural y balanceada con sombreado suave y detalles bien definidos.'}

Efectos visuales: ${effects || 'Sin efectos adicionales'}. Textura: ${stats.sharpness < 0.1 ? 'suave y etérea con bokeh artístico' : stats.sharpness > 0.25 ? 'nítida y detallada, hiperrealista' : 'natural y equilibrada'}.

Calidad final: 8k resolution, ultra HD, masterpiece quality, photorealistic, extreme detail, professional photography, cinematic composition, perfect lighting, vibrant colors, sharp focus, award-winning.`;
        } else {
            return `Recreate the exact subject, composition, and pose from the reference image, but completely transform the visual style. ${style}, ${lighting}, ${temperature}, ${contrast}, ${saturation}, ${sharpness}, ${aspectRatio}.

Color profile: Dominant palette ${colorNames.join(', ')}, with hex codes: ${colorHexes.join(', ')}. ${stats.brightness < 0.4 ? 'Dramatic chiaroscuro shading with pitch-black shadow depth and vibrant rim lighting catching every edge.' : stats.brightness > 0.7 ? 'Bright and balanced lighting with smooth gradients and natural highlights.' : 'Natural and balanced lighting with soft shading and well-defined details.'}

Visual effects: ${effects || 'No additional effects'}. Texture: ${stats.sharpness < 0.1 ? 'soft and ethereal with artistic bokeh' : stats.sharpness > 0.25 ? 'sharp and detailed, hyperrealistic' : 'natural and balanced'}.

Final quality: 8k resolution, ultra HD, masterpiece quality, photorealistic, extreme detail, professional photography, cinematic composition, perfect lighting, vibrant colors, sharp focus, award-winning.`;
        }
    }
}

class ImageAnalyzer {
    constructor() {
        // Referencias DOM
        this.els = {
            dropZone: document.getElementById('dropZone'),
            imageInput: document.getElementById('imageInput'),
            imagePreview: document.getElementById('imagePreview'),
            previewContainer: document.getElementById('previewContainer'),
            clearImageBtn: document.getElementById('clearImageBtn'),
            analyzeBtn: document.getElementById('analyzeBtn'),
            resultsSection: document.getElementById('resultsSection'),
            predictionList: document.getElementById('predictionList'),
            loadingIndicator: document.getElementById('loadingIndicator'),
            modelStatus: document.getElementById('modelStatus'),
            modelProgressBar: document.getElementById('modelProgressBar'),
            toastContainer: document.getElementById('toastContainer'),
            sidebar: document.getElementById('sidebar'),
            sidebarOverlay: document.getElementById('sidebarOverlay'),
            historyBtn: document.getElementById('historyBtn'),
            closeSidebarBtn: document.getElementById('closeSidebarBtn'),
            clearHistoryBtn: document.getElementById('clearHistoryBtn'),
            historyList: document.getElementById('historyList'),
            // Style prompt elements
            logoBtn: document.getElementById('logoBtn'),
            langToggle: document.getElementById('langToggle'),
            stylePromptSection: document.getElementById('stylePromptSection'),
            colorPalette: document.getElementById('colorPalette'),
            styleAttributes: document.getElementById('styleAttributes'),
            promptText: document.getElementById('promptText'),
            copyPromptBtn: document.getElementById('copyPromptBtn'),
            copyPromptENBtn: document.getElementById('copyPromptENBtn')
        };

        // Estado
        this.model = null;
        this.selectedImage = null;
        this.history = new AnalysisHistory();
        this.lastStyleAnalysis = null;
        this.currentLanguage = 'es'; // 'es' or 'en'

        this._init();
    }

    /** Inicializar event listeners y cargar modelo */
    _init() {
        this._setupDragAndDrop();
        this._setupFileInput();
        this._setupButtons();
        this._setupSidebar();
        this._setupStylePrompt();
        this._setupLanguageToggle();
        this._setupLogoClick();
        this._loadModel();
    }

    _setupLogoClick() {
        // Click event
        this.els.logoBtn.addEventListener('click', () => {
            this._hardRefresh();
        });

        // Keyboard navigation support
        this.els.logoBtn.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                this._hardRefresh();
            }
        });
    }

    _hardRefresh() {
        // Clear localStorage
        try {
            localStorage.clear();
            this.showToast(this.currentLanguage === 'es' ? 'Caché limpiada. Recargando...' : 'Cache cleared. Reloading...', 'success');
        } catch (e) {
            console.warn('Error clearing localStorage:', e);
        }

        // Force reload from server (not cache)
        setTimeout(() => {
            location.reload(true);
        }, 500);
    }

    _setupLanguageToggle() {
        this.els.langToggle.addEventListener('click', () => {
            this.currentLanguage = this.currentLanguage === 'es' ? 'en' : 'es';
            this.els.langToggle.querySelector('.lang-text').textContent = this.currentLanguage.toUpperCase();
            
            // Update the copy button texts
            if (this.currentLanguage === 'es') {
                this.els.copyPromptBtn.innerHTML = '<i class="fas fa-copy"></i> Copiar Prompt';
                this.els.copyPromptENBtn.innerHTML = '<i class="fas fa-language"></i> Copiar en Inglés';
            } else {
                this.els.copyPromptBtn.innerHTML = '<i class="fas fa-copy"></i> Copy Prompt';
                this.els.copyPromptENBtn.innerHTML = '<i class="fas fa-language"></i> Copy in English';
            }
            
            // Update the prompt if we have an analysis
            if (this.lastStyleAnalysis) {
                this._displayStyleAnalysis(this.lastStyleAnalysis);
            }
        });
    }

    // =====================
    //  Carga del Modelo
    // =====================

    async _loadModel() {
        this._setModelStatus('loading', 'Cargando modelo...');

        try {
            this.model = await mobilenet.load({ version: 2, alpha: 1.0 });
            this._setModelStatus('ready', 'Modelo listo');
            this._updateAnalyzeBtn();
            this.showToast('Modelo de IA cargado correctamente', 'success');
        } catch (err) {
            console.error('Error cargando modelo:', err);
            this._setModelStatus('error', 'Error al cargar');
            this.showToast('No se pudo cargar el modelo. Verifica tu conexión.', 'error');
        }
    }

    _setModelStatus(state, text) {
        const status = this.els.modelStatus;
        const bar = this.els.modelProgressBar;
        status.className = `model-status ${state}`;
        status.querySelector('.status-text').textContent = text;

        // Barra de progreso
        if (state === 'loading') {
            bar.className = 'model-progress-bar indeterminate';
        } else {
            bar.className = 'model-progress-bar';
            bar.style.width = state === 'ready' ? '100%' : '0%';
        }
    }

    // =====================
    //  Drag & Drop
    // =====================

    _setupDragAndDrop() {
        const dz = this.els.dropZone;

        // Prevenir comportamiento por defecto del navegador
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(evt => {
            dz.addEventListener(evt, e => { e.preventDefault(); e.stopPropagation(); });
        });

        // Efecto visual al arrastrar sobre la zona
        dz.addEventListener('dragenter', () => dz.classList.add('drag-over'));
        dz.addEventListener('dragover', () => dz.classList.add('drag-over'));
        dz.addEventListener('dragleave', () => dz.classList.remove('drag-over'));
        dz.addEventListener('drop', (e) => {
            dz.classList.remove('drag-over');
            const files = e.dataTransfer.files;
            if (files.length > 0) this._handleFile(files[0]);
        });

        // Click para abrir selector de archivos
        dz.addEventListener('click', () => this.els.imageInput.click());
        dz.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                this.els.imageInput.click();
            }
        });
    }

    // =====================
    //  Input de Archivos
    // =====================

    _setupFileInput() {
        this.els.imageInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) this._handleFile(file);
        });
    }

    /** Procesar un archivo de imagen */
    _handleFile(file) {
        // Validar tipo
        if (!file.type.startsWith('image/')) {
            this.showToast('Por favor selecciona un archivo de imagen válido', 'warning');
            return;
        }

        // Validar tamaño (max 10MB)
        if (file.size > 10 * 1024 * 1024) {
            this.showToast('La imagen es demasiado grande (máximo 10MB)', 'warning');
            return;
        }

        this.selectedImage = file;

        const reader = new FileReader();
        reader.onload = (e) => {
            this.els.imagePreview.src = e.target.result;
            this.els.previewContainer.classList.add('active');
            this._updateAnalyzeBtn();

            // Ocultar resultados previos
            this.els.resultsSection.classList.add('hidden');
            this.els.stylePromptSection.classList.add('hidden');
            this.els.predictionList.innerHTML = '';

            this.showToast('Imagen cargada correctamente', 'info');
        };

        reader.onerror = () => {
            this.showToast('Error al leer la imagen', 'error');
        };

        reader.readAsDataURL(file);
    }

    // =====================
    //  Botones
    // =====================

    _setupButtons() {
        // Analizar
        this.els.analyzeBtn.addEventListener('click', () => this._analyze());

        // Limpiar imagen
        this.els.clearImageBtn.addEventListener('click', () => this._clearImage());
    }

    _updateAnalyzeBtn() {
        this.els.analyzeBtn.disabled = !(this.model && this.selectedImage);
    }

    _clearImage() {
        this.selectedImage = null;
        this.els.imagePreview.src = '';
        this.els.previewContainer.classList.remove('active');
        this.els.resultsSection.classList.add('hidden');
        this.els.stylePromptSection.classList.add('hidden');
        this.els.predictionList.innerHTML = '';
        this.els.imageInput.value = '';
        this.lastStyleAnalysis = null;
        this._updateAnalyzeBtn();
    }

    // =====================
    //  Análisis / Clasificación
    // =====================

    async _analyze() {
        if (!this.model || !this.selectedImage) return;

        // Mostrar sección de resultados con loading
        this.els.resultsSection.classList.remove('hidden');
        this.els.loadingIndicator.classList.remove('hidden');
        this.els.predictionList.innerHTML = '';
        // Asegurarnos que la sección de prompt esté oculta durante la carga
        this.els.stylePromptSection.classList.add('hidden');
        this.els.analyzeBtn.disabled = true;

        // Obtener todos los elementos de los spinners
        const spinnerWrappers = this.els.loadingIndicator.querySelectorAll('.spinner-wrapper');
        
        // Función para actualizar el estado de los spinners
        const updateSpinnerStep = (step) => {
            spinnerWrappers.forEach((wrapper, index) => {
                wrapper.classList.remove('active', 'completed');
                if (index < step) {
                    wrapper.classList.add('completed');
                } else if (index === step) {
                    wrapper.classList.add('active');
                }
            });
        };

        // Inicializar el primer spinner
        updateSpinnerStep(0);

        // Hora de inicio para asegurar al menos 15 segundos de animación
        const startTime = Date.now();
        const MIN_LOADING_TIME = 15000; // 15 segundos
        const TOTAL_STEPS = spinnerWrappers.length;
        const STEP_DURATION = MIN_LOADING_TIME / TOTAL_STEPS;
        let currentStep = 0;
        
        // Intervalo para avanzar de paso cada 3 segundos (15/5)
        const stepInterval = setInterval(() => {
            if (currentStep < TOTAL_STEPS - 1) {
                currentStep++;
                updateSpinnerStep(currentStep);
            }
        }, STEP_DURATION);

        try {
            // 1. Realizar todos los cálculos primero (sin mostrar nada)
            const predictions = await this.model.classify(this.els.imagePreview);
            const styleAnalysis = this._analyzeStyle();
            this._saveToHistory(predictions);
            
            // 2. Esperar los 15 segundos completos
            const elapsedTime = Date.now() - startTime;
            const remainingTime = Math.max(0, MIN_LOADING_TIME - elapsedTime);
            
            if (remainingTime > 0) {
                await new Promise(resolve => setTimeout(resolve, remainingTime));
            }
            
            // 3. Mostrar todos los resultados juntos
            this._displayPredictions(predictions);
            if (styleAnalysis) {
                this._displayStyleAnalysis(styleAnalysis);
            }
            this.showToast(`Análisis completado — ${predictions.length} resultados`, 'success');
        } catch (err) {
            console.error('Error al analizar:', err);
            this.els.predictionList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-triangle-exclamation"></i>
                    <p>Ocurrió un error al procesar la imagen. Intenta de nuevo.</p>
                </div>
            `;
            this.showToast('Error al analizar la imagen', 'error');
        } finally {
            // Limpiar el intervalo de pasos
            clearInterval(stepInterval);
            // Restablecer los spinners para la próxima vez
            spinnerWrappers.forEach(wrapper => {
                wrapper.classList.remove('active', 'completed');
            });
            this.els.loadingIndicator.classList.add('hidden');
            this.els.analyzeBtn.disabled = false;
        }
    }

    /** Renderizar predicciones con barras de progreso animadas */
    _displayPredictions(predictions) {
        const list = this.els.predictionList;

        list.innerHTML = predictions.map((pred, i) => {
            const percentage = (pred.probability * 100).toFixed(1);
            return `
                <div class="prediction-card">
                    <div class="prediction-top">
                        <span class="prediction-rank">${i + 1}</span>
                        <span class="prediction-name">${pred.className}</span>
                        <span class="prediction-confidence">${percentage}%</span>
                    </div>
                    <div class="progress-bar-wrapper">
                        <div class="progress-bar" data-width="${percentage}"></div>
                    </div>
                </div>
            `;
        }).join('');

        // Animar barras con un pequeño delay para que el CSS transition funcione
        requestAnimationFrame(() => {
            list.querySelectorAll('.progress-bar').forEach(bar => {
                bar.style.width = bar.dataset.width + '%';
            });
        });
    }

    // =====================
    //  Historial
    // =====================

    _saveToHistory(predictions) {
        try {
            this.history.add(this.els.imagePreview, predictions);
            this.history.render(this.els.historyList, (entry) => this._restoreFromHistory(entry));
        } catch (err) {
            console.warn('No se pudo guardar en historial:', err);
        }
    }

    // =====================
    //  Análisis de Estilo
    // =====================

    /** Ejecutar análisis de estilo visual de la imagen (solo cálculo, sin mostrar) */
    _analyzeStyle() {
        try {
            const analysis = StyleAnalyzer.analyze(this.els.imagePreview);
            this.lastStyleAnalysis = analysis;
            return analysis;
        } catch (err) {
            console.error('Error en análisis de estilo:', err);
            return null;
        }
    }

    /** Renderizar resultados del análisis de estilo en la UI */
    _displayStyleAnalysis(analysis) {
        const section = this.els.stylePromptSection;
        section.classList.remove('hidden');

        // --- Paleta de colores ---
        this.els.colorPalette.innerHTML = analysis.palette.map(c => `
            <div class="color-swatch" title="${(this.currentLanguage === 'es' ? StyleAnalyzer._colorName(c.r, c.g, c.b) : StyleAnalyzer._colorNameEN(c.r, c.g, c.b))} (${c.percent}%)">
                <div class="color-circle" style="background-color: rgb(${c.r}, ${c.g}, ${c.b})"></div>
                <span class="color-percent">${c.percent}%</span>
            </div>
        `).join('');

        // --- Atributos de estilo ---
        this.els.styleAttributes.innerHTML = analysis.attributes.map(a => `
            <span class="style-tag">
                <i class="fas ${a.icon}"></i>
                ${this.currentLanguage === 'es' ? a.label : a.labelEN}
            </span>
        `).join('');

        // --- Prompt detallado ---
        const prompt = this.currentLanguage === 'es' ? analysis.prompt : analysis.promptEN;
        this.els.promptText.innerHTML = prompt
            .split('\n')
            .map(line => {
                if (line.includes(':')) {
                    const [label, ...rest] = line.split(':');
                    return `<p><span class="prompt-keyword">${label}:</span>${rest.join(':')}</p>`;
                }
                return `<p>${line}</p>`;
            })
            .join('');
    }

    /** Configurar botones del prompt de estilo */
    _setupStylePrompt() {
        // Copiar prompt en el idioma actual
        this.els.copyPromptBtn.addEventListener('click', () => {
            const prompt = this.currentLanguage === 'es' 
                ? (this.lastStyleAnalysis?.prompt || '') 
                : (this.lastStyleAnalysis?.promptEN || '');
            this._copyToClipboard(prompt, this.els.copyPromptBtn);
        });

        // Copiar prompt en el otro idioma
        this.els.copyPromptENBtn.addEventListener('click', () => {
            const prompt = this.currentLanguage === 'es' 
                ? (this.lastStyleAnalysis?.promptEN || '') 
                : (this.lastStyleAnalysis?.prompt || '');
            this._copyToClipboard(prompt, this.els.copyPromptENBtn);
        });
    }

    /** Copiar texto al portapapeles con feedback visual */
    async _copyToClipboard(text, btn) {
        try {
            await navigator.clipboard.writeText(text);
            const originalHTML = btn.innerHTML;
            btn.classList.add('copied');
            btn.innerHTML = '<i class="fas fa-check"></i> Copiado';
            this.showToast('Prompt copiado al portapapeles', 'success');
            setTimeout(() => {
                btn.classList.remove('copied');
                btn.innerHTML = originalHTML;
            }, 2000);
        } catch {
            // Fallback para navegadores sin soporte
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            this.showToast('Prompt copiado al portapapeles', 'success');
        }
    }

    /** Restaurar una imagen y sus resultados desde el historial */
    _restoreFromHistory(entry) {
        this.els.imagePreview.src = entry.thumbnail;
        this.els.previewContainer.classList.add('active');
        this.selectedImage = new File([], 'restored.jpg', { type: 'image/jpeg' });
        this._updateAnalyzeBtn();

        // Mostrar resultados
        this._displayPredictions(entry.predictions);
        this.els.resultsSection.classList.remove('hidden');

        // Cerrar sidebar
        this._closeSidebar();

        this.showToast('Análisis restaurado desde el historial', 'info');
    }

    // =====================
    //  Sidebar
    // =====================

    _setupSidebar() {
        this.els.historyBtn.addEventListener('click', () => this._openSidebar());
        this.els.closeSidebarBtn.addEventListener('click', () => this._closeSidebar());
        this.els.sidebarOverlay.addEventListener('click', () => this._closeSidebar());

        this.els.clearHistoryBtn.addEventListener('click', () => {
            this.history.clear();
            this.history.render(this.els.historyList, (entry) => this._restoreFromHistory(entry));
            this.showToast('Historial eliminado', 'info');
        });

        // Cerrar con Escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.els.sidebar.classList.contains('active')) {
                this._closeSidebar();
            }
        });

        // Render inicial
        this.history.render(this.els.historyList, (entry) => this._restoreFromHistory(entry));
    }

    _openSidebar() {
        this.els.sidebar.classList.add('active');
        this.els.sidebarOverlay.classList.add('active');
        document.body.style.overflow = 'hidden';
        this.els.closeSidebarBtn.focus();
    }

    _closeSidebar() {
        this.els.sidebar.classList.remove('active');
        this.els.sidebarOverlay.classList.remove('active');
        document.body.style.overflow = '';
        this.els.historyBtn.focus();
    }

    // =====================
    //  Toast Notifications
    // =====================

    /**
     * Mostrar una notificación toast.
     * @param {string} message - Texto del toast
     * @param {'success'|'error'|'info'|'warning'} type - Tipo de toast
     * @param {number} duration - Duración en ms (default 3000)
     */
    showToast(message, type = 'info', duration = 3000) {
        const container = this.els.toastContainer;

        const icons = {
            success: 'fas fa-circle-check',
            error: 'fas fa-circle-xmark',
            info: 'fas fa-circle-info',
            warning: 'fas fa-triangle-exclamation'
        };

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.setAttribute('role', 'alert');
        toast.innerHTML = `
            <i class="${icons[type]} toast-icon"></i>
            <span>${message}</span>
        `;

        container.appendChild(toast);

        // Auto-dismiss
        setTimeout(() => {
            toast.classList.add('toast-out');
            toast.addEventListener('animationend', () => toast.remove());
        }, duration);
    }
}

// =====================
//  Inicialización
// =====================
document.addEventListener('DOMContentLoaded', () => {
    new ImageAnalyzer();
});
