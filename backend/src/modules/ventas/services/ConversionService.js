// ============================================
// CONVERSION SERVICE UNIFICADO - MIGRADO A POSTGRESQL
// Funciona para: ProspectosController + SeguimientosController
// ============================================

const { query } = require('../../../config/database');

// Función para fechas Peru
const obtenerFechaPeruISO = () => {
    const ahora = new Date();
    const offsetPeru = -5 * 60;
    const fechaPeru = new Date(ahora.getTime() + (offsetPeru * 60 * 1000));
    return fechaPeru.toISOString();
};

function parseHistorialSeguro(historial) {
    if (!historial) return [];
    if (Array.isArray(historial)) return historial;
    
    if (typeof historial === 'string') {
        try {
            const parsed = JSON.parse(historial);
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    }
    
    return [];
}

// ============================================
// CONVERSIÓN UNIFICADA
// ============================================
const convertirProspectoAVenta = async (config) => {
    try {
        const {
            prospecto_id,
            asesor_id,
            fuente = 'conversion_automatica',
            seguimiento_id = null,
            resultado_seguimiento = null,
            notas_adicionales = ''
        } = config;

        // Validaciones
        if (!prospecto_id || !asesor_id) {
            throw new Error('prospecto_id y asesor_id son obligatorios');
        }

        // Iniciar transacción PostgreSQL
        await query('BEGIN');

        try {
            // 1. Obtener datos completos del prospecto
            const prospectoResult = await query(
                'SELECT * FROM prospectos WHERE id = $1 AND activo = $2',
                [prospecto_id, true]
            );

            if (!prospectoResult.rows || prospectoResult.rows.length === 0) {
                throw new Error('Prospecto no encontrado o inactivo');
            }

            const prospecto = prospectoResult.rows[0];

            // 2. Verificar que no esté ya convertido
            if (prospecto.convertido_venta === true) {
                let ventaExistente = null;
                
                // Solo buscar venta si venta_id no es null
                if (prospecto.venta_id && prospecto.venta_id !== null) {
                    const ventaResult = await query(
                        'SELECT id, codigo FROM ventas WHERE id = $1',
                        [prospecto.venta_id]
                    );
                    
                    ventaExistente = ventaResult.rows[0] || null;
                } else {
                    // Prospecto marcado como convertido pero sin venta - resetear y continuar
                    await query(
                        'UPDATE prospectos SET convertido_venta = $1 WHERE id = $2',
                        [false, prospecto_id]
                    );
                        
                    // Actualizar el objeto prospecto en memoria
                    prospecto.convertido_venta = false;
                    prospecto.venta_id = null;
                }

                if (ventaExistente) {
                    await query('ROLLBACK');
                    return {
                        success: false,
                        error: `Prospecto ya convertido`,
                        venta_existente: ventaExistente
                    };
                }
            }

            // 3. Generar código único
            const codigoVenta = await generarCodigoVenta();

            // 4. Preparar datos
            const fechaActual = obtenerFechaPeruISO();
            const valorFinal = parseFloat(prospecto.valor_estimado) || 0;

            // 5. Determinar probabilidad según fuente
            let probabilidadCierre = 75;
            let estadoDetallado = 'vendido';
            
            if (fuente === 'seguimiento_exitoso') {
                probabilidadCierre = 85;
                estadoDetallado = 'vendido';
            }

            // 6. Crear venta
            const ventaData = {
                // Identificadores
                codigo: codigoVenta,
                prospecto_id: prospecto_id,
                asesor_id: asesor_id,
                
                // Datos del cliente
                nombre_cliente: prospecto.nombre_cliente,
                apellido_cliente: prospecto.apellido_cliente || '',
                cliente_empresa: prospecto.empresa,
                cliente_email: prospecto.email,
                cliente_telefono: prospecto.telefono,
                
                // Valores financieros
                valor_total: valorFinal,
                valor_final: valorFinal,
                descuento_porcentaje: 0,
                descuento_monto: 0,
                moneda: 'PEN',
                
                // Origen y seguimiento
                canal_origen: 'pipeline-convertido',
                canal_contacto: prospecto.canal_contacto,
                fuente_conversion: fuente,
                seguimiento_id: seguimiento_id,
                
                // Estado y probabilidad
                estado_detallado: estadoDetallado,
                probabilidad_cierre: probabilidadCierre,
                
                // Fechas
                fecha_creacion: fechaActual,
                fecha_venta: fechaActual.split('T')[0],
                created_at: fechaActual,
                updated_at: fechaActual,
                
                // Usuarios
                created_by: asesor_id,
                updated_by: asesor_id,
                
                // Ubicación
                ciudad: prospecto.ciudad || 'Lima',
                departamento: prospecto.departamento || 'Lima',
                distrito: prospecto.distrito,
                
                // Notas
                notas_internas: [
                    `Conversión automática desde prospecto ${prospecto.codigo}`,
                    `Fuente: ${fuente}`,
                    resultado_seguimiento ? `Resultado seguimiento: ${resultado_seguimiento}` : '',
                    prospecto.observaciones ? `Observaciones originales: ${prospecto.observaciones}` : '',
                    notas_adicionales || ''
                ].filter(Boolean).join('\n\n'),
                
                // Configuraciones
                tipo_venta: 'boleta',
                es_venta_presencial: false,
                activo: true
            };

            // ✅ HEREDAR CAMPAÑA DEL PROSPECTO (si existe)
            const campanaOrigenId = prospecto.campana_id || null;

            const insertVentaQuery = `
                INSERT INTO ventas (
                    codigo, prospecto_id, asesor_id, nombre_cliente, apellido_cliente,
                    cliente_empresa, cliente_email, cliente_telefono, valor_total, valor_final,
                    descuento_porcentaje, descuento_monto, moneda, canal_origen, canal_contacto,
                    fuente_conversion, seguimiento_id, estado_detallado, probabilidad_cierre,
                    fecha_creacion, fecha_venta, created_at, updated_at, created_by, updated_by,
                    ciudad, departamento, distrito, notas_internas, tipo_venta, es_venta_presencial, activo,
                    campana_origen_id
                ) VALUES (
                    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
                    $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
                    $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33
                ) RETURNING *
            `;

            const ventaValues = [
                ventaData.codigo, ventaData.prospecto_id, ventaData.asesor_id,
                ventaData.nombre_cliente, ventaData.apellido_cliente, ventaData.cliente_empresa,
                ventaData.cliente_email, ventaData.cliente_telefono, ventaData.valor_total,
                ventaData.valor_final, ventaData.descuento_porcentaje, ventaData.descuento_monto,
                ventaData.moneda, ventaData.canal_origen, ventaData.canal_contacto,
                ventaData.fuente_conversion, ventaData.seguimiento_id, ventaData.estado_detallado,
                ventaData.probabilidad_cierre, ventaData.fecha_creacion, ventaData.fecha_venta,
                ventaData.created_at, ventaData.updated_at, ventaData.created_by,
                ventaData.updated_by, ventaData.ciudad, ventaData.departamento,
                ventaData.distrito, ventaData.notas_internas, ventaData.tipo_venta,
                ventaData.es_venta_presencial, ventaData.activo,
                campanaOrigenId  // ✅ Heredar campaña
            ];

            const nuevaVentaResult = await query(insertVentaQuery, ventaValues);
            
            if (!nuevaVentaResult.rows || nuevaVentaResult.rows.length === 0) {
                throw new Error('Venta creada pero sin datos devueltos');
            }

            const nuevaVenta = nuevaVentaResult.rows[0];

            if (!nuevaVenta || !nuevaVenta.id) {
                throw new Error('Venta creada pero sin ID válido');
            }

            // 7. Actualizar prospecto
            await query(`
                UPDATE prospectos 
                SET convertido_venta = $1, venta_id = $2, fecha_cierre = $3, 
                    estado = $4, fecha_ultima_actualizacion = $5, updated_at = $6
                WHERE id = $7
            `, [true, nuevaVenta.id, fechaActual, 'Cerrado', fechaActual, fechaActual, prospecto_id]);

            // 8. Crear registro de historial
            const historialActual = parseHistorialSeguro(prospecto.historial_interacciones);
            const nuevaInteraccion = {
                fecha: fechaActual,
                tipo: 'Conversión a Venta',
                descripcion: `${fuente} → Venta ${codigoVenta} ($${valorFinal})${resultado_seguimiento ? ` - ${resultado_seguimiento}` : ''}`,
                usuario: 'Sistema',
                venta_id: nuevaVenta.id
            };

            await query(`
                UPDATE prospectos 
                SET historial_interacciones = $1
                WHERE id = $2
            `, [JSON.stringify([...historialActual, nuevaInteraccion]), prospecto_id]);

            // Commit de la transacción
            await query('COMMIT');

            // Respuesta
            return {
                success: true,
                venta_creada: {
                    id: nuevaVenta.id,
                    codigo: nuevaVenta.codigo,
                    prospecto_id: prospecto_id,
                    cliente_nombre: prospecto.nombre_cliente,
                    cliente_empresa: prospecto.empresa,
                    valor_total: parseFloat(nuevaVenta.valor_total),
                    valor_final: parseFloat(nuevaVenta.valor_final),
                    estado: nuevaVenta.estado_detallado,
                    probabilidad_cierre: nuevaVenta.probabilidad_cierre,
                    fecha_creacion: nuevaVenta.created_at,
                    fuente_conversion: fuente
                },
                prospecto_original: {
                    codigo: prospecto.codigo,
                    nombre: prospecto.nombre_cliente,
                    valor_estimado_original: parseFloat(prospecto.valor_estimado || 0)
                },
                message: `Venta ${nuevaVenta.codigo} creada exitosamente desde ${fuente}`
            };

        } catch (error) {
            // Rollback en caso de error
            await query('ROLLBACK');
            throw error;
        }

    } catch (error) {
        return {
            success: false,
            error: error.message,
            prospecto_id: config.prospecto_id
        };
    }
};

// ============================================
// GENERAR CÓDIGO ÚNICO
// ============================================
const generarCodigoVenta = async () => {
    try {
        const fecha = new Date();
        const año = fecha.getFullYear().toString().slice(-2);
        const mes = (fecha.getMonth() + 1).toString().padStart(2, '0');
        
        const result = await query(`
            SELECT codigo 
            FROM ventas 
            WHERE codigo LIKE $1 
            ORDER BY created_at DESC 
            LIMIT 1
        `, [`VT${año}${mes}%`]);

        let siguienteNumero = 1;
        if (result.rows && result.rows.length > 0) {
            const ultimoCodigo = result.rows[0].codigo;
            const ultimoNumero = parseInt(ultimoCodigo.slice(-4));
            if (!isNaN(ultimoNumero)) {
                siguienteNumero = ultimoNumero + 1;
            }
        }

        return `VT${año}${mes}${siguienteNumero.toString().padStart(4, '0')}`;
        
    } catch (error) {
        console.error('Error generating code:', error);
        return `VT${Date.now().toString().slice(-6)}`;
    }
};

// ============================================
// MÉTODOS HELPER
// ============================================

const convertirDesdeKanban = async (prospecto_id, asesor_id, motivo = '') => {
    return await convertirProspectoAVenta({
        prospecto_id,
        asesor_id,
        fuente: 'kanban_cerrado',
        notas_adicionales: motivo
    });
};

const convertirDesdeSeguimiento = async (prospecto_id, asesor_id, seguimiento_id, resultado, notas = '') => {
    return await convertirProspectoAVenta({
        prospecto_id,
        asesor_id,
        fuente: 'seguimiento_exitoso',
        seguimiento_id,
        resultado_seguimiento: resultado,
        notas_adicionales: notas
    });
};

const convertirManual = async (prospecto_id, asesor_id, notas = '') => {
    return await convertirProspectoAVenta({
        prospecto_id,
        asesor_id,
        fuente: 'conversion_manual',
        notas_adicionales: notas
    });
};

module.exports = {
    convertirProspectoAVenta,
    convertirDesdeKanban,
    convertirDesdeSeguimiento,  
    convertirManual,
    generarCodigoVenta
};

console.log('✅ ConversionService unificado cargado (PostgreSQL)');