// ============================================
// ESTILOS CORPORATIVOS PARA PDFs
// Configuración centralizada de colores, fuentes y dimensiones
// ============================================

class PDFStyles {
    // ============================================
    // COLORES CORPORATIVOS
    // ============================================
    static COLORES = {
        // Primarios
        AZUL_OSCURO: '#1e3a8a',
        AZUL_MEDIO: '#3b82f6',
        AZUL_CLARO: '#dbeafe',

        // Estados
        VERDE: '#10b981',
        AMARILLO: '#f59e0b',
        ROJO: '#ef4444',
        GRIS: '#64748b',

        // Neutros
        BLANCO: '#ffffff',
        GRIS_CLARO: '#f9fafb',
        GRIS_BORDE: '#e5e7eb',
        GRIS_TEXTO: '#374151',

        // Específicos
        PURPURA: '#8b5cf6',
        NARANJA: '#f59e0b'
    };

    // ============================================
    // TIPOGRAFÍA
    // ============================================
    static FUENTES = {
        TITULO_GRANDE: 20,
        TITULO_MEDIO: 16,
        TITULO_PEQUENO: 14,
        SUBTITULO: 12,
        TEXTO_NORMAL: 10,
        TEXTO_PEQUENO: 9,
        TEXTO_MUY_PEQUENO: 8
    };

    // ============================================
    // DIMENSIONES
    // ============================================
    static DIMENSIONES = {
        MARGEN_SUPERIOR: 50,
        MARGEN_INFERIOR: 50,
        MARGEN_IZQUIERDO: 50,
        MARGEN_DERECHO: 50,

        ALTURA_ENCABEZADO: 80,
        ALTURA_PIE: 50,

        // KPI Cards
        KPI_ANCHO: 240,
        KPI_ALTO: 80,
        KPI_GAP: 20,

        // Tablas
        TABLA_FILA_ALTURA: 25
    };

    // ============================================
    // MÉTODOS DE EVALUACIÓN
    // ============================================

    /**
     * Obtener color según valor y umbral
     */
    static getColorPorValor(valor, umbral, mayorEsMejor = true) {
        if (mayorEsMejor) {
            return valor >= umbral ? this.COLORES.VERDE : this.COLORES.ROJO;
        } else {
            return valor <= umbral ? this.COLORES.VERDE : this.COLORES.ROJO;
        }
    }

    /**
     * Obtener símbolo de estado
     */
    static getSimboloPorValor(valor, umbral, mayorEsMejor = true) {
        if (mayorEsMejor) {
            return valor >= umbral ? '[OK]' : '[!]';
        } else {
            return valor <= umbral ? '[OK]' : '[!]';
        }
    }

    /**
     * Obtener nivel de impacto
     */
    static getNivelImpacto(cantidad, umbrales = [0, 3]) {
        if (cantidad === 0) return { texto: 'Ninguno', color: this.COLORES.VERDE };
        if (cantidad <= umbrales[1]) return { texto: 'Bajo', color: this.COLORES.AMARILLO };
        return { texto: 'Alto', color: this.COLORES.ROJO };
    }

    /**
     * Obtener calificación por porcentaje
     */
    static getCalificacion(porcentaje) {
        if (porcentaje >= 95) return { texto: 'Excelente', color: this.COLORES.VERDE };
        if (porcentaje >= 85) return { texto: 'Muy Bueno', color: this.COLORES.VERDE };
        if (porcentaje >= 70) return { texto: 'Bueno', color: this.COLORES.AZUL_MEDIO };
        if (porcentaje >= 50) return { texto: 'Regular', color: this.COLORES.AMARILLO };
        return { texto: 'Deficiente', color: this.COLORES.ROJO };
    }

    /**
     * Obtener interpretación de eficiencia
     */
    static getInterpretacionEficiencia(eficiencia) {
        if (eficiencia <= 90) {
            return {
                nivel: 'EXCELENTE',
                texto: 'Las actividades se completan antes del tiempo planeado.',
                color: this.COLORES.VERDE
            };
        } else if (eficiencia <= 110) {
            return {
                nivel: 'BUENO',
                texto: 'El tiempo real está muy cerca del planeado.',
                color: this.COLORES.AZUL_MEDIO
            };
        } else if (eficiencia <= 130) {
            return {
                nivel: 'ATENCIÓN',
                texto: 'Las actividades toman más tiempo del planeado.',
                color: this.COLORES.AMARILLO
            };
        } else {
            return {
                nivel: 'CRÍTICO',
                texto: 'Revisar planificación de tiempos.',
                color: this.COLORES.ROJO
            };
        }
    }
}

module.exports = PDFStyles;
