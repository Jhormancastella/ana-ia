/**
 * AnalysisHistory — Módulo de historial de análisis con localStorage
 * Guarda hasta 20 entradas con miniaturas y predicciones.
 */
class AnalysisHistory {
    constructor(storageKey = 'imageAnalyzerHistory', maxEntries = 20) {
        this.storageKey = storageKey;
        this.maxEntries = maxEntries;
        this.entries = this._load();
    }

    /** Leer entradas desde localStorage */
    _load() {
        try {
            const data = localStorage.getItem(this.storageKey);
            return data ? JSON.parse(data) : [];
        } catch {
            return [];
        }
    }

    /** Persistir entradas actuales en localStorage */
    _save() {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(this.entries));
        } catch (e) {
            console.warn('No se pudo guardar en localStorage:', e);
        }
    }

    /**
     * Agregar una entrada al historial.
     * @param {HTMLImageElement|string} source - Imagen o Data URL de la imagen
     * @param {Array} predictions - Array de { className, probability }
     * @returns {object} La entrada creada
     */
    add(source, predictions) {
        // Crear thumbnail comprimido (max 150px)
        const thumbnail = this._createThumbnail(source, 150);

        const entry = {
            id: Date.now(),
            date: new Date().toLocaleString('es-ES', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            }),
            thumbnail,
            predictions: predictions.slice(0, 5) // Guardar top 5
        };

        this.entries.unshift(entry); // Más reciente primero

        // Respetar límite
        if (this.entries.length > this.maxEntries) {
            this.entries = this.entries.slice(0, this.maxEntries);
        }

        this._save();
        return entry;
    }

    /** Obtener todas las entradas */
    getAll() {
        return [...this.entries];
    }

    /** Obtener una entrada por ID */
    getById(id) {
        return this.entries.find(e => e.id === id) || null;
    }

    /** Eliminar una entrada por ID */
    remove(id) {
        this.entries = this.entries.filter(e => e.id !== id);
        this._save();
    }

    /** Limpiar todo el historial */
    clear() {
        this.entries = [];
        this._save();
    }

    /** Cantidad de entradas */
    get count() {
        return this.entries.length;
    }

    /**
     * Crear un thumbnail comprimido desde un Data URL o HTMLImageElement.
     * Usa un canvas para redimensionar y comprimir.
     */
    _createThumbnail(source, maxSize) {
        try {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            let img;

            if (source instanceof HTMLImageElement) {
                img = source;
            } else {
                img = new Image();
                img.src = source;
                // If image isn't loaded yet, use a fallback size
                if (!img.naturalWidth) {
                    return source;
                }
            }

            const width = img.naturalWidth || img.width || 150;
            const height = img.naturalHeight || img.height || 150;
            const ratio = Math.min(maxSize / width, maxSize / height, 1);
            canvas.width = Math.round(width * ratio);
            canvas.height = Math.round(height * ratio);

            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            return canvas.toDataURL('image/jpeg', 0.7);
        } catch {
            // Fallback: return original source if it's a data URL, or a placeholder
            return typeof source === 'string' ? source : '';
        }
    }

    /**
     * Renderizar el historial en el sidebar.
     * @param {HTMLElement} container - Elemento donde insertar el HTML
     * @param {Function} onRestore - Callback al hacer click en una entrada (entry) => void
     */
    render(container, onRestore) {
        if (!container) return;

        if (this.entries.length === 0) {
            container.innerHTML = `
                <div class="history-empty">
                    <i class="fas fa-clock"></i>
                    <p>No hay análisis previos</p>
                </div>
            `;
            return;
        }

        container.innerHTML = this.entries.map(entry => `
            <div class="history-item" data-id="${entry.id}" tabindex="0" role="button"
                 aria-label="Restaurar análisis del ${entry.date}">
                <img src="${entry.thumbnail}" alt="Thumbnail" class="history-thumb" loading="lazy">
                <div class="history-info">
                    <span class="history-date">${entry.date}</span>
                    <div class="history-preds">
                        ${entry.predictions.slice(0, 3).map(p => `
                            <span class="history-tag">${p.className.split(',')[0]}</span>
                        `).join('')}
                    </div>
                </div>
                <button class="history-delete" data-delete-id="${entry.id}" 
                        aria-label="Eliminar este análisis">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `).join('');

        // Event listeners para restaurar
        container.querySelectorAll('.history-item').forEach(item => {
            item.addEventListener('click', (e) => {
                // Ignorar clicks en el botón de eliminar
                if (e.target.closest('.history-delete')) return;
                const entry = this.getById(Number(item.dataset.id));
                if (entry && onRestore) onRestore(entry);
            });

            // Tecla Enter para accesibilidad
            item.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    const entry = this.getById(Number(item.dataset.id));
                    if (entry && onRestore) onRestore(entry);
                }
            });
        });

        // Event listeners para eliminar
        container.querySelectorAll('.history-delete').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = Number(btn.dataset.deleteId);
                this.remove(id);
                this.render(container, onRestore);
            });
        });
    }
}
