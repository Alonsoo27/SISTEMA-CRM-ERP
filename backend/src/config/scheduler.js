// ============================================
// CONFIGURACIÓN DE TAREAS PROGRAMADAS (CRON JOBS)
// ============================================

const cron = require('node-cron');
const procesoNocturnoService = require('../modules/marketing/services/procesoNocturnoService');
const actividadesService = require('../modules/marketing/services/actividadesService');

/**
 * Inicializar todos los cron jobs del sistema
 */
function inicializarScheduler() {
    console.log('🕐 Inicializando scheduler de tareas programadas...');

    // ============================================
    // PROCESO NOCTURNO MARKETING - 11:59 PM diariamente
    // ============================================
    // Cron expression: '59 23 * * *' = A las 11:59 PM todos los días
    cron.schedule('59 23 * * *', async () => {
        try {
            console.log('\n🌙 ===================================');
            console.log('🌙 INICIANDO PROCESO NOCTURNO');
            console.log('🌙 ===================================');

            const resultado = await procesoNocturnoService.procesarActividadesNoGestionadas();

            console.log('✅ PROCESO NOCTURNO COMPLETADO');
            console.log(`📊 Actividades procesadas: ${resultado.actividades_procesadas}`);
            console.log(`📝 Actividades marcadas como no_realizada: ${resultado.actividades_marcadas}`);
            console.log('🌙 ===================================\n');

        } catch (error) {
            console.error('❌ ERROR EN PROCESO NOCTURNO:', error);
        }
    }, {
        timezone: 'America/Mexico_City' // Ajusta según tu zona horaria
    });

    console.log('✅ Proceso nocturno programado: 11:59 PM diariamente');

    // ============================================
    // ACTUALIZAR ESTADOS DE ACTIVIDADES - Cada 2 minutos
    // ============================================
    // Cron expression: '*/2 * * * *' = Cada 2 minutos
    cron.schedule('*/2 * * * *', async () => {
        try {
            await actividadesService.actualizarEstadosAutomatico();
        } catch (error) {
            console.error('❌ Error actualizando estados de actividades:', error.message);
        }
    }, {
        timezone: 'America/Mexico_City'
    });

    console.log('✅ Actualización de estados programada: cada 2 minutos');

    // ============================================
    // PRUEBA RÁPIDA (Solo para desarrollo - comentar en producción)
    // ============================================
    // Descomentar solo para testing - se ejecuta cada minuto
    /*
    cron.schedule('* * * * *', async () => {
        console.log('🔧 Test proceso nocturno (cada minuto)...');
        try {
            const resultado = await procesoNocturnoService.procesarActividadesNoGestionadas();
            console.log(`✅ Test completado: ${resultado.actividades_marcadas} marcadas`);
        } catch (error) {
            console.error('❌ Error en test:', error.message);
        }
    });
    */

    console.log('✅ Scheduler inicializado correctamente\n');
}

module.exports = { inicializarScheduler };
