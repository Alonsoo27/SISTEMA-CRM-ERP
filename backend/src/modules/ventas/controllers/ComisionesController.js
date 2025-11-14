// ============================================
// BONOS CONTROLLER - SISTEMA EXTENDIDO  
// Sistema CRM/ERP v2.0 - Bonos por Metas + Actividad
// ============================================

const { query } = require('../../../config/database');

class ComisionesController {

    // ============================================
    // TABLA DE BONOS SEGÚN META ASIGNADA - ESCALA REAL
    // ============================================
    static BONOS_POR_META = [
        // Metas para nuevos (3 meses iniciales)
        { meta_usd: 2500, bono_100: 92.00, bono_90: 46.00, bono_80: null },
        
        // Metas progresivas según desempeño
        { meta_usd: 4000, bono_100: 144.80, bono_90: 72.40, bono_80: null },
        { meta_usd: 5000, bono_100: 197.25, bono_90: 98.63, bono_80: null },
        
        // Meta máxima práctica (mayoría de asesores)
        { meta_usd: 8000, bono_100: 276.00, bono_90: 138.00, bono_80: 69.00 },
        
        // Metas excepcionales (top performers)
        { meta_usd: 9500, bono_100: 343.90, bono_90: null, bono_80: null },
        { meta_usd: 10500, bono_100: 416.85, bono_90: null, bono_80: null },
        { meta_usd: 11500, bono_100: 448.50, bono_90: null, bono_80: null },
        { meta_usd: 12500, bono_100: 487.50, bono_90: null, bono_80: null },
        { meta_usd: 14000, bono_100: 658.00, bono_90: null, bono_80: null },
        { meta_usd: 16000, bono_100: 739.20, bono_90: null, bono_80: null },
        { meta_usd: 20000, bono_100: 980.00, bono_90: null, bono_80: null },
        { meta_usd: 24000, bono_100: 1320.00, bono_90: null, bono_80: null }
    ];

    // ============================================
    // CALCULAR BONO BASADO EN META INDIVIDUAL (ORIGINAL)
    // ============================================
    static calcularBono(metaUsd, ventasUsd) {
        // Convertir a números para comparación correcta
        const metaNumero = parseFloat(metaUsd);
        const ventasNumero = parseFloat(ventasUsd);

        // Buscar configuración de bono para esta meta específica
        const bonoConfig = ComisionesController.BONOS_POR_META.find(b => b.meta_usd === metaNumero);

        if (!bonoConfig) {
            console.warn(`No hay configuración de bono para meta ${metaNumero}`);
            return {
                porcentaje: Math.round((ventasNumero / metaNumero) * 100),
                bono: 0,
                nivel: 'sin_bono',
                mensaje: `Meta ${metaNumero} no tiene bonos configurados`
            };
        }

        const porcentaje = Math.round((ventasNumero / metaNumero) * 100);

        // Lógica: Solo recibes bono si alcanzas al menos 80% de TU meta específica
        if (porcentaje >= 100) {
            return {
                porcentaje,
                bono: bonoConfig.bono_100,
                nivel: '100%',
                mensaje: `Meta cumplida al 100%`
            };
        } else if (porcentaje >= 90 && bonoConfig.bono_90) {
            return {
                porcentaje,
                bono: bonoConfig.bono_90,
                nivel: '90%',
                mensaje: `90% de tu meta`
            };
        } else if (porcentaje >= 80 && bonoConfig.bono_80) {
            return {
                porcentaje,
                bono: bonoConfig.bono_80,
                nivel: '80%',
                mensaje: `80% de tu meta`
            };
        } else {
            return {
                porcentaje,
                bono: 0,
                nivel: 'sin_bono',
                mensaje: `Necesitas llegar al 80% de tu meta (${metaNumero}) para recibir bono`
            };
        }
    }

