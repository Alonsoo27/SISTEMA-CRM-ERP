// ============================================
// SERVICIO DE FALTAS AUTOMÁTICAS Y CHECKOUT
// Sistema empresarial para automatización de actividad diaria
// - Checkout automático a las 6:00 PM (lunes a viernes)
// - Detección de faltas a las 9:00 AM del día siguiente (lunes a viernes)
// Zona horaria: Lima, Perú
// ============================================

const cron = require('node-cron');
const { query } = require('../config/database');

class FaltasAutomaticasService {
    constructor() {
        this.jobs = new Map();
        this.logger = console;
        this.init();
    }

    init() {
        this.logger.log('🚀 Iniciando FaltasAutomaticasService...');
        this.scheduleJobs();
    }

    scheduleJobs() {
        // Job 1: Checkout automático a las 6:00 PM (lunes a viernes)
        this.jobs.set('autoCheckout', cron.schedule('0 18 * * 1-5', () => {
            this.ejecutarCheckoutAutomatico();
        }, {
            scheduled: true,
            timezone: 'America/Lima'
        }));

        // Job 2: Detección de faltas a las 9:00 AM (lunes a viernes)
        this.jobs.set('detectarFaltas', cron.schedule('0 9 * * 1-5', () => {
            this.detectarYRegistrarFaltas();
        }, {
            scheduled: true,
            timezone: 'America/Lima'
        }));

        this.logger.log('⏰ Jobs programados:');
        this.logger.log('   - Checkout automático: 18:00 (L-V)');
        this.logger.log('   - Detección de faltas: 09:00 (L-V)');
    }

    /**
     * Ejecutar checkout automático para usuarios que no han hecho checkout
     */
    async ejecutarCheckoutAutomatico() {
        const startTime = Date.now();
        this.logger.log('\n🔄 Ejecutando checkout automático (18:00)...');

        try {
            const fechaHoy = new Date().toLocaleDateString('en-CA', {
                timeZone: 'America/Lima'
            });

            // Buscar usuarios que hicieron check-in pero no check-out
            const usuariosSinCheckout = await query(`
                SELECT
                    id, usuario_id, check_in_time,
                    mensajes_meta + mensajes_whatsapp + mensajes_instagram + mensajes_tiktok as total_mensajes,
                    COALESCE(llamadas_realizadas, 0) + COALESCE(llamadas_recibidas, 0) as total_llamadas
                FROM actividad_diaria
                WHERE fecha = $1
                    AND check_in_time IS NOT NULL
                    AND check_out_time IS NULL
                    AND estado_jornada = 'en_progreso'
            `, [fechaHoy]);

            if (usuariosSinCheckout.rows.length === 0) {
                this.logger.log('✅ No hay usuarios pendientes de checkout automático');
                return;
            }

            let exitosos = 0;
            let fallidos = 0;

            for (const usuario of usuariosSinCheckout.rows) {
                try {
                    // Calcular horas efectivas
                    const checkInTime = new Date(usuario.check_in_time);
                    const checkOutTime = new Date(); // Ahora (6 PM)
                    const horasEfectivas = (checkOutTime - checkInTime) / (1000 * 60 * 60);
                    const total_horas_efectivas = Math.round(horasEfectivas * 100) / 100;

                    // Ejecutar checkout automático
                    await query(`
                        UPDATE actividad_diaria SET
                            check_out_time = NOW(),
                            estado_salida = 'automatica',
                            total_horas_efectivas = $2,
                            estado_jornada = 'finalizada',
                            notas_check_out = COALESCE(notas_check_out, '') || ' [Checkout automático 18:00]',
                            tipo_registro = 'automatico',
                            updated_at = NOW()
                        WHERE id = $1
                    `, [usuario.id, total_horas_efectivas]);

                    exitosos++;
                    this.logger.log(`✅ Checkout automático: Usuario ${usuario.usuario_id} (${total_horas_efectivas}h)`);

                } catch (error) {
                    fallidos++;
                    this.logger.error(`❌ Error checkout usuario ${usuario.usuario_id}:`, error.message);
                }
            }

            const duration = Date.now() - startTime;
            this.logger.log(`🎯 Checkout automático completado en ${duration}ms`);
            this.logger.log(`   Exitosos: ${exitosos}, Fallidos: ${fallidos}\n`);

        } catch (error) {
            this.logger.error('❌ Error crítico en checkout automático:', error);
        }
    }

