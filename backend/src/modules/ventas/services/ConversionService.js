// ============================================
// CONVERSION SERVICE UNIFICADO 
// Funciona para: ProspectosController + SeguimientosController
// ============================================

const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

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

        // Iniciar transacción
        const { error: beginError } = await supabase.rpc('begin_transaction');
        if (beginError) console.log('Warning: Manual transaction control not available');

        try {
            // 1. Obtener datos completos del prospecto
            const { data: prospecto, error: errorProspecto } = await supabase
                .from('prospectos')
                .select('*')
                .eq('id', prospecto_id)
                .eq('activo', true)
                .single();

            if (errorProspecto || !prospecto) {
                throw new Error('Prospecto no encontrado o inactivo');
            }

            // 2. Verificar que no esté ya convertido
            if (prospecto.convertido_venta === true) {
                let ventaExistente = null;
                
                // Solo buscar venta si venta_id no es null
                if (prospecto.venta_id && prospecto.venta_id !== null) {
                    const result = await supabase
                        .from('ventas')
                        .select('id, codigo')
                        .eq('id', prospecto.venta_id)
                        .single();
                    
                    ventaExistente = result.data;
                } else {
                    // Prospecto marcado como convertido pero sin venta - resetear y continuar
                    await supabase
                        .from('prospectos')
                        .update({ convertido_venta: false })
                        .eq('id', prospecto_id);
                        
                    // Actualizar el objeto prospecto en memoria
                    prospecto.convertido_venta = false;
                    prospecto.venta_id = null;
                }

                if (ventaExistente) {
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

            const { data: nuevaVenta, error: errorVenta } = await supabase
                .from('ventas')
                .insert([ventaData])
                .select()
                .single();

            if (errorVenta) {
                throw errorVenta;
            }

            if (!nuevaVenta || !nuevaVenta.id) {
                throw new Error('Venta creada pero sin ID válido');
            }

            // 7. Actualizar prospecto
            const { error: errorUpdateProspecto } = await supabase
                .from('prospectos')
                .update({
                    convertido_venta: true,
                    venta_id: nuevaVenta.id,
                    fecha_cierre: fechaActual,
                    estado: 'Cerrado',
                    fecha_ultima_actualizacion: fechaActual,
                    updated_at: fechaActual
                })
                .eq('id', prospecto_id);

            if (errorUpdateProspecto) {
                throw errorUpdateProspecto;
            }

            // 8. Crear registro de historial
            const historialActual = parseHistorialSeguro(prospecto.historial_interacciones);
            const nuevaInteraccion = {
                fecha: fechaActual,
                tipo: 'Conversión a Venta',
                descripcion: `${fuente} → Venta ${codigoVenta} ($${valorFinal})${resultado_seguimiento ? ` - ${resultado_seguimiento}` : ''}`,
                usuario: 'Sistema',
                venta_id: nuevaVenta.id
            };

            await supabase
                .from('prospectos')
                .update({
                    historial_interacciones: [...historialActual, nuevaInteraccion]
                })
                .eq('id', prospecto_id);

            // Commit
            const { error: commitError } = await supabase.rpc('commit_transaction');
            if (commitError) console.log('Warning: Manual commit not available');

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
            // Rollback
            const { error: rollbackError } = await supabase.rpc('rollback_transaction');
            if (rollbackError) console.log('Warning: Manual rollback not available');
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
        
        const { data, error } = await supabase
            .from('ventas')
            .select('codigo')
            .like('codigo', `VT${año}${mes}%`)
            .order('created_at', { ascending: false })
            .limit(1);

        let siguienteNumero = 1;
        if (data && data.length > 0) {
            const ultimoCodigo = data[0].codigo;
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

console.log('✅ ConversionService unificado cargado');