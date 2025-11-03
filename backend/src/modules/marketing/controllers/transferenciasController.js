// ============================================
// CONTROLLER DE TRANSFERENCIAS Y AUSENCIAS
// ============================================

const { query } = require('../../../config/database');
const reajusteService = require('../services/reajusteService');
const actividadesService = require('../services/actividadesService');

class TransferenciasController {
    /**
     * Transferir actividad a otro usuario
     */
    static async transferirActividad(req, res) {
        try {
            const { user_id, rol } = req.user;
            const {
                actividad_id,
                usuario_destino_id,
                motivo_transferencia,
                fecha_nueva,
                duracion_nueva
            } = req.body;

            // Validar permisos
            const esJefe = ['JEFE_MARKETING', 'SUPER_ADMIN', 'GERENTE', 'ADMIN'].includes(rol);
            if (!esJefe) {
                return res.status(403).json({
                    success: false,
                    message: 'Solo el jefe de marketing puede transferir actividades'
                });
            }

            // Obtener actividad original
            const actividadResult = await query(
                'SELECT * FROM actividades_marketing WHERE id = $1',
                [actividad_id]
            );

            if (actividadResult.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Actividad no encontrada'
                });
            }

            const actividadOriginal = actividadResult.rows[0];

            // VALIDACIÓN: No permitir transferir actividades pasadas
            const ahora = new Date();
            const fechaFinPlaneada = new Date(actividadOriginal.fecha_fin_planeada);

            if (fechaFinPlaneada < ahora) {
                return res.status(400).json({
                    success: false,
                    message: 'No se puede transferir una actividad que ya venció.'
                });
            }

            // 🔒 VALIDACIÓN: Verificar que el usuario destino esté activo
            const usuarioDestinoResult = await query(
                'SELECT id, nombre, apellido, activo FROM usuarios WHERE id = $1',
                [usuario_destino_id]
            );