    // ============================================
    // CALCULAR MEJOR BONO DISPONIBLE (NUEVA LÓGICA)
    // Busca el mejor bono alcanzable, incluyendo metas opcionales superiores
    // ============================================
    static calcularMejorBono(metaUsd, ventasUsd) {
        const metaNumero = parseFloat(metaUsd);
        const ventasNumero = parseFloat(ventasUsd);

        // 1. Calcular bono de tu meta asignada
        const bonoMetaAsignada = ComisionesController.calcularBono(metaUsd, ventasUsd);

        // 2. Verificar si alcanzaste bonos de metas SUPERIORES (solo al 100%)
        let mejorBono = {
            ...bonoMetaAsignada,
            meta_alcanzada: metaNumero
        };

        // Buscar metas superiores que haya alcanzado al 100%
        for (const metaConfig of ComisionesController.BONOS_POR_META) {
            // Solo verificar metas SUPERIORES a la asignada
            if (metaConfig.meta_usd > metaNumero && ventasNumero >= metaConfig.meta_usd) {
                // Si alcanzó el 100% de esta meta superior
                if (metaConfig.bono_100 > mejorBono.bono) {
                    mejorBono = {
                        porcentaje: Math.round((ventasNumero / metaNumero) * 100), // Porcentaje respecto a tu meta original
                        bono: metaConfig.bono_100,
                        nivel: `Meta ${metaConfig.meta_usd} (100%)`,
                        mensaje: `Meta opcional ${metaConfig.meta_usd} alcanzada`,
                        meta_alcanzada: metaConfig.meta_usd
                    };
                }
            }
        }

        return mejorBono;
    }

    // ============================================
    // NUEVO: CALCULAR BONO CON ACTIVIDAD
    // ============================================
    static async calcularBonoConActividad(asesor_id, metaUsd, ventasUsd, año, mes) {
        try {
            const metaNumero = parseFloat(metaUsd);
            const ventasNumero = parseFloat(ventasUsd);

            // 1. Calcular bono base por ventas (incluyendo metas opcionales)
            const bonoVentas = ComisionesController.calcularMejorBono(metaUsd, ventasUsd);
            
            // 2. Obtener métricas de actividad del mes
            const actividadResult = await query(`
                SELECT 
                    COALESCE(SUM(total_mensajes_recibidos), 0) as total_mensajes,
                    COALESCE(SUM(total_llamadas), 0) as total_llamadas,
                    COUNT(*) as dias_activos
                FROM actividad_diaria 
                WHERE usuario_id = $1 
                AND EXTRACT(YEAR FROM fecha) = $2 
                AND EXTRACT(MONTH FROM fecha) = $3
            `, [asesor_id, año, mes]);

            const actividad = actividadResult.rows[0] || { 
                total_mensajes: 0, 
                total_llamadas: 0, 
                dias_activos: 0 
            };

            // 3. Obtener ventas del mes para conversiones
            const ventasResult = await query(`
                SELECT COUNT(*) as ventas_mes
                FROM ventas v
                INNER JOIN metas_ventas mv ON v.asesor_id = mv.asesor_id
                WHERE v.asesor_id = $1 
                AND v.estado_detallado LIKE 'vendido%'
                AND EXTRACT(YEAR FROM v.fecha_creacion) = $2
                AND EXTRACT(MONTH FROM v.fecha_creacion) = $3
                AND mv.año = $2 AND mv.mes = $3
            `, [asesor_id, año, mes]);

            const ventasMes = parseInt(ventasResult.rows[0]?.ventas_mes || 0);

            // 4. Obtener configuración de metas de actividad
            const configActividadResult = await query(`
                SELECT 
                    t.nombre as tipo_meta,
                    c.valor_minimo,
                    c.valor_objetivo
                FROM tipos_meta_actividad t
                INNER JOIN configuracion_metas_actividad c ON t.id = c.tipo_meta_id
                WHERE t.activo = true AND c.activo = true
            `);

            const configActividad = {};
            configActividadResult.rows.forEach(row => {
                configActividad[row.tipo_meta] = {
                    minimo: parseFloat(row.valor_minimo),
                    objetivo: parseFloat(row.valor_objetivo)
                };
            });

            // 5. Calcular conversiones
            const conversionMensajes = actividad.total_mensajes > 0 ? 
                (ventasMes / actividad.total_mensajes) * 100 : 0;
            const conversionLlamadas = actividad.total_llamadas > 0 ? 
                (ventasMes / actividad.total_llamadas) * 100 : 0;

            // 6. Evaluar cumplimiento de metas de actividad
            let cumpleActividad = true;
            let penalizacion = 0;
            const detallesActividad = [];

            if (configActividad['conversion_mensajes']) {
                const config = configActividad['conversion_mensajes'];
                if (conversionMensajes < config.minimo) {
                    cumpleActividad = false;
                    penalizacion += 25; // 25% de penalización
                    detallesActividad.push({
                        tipo: 'conversion_mensajes',
                        actual: conversionMensajes.toFixed(2),
                        requerido: config.minimo,
                        cumple: false
                    });
                } else {
                    detallesActividad.push({
                        tipo: 'conversion_mensajes',
                        actual: conversionMensajes.toFixed(2),
                        requerido: config.minimo,
                        cumple: true
                    });
                }
            }

            if (configActividad['conversion_llamadas']) {
                const config = configActividad['conversion_llamadas'];
                if (conversionLlamadas < config.minimo) {
                    cumpleActividad = false;
                    penalizacion += 25; // 25% de penalización
                    detallesActividad.push({
                        tipo: 'conversion_llamadas',
                        actual: conversionLlamadas.toFixed(2),
                        requerido: config.minimo,
                        cumple: false
                    });
                } else {
                    detallesActividad.push({
                        tipo: 'conversion_llamadas',
                        actual: conversionLlamadas.toFixed(2),
                        requerido: config.minimo,
                        cumple: true
                    });
                }
            }

            // 7. Aplicar penalización si no cumple actividad
            let bonoFinal = bonoVentas.bono;
            let nivelFinal = bonoVentas.nivel;
            let mensajeFinal = bonoVentas.mensaje;

            if (!cumpleActividad && bonoFinal > 0) {
                const factorPenalizacion = Math.max(0, (100 - penalizacion) / 100);
                bonoFinal = bonoFinal * factorPenalizacion;
                nivelFinal = `${bonoVentas.nivel} - Penalizado ${penalizacion}%`;
                mensajeFinal = `${bonoVentas.mensaje} (Penalizado por no cumplir metas de actividad)`;
            }

            return {
                // Resultado de ventas
                porcentaje_ventas: bonoVentas.porcentaje,
                bono_base_ventas: bonoVentas.bono,
                
                // Métricas de actividad
                actividad: {
                    total_mensajes: parseInt(actividad.total_mensajes),
                    total_llamadas: parseInt(actividad.total_llamadas),
                    dias_activos: parseInt(actividad.dias_activos),
                    ventas_mes: ventasMes,
                    conversion_mensajes: parseFloat(conversionMensajes.toFixed(2)),
                    conversion_llamadas: parseFloat(conversionLlamadas.toFixed(2))
                },
                
                // Evaluación de actividad
                cumple_actividad: cumpleActividad,
                detalles_actividad: detallesActividad,
                penalizacion: penalizacion,
                
                // Resultado final
                bono_final: parseFloat(bonoFinal.toFixed(2)),
                nivel: nivelFinal,
                mensaje: mensajeFinal
            };

        } catch (error) {
            console.error('Error calculando bono con actividad:', error);
            // Fallback al cálculo simple
            const bonoSimple = ComisionesController.calcularBono(metaUsd, ventasUsd);
            return {
                ...bonoSimple,
                error: 'Error calculando actividad, usando solo ventas',
                actividad: null
            };
        }
    }

