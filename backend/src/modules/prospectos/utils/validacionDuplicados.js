// utils/validacionDuplicados.js
const { query } = require('../../../config/database');
const winston = require('winston');

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
    ),
    defaultMeta: { service: 'validacion-duplicados' },
    transports: [
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.simple()
            )
        })
    ]
});

/**
 * SISTEMA DE VALIDACIÓN MULTINIVEL DE PROSPECTOS DUPLICADOS
 *
 * Escenarios:
 * A - PERMITIR SIN ADVERTENCIA: Prospecto Cerrado/Perdido
 * B - ADVERTIR PERO PERMITIR: Prospecto activo con diferentes productos
 * C - BLOQUEAR: Mismo producto en Cotizado/Negociación
 * D - PERMITIR: Mismo asesor re-registrando su prospecto cerrado/perdido
 */

class ValidacionDuplicados {
    /**
     * Valida si se puede crear un prospecto duplicado
     * @param {string} telefono - Número de teléfono a validar
     * @param {number} asesorId - ID del asesor que intenta crear
     * @param {Array} productosInteres - Array de productos [{codigo_producto, descripcion_producto}]
     * @returns {Object} { permitir, escenario, mensaje, requires_confirmation, asesores_activos, motivo_bloqueo }
     */
    static async validarProspectoDuplicado(telefono, asesorId, productosInteres = []) {
        try {
            // 1. Buscar todos los prospectos activos con ese teléfono
            const prospectosExistentes = await query(`
                SELECT
                    p.id,
                    p.codigo,
                    p.nombre_cliente,
                    p.apellido_cliente,
                    p.estado,
                    p.asesor_id,
                    p.asesor_nombre,
                    p.asesor_original_id,
                    p.asesor_original_nombre,
                    p.created_at,
                    p.fecha_contacto
                FROM prospectos p
                WHERE p.telefono = $1
                    AND p.activo = true
                ORDER BY p.created_at DESC
            `, [telefono]);

            // 2. Si NO hay prospectos existentes -> PERMITIR
            if (!prospectosExistentes.rows || prospectosExistentes.rows.length === 0) {
                return {
                    permitir: true,
                    escenario: 'NUEVO',
                    mensaje: 'Prospecto nuevo, sin duplicados',
                    requires_confirmation: false,
                    asesores_activos: []
                };
            }

            const prospectos = prospectosExistentes.rows;

            // 3. Filtrar prospectos por estado
            const prospectosActivos = prospectos.filter(p =>
                ['Prospecto', 'Cotizado', 'Negociacion'].includes(p.estado)
            );

            const prospectosCerradosOPerdidos = prospectos.filter(p =>
                ['Cerrado', 'Perdido'].includes(p.estado)
            );

            // 4. ESCENARIO D: Mismo asesor re-registrando su prospecto cerrado/perdido
            if (prospectosActivos.length === 0 && prospectosCerradosOPerdidos.length > 0) {
                const esMismoAsesor = prospectosCerradosOPerdidos.some(p =>
                    p.asesor_id === asesorId || p.asesor_original_id === asesorId
                );

                if (esMismoAsesor) {
                    return {
                        permitir: true,
                        escenario: 'D_REACTIVACION_PROPIO',
                        mensaje: 'Reactivando prospecto propio previamente cerrado/perdido',
                        requires_confirmation: false,
                        asesores_activos: []
                    };
                }
            }

            // 5. ESCENARIO A: Solo hay prospectos Cerrados/Perdidos (otros asesores)
            if (prospectosActivos.length === 0) {
                return {
                    permitir: true,
                    escenario: 'A_CERRADO_PERDIDO',
                    mensaje: 'Prospectos anteriores están cerrados o perdidos',
                    requires_confirmation: false,
                    asesores_activos: [],
                    prospectos_historicos: prospectosCerradosOPerdidos.map(p => ({
                        asesor: p.asesor_nombre,
                        estado: p.estado,
                        fecha: p.created_at
                    }))
                };
            }

            // 6. Hay prospectos ACTIVOS -> Verificar productos
            const productosARegistrar = productosInteres
                .map(p => p.codigo_producto)
                .filter(codigo => codigo && codigo.trim() !== '');

            // Si no hay productos específicos, permitir con advertencia
            if (productosARegistrar.length === 0) {
                return {
                    permitir: true,
                    escenario: 'B_ADVERTIR_SIN_PRODUCTOS',
                    mensaje: 'Prospecto activo sin productos específicos',
                    requires_confirmation: true,
                    asesores_activos: prospectosActivos.map(p => ({
                        id: p.id,
                        asesor_id: p.asesor_id,
                        asesor_nombre: p.asesor_nombre,
                        estado: p.estado,
                        fecha_registro: p.created_at
                    }))
                };
            }

            // 7. Verificar conflictos de productos
            const conflictos = await this.verificarConflictosProductos(
                prospectosActivos,
                productosARegistrar
            );

            // 8. ESCENARIO C: BLOQUEAR por mismo producto en Cotizado/Negociación
            if (conflictos.bloqueantes.length > 0) {
                return {
                    permitir: false,
                    escenario: 'C_BLOQUEAR_PRODUCTO_AVANZADO',
                    mensaje: 'Producto ya en cotización/negociación por otro asesor',
                    requires_confirmation: false,
                    motivo_bloqueo: conflictos.bloqueantes[0],
                    asesores_activos: prospectosActivos.map(p => ({
                        id: p.id,
                        asesor_id: p.asesor_id,
                        asesor_nombre: p.asesor_nombre,
                        estado: p.estado,
                        fecha_registro: p.created_at
                    }))
                };
            }

            // 9. ESCENARIO B: Productos diferentes o mismo producto en estado inicial
            return {
                permitir: true,
                escenario: 'B_ADVERTIR_PRODUCTOS_DIFERENTES',
                mensaje: 'Prospecto activo con productos diferentes o sin avance',
                requires_confirmation: true,
                asesores_activos: prospectosActivos.map(p => ({
                    id: p.id,
                    asesor_id: p.asesor_id,
                    asesor_nombre: p.asesor_nombre,
                    estado: p.estado,
                    fecha_registro: p.created_at
                })),
                productos_en_comun: conflictos.coincidencias
            };

        } catch (error) {
            logger.error('Error en validarProspectoDuplicado:', error);
            throw error;
        }
    }

