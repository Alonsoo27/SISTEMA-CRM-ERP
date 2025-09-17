const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const ProspectosController = require('../controllers/prospectosController');

// CONFIGURACIÓN DE RATE LIMITING
const createProspectoRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: {
        success: false,
        error: 'Demasiados intentos de creación. Espere 15 minutos antes de intentar nuevamente.',
        reintentarEn: '15 minutos'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

const updateRateLimit = rateLimit({
    windowMs: 5 * 60 * 1000,
    max: 50,
    message: {
        success: false,
        error: 'Demasiadas actualizaciones. Espere 5 minutos antes de continuar.',
        reintentarEn: '5 minutos'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// MIDDLEWARE DE VALIDACIÓN DE DATOS
const validarDatosProspecto = (req, res, next) => {
    try {
        const { nombre_cliente, telefono, canal_contacto } = req.body;

        if (req.method === 'POST') {
            if (!nombre_cliente?.trim()) {
                return res.status(400).json({
                    success: false,
                    error: 'El nombre del cliente es requerido'
                });
            }

            if (!telefono?.trim()) {
                return res.status(400).json({
                    success: false,
                    error: 'El teléfono es requerido'
                });
            }

            if (!canal_contacto?.trim()) {
                return res.status(400).json({
                    success: false,
                    error: 'El canal de contacto es requerido'
                });
            }
        }

        if (req.body.telefono) {
            req.body.telefono = req.body.telefono.replace(/[^\d+]/g, '');
        }

        ['nombre_cliente', 'apellido_cliente', 'empresa', 'observaciones'].forEach(field => {
            if (req.body[field]) {
                req.body[field] = req.body[field].trim();
            }
        });

        next();
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Error en validación de datos: ' + error.message
        });
    }
};

// MIDDLEWARE TEMPORAL PARA SIMULAR USUARIO AUTENTICADO
const mockUser = (req, res, next) => {
    req.user = {
        id: 1,
        nombre: 'Admin',
        apellido: 'Test',
        email: 'admin@test.com',
        rol: 'admin',
        nombre_completo: 'Admin Test'
    };
    next();
};

// ============================================================================
// FUNCIONES AUXILIARES PARA SEGUIMIENTOS
// ============================================================================

/**
 * Calcula horas laborales transcurridas entre dos fechas
 * Horario: L-V 8am-6pm, Sáb 9am-12pm
 */
function calcularHorasLaborales(fechaInicio, fechaFin) {
    const inicio = new Date(fechaInicio);
    const fin = new Date(fechaFin);
    
    if (fin <= inicio) return 0;
    
    let horasLaborales = 0;
    let fechaActual = new Date(inicio);
    
    while (fechaActual < fin) {
        const diaSemana = fechaActual.getDay(); // 0=domingo, 1=lunes, ..., 6=sábado
        const hora = fechaActual.getHours();
        
        let esHoraLaboral = false;
        
        if (diaSemana >= 1 && diaSemana <= 5) { // Lunes a viernes
            esHoraLaboral = hora >= 8 && hora < 18;
        } else if (diaSemana === 6) { // Sábado
            esHoraLaboral = hora >= 9 && hora < 12;
        }
        
        if (esHoraLaboral) {
            horasLaborales++;
        }
        
        fechaActual.setHours(fechaActual.getHours() + 1);
    }
    
    return horasLaborales;
}

/**
 * Calcula el nivel de urgencia de un seguimiento
 */
function calcularUrgencia(fechaProgramada, ahora = new Date()) {
    const diff = fechaProgramada - ahora;
    const horasRestantes = diff / (1000 * 60 * 60);
    const diasRestantes = horasRestantes / 24;
    
    if (diasRestantes <= 1) {
        return 'critico';
    } else if (diasRestantes <= 5) {
        return 'medio';
    } else {
        return 'bajo';
    }
}

/**
 * Procesa y clasifica seguimientos desde datos de BD
 */
async function procesarSeguimientos(asesorId = null) {
    try {
        const { createClient } = require('@supabase/supabase-js');
        const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

        // Construir query base
        let query = supabase
            .from('prospectos')
            .select(`
                id,
                codigo,
                nombre_cliente,
                apellido_cliente,
                telefono,
                canal_contacto,
                estado,
                seguimiento_obligatorio,
                fecha_seguimiento,
                seguimiento_completado,
                seguimiento_vencido,
                asesor_id,
                created_at,
                usuarios!asesor_id(nombre, apellido)
            `)
            .eq('activo', true)
            .not('seguimiento_obligatorio', 'is', null);

        // Filtrar por asesor si se especifica
        if (asesorId && !isNaN(asesorId)) {
            query = query.eq('asesor_id', parseInt(asesorId));
        }

        const { data: prospectos, error } = await query;

        if (error) {
            console.error('Error consultando seguimientos:', error);
            throw error;
        }

        if (!prospectos || prospectos.length === 0) {
            return {
                seguimientos: {
                    proximos: [],
                    vencidos: [],
                    hoy: []
                },
                conteos: {
                    total: 0,
                    pendientes: 0,
                    vencidos: 0,
                    completados_hoy: 0
                },
                metricas: {
                    efectividad: 0,
                    total_prospectos: 0,
                    completados: 0,
                    vencidos: 0,
                    tasa_vencimiento: 0
                },
                sistema: {
                    prospectos_evaluados: 0,
                    ultima_actualizacion: new Date().toISOString(),
                    filtro_asesor: asesorId ? parseInt(asesorId) : null
                }
            };
        }

        // Procesar seguimientos
        const ahora = new Date();
        const inicioDia = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
        const finDia = new Date(inicioDia);
        finDia.setDate(finDia.getDate() + 1);

        const seguimientosProcesados = prospectos.map(prospecto => {
            const fechaSeguimiento = new Date(prospecto.seguimiento_obligatorio);
            const horasLaboralesPasadas = calcularHorasLaborales(fechaSeguimiento, ahora);
            
            return {
                id: `prospecto_${prospecto.id}`,
                prospecto_id: prospecto.id,
                prospecto_nombre: `${prospecto.nombre_cliente} ${prospecto.apellido_cliente || ''}`.trim(),
                prospecto_codigo: prospecto.codigo,
                tipo: prospecto.canal_contacto || 'Llamada',
                estado: prospecto.estado,
                fecha_programada: prospecto.seguimiento_obligatorio,
                fecha_seguimiento: prospecto.fecha_seguimiento,
                completado: prospecto.seguimiento_completado || false,
                vencido: prospecto.seguimiento_vencido || horasLaboralesPasadas >= 18,
                horas_laborales_pasadas: horasLaboralesPasadas,
                descripcion: `${prospecto.canal_contacto} programada para ${prospecto.nombre_cliente}`,
                asesor_nombre: prospecto.usuarios ? 
                    `${prospecto.usuarios.nombre} ${prospecto.usuarios.apellido || ''}`.trim() : 
                    'Sin asignar',
                telefono: prospecto.telefono,
                urgencia: calcularUrgencia(fechaSeguimiento, ahora),
                created_at: prospecto.created_at
            };
        });

        // Clasificar seguimientos
        const clasificacion = {
            proximos: [],
            vencidos: [],
            hoy: []
        };

        seguimientosProcesados.forEach(seg => {
            const fechaSeg = new Date(seg.fecha_programada);
            
            if (seg.completado && fechaSeg >= inicioDia && fechaSeg < finDia) {
                // Completados hoy
                clasificacion.hoy.push(seg);
            } else if (seg.vencido || seg.horas_laborales_pasadas >= 18) {
                // Vencidos (más de 18 horas laborales)
                clasificacion.vencidos.push(seg);
            } else if (!seg.completado) {
                // Pendientes
                clasificacion.proximos.push(seg);
            }
        });

        // Ordenar por urgencia y fecha
        clasificacion.proximos.sort((a, b) => {
            if (a.urgencia !== b.urgencia) {
                const orden = { 'critico': 0, 'medio': 1, 'bajo': 2 };
                return orden[a.urgencia] - orden[b.urgencia];
            }
            return new Date(a.fecha_programada) - new Date(b.fecha_programada);
        });

        clasificacion.vencidos.sort((a, b) => 
            b.horas_laborales_pasadas - a.horas_laborales_pasadas
        );

        clasificacion.hoy.sort((a, b) => 
            new Date(b.fecha_seguimiento || b.fecha_programada) - new Date(a.fecha_seguimiento || a.fecha_programada)
        );

        // Calcular métricas
        const totalCompletados = seguimientosProcesados.filter(s => s.completado).length;
        const totalVencidos = clasificacion.vencidos.length;
        const efectividad = seguimientosProcesados.length > 0 ? 
            ((totalCompletados / seguimientosProcesados.length) * 100).toFixed(1) : 0;

        return {
            seguimientos: clasificacion,
            conteos: {
                total: seguimientosProcesados.length,
                pendientes: clasificacion.proximos.length,
                vencidos: clasificacion.vencidos.length,
                completados_hoy: clasificacion.hoy.length
            },
            metricas: {
                efectividad: parseFloat(efectividad),
                total_prospectos: seguimientosProcesados.length,
                completados: totalCompletados,
                vencidos: totalVencidos,
                tasa_vencimiento: seguimientosProcesados.length > 0 ? 
                    ((totalVencidos / seguimientosProcesados.length) * 100).toFixed(1) : 0
            },
            sistema: {
                prospectos_evaluados: prospectos.length,
                ultima_actualizacion: ahora.toISOString(),
                filtro_asesor: asesorId ? parseInt(asesorId) : null
            }
        };

    } catch (error) {
        console.error('Error procesando seguimientos:', error);
        throw error;
    }
}

// ============================================================================
// RUTAS DE INFORMACIÓN DEL SISTEMA
// ============================================================================

router.get('/health', mockUser, ProspectosController.healthCheck);

router.get('/info/estados', (req, res) => {
    res.json({
        success: true,
        data: {
            estados: [
                { codigo: 'Prospecto', nombre: 'Prospecto', descripcion: 'Contacto inicial registrado' },
                { codigo: 'Cotizado', nombre: 'Cotizado', descripcion: 'Cotización enviada al cliente' },
                { codigo: 'Negociacion', nombre: 'Negociación', descripcion: 'En proceso de negociación' },
                { codigo: 'Cerrado', nombre: 'Cerrado', descripcion: 'Venta exitosa' },
                { codigo: 'Perdido', nombre: 'Perdido', descripcion: 'No se concretó la venta' }
            ],
            flujo_normal: 'Prospecto → Cotizado → Negociación → Cerrado',
            notas: 'Cualquier estado puede ir directamente a Perdido con justificación'
        }
    });
});

router.get('/info/canales', (req, res) => {
    res.json({
        success: true,
        data: {
            canales: [
                { codigo: 'WhatsApp', nombre: 'WhatsApp', icono: '📱' },
                { codigo: 'Messenger', nombre: 'Facebook Messenger', icono: '💬' },
                { codigo: 'Facebook', nombre: 'Facebook', icono: '📘' },
                { codigo: 'TikTok', nombre: 'TikTok', icono: '🎵' },
                { codigo: 'Llamada', nombre: 'Llamada Telefónica', icono: '📞' },
                { codigo: 'Presencial', nombre: 'Visita Presencial', icono: '🏢' },
                { codigo: 'Email', nombre: 'Correo Electrónico', icono: '📧' }
            ],
            recomendacion: 'WhatsApp es el canal más efectivo según las métricas'
        }
    });
});

// ============================================================================
// RUTAS DE LECTURA PRINCIPALES
// ============================================================================

router.get('/', mockUser, ProspectosController.obtenerTodos);
router.get('/kanban/:asesorId', mockUser, ProspectosController.obtenerKanban);
router.get('/kanban', mockUser, ProspectosController.obtenerKanban);
router.get('/metricas/:asesorId', mockUser, ProspectosController.obtenerMetricas);
router.get('/metricas', mockUser, ProspectosController.obtenerMetricas);
router.get('/verificar-duplicado/:telefono', ProspectosController.verificarDuplicado);

// ============================================================================
// RUTAS DE ESCRITURA
// ============================================================================

router.post('/', mockUser, createProspectoRateLimit, validarDatosProspecto, ProspectosController.crearProspecto);
router.put('/:id', mockUser, updateRateLimit, validarDatosProspecto, ProspectosController.actualizarProspecto);
router.patch('/:id/estado', mockUser, updateRateLimit, ProspectosController.cambiarEstado);
router.post('/:id/cerrar-venta', mockUser, ProspectosController.cerrarVenta);

// ============================================================================
// RUTA DELETE SIMPLIFICADA
// ============================================================================

router.delete('/:id', mockUser, updateRateLimit, async (req, res) => {
    try {
        const { id } = req.params;

        if (!id || isNaN(id)) {
            return res.status(400).json({
                success: false,
                error: 'ID de prospecto inválido'
            });
        }

        const { createClient } = require('@supabase/supabase-js');
        const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

        const { data, error } = await supabase
            .from('prospectos')
            .update({ 
                activo: false,
                fecha_eliminacion: new Date().toISOString(),
                eliminado_por: req.user?.nombre || 'Sistema'
            })
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('Error al eliminar prospecto:', error);
            throw error;
        }

        if (!data) {
            return res.status(404).json({
                success: false,
                error: 'Prospecto no encontrado'
            });
        }

        console.log(`Prospecto eliminado: ${data.codigo} por ${req.user?.nombre}`);

        res.json({
            success: true,
            message: 'Prospecto eliminado exitosamente',
            data: data
        });

    } catch (error) {
        console.error('Error en eliminar prospecto:', error);
        res.status(500).json({
            success: false,
            error: 'Error al eliminar prospecto: ' + error.message
        });
    }
});

// ============================================================================
// RUTAS DE SEGUIMIENTOS CON DATOS REALES
// ============================================================================

// Dashboard principal de seguimientos (sin filtro de asesor)
router.get('/dashboard/seguimientos', mockUser, async (req, res) => {
    try {
        const datosCompletos = await procesarSeguimientos();
        
        res.json({
            success: true,
            data: datosCompletos,
            message: `Seguimientos procesados: ${datosCompletos.conteos.total} total`
        });

    } catch (error) {
        console.error('Error en dashboard seguimientos:', error);
        res.status(500).json({
            success: false,
            error: 'Error al obtener dashboard de seguimientos: ' + error.message
        });
    }
});

// Dashboard de seguimientos filtrado por asesor
router.get('/dashboard/seguimientos/:asesorId', mockUser, async (req, res) => {
    try {
        const { asesorId } = req.params;
        
        if (!asesorId || isNaN(asesorId)) {
            return res.status(400).json({
                success: false,
                error: 'ID de asesor inválido'
            });
        }

        const datosCompletos = await procesarSeguimientos(asesorId);
        
        res.json({
            success: true,
            data: datosCompletos,
            message: `Seguimientos para asesor ${asesorId}: ${datosCompletos.conteos.total} encontrados`
        });

    } catch (error) {
        console.error('Error en dashboard seguimientos por asesor:', error);
        res.status(500).json({
            success: false,
            error: 'Error al obtener seguimientos por asesor: ' + error.message
        });
    }
});

// Todos los seguimientos en un solo array
router.get('/seguimientos', mockUser, async (req, res) => {
    try {
        const datosCompletos = await procesarSeguimientos();
        
        // Extraer todos los seguimientos en un solo array
        const todosSeguimientos = [
            ...datosCompletos.seguimientos.proximos,
            ...datosCompletos.seguimientos.vencidos,
            ...datosCompletos.seguimientos.hoy
        ];
        
        res.json({
            success: true,
            data: todosSeguimientos,
            total: todosSeguimientos.length,
            message: 'Seguimientos obtenidos correctamente'
        });
        
    } catch (error) {
        console.error('Error en /seguimientos:', error);
        res.json({
            success: true,
            data: [],
            total: 0,
            message: 'Error obteniendo seguimientos: ' + error.message
        });
    }
});

// Solo seguimientos pendientes
router.get('/seguimientos/pendientes', mockUser, async (req, res) => {
    try {
        const datosCompletos = await procesarSeguimientos();
        
        res.json({
            success: true,
            data: datosCompletos.seguimientos.proximos || [],
            total: datosCompletos.conteos.pendientes || 0,
            message: 'Seguimientos pendientes obtenidos'
        });
        
    } catch (error) {
        console.error('Error en /seguimientos/pendientes:', error);
        res.json({
            success: true,
            data: [],
            total: 0,
            message: 'Error obteniendo seguimientos pendientes: ' + error.message
        });
    }
});

// Solo seguimientos vencidos
router.get('/seguimientos/vencidos', mockUser, async (req, res) => {
    try {
        const datosCompletos = await procesarSeguimientos();
        
        res.json({
            success: true,
            data: datosCompletos.seguimientos.vencidos || [],
            total: datosCompletos.conteos.vencidos || 0,
            message: 'Seguimientos vencidos obtenidos'
        });
        
    } catch (error) {
        console.error('Error en /seguimientos/vencidos:', error);
        res.json({
            success: true,
            data: [],
            total: 0,
            message: 'Error obteniendo seguimientos vencidos: ' + error.message
        });
    }
});

// Solo seguimientos completados hoy
router.get('/seguimientos/completados', mockUser, async (req, res) => {
    try {
        const datosCompletos = await procesarSeguimientos();
        
        res.json({
            success: true,
            data: datosCompletos.seguimientos.hoy || [],
            total: datosCompletos.conteos.completados_hoy || 0,
            message: 'Seguimientos completados hoy obtenidos'
        });
        
    } catch (error) {
        console.error('Error en /seguimientos/completados:', error);
        res.json({
            success: true,
            data: [],
            total: 0,
            message: 'Error obteniendo seguimientos completados: ' + error.message
        });
    }
});

// ============================================================================
// RUTA DINÁMICA AL FINAL (mantener al final para evitar conflictos)
// ============================================================================

router.get('/:id', mockUser, async (req, res) => {
    try {
        const { id } = req.params;

        if (!id || isNaN(id)) {
            return res.status(400).json({
                success: false,
                error: 'ID de prospecto inválido'
            });
        }

        const { createClient } = require('@supabase/supabase-js');
        const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

        const { data, error } = await supabase
            .from('prospectos')
            .select(`
                *,
                usuarios!asesor_id(nombre, apellido)
            `)
            .eq('id', id)
            .eq('activo', true)
            .single();

        if (error) {
            console.error('Error al obtener prospecto:', error);
            throw error;
        }

        if (!data) {
            return res.status(404).json({
                success: false,
                error: 'Prospecto no encontrado'
            });
        }

        res.json({
            success: true,
            data: data
        });

    } catch (error) {
        console.error('Error en obtener prospecto por ID:', error);
        res.status(500).json({
            success: false,
            error: 'Error al obtener prospecto: ' + error.message
        });
    }
});

// ============================================================================
// MIDDLEWARE DE MANEJO DE ERRORES
// ============================================================================

router.use((error, req, res, next) => {
    console.error('Error en rutas de prospectos:', error);
    
    res.status(500).json({
        success: false,
        error: 'Error interno del servidor en módulo de prospectos',
        timestamp: new Date().toISOString(),
        mode: 'TESTING - SIN JWT'
    });
});
router.post('/seguimientos/procesar-vencidos', mockUser, async (req, res) => {
    try {
        const resultado = await ProspectosController.procesarSeguimientosVencidos(req, res);
        return resultado;
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Error procesando seguimientos vencidos: ' + error.message
        });
    }
});
module.exports = router;