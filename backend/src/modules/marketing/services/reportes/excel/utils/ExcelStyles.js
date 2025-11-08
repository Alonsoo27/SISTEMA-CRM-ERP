// ============================================
// ESTILOS CORPORATIVOS PARA EXCEL
// Configuración centralizada de colores y formatos
// ============================================

class ExcelStyles {
    // ============================================
    // COLORES CORPORATIVOS (ARGB)
    // ============================================
    static COLORES = {
        // Primarios
        AZUL_OSCURO: 'FF1E3A8A',
        AZUL_MEDIO: 'FF3B82F6',
        AZUL_CLARO: 'FFDBEAFE',

        // Estados
        VERDE: 'FF10B981',
        VERDE_CLARO: 'FF10B98120',
        AMARILLO: 'FFF59E0B',
        AMARILLO_CLARO: 'FFF59E0B20',
        ROJO: 'FFEF4444',
        ROJO_CLARO: 'FFEF444420',

        // Neutros
        BLANCO: 'FFFFFFFF',
        GRIS_CLARO: 'FFF9FAFB',
        GRIS_BORDE: 'FFE5E7EB',
        GRIS_TEXTO: 'FF374151',

        // Específicos
        PURPURA: 'FF8B5CF6',
        NARANJA: 'FFF59E0B',

        // Medallas
        ORO: 'FFFDE68A',
        PLATA: 'FFD1D5DB',
        BRONCE: 'FFFED7AA'
    };

    // ============================================
    // ESTILOS PREDEFINIDOS
    // ============================================

    /**
     * Estilo para encabezado principal
     */
    static get ENCABEZADO_PRINCIPAL() {
        return {
            font: { size: 18, bold: true, color: { argb: this.COLORES.BLANCO } },
            fill: {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: this.COLORES.AZUL_OSCURO }
            },
            alignment: { vertical: 'middle', horizontal: 'center' }
        };
    }

    /**
     * Estilo para encabezado de sección
     */
    static get ENCABEZADO_SECCION() {
        return {
            font: { size: 14, bold: true, color: { argb: this.COLORES.BLANCO } },
            fill: {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: this.COLORES.AZUL_MEDIO }
            },
            alignment: { vertical: 'middle', horizontal: 'center' }
        };
    }

    /**
     * Estilo para encabezado de tabla
     */
    static get ENCABEZADO_TABLA() {
        return {
            font: { bold: true, color: { argb: this.COLORES.BLANCO } },
            fill: {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: this.COLORES.AZUL_OSCURO }
            },
            alignment: { vertical: 'middle', horizontal: 'center' },
            border: this.BORDE_COMPLETO
        };
    }

    /**
     * Estilo para celda de datos
     */
    static get CELDA_DATOS() {
        return {
            alignment: { vertical: 'middle', horizontal: 'center' },
            border: this.BORDE_COMPLETO
        };
    }

    /**
     * Estilo para texto de información
     */
    static get TEXTO_INFO() {
        return {
            font: { bold: true, color: { argb: this.COLORES.AZUL_OSCURO } }
        };
    }

    /**
     * Borde completo para celdas
     */
    static get BORDE_COMPLETO() {
        return {
            top: { style: 'thin', color: { argb: this.COLORES.GRIS_BORDE } },
            left: { style: 'thin', color: { argb: this.COLORES.GRIS_BORDE } },
            bottom: { style: 'thin', color: { argb: this.COLORES.GRIS_BORDE } },
            right: { style: 'thin', color: { argb: this.COLORES.GRIS_BORDE } }
        };
    }

    // ============================================
    // MÉTODOS DINÁMICOS
    // ============================================

    /**
     * Obtener fill para filas alternas
     */
    static getFillFilaAlterna(index) {
        return {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: index % 2 === 0 ? this.COLORES.GRIS_CLARO : this.COLORES.BLANCO }
        };
    }

    /**
     * Obtener color según evaluación
     */
    static getColorPorEvaluacion(valor, umbral, mayorEsMejor = true) {
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
            return valor >= umbral ? '✅' : '⚠️';
        } else {
            return valor <= umbral ? '✅' : '⚠️';
        }
    }

    /**
     * Obtener interpretación de eficiencia
     */
    static getInterpretacionEficiencia(eficiencia) {
        if (eficiencia <= 90) {
            return {
                texto: '✅ EXCELENTE: Las actividades se completan antes del tiempo estimado.',
                color: this.COLORES.VERDE
            };
        } else if (eficiencia <= 110) {
            return {
                texto: '✓ BUENO: El tiempo real está muy cerca del tiempo planeado.',
                color: this.COLORES.AZUL_MEDIO
            };
        } else if (eficiencia <= 130) {
            return {
                texto: '⚠️ ATENCIÓN: Las actividades toman más tiempo del planeado.',
                color: this.COLORES.AMARILLO
            };
        } else {
            return {
                texto: '❌ CRÍTICO: Revisar planificación.',
                color: this.COLORES.ROJO
            };
        }
    }
}

module.exports = ExcelStyles;