    /**
     * Verifica conflictos de productos entre prospectos existentes y nuevos productos
     * @param {Array} prospectosActivos - Prospectos activos encontrados
     * @param {Array} productosNuevos - Códigos de productos a registrar
     * @returns {Object} { bloqueantes: [], coincidencias: [] }
     */
    static async verificarConflictosProductos(prospectosActivos, productosNuevos) {
        const bloqueantes = [];
        const coincidencias = [];

        for (const prospecto of prospectosActivos) {
            // Obtener productos del prospecto existente
            const productosExistentes = await query(`
                SELECT
                    codigo_producto,
                    descripcion_producto
                FROM prospecto_productos_interes
                WHERE prospecto_id = $1
                    AND codigo_producto IS NOT NULL
            `, [prospecto.id]);

            if (!productosExistentes.rows || productosExistentes.rows.length === 0) {
                continue;
            }

            const codigosExistentes = productosExistentes.rows.map(p => p.codigo_producto);

            // Buscar coincidencias
            const productosEnComun = productosNuevos.filter(codigo =>
                codigosExistentes.includes(codigo)
            );

            if (productosEnComun.length > 0) {
                // Si el prospecto está en Cotizado o Negociación -> BLOQUEANTE
                if (['Cotizado', 'Negociacion'].includes(prospecto.estado)) {
                    bloqueantes.push({
                        prospecto_id: prospecto.id,
                        asesor_nombre: prospecto.asesor_nombre,
                        estado: prospecto.estado,
                        productos: productosEnComun,
                        mensaje: `El asesor ${prospecto.asesor_nombre} ya está ${prospecto.estado === 'Cotizado' ? 'cotizando' : 'negociando'} los productos: ${productosEnComun.join(', ')}`
                    });
                } else {
                    // Estado Prospecto -> Solo coincidencia
                    coincidencias.push({
                        prospecto_id: prospecto.id,
                        asesor_nombre: prospecto.asesor_nombre,
                        estado: prospecto.estado,
                        productos: productosEnComun
                    });
                }
            }
        }

        return { bloqueantes, coincidencias };
    }

    /**
     * Obtener información resumida de duplicados para mostrar en UI
     * @param {string} telefono - Número de teléfono
     * @returns {Array} Lista de prospectos activos con ese teléfono
     */
    static async obtenerResumenDuplicados(telefono) {
        try {
            const result = await query(`
                SELECT
                    p.id,
                    p.codigo,
                    p.nombre_cliente,
                    p.apellido_cliente,
                    p.estado,
                    p.asesor_id,
                    p.asesor_nombre,
                    p.created_at,
                    p.valor_estimado,
                    (
                        SELECT COALESCE(
                            json_agg(
                                json_build_object(
                                    'codigo', ppi.codigo_producto,
                                    'descripcion', ppi.descripcion_producto
                                )
                            ), '[]'::json
                        )
                        FROM prospecto_productos_interes ppi
                        WHERE ppi.prospecto_id = p.id
                    ) as productos
                FROM prospectos p
                WHERE p.telefono = $1
                    AND p.activo = true
                ORDER BY p.created_at DESC
            `, [telefono]);

            return result.rows || [];
        } catch (error) {
            logger.error('Error en obtenerResumenDuplicados:', error);
            throw error;
        }
    }
}

module.exports = ValidacionDuplicados;
