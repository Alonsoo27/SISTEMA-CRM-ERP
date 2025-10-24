// ============================================
// CONTROLLER DE ACTIVIDADES - MARKETING
// ============================================

const { query } = require('../../../config/database');
const reajusteService = require('../services/reajusteService');
const actividadesService = require('../services/actividadesService');

// Mapeo de colores por categoría principal
const COLORES_CATEGORIAS = {
    'GRABACIONES': '#3B82F6',
    'EDICIONES': '#F59E0B',
    'LIVES': '#EC4899',
    'DISEÑO': '#A855F7',
    'FICHAS TÉCNICAS': '#64748B',
    'FERIA': '#0EA5E9',
    'REUNIONES': '#84CC16',
    'PRUEBAS Y MUESTRAS': '#F43F5E',
    'CAPACITACIONES': '#16A34A'
};

// Función helper para obtener color por categoría
function obtenerColorCategoria(categoria_principal) {
    return COLORES_CATEGORIAS[categoria_principal] || '#3B82F6'; // Azul por defecto
}

class ActividadesController {
    /**
     * Crear actividad individual
     */
    static async crearActividad(req, res) {
        try {
            const { user_id: usuarioLogueado, rol } = req.user;
            const {
                categoria_principal,
                subcategoria,
                descripcion,
                duracion_minutos,
                fecha_inicio,
                es_prioritaria = false,
                usuario_id // ID del usuario para quien se crea (opcional)
            } = req.body;

            // Determinar para quién es la actividad
            const usuarioDestino = usuario_id || usuarioLogueado;

            // Validar permisos: solo jefe+ puede crear para otros
            if (usuario_id && usuario_id !== usuarioLogueado) {
                const puedeCrearParaOtros = ['JEFE_MARKETING', 'SUPER_ADMIN', 'GERENTE', 'ADMIN'].includes(rol);
                if (!puedeCrearParaOtros) {
                    return res.status(403).json({
                        success: false,
                        message: 'Solo el jefe de marketing y superiores pueden crear actividades para otros usuarios'
                    });
                }
            }

            // Validaciones
            if (!categoria_principal || !subcategoria || !descripcion || !duracion_minutos) {
                return res.status(400).json({
                    success: false,
                    message: 'Faltan campos requeridos: categoria_principal, subcategoria, descripcion, duracion_minutos'
                });
            }

            // Validar duración
            if (duracion_minutos <= 0) {
                return res.status(400).json({
                    success: false,
                    message: 'La duración debe ser mayor a 0 minutos'
                });
            }

            // Validar duración máxima (30 días laborales = 240 horas = 14400 minutos)
            const MAX_MINUTOS = 14400;
            if (duracion_minutos > MAX_MINUTOS) {
                const diasSolicitados = Math.round(duracion_minutos / 60 / 8);
                const diasMaximos = MAX_MINUTOS / 60 / 8;
                return res.status(400).json({
                    success: false,
                    message: `La duración máxima permitida es de ${diasMaximos} días laborales. Estás intentando crear una actividad de ${diasSolicitados} días. Por favor, divide esta actividad en partes más pequeñas.`
                });
            }

            // Validar que el tipo de actividad existe
            const tipoResult = await query(
                'SELECT 1 FROM tipos_actividad_marketing WHERE categoria_principal = $1 AND subcategoria = $2',
                [categoria_principal, subcategoria]
            );

            if (tipoResult.rows.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Tipo de actividad no válido'
                });
            }

            // Obtener color por categoría principal
            const color_hex = obtenerColorCategoria(categoria_principal);

            // Generar código único
            const codigo = await actividadesService.generarCodigoActividad();

            // Calcular fecha de inicio
            let fechaInicioPlaneada;
            if (fecha_inicio) {
                fechaInicioPlaneada = new Date(fecha_inicio);
                console.log('📅 Usando fecha_inicio MANUAL:', fecha_inicio);
            } else {
                // Buscar el próximo slot disponible para el usuario destino
                fechaInicioPlaneada = await actividadesService.obtenerProximoSlotDisponible(usuarioDestino);
                console.log('📅 Usando fecha_inicio AUTOMÁTICA:', fechaInicioPlaneada);
            }

            // Calcular fecha fin usando el servicio de reajuste
            const fechaFinPlaneada = reajusteService.agregarMinutosEfectivos(
                new Date(fechaInicioPlaneada),
                duracion_minutos
            );

            console.log('📅 Creando actividad:', {
                usuarioDestino,
                usuarioLogueado,
                fecha_inicio_recibida: fecha_inicio || 'NO ENVIADA (automático)',
                fechaInicioPlaneada,
                fechaFinPlaneada,
                duracion_minutos
            });