            if (usuarioDestinoResult.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'El usuario destino no existe'
                });
            }

            const usuarioDestino = usuarioDestinoResult.rows[0];
            if (usuarioDestino.activo === false) {
                return res.status(400).json({
                    success: false,
                    message: `No se puede transferir a ${usuarioDestino.nombre} ${usuarioDestino.apellido} porque está inactivo`,
                    usuario_inactivo: true
                });
            }

            // Calcular duración
            let duracionFinal = duracion_nueva || actividadOriginal.duracion_planeada_minutos;

            // Si la actividad ya comenzó, calcular tiempo restante
            const inicioPlaneado = new Date(actividadOriginal.fecha_inicio_planeada);

            if (ahora > inicioPlaneado && !duracion_nueva) {
                const tiempoTranscurrido = (ahora - inicioPlaneado) / 60000; // minutos
                duracionFinal = Math.max(0, actividadOriginal.duracion_planeada_minutos - tiempoTranscurrido);
            }

            // Calcular fecha de inicio para el destinatario
            const fechaInicio = fecha_nueva
                ? new Date(fecha_nueva)
                : await actividadesService.obtenerProximoSlotDisponible(usuario_destino_id);

            const fechaFin = reajusteService.agregarMinutosEfectivos(fechaInicio, duracionFinal);

            // Crear nueva actividad para el destinatario
            const codigo = await actividadesService.generarCodigoActividad();

            const insertQuery = `
                INSERT INTO actividades_marketing (
                    codigo, categoria_principal, subcategoria, descripcion,
                    usuario_id, creado_por, tipo, transferida_de,
                    motivo_transferencia, fecha_inicio_planeada, fecha_fin_planeada,
                    duracion_planeada_minutos, color_hex, estado
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'pendiente')
                RETURNING *
            `;

            const result = await query(insertQuery, [
                codigo,
                actividadOriginal.categoria_principal,
                actividadOriginal.subcategoria,
                actividadOriginal.descripcion,
                usuario_destino_id,
                user_id,
                'transferida',
                actividadOriginal.usuario_id,
                motivo_transferencia,
                fechaInicio,
                fechaFin,
                duracionFinal,
                actividadOriginal.color_hex
            ]);

            // Marcar actividad original como cancelada
            await query(`
                UPDATE actividades_marketing SET
                    estado = 'cancelada',
                    activo = false,
                    motivo_edicion = $1,
                    deleted_at = NOW()
                WHERE id = $2
            `, [`Transferida a usuario ${usuario_destino_id}: ${motivo_transferencia}`, actividad_id]);

            // Reajustar actividades del destinatario
            await reajusteService.reajustarActividades(
                usuario_destino_id,
                fechaInicio,
                duracionFinal,
                result.rows[0].id
            );

            res.json({
                success: true,
                message: 'Actividad transferida exitosamente',
                data: result.rows[0]
            });

        } catch (error) {
            console.error('Error transfiriendo actividad:', error);
            res.status(500).json({
                success: false,
                message: 'Error al transferir actividad',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }

    /**
     * Registrar ausencia (crea actividad de reemplazo)
     */
    static async registrarAusencia(req, res) {
        try {
            const { user_id, rol } = req.user;
            const {
                usuario_id,
                tipo_ausencia,
                dias_ausencia,
                motivo,
                fecha_inicio,
                actividades_a_transferir = []
            } = req.body;

            // Validar permisos - SOLO jefe de marketing y superiores pueden registrar ausencias
            const esJefe = ['JEFE_MARKETING', 'SUPER_ADMIN', 'GERENTE', 'ADMIN'].includes(rol);

            if (!esJefe) {
                return res.status(403).json({
                    success: false,
                    message: 'Solo el jefe de marketing y roles superiores pueden registrar ausencias'
                });
            }

            // Validaciones
            if (!tipo_ausencia || !dias_ausencia) {
                return res.status(400).json({
                    success: false,
                    message: 'Tipo de ausencia y días son obligatorios'
                });
            }

            // Calcular horas de ausencia (días * 9 horas efectivas)
            const horasAusencia = dias_ausencia * 9;
            const minutosAusencia = horasAusencia * 60;

            // Generar código
            const codigo = await actividadesService.generarCodigoActividad();

            // Calcular fechas
            const fechaInicioAusencia = fecha_inicio ? new Date(fecha_inicio) : new Date();
            const fechaFinAusencia = reajusteService.agregarMinutosEfectivos(
                fechaInicioAusencia,
                minutosAusencia
            );

            // Crear actividad de ausencia
            const insertQuery = `
                INSERT INTO actividades_marketing (
                    codigo, categoria_principal, subcategoria, descripcion,
                    usuario_id, creado_por, tipo, es_ausencia, tipo_ausencia,
                    dias_ausencia, fecha_inicio_planeada, fecha_fin_planeada,
                    duracion_planeada_minutos, color_hex, estado
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 'pendiente')
                RETURNING *
            `;

            const tipoAusenciaMap = {
                permiso_medico: { categoria: 'AUSENCIA', subcategoria: 'PERMISO MÉDICO', color: '#EF4444' },
                capacitacion: { categoria: 'CAPACITACIONES', subcategoria: 'PERSONAL', color: '#22C55E' },
                viaje: { categoria: 'FERIA', subcategoria: 'PRODUCCIÓN', color: '#0284C7' },
                otro: { categoria: 'AUSENCIA', subcategoria: 'OTRO', color: '#6B7280' }
            };

            const tipoInfo = tipoAusenciaMap[tipo_ausencia] || tipoAusenciaMap.otro;

            const result = await query(insertQuery, [
                codigo,
                tipoInfo.categoria,
                tipoInfo.subcategoria,
                motivo || `Ausencia por ${tipo_ausencia}`,
                usuario_id,
                user_id,
                'ausencia',
                true,
                tipo_ausencia,
                dias_ausencia,
                fechaInicioAusencia,
                fechaFinAusencia,
                minutosAusencia,
                tipoInfo.color
            ]);

            // Transferir actividades pendientes si se especificaron
            if (actividades_a_transferir.length > 0) {
                for (const transferencia of actividades_a_transferir) {
                    await this.transferirActividad({
                        user: { user_id, rol },
                        body: {
                            actividad_id: transferencia.actividad_id,
                            usuario_destino_id: transferencia.usuario_destino_id,
                            motivo_transferencia: `Ausencia de usuario: ${motivo}`
                        }
                    }, { json: () => {} }); // Mock response
                }
            }

            // Reajustar actividades del usuario
            await reajusteService.reajustarActividades(
                usuario_id,
                fechaInicioAusencia,
                minutosAusencia,
                result.rows[0].id
            );

            res.json({
                success: true,
                message: 'Ausencia registrada exitosamente',
                data: result.rows[0]
            });

        } catch (error) {
            console.error('Error registrando ausencia:', error);
            res.status(500).json({
                success: false,
                message: 'Error al registrar ausencia',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }

    /**
     * Listar ausencias
     */
    static async listarAusencias(req, res) {
        try {
            const { user_id, rol } = req.user;
            const { usuario_id, fecha_inicio, fecha_fin } = req.query;

            let whereConditions = ['es_ausencia = true', 'activo = true'];
            let params = [];
            let paramCount = 0;

            // Filtro por usuario
            const esJefe = ['JEFE_MARKETING', 'SUPER_ADMIN', 'GERENTE', 'ADMIN'].includes(rol);

            if (usuario_id && esJefe) {
                paramCount++;
                whereConditions.push(`usuario_id = $${paramCount}`);
                params.push(usuario_id);
            } else if (!esJefe) {
                paramCount++;
                whereConditions.push(`usuario_id = $${paramCount}`);
                params.push(user_id);
            }

            // Filtros de fecha
            if (fecha_inicio) {
                paramCount++;
                whereConditions.push(`fecha_inicio_planeada >= $${paramCount}`);
                params.push(fecha_inicio);
            }

            if (fecha_fin) {
                paramCount++;
                whereConditions.push(`fecha_fin_planeada <= $${paramCount}`);
                params.push(fecha_fin);
            }

            const whereClause = whereConditions.join(' AND ');

            const sql = `
                SELECT
                    a.*,
                    u.nombre || ' ' || u.apellido as usuario_nombre
                FROM actividades_marketing a
                INNER JOIN usuarios u ON a.usuario_id = u.id
                WHERE ${whereClause}
                ORDER BY a.fecha_inicio_planeada DESC
            `;

            const result = await query(sql, params);

            res.json({
                success: true,
                data: result.rows,
                total: result.rowCount
            });

        } catch (error) {
            console.error('Error listando ausencias:', error);
            res.status(500).json({
                success: false,
                message: 'Error al listar ausencias',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }
}

module.exports = TransferenciasController;
