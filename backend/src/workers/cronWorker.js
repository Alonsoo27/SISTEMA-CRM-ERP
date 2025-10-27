/**
 * 🔄 WORKER DE CRON JOBS PARA RAILWAY
 *
 * Este worker se ejecuta en un proceso separado del servidor principal
 * para manejar tareas programadas (cron jobs) de manera confiable.
 *
 * Tareas programadas:
 * - Procesamiento de seguimientos vencidos (cada hora en horario laboral)
 *
 * Fecha: 2025-10-20
 */

const cron = require('node-cron');
const SeguimientosController = require('../modules/prospectos/controllers/seguimientosController');

console.log('🚀 Iniciando worker de cron jobs...');

/**
 * ⏰ PROCESAMIENTO DE SEGUIMIENTOS VENCIDOS
 *
 * Horario:
 * - Lunes a Viernes: 8am-6pm (cada hora en punto)
 * - Sábados: 9am-12pm (cada hora en punto)
 * - Domingos: No se ejecuta
 */

// L-V: 8am-6pm cada hora
cron.schedule('0 8-18 * * 1-5', async () => {
  console.log('⏰ [L-V] Ejecutando procesamiento de seguimientos vencidos...');
  console.log('   Hora:', new Date().toLocaleString('es-PE', { timeZone: 'America/Lima' }));

  try {
    // Mock request y response objects
    const req = { body: {} };
    const res = {
      json: (data) => {
        console.log('✅ Procesamiento completado:', data);
        if (data.traspasados && data.traspasados.length > 0) {
          console.log(`   📊 ${data.traspasados.length} prospecto(s) traspasado(s)`);
        }
        return res;
      },
      status: (code) => {
        console.log(`   Status: ${code}`);
        return res;
      }
    };

    await SeguimientosController.procesarSeguimientosVencidos(req, res);

  } catch (error) {
    console.error('❌ Error en procesamiento de seguimientos vencidos:', error);
  }
}, {
  timezone: "America/Lima"
});

// Sábados: 9am-12pm cada hora
cron.schedule('0 9-12 * * 6', async () => {
  console.log('⏰ [SÁBADO] Ejecutando procesamiento de seguimientos vencidos...');
  console.log('   Hora:', new Date().toLocaleString('es-PE', { timeZone: 'America/Lima' }));

  try {
    const req = { body: {} };
    const res = {
      json: (data) => {
        console.log('✅ Procesamiento completado:', data);
        if (data.traspasados && data.traspasados.length > 0) {
          console.log(`   📊 ${data.traspasados.length} prospecto(s) traspasado(s)`);
        }
        return res;
      },
      status: (code) => {
        console.log(`   Status: ${code}`);
        return res;
      }
    };

    await SeguimientosController.procesarSeguimientosVencidos(req, res);

  } catch (error) {
    console.error('❌ Error en procesamiento de seguimientos vencidos:', error);
  }
}, {
  timezone: "America/Lima"
});

// Mantener el proceso activo
console.log('✅ Worker de cron jobs iniciado correctamente');
console.log('📅 Horarios programados:');
console.log('   - L-V: 8am-6pm (cada hora)');
console.log('   - Sábados: 9am-12pm (cada hora)');
console.log('   - Zona horaria: America/Lima');
console.log('');
console.log('⏳ Esperando próxima ejecución programada...');

// Prevenir que el proceso termine
process.on('SIGTERM', () => {
  console.log('⚠️  Recibida señal SIGTERM, cerrando worker...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('⚠️  Recibida señal SIGINT, cerrando worker...');
  process.exit(0);
});