            // Registrar huecos pasados si es necesario
            await actividadesService.registrarHuecosPasados(usuarioDestino, fechaInicioPlaneada);

            // Insertar actividad
            const insertQuery = `
                INSERT INTO actividades_marketing (
                    codigo, categoria_principal, subcategoria, descripcion,
                    usuario_id, creado_por, tipo, es_prioritaria,
                    fecha_inicio_planeada, fecha_fin_planeada, duracion_planeada_minutos,
                    color_hex, estado
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'pendiente')
                RETURNING *
            `;

            const result = await query(insertQuery, [
                codigo,
                categoria_principal,
                subcategoria,
                descripcion,
                usuarioDestino,      // Para quién es la actividad
                usuarioLogueado,     // Quién la creó
                'individual',
                es_prioritaria,
                fechaInicioPlaneada,
                fechaFinPlaneada,
                duracion_minutos,
                color_hex
            ]);

            const actividad = result.rows[0];

            // Si es prioritaria, reajustar actividades existentes
            if (es_prioritaria) {
                await reajusteService.reajustarActividades(
                    usuarioDestino,
                    fechaInicioPlaneada,
                    duracion_minutos,
                    actividad.id
                );
            }

            res.status(201).json({
                success: true,
                message: 'Actividad creada exitosamente',
                data: actividad
            });

        } catch (error) {
            console.error('Error creando actividad:', error);
            res.status(500).json({
                success: false,
                message: 'Error al crear actividad',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }

    /**
     * Crear actividad grupal (solo JEFE_MARKETING)
     */
    static async crearActividadGrupal(req, res) {
        try {
            const { user_id, rol } = req.user;
            const {
                categoria_principal,
                subcategoria,
                descripcion,
                duracion_minutos,
                fecha_inicio,
                participantes_ids
            } = req.body;

            // Validar que sea jefe de marketing
            if (rol !== 'JEFE_MARKETING' && !['SUPER_ADMIN', 'GERENTE'].includes(rol)) {
                return res.status(403).json({
                    success: false,
                    message: 'Solo el Jefe de Marketing puede crear actividades grupales'
                });
            }

            // Validaciones
            if (!participantes_ids || participantes_ids.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Debe seleccionar al menos un participante'
                });
            }

            // Validar duración
            if (duracion_minutos <= 0) {
                return res.status(400).json({
                    success: false,
                    message: 'La duración debe ser mayor a 0 minutos'
                });
            }

            // Validar duración máxima (30 días laborales)
            const MAX_MINUTOS = 14400;
            if (duracion_minutos > MAX_MINUTOS) {
                const diasSolicitados = Math.round(duracion_minutos / 60 / 8);
                const diasMaximos = MAX_MINUTOS / 60 / 8;
                return res.status(400).json({
                    success: false,
                    message: `La duración máxima permitida es de ${diasMaximos} días laborales. Estás intentando crear una actividad de ${diasSolicitados} días. Por favor, divide esta actividad en partes más pequeñas.`
                });
            }

            // Validar que el tipo de actividad existe
            const tipoResult = await query(
                'SELECT 1 FROM tipos_actividad_marketing WHERE categoria_principal = $1 AND subcategoria = $2',
                [categoria_principal, subcategoria]
            );

            if (tipoResult.rows.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Tipo de actividad no válido'
                });
            }

            // Obtener color por categoría principal
            const color_hex = obtenerColorCategoria(categoria_principal);
            const codigo = await actividadesService.generarCodigoActividad();

            const fechaInicioPlaneada = new Date(fecha_inicio);
            const fechaFinPlaneada = reajusteService.agregarMinutosEfectivos(
                fechaInicioPlaneada,
                duracion_minutos
            );

            // Crear actividad para cada participante
            const actividadesCreadas = [];

            for (const participante_id of participantes_ids) {
                const insertQuery = `
                    INSERT INTO actividades_marketing (
                        codigo, categoria_principal, subcategoria, descripcion,
                        usuario_id, creado_por, tipo, es_grupal, es_prioritaria,
                        participantes_ids, fecha_inicio_planeada, fecha_fin_planeada,
                        duracion_planeada_minutos, color_hex, estado
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 'pendiente')
                    RETURNING *
                `;

                const result = await query(insertQuery, [
                    `${codigo}-U${participante_id}`,
                    categoria_principal,
                    subcategoria,
                    descripcion,
                    participante_id,
                    user_id,
                    'grupal',
                    true,
                    true, // Las actividades grupales son prioritarias
                    participantes_ids,
                    fechaInicioPlaneada,
                    fechaFinPlaneada,
                    duracion_minutos,
                    color_hex
                ]);

                actividadesCreadas.push(result.rows[0]);

                // Reajustar actividades de cada participante
                await reajusteService.reajustarActividades(
                    participante_id,
                    fechaInicioPlaneada,
                    duracion_minutos,
                    result.rows[0].id
                );
            }

            res.status(201).json({
                success: true,
                message: 'Actividad grupal creada exitosamente',
                data: actividadesCreadas
            });

        } catch (error) {
            console.error('Error creando actividad grupal:', error);
            res.status(500).json({
                success: false,
                message: 'Error al crear actividad grupal',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }

    /**
     * Listar actividades con filtros
     */
    static async listarActividades(req, res) {
        try {
            const { user_id, rol } = req.user;
            const {
                usuario_id,
                estado,
                fecha_inicio,
                fecha_fin,
                categoria_principal,
                vista = 'semanal'
            } = req.query;

            let whereConditions = ['a.activo = true'];
            let params = [];
            let paramCount = 0;

            // Filtro por usuario
            const esJefe = ['JEFE_MARKETING', 'SUPER_ADMIN', 'GERENTE', 'ADMIN'].includes(rol);

            if (usuario_id && esJefe) {
                paramCount++;
                whereConditions.push(`a.usuario_id = $${paramCount}`);
                params.push(usuario_id);
            } else if (!usuario_id) {
                paramCount++;
                whereConditions.push(`a.usuario_id = $${paramCount}`);
                params.push(user_id);
            }

            // Filtro por estado
            if (estado) {
                paramCount++;
                whereConditions.push(`a.estado = $${paramCount}`);
                params.push(estado);
            }

            // Filtro por fechas
            if (fecha_inicio) {
                paramCount++;
                whereConditions.push(`a.fecha_inicio_planeada >= $${paramCount}`);
                params.push(fecha_inicio);
            }

            if (fecha_fin) {
                paramCount++;
                whereConditions.push(`a.fecha_fin_planeada <= $${paramCount}`);
                params.push(fecha_fin);
            }

            // Filtro por categoría
            if (categoria_principal) {
                paramCount++;
                whereConditions.push(`a.categoria_principal = $${paramCount}`);
                params.push(categoria_principal);
            }

            const whereClause = whereConditions.join(' AND ');

            const sql = `
                SELECT
                    a.*,
                    u.nombre || ' ' || u.apellido as usuario_nombre,
                    c.nombre || ' ' || c.apellido as creado_por_nombre
                FROM actividades_marketing a
                INNER JOIN usuarios u ON a.usuario_id = u.id
                INNER JOIN usuarios c ON a.creado_por = c.id
                WHERE ${whereClause}
                ORDER BY a.fecha_inicio_planeada ASC
            `;

            const result = await query(sql, params);

            res.json({
                success: true,
                data: result.rows,
                total: result.rowCount
            });

        } catch (error) {
            console.error('Error listando actividades:', error);
            res.status(500).json({
                success: false,
                message: 'Error al listar actividades',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }

    /**
     * Obtener actividad por ID
     */
    static async obtenerActividad(req, res) {
        try {
            const { id } = req.params;

            const result = await query(`
                SELECT
                    a.*,
                    u.nombre || ' ' || u.apellido as usuario_nombre,
                    c.nombre || ' ' || c.apellido as creado_por_nombre
                FROM actividades_marketing a
                INNER JOIN usuarios u ON a.usuario_id = u.id
                INNER JOIN usuarios c ON a.creado_por = c.id
                WHERE a.id = $1
            `, [id]);

            if (result.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Actividad no encontrada'
                });
            }

            res.json({
                success: true,
                data: result.rows[0]
            });

        } catch (error) {
            console.error('Error obteniendo actividad:', error);
            res.status(500).json({
                success: false,
                message: 'Error al obtener actividad',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }

    /**
     * Editar actividad (requiere motivo)
     */
    static async editarActividad(req, res) {
        try {
            const { id } = req.params;
            const { user_id } = req.user;
            const { motivo_edicion, duracion_minutos, fecha_inicio } = req.body;

            if (!motivo_edicion) {
                return res.status(400).json({
                    success: false,
                    message: 'El motivo de edición es obligatorio'
                });
            }

            // Obtener actividad actual
            const actividadActual = await query('SELECT * FROM actividades_marketing WHERE id = $1', [id]);

            if (actividadActual.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Actividad no encontrada'
                });
            }

            const actividad = actividadActual.rows[0];

            // Calcular nueva fecha fin si cambia duración
            let nuevaFechaFin = actividad.fecha_fin_planeada;
            if (duracion_minutos && duracion_minutos !== actividad.duracion_planeada_minutos) {
                const fechaInicio = fecha_inicio ? new Date(fecha_inicio) : new Date(actividad.fecha_inicio_planeada);
                nuevaFechaFin = reajusteService.agregarMinutosEfectivos(fechaInicio, duracion_minutos);
            }

            // Actualizar actividad
            const updateQuery = `
                UPDATE actividades_marketing SET
                    duracion_planeada_minutos = COALESCE($1, duracion_planeada_minutos),
                    fecha_inicio_planeada = COALESCE($2, fecha_inicio_planeada),
                    fecha_fin_planeada = $3,
                    editada = true,
                    motivo_edicion = $4,
                    editada_por = $5,
                    editada_en = NOW()
                WHERE id = $6
                RETURNING *
            `;

            const result = await query(updateQuery, [
                duracion_minutos,
                fecha_inicio,
                nuevaFechaFin,
                motivo_edicion,
                user_id,
                id
            ]);

            // Reajustar actividades posteriores
            if (duracion_minutos || fecha_inicio) {
                await reajusteService.reajustarActividades(
                    actividad.usuario_id,
                    fecha_inicio || actividad.fecha_inicio_planeada,
                    duracion_minutos || actividad.duracion_planeada_minutos,
                    id
                );
            }

            res.json({
                success: true,
                message: 'Actividad editada exitosamente',
                data: result.rows[0]
            });

        } catch (error) {
            console.error('Error editando actividad:', error);
            res.status(500).json({
                success: false,
                message: 'Error al editar actividad',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }

    /**
     * Extender tiempo de actividad
     */
    static async extenderActividad(req, res) {
        try {
            const { id } = req.params;
            const { user_id } = req.user;
            const { minutos_adicionales, motivo } = req.body;

            if (!minutos_adicionales || minutos_adicionales <= 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Los minutos adicionales deben ser mayor a 0'
                });
            }

            // Registrar extensión
            await query(`
                INSERT INTO extensiones_actividades (actividad_id, usuario_id, minutos_adicionales, motivo)
                VALUES ($1, $2, $3, $4)
            `, [id, user_id, minutos_adicionales, motivo]);

            // Actualizar actividad
            const updateQuery = `
                UPDATE actividades_marketing SET
                    tiempo_adicional_minutos = tiempo_adicional_minutos + $1,
                    fecha_fin_planeada = fecha_fin_planeada + ($1 || ' minutes')::interval
                WHERE id = $2
                RETURNING *
            `;

            const result = await query(updateQuery, [minutos_adicionales, id]);

            // Reajustar actividades posteriores
            const actividad = result.rows[0];
            await reajusteService.reajustarActividades(
                actividad.usuario_id,
                actividad.fecha_inicio_planeada,
                actividad.duracion_planeada_minutos + minutos_adicionales,
                id
            );

            res.json({
                success: true,
                message: 'Actividad extendida exitosamente',
                data: result.rows[0]
            });

        } catch (error) {
            console.error('Error extendiendo actividad:', error);
            res.status(500).json({
                success: false,
                message: 'Error al extender actividad',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }

    /**
     * Completar actividad
     */
    static async completarActividad(req, res) {
        try {
            const { id } = req.params;

            const result = await query(`
                UPDATE actividades_marketing SET
                    estado = 'completada',
                    fecha_fin_real = NOW(),
                    duracion_real_minutos = EXTRACT(EPOCH FROM (NOW() - fecha_inicio_real)) / 60
                WHERE id = $1
                RETURNING *
            `, [id]);

            if (result.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Actividad no encontrada'
                });
            }

            res.json({
                success: true,
                message: 'Actividad completada exitosamente',
                data: result.rows[0]
            });

        } catch (error) {
            console.error('Error completando actividad:', error);
            res.status(500).json({
                success: false,
                message: 'Error al completar actividad',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }

    /**
     * Cancelar actividad
     */
    static async cancelarActividad(req, res) {
        try {
            const { id } = req.params;
            const { user_id } = req.user;
            const { motivo } = req.body;

            const result = await query(`
                UPDATE actividades_marketing SET
                    estado = 'cancelada',
                    activo = false,
                    editada = true,
                    motivo_edicion = $1,
                    editada_por = $2,
                    editada_en = NOW(),
                    deleted_at = NOW()
                WHERE id = $3
                RETURNING *
            `, [motivo, user_id, id]);

            if (result.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Actividad no encontrada'
                });
            }

            res.json({
                success: true,
                message: 'Actividad cancelada exitosamente',
                data: result.rows[0]
            });

        } catch (error) {
            console.error('Error cancelando actividad:', error);
            res.status(500).json({
                success: false,
                message: 'Error al cancelar actividad',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }
}

module.exports = ActividadesController;
