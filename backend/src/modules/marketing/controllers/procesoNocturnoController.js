// ============================================
// CONTROLADOR DE PROCESO NOCTURNO
// ============================================

const procesoNocturnoService = require('../services/procesoNocturnoService');

class ProcesoNocturnoController {
    /**
     * Ejecutar proceso nocturno manualmente
     * Solo accesible para SUPER_ADMIN
     */
    static async ejecutarManualmente(req, res) {
        try {
            const { user_id } = req.user;

            console.log(`🔧 Ejecución manual del proceso nocturno por usuario: ${user_id}`);

            const resultado = await procesoNocturnoService.ejecutarManualmente(user_id);

            res.json({
                success: true,
                message: `Proceso completado: ${resultado.actividades_marcadas} actividades marcadas como no_realizada`,
                data: resultado
            });

        } catch (error) {
            console.error('Error ejecutando proceso nocturno:', error);
            res.status(500).json({
                success: false,
                message: 'Error al ejecutar proceso nocturno',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }

    /**
     * Obtener historial de ejecuciones
     * Solo accesible para JEFE_MARKETING y superiores
     */
    static async obtenerHistorial(req, res) {
        try {
            const { limite = 30 } = req.query;

            const resultado = await procesoNocturnoService.obtenerHistorial(parseInt(limite));

            res.json({
                success: true,
                data: resultado.historial
            });

        } catch (error) {
            console.error('Error obteniendo historial:', error);
            res.status(500).json({
                success: false,
                message: 'Error al obtener historial',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }
}

module.exports = ProcesoNocturnoController;