    /**
     * Detectar y registrar faltas del día anterior
     */
    async detectarYRegistrarFaltas() {
        const startTime = Date.now();
        this.logger.log('\n🔍 Detectando faltas del día anterior (09:00)...');

        try {
            const ayer = new Date();
            ayer.setDate(ayer.getDate() - 1);
            const fechaAyer = ayer.toLocaleDateString('en-CA', {
                timeZone: 'America/Lima'
            });

            // Solo verificar días laborables (lunes a viernes)
            const diaSemana = ayer.getDay(); // 0=domingo, 1=lunes, ..., 6=sábado
            if (diaSemana === 0 || diaSemana === 6) {
                this.logger.log('📅 Día no laboral (fin de semana), omitiendo detección de faltas');
                return;
            }

            // Obtener todos los usuarios activos que deberían trabajar
            const usuariosActivos = await query(`
                SELECT DISTINCT u.id, u.nombre, u.apellido, u.rol_id, r.nombre as rol_nombre
                FROM usuarios u
                LEFT JOIN roles r ON u.rol_id = r.id
                WHERE u.activo = true
                    AND u.vende = true  -- Solo usuarios que venden
                    AND r.nombre IN ('VENDEDOR', 'ASESOR', 'JEFE_VENTAS', 'GERENTE')
            `);

            if (usuariosActivos.rows.length === 0) {
                this.logger.log('⚠️ No se encontraron usuarios activos para verificar faltas');
                return;
            }

            // Verificar quiénes NO tienen registro de actividad ayer
            const usuariosSinActividad = await query(`
                SELECT u.id, u.nombre, u.apellido
                FROM usuarios u
                LEFT JOIN roles r ON u.rol_id = r.id
                WHERE u.activo = true
                    AND u.vende = true
                    AND r.nombre IN ('VENDEDOR', 'ASESOR', 'JEFE_VENTAS', 'GERENTE')
                    AND u.id NOT IN (
                        SELECT usuario_id
                        FROM actividad_diaria
                        WHERE fecha = $1
                    )
            `, [fechaAyer]);

            if (usuariosSinActividad.rows.length === 0) {
                this.logger.log('✅ Todos los usuarios registraron actividad ayer, no hay faltas');
                return;
            }

            let faltasRegistradas = 0;
            let fallosRegistro = 0;

            // Registrar faltas automáticas
            for (const usuario of usuariosSinActividad.rows) {
                try {
                    await query(`
                        INSERT INTO actividad_diaria (
                            usuario_id, fecha,
                            check_in_time, check_out_time,
                            mensajes_meta, mensajes_whatsapp, mensajes_instagram, mensajes_tiktok,
                            llamadas_realizadas, llamadas_recibidas,
                            estado_jornada, estado_entrada, estado_salida,
                            minutos_tardanza, total_horas_efectivas,
                            tipo_registro, notas_check_in,
                            created_at, updated_at
                        ) VALUES (
                            $1, $2,
                            NULL, NULL,
                            0, 0, 0, 0,
                            0, 0,
                            'falta', 'falta', 'falta',
                            0, 0,
                            'automatico', 'Falta detectada automáticamente - Sin check-in registrado',
                            NOW(), NOW()
                        )
                    `, [usuario.id, fechaAyer]);

                    faltasRegistradas++;
                    this.logger.log(`📝 Falta registrada: ${usuario.nombre} ${usuario.apellido} (${fechaAyer})`);

                } catch (error) {
                    fallosRegistro++;
                    this.logger.error(`❌ Error registrando falta para ${usuario.nombre}:`, error.message);
                }
            }

            const duration = Date.now() - startTime;
            this.logger.log(`🎯 Detección de faltas completada en ${duration}ms`);
            this.logger.log(`   Fecha analizada: ${fechaAyer}`);
            this.logger.log(`   Usuarios verificados: ${usuariosActivos.rows.length}`);
            this.logger.log(`   Faltas detectadas: ${faltasRegistradas}`);
            this.logger.log(`   Errores: ${fallosRegistro}\n`);

        } catch (error) {
            this.logger.error('❌ Error crítico en detección de faltas:', error);
        }
    }