    // ============================================
    // OBTENER BONO ACTUAL DEL ASESOR (VERSIÓN MEJORADA)
    // ============================================
    static async obtenerBonoActual(req, res) {
        try {
            console.log('Iniciando obtenerBonoActual - Params:', req.params);

            const { asesor_id } = req.params;
            const userId = req.user?.user_id || req.user?.id;

            // requireOwnership middleware ya validó permisos
            const targetAsesorId = asesor_id || userId;

            // Obtener meta actual del asesor
            const metaResult = await query(`
                SELECT 
                    asesor_id,
                    año,
                    mes,
                    meta_valor,
                    valor_logrado,
                    porcentaje_valor,
                    ventas_logradas
                FROM metas_ventas
                WHERE asesor_id = $1 
                AND año = EXTRACT(YEAR FROM CURRENT_DATE)
                AND mes = EXTRACT(MONTH FROM CURRENT_DATE)
                AND activo = true
                LIMIT 1
            `, [targetAsesorId]);

            if (metaResult.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'No hay meta asignada para este asesor en el mes actual'
                });
            }

            const meta = metaResult.rows[0];

            // ============================================
            // FIX: Calcular ventas REALES del mes directamente desde tabla ventas
            // ============================================
            const ventasRealesResult = await query(`
                SELECT
                    COALESCE(SUM(valor_final), 0) as total_vendido,
                    COUNT(*) as cantidad_ventas
                FROM ventas
                WHERE asesor_id = $1
                    AND estado_detallado LIKE 'vendido%'
                    AND EXTRACT(YEAR FROM fecha_venta) = $2
                    AND EXTRACT(MONTH FROM fecha_venta) = $3
                    AND activo = true
            `, [targetAsesorId, meta.año, meta.mes]);

            const ventasReales = ventasRealesResult.rows[0];
            const valorLogradoReal = parseFloat(ventasReales.total_vendido) || 0;
            const ventasLogradasReal = parseInt(ventasReales.cantidad_ventas) || 0;

            console.log(`✅ Ventas reales del asesor ${targetAsesorId}: $${valorLogradoReal} (${ventasLogradasReal} ventas)`);

            // Obtener configuración de modalidad del asesor
            const modalidadResult = await query(`
                SELECT 
                    mb.nombre as modalidad_nombre,
                    mb.descripcion,
                    acb.meses_experiencia
                FROM asesor_configuracion_bonos acb
                INNER JOIN modalidades_bono mb ON acb.modalidad_bono_id = mb.id
                WHERE acb.asesor_id = $1 AND acb.activo = true
                ORDER BY acb.created_at DESC
                LIMIT 1
            `, [targetAsesorId]);

            const modalidad = modalidadResult.rows[0]?.modalidad_nombre || 'solo_ventas';

            // Obtener nombre del asesor
            const asesorResult = await query(`
                SELECT nombre, apellido FROM usuarios WHERE id = $1
            `, [targetAsesorId]);

            const asesorNombre = asesorResult.rows[0] ? 
                `${asesorResult.rows[0].nombre} ${asesorResult.rows[0].apellido}` : 
                `Asesor ${targetAsesorId}`;

            let calculoFinal;
            let siguienteNivel;

            // Calcular bono según modalidad (usando ventas REALES, no de metas_ventas)
            if (modalidad === 'ventas_actividad') {
                console.log('Calculando bono con actividad para asesor:', targetAsesorId);
                calculoFinal = await ComisionesController.calcularBonoConActividad(
                    targetAsesorId,
                    meta.meta_valor,
                    valorLogradoReal,  // ✅ Usar ventas reales
                    meta.año,
                    meta.mes
                );
                siguienteNivel = ComisionesController.calcularSiguienteNivel(meta.meta_valor, valorLogradoReal);
            } else {
                console.log('Calculando bono solo por ventas para asesor:', targetAsesorId);
                // ✅ Usar calcularMejorBono en lugar de calcularBono para incluir metas opcionales
                const bonoSimple = ComisionesController.calcularMejorBono(meta.meta_valor, valorLogradoReal);
                calculoFinal = {
                    porcentaje_ventas: bonoSimple.porcentaje,
                    bono_final: bonoSimple.bono,
                    nivel: bonoSimple.nivel,
                    mensaje: bonoSimple.mensaje,
                    modalidad: 'solo_ventas',
                    meta_alcanzada: bonoSimple.meta_alcanzada
                };
                siguienteNivel = ComisionesController.calcularSiguienteNivel(meta.meta_valor, valorLogradoReal);
            }

            console.log(`Bono calculado para asesor ${targetAsesorId}: ${calculoFinal.porcentaje_ventas}% = ${calculoFinal.bono_final}`);

            // Calcular porcentaje de meta (siempre disponible, usando ventas reales)
            const porcentajeMeta = meta.meta_valor > 0 ?
                Math.round((valorLogradoReal / parseFloat(meta.meta_valor)) * 100) : 0;

            res.json({
                success: true,
                data: {
                    asesor: {
                        id: targetAsesorId,
                        nombre: asesorNombre,
                        meta_usd: parseFloat(meta.meta_valor),
                        vendido_usd: valorLogradoReal,  // ✅ Usar ventas reales
                        ventas_cantidad: ventasLogradasReal,  // ✅ Usar cantidad real
                        modalidad: modalidad
                    },
                    bono_actual: {
                        porcentaje: calculoFinal.porcentaje_ventas || calculoFinal.porcentaje || porcentajeMeta,
                        bono_usd: calculoFinal.bono_final || 0,
                        nivel: calculoFinal.nivel,
                        mensaje: calculoFinal.mensaje,
                        modalidad_aplicada: modalidad
                    },
                    actividad: calculoFinal.actividad || null,
                    detalles_actividad: calculoFinal.detalles_actividad || null,
                    siguiente_nivel: siguienteNivel,
                    timestamp: new Date().toISOString()
                }
            });

        } catch (error) {
            console.error('Error detallado en obtenerBonoActual:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor',
                debug_error: error.message
            });
        }
    }

    // ============================================
    // CALCULAR SIGUIENTE NIVEL DE BONO (SIN CAMBIOS)
    // ============================================
    static calcularSiguienteNivel(metaUsd, ventasActuales) {
        const metaNumero = parseFloat(metaUsd);
        const ventasNumero = parseFloat(ventasActuales);
        
        const bonoConfig = ComisionesController.BONOS_POR_META.find(b => b.meta_usd === metaNumero);
        
        if (!bonoConfig) {
            return null;
        }

        const porcentajeActual = (ventasNumero / metaNumero) * 100;

        if (porcentajeActual < 80) {
            const necesario = (metaNumero * 0.8) - ventasNumero;
            return {
                objetivo: '80%',
                bono_objetivo: bonoConfig.bono_80 || 0,
                falta_usd: Math.max(0, Math.round(necesario)),
                mensaje: `Faltan ${Math.round(necesario)} para el primer bono`
            };
        } else if (porcentajeActual < 90 && bonoConfig.bono_90) {
            const necesario = (metaNumero * 0.9) - ventasNumero;
            return {
                objetivo: '90%',
                bono_objetivo: bonoConfig.bono_90,
                falta_usd: Math.max(0, Math.round(necesario)),
                mensaje: `Faltan ${Math.round(necesario)} para el siguiente nivel`
            };
        } else if (porcentajeActual < 100) {
            const necesario = metaNumero - ventasNumero;
            return {
                objetivo: '100%',
                bono_objetivo: bonoConfig.bono_100,
                falta_usd: Math.max(0, Math.round(necesario)),
                mensaje: `Faltan ${Math.round(necesario)} para el bono máximo`
            };
        } else {
            return {
                objetivo: 'COMPLETADO',
                bono_objetivo: bonoConfig.bono_100,
                falta_usd: 0,
                mensaje: 'Meta cumplida'
            };
        }
    }

    // ============================================
    // DASHBOARD DE BONOS POR EQUIPO (MEJORADO)
    // ============================================
    static async dashboardEquipo(req, res) {
        try {
            const userRole = req.user?.rol || 'asesor';

            if (!['ADMIN', 'SUPER_ADMIN', 'GERENTE', 'JEFE_VENTAS'].includes(userRole)) {
                return res.status(403).json({
                    success: false,
                    message: 'Sin permisos para ver dashboard de equipo'
                });
            }

            // Obtener todas las metas del mes actual con modalidades
            const metasResult = await query(`
                SELECT 
                    m.*,
                    u.nombre,
                    u.apellido,
                    r.nombre as rol,
                    COALESCE(mb.nombre, 'solo_ventas') as modalidad
                FROM metas_ventas m
                LEFT JOIN usuarios u ON m.asesor_id = u.id
                LEFT JOIN roles r ON u.rol_id = r.id
                LEFT JOIN asesor_configuracion_bonos acb ON m.asesor_id = acb.asesor_id AND acb.activo = true
                LEFT JOIN modalidades_bono mb ON acb.modalidad_bono_id = mb.id
                WHERE m.año = EXTRACT(YEAR FROM CURRENT_DATE)
                AND m.mes = EXTRACT(MONTH FROM CURRENT_DATE)
                AND m.activo = true
                ORDER BY m.porcentaje_valor DESC
            `);

            const equipoConBonos = await Promise.all(
                metasResult.rows.map(async (meta) => {
                    let calculo;

                    if (meta.modalidad === 'ventas_actividad') {
                        calculo = await ComisionesController.calcularBonoConActividad(
                            meta.asesor_id,
                            meta.meta_valor,
                            meta.valor_logrado,
                            meta.año,
                            meta.mes
                        );
                    } else {
                        // ✅ Usar calcularMejorBono para incluir metas opcionales
                        const bonoSimple = ComisionesController.calcularMejorBono(meta.meta_valor, meta.valor_logrado);
                        calculo = {
                            porcentaje_ventas: bonoSimple.porcentaje,
                            bono_final: bonoSimple.bono,
                            nivel: bonoSimple.nivel,
                            actividad: null
                        };
                    }

                    const siguiente = ComisionesController.calcularSiguienteNivel(meta.meta_valor, meta.valor_logrado);

                    return {
                        asesor_id: meta.asesor_id,
                        nombre: `${meta.nombre} ${meta.apellido}`,
                        rol: meta.rol,
                        modalidad: meta.modalidad,
                        meta_usd: parseFloat(meta.meta_valor),
                        vendido_usd: parseFloat(meta.valor_logrado),
                        ventas_cantidad: meta.ventas_logradas,
                        porcentaje: calculo.porcentaje_ventas || calculo.porcentaje,
                        bono_usd: calculo.bono_final,
                        nivel: calculo.nivel,
                        actividad: calculo.actividad,
                        siguiente_objetivo: siguiente
                    };
                })
            );

            // Cálculos de resumen
            const totalMetas = equipoConBonos.reduce((sum, e) => sum + e.meta_usd, 0);
            const totalVendido = equipoConBonos.reduce((sum, e) => sum + e.vendido_usd, 0);
            const totalBonos = equipoConBonos.reduce((sum, e) => sum + e.bono_usd, 0);
            const promedioEquipo = totalMetas > 0 ? Math.round((totalVendido / totalMetas) * 100) : 0;

            console.log(`Dashboard equipo generado: ${equipoConBonos.length} asesores`);

            res.json({
                success: true,
                data: {
                    periodo: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`,
                    equipo: equipoConBonos,
                    resumen: {
                        total_asesores: equipoConBonos.length,
                        solo_ventas: equipoConBonos.filter(e => e.modalidad === 'solo_ventas').length,
                        ventas_actividad: equipoConBonos.filter(e => e.modalidad === 'ventas_actividad').length,
                        meta_total_usd: totalMetas,
                        vendido_total_usd: totalVendido,
                        bonos_total_usd: totalBonos,
                        promedio_cumplimiento: promedioEquipo,
                        asesores_con_bono: equipoConBonos.filter(e => e.bono_usd > 0).length
                    }
                }
            });

        } catch (error) {
            console.error('Error en dashboard de equipo:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor'
            });
        }
    }

    // ============================================
    // RESTO DE MÉTODOS SIN CAMBIOS
    // ============================================
    static async listarConfiguracionBonos(req, res) {
        try {
            res.json({
                success: true,
                data: {
                    bonos_disponibles: ComisionesController.BONOS_POR_META,
                    mensaje: 'Configuración de bonos según meta asignada',
                    reglas: {
                        '80%': 'Bono mínimo (si está disponible para tu meta)',
                        '90%': 'Bono intermedio (si está disponible para tu meta)', 
                        '100%': 'Bono máximo por cumplir tu meta completa',
                        'logica': 'Solo recibes bono si alcanzas al menos 80% de TU meta específica',
                        'modalidades': {
                            'solo_ventas': 'Bono basado únicamente en ventas USD',
                            'ventas_actividad': 'Bono basado en ventas USD + métricas de actividad'
                        }
                    }
                }
            });
        } catch (error) {
            console.error('Error listando configuración:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor'
            });
        }
    }

    static async simularBono(req, res) {
        try {
            const { meta_usd, ventas_usd } = req.body;

            if (!meta_usd || !ventas_usd) {
                return res.status(400).json({
                    success: false,
                    message: 'meta_usd y ventas_usd son requeridos'
                });
            }

            const calculo = ComisionesController.calcularBono(parseFloat(meta_usd), parseFloat(ventas_usd));
            const siguiente = ComisionesController.calcularSiguienteNivel(parseFloat(meta_usd), parseFloat(ventas_usd));

            res.json({
                success: true,
                data: {
                    simulacion: {
                        meta_usd: parseFloat(meta_usd),
                        ventas_usd: parseFloat(ventas_usd),
                        porcentaje: calculo.porcentaje,
                        bono_usd: calculo.bono,
                        nivel: calculo.nivel,
                        mensaje: calculo.mensaje
                    },
                    siguiente_nivel: siguiente
                }
            });

        } catch (error) {
            console.error('Error en simulación:', error);
            res.status(500).json({
                success: false,
                message: 'Error en simulación'
            });
        }
    }
}

module.exports = ComisionesController;

console.log('ComisionesController loaded - Sistema extendido con modalidades');
console.log('Metas soportadas:', ComisionesController.BONOS_POR_META.map(b => `${b.meta_usd}`).join(', '));
console.log('Modalidades: solo_ventas, ventas_actividad');
console.log('Lógica: Bonos por ventas + penalización por no cumplir actividad (si aplica)');