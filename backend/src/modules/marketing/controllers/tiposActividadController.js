// ============================================
// CONTROLLER DE TIPOS DE ACTIVIDAD
// ============================================

const { query } = require('../../../config/database');

class TiposActividadController {
    /**
     * Listar todos los tipos de actividades
     */
    static async listarTipos(req, res) {
        try {
            const result = await query(`
                SELECT
                    id,
                    categoria_principal,
                    subcategoria,
                    descripcion,
                    color_hex
                FROM tipos_actividad_marketing
                WHERE activo = true
                ORDER BY categoria_principal, subcategoria
            `);

            // Agrupar por categoría principal
            const tiposAgrupados = result.rows.reduce((acc, tipo) => {
                if (!acc[tipo.categoria_principal]) {
                    acc[tipo.categoria_principal] = [];
                }
                acc[tipo.categoria_principal].push({
                    id: tipo.id,
                    subcategoria: tipo.subcategoria,
                    descripcion: tipo.descripcion,
                    color_hex: tipo.color_hex
                });
                return acc;
            }, {});

            res.json({
                success: true,
                data: {
                    tipos: result.rows,
                    agrupados: tiposAgrupados
                },
                total: result.rowCount
            });

        } catch (error) {
            console.error('Error listando tipos de actividad:', error);
            res.status(500).json({
                success: false,
                message: 'Error al listar tipos de actividad',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }

    /**
     * Obtener categorías principales
     */
    static async obtenerCategorias(req, res) {
        try {
            const result = await query(`
                SELECT DISTINCT categoria_principal
                FROM tipos_actividad_marketing
                WHERE activo = true
                ORDER BY categoria_principal
            `);

            res.json({
                success: true,
                data: result.rows.map(r => r.categoria_principal)
            });

        } catch (error) {
            console.error('Error obteniendo categorías:', error);
            res.status(500).json({
                success: false,
                message: 'Error al obtener categorías',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }

    /**
     * Obtener subcategorías por categoría principal
     */
    static async obtenerSubcategorias(req, res) {
        try {
            const { categoria_principal } = req.params;

            const result = await query(`
                SELECT
                    id,
                    subcategoria,
                    descripcion,
                    color_hex
                FROM tipos_actividad_marketing
                WHERE categoria_principal = $1 AND activo = true
                ORDER BY subcategoria
            `, [categoria_principal]);

            res.json({
                success: true,
                data: result.rows
            });

        } catch (error) {
            console.error('Error obteniendo subcategorías:', error);
            res.status(500).json({
                success: false,
                message: 'Error al obtener subcategorías',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }
}

module.exports = TiposActividadController;