    /**
     * Ejecutar checkout manual de emergencia
     */
    async ejecutarCheckoutManual(usuarioId, fecha = null) {
        this.logger.log(`🔧 Ejecutando checkout manual para usuario ${usuarioId}...`);

        const fechaTarget = fecha || new Date().toLocaleDateString('en-CA', {
            timeZone: 'America/Lima'
        });

        try {
            const registro = await query(`
                SELECT id, check_in_time
                FROM actividad_diaria
                WHERE usuario_id = $1 AND fecha = $2 AND check_out_time IS NULL
            `, [usuarioId, fechaTarget]);

            if (registro.rows.length === 0) {
                throw new Error('No se encontró registro pendiente de checkout');
            }

            const checkInTime = new Date(registro.rows[0].check_in_time);
            const checkOutTime = new Date();
            const horasEfectivas = (checkOutTime - checkInTime) / (1000 * 60 * 60);

            await query(`
                UPDATE actividad_diaria SET
                    check_out_time = NOW(),
                    estado_salida = 'manual',
                    total_horas_efectivas = $2,
                    estado_jornada = 'finalizada',
                    notas_check_out = COALESCE(notas_check_out, '') || ' [Checkout manual por administrador]',
                    updated_at = NOW()
                WHERE id = $1
            `, [registro.rows[0].id, Math.round(horasEfectivas * 100) / 100]);

            this.logger.log(`✅ Checkout manual exitoso para usuario ${usuarioId}`);
            return { success: true, horas: Math.round(horasEfectivas * 100) / 100 };

        } catch (error) {
            this.logger.error(`❌ Error en checkout manual:`, error.message);
            throw error;
        }
    }

    /**
     * Obtener estadísticas de jobs
     */
    getEstadisticas() {
        return {
            jobs_activos: this.jobs.size,
            jobs_programados: Array.from(this.jobs.keys()),
            ultima_ejecucion: new Date().toISOString(),
            timezone: 'America/Lima',
            horarios: {
                checkout_automatico: '18:00 (6:00 PM)',
                deteccion_faltas: '09:00 (9:00 AM)'
            }
        };
    }

    /**
     * Parar todos los jobs
     */
    stop() {
        this.logger.log('🛑 Deteniendo todos los jobs automáticos...');
        this.jobs.forEach((job, name) => {
            job.stop();
            this.logger.log(`   ❌ Job detenido: ${name}`);
        });
        this.jobs.clear();
    }

    /**
     * Reiniciar jobs
     */
    restart() {
        this.stop();
        this.scheduleJobs();
        this.logger.log('🔄 Jobs reiniciados exitosamente');
    }

    /**
     * Ejecutar checkout automático manualmente (para testing)
     */
    async testCheckoutAutomatico() {
        this.logger.log('🧪 Ejecutando checkout automático manualmente...');
        return await this.ejecutarCheckoutAutomatico();
    }

    /**
     * Ejecutar detección de faltas manualmente (para testing)
     */
    async testDeteccionFaltas() {
        this.logger.log('🧪 Ejecutando detección de faltas manualmente...');
        return await this.detectarYRegistrarFaltas();
    }
}

// Crear instancia singleton
let faltasService = null;

const getFaltasService = () => {
    if (!faltasService) {
        faltasService = new FaltasAutomaticasService();
    }
    return faltasService;
};

module.exports = {
    FaltasAutomaticasService,
    getFaltasService
};

// Log de inicialización
console.log('✅ FaltasAutomaticasService actualizado - Jobs automáticos disponibles');
console.log('⏰ Jobs programados: Checkout 18:00, Detección faltas 09:00 (L-V)');