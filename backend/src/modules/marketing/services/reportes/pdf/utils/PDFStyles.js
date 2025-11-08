// ============================================
// ESTILOS CORPORATIVOS PARA PDFs
// Configuración centralizada de colores, fuentes y dimensiones
// VERSIÓN OPTIMIZADA v2.0
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
        NARANJA: '#f59e0b',
        
        // Nuevos: para gráficos
        AZUL_SUAVE: '#60a5fa',
        VERDE_SUAVE: '#34d399',
        AMARILLO_SUAVE: '#fbbf24',
        ROJO_SUAVE: '#f87171'
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
        TEXTO_MUY_PEQUENO: 8,
        // Nuevo: para valores destacados
        VALOR_KPI: 22
    };

    // ============================================
    // DIMENSIONES OPTIMIZADAS
    // ============================================
    static DIMENSIONES = {
        // Márgenes de página
        MARGEN_SUPERIOR: 50,
        MARGEN_INFERIOR: 70,
        MARGEN_IZQUIERDO: 50,
        MARGEN_DERECHO: 50,

        // Elementos de página
        ALTURA_ENCABEZADO: 80,
        ALTURA_PIE: 60,

        // KPI Cards (optimizado para mejor densidad)
        KPI_ANCHO: 235,
        KPI_ALTO: 75,         // Reducido de 95 → ahorro 20px por fila
        KPI_GAP: 18,          // Reducido de 25 → ahorro 7px
        KPI_PADDING: 12,      // Reducido de 15

        // Tablas (optimizado para legibilidad sin exceso)
        TABLA_FILA_ALTURA: 28,           // Reducido de 32
        TABLA_PADDING_VERTICAL: 8,       // Reducido de 10
        TABLA_PADDING_HORIZONTAL: 6,     // Reducido de 8

        // Espaciado entre elementos
        ESPACIO_ENTRE_SECCIONES: 20,     // Reducido de 25
        ESPACIO_ENTRE_ELEMENTOS: 12,     // Reducido de 15
        
        // Nuevos: para gráficos
        ALTURA_GRAFICO_PEQUENO: 120,
        ALTURA_GRAFICO_MEDIANO: 180,
        ALTURA_GRAFICO_GRANDE: 240,
        
        // Nuevos: para progress bars
        PROGRESS_BAR_ALTURA: 12,
        PROGRESS_BAR_ANCHO: 200
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
    
    /**
     * NUEVO: Obtener color para gráfico donut por índice
     */
    static getColorDonutPorIndice(indice) {
        const colores = [
            this.COLORES.VERDE,
            this.COLORES.AZUL_MEDIO,
            this.COLORES.AMARILLO,
            this.COLORES.ROJO,
            this.COLORES.PURPURA,
            this.COLORES.NARANJA
        ];
        return colores[indice % colores.length];
    }
    
    /**
     * NUEVO: Obtener color por estado de actividad
     */
    static getColorPorEstado(estado) {
        const coloresEstado = {
            'completada': this.COLORES.VERDE,
            'en_progreso': this.COLORES.AZUL_MEDIO,
            'pendiente': this.COLORES.AMARILLO,
            'cancelada': this.COLORES.GRIS,
            'no_realizada': this.COLORES.ROJO
        };
        return coloresEstado[estado] || this.COLORES.GRIS;
    }
}

module.exports = PDFStyles;