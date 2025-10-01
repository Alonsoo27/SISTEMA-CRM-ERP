// Script para crear datos de prueba para la balanza de seguimientos
const { Pool } = require('pg');

// Configuración de la base de datos (ajustar según tu configuración)
const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'tu_database',
  user: 'tu_usuario',
  password: 'tu_password'
});

async function crearDatosPrueba() {
  const client = await pool.connect();

  try {
    console.log('🚀 Creando datos de prueba para balanza de seguimientos...');

    // 1. Seguimientos PENDIENTES
    console.log('📋 Insertando seguimientos pendientes...');

    await client.query(`
      INSERT INTO seguimientos (
        prospecto_id, asesor_id, tipo, fecha_programada, fecha_limite,
        descripcion, completado, vencido, visible_para_asesor
      ) VALUES
      ($1, $2, $3, $4, $5, $6, $7, $8, $9),
      ($10, $11, $12, $13, $14, $15, $16, $17, $18),
      ($19, $20, $21, $22, $23, $24, $25, $26, $27)
    `, [
      // Seguimiento para hoy
      1, 1, 'llamada', '2025-09-23T16:00:00Z', '2025-09-23T18:00:00Z',
      'Llamada de seguimiento comercial', false, false, true,

      // Seguimiento para mañana
      2, 1, 'email', '2025-09-24T10:00:00Z', '2025-09-24T12:00:00Z',
      'Envío de propuesta comercial', false, false, true,

      // Seguimiento VENCIDO
      3, 1, 'whatsapp', '2025-09-22T14:00:00Z', '2025-09-22T16:00:00Z',
      'WhatsApp de seguimiento - VENCIDO', false, true, true
    ]);

    // 2. Seguimientos REALIZADOS
    console.log('✅ Insertando seguimientos realizados...');

    await client.query(`
      INSERT INTO seguimientos (
        prospecto_id, asesor_id, tipo, fecha_programada, fecha_limite,
        descripcion, completado, vencido, visible_para_asesor,
        completado_por, fecha_completado, resultado_seguimiento
      ) VALUES
      ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12),
      ($13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24),
      ($25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35, $36),
      ($37, $38, $39, $40, $41, $42, $43, $44, $45, $46, $47, $48)
    `, [
      // Completado hoy
      4, 1, 'llamada', '2025-09-23T09:00:00Z', '2025-09-23T11:00:00Z',
      'Llamada exitosa - Interesado', true, false, true,
      1, '2025-09-23T09:30:00Z', 'Cliente muy interesado, solicita segunda reunión',

      // Completado ayer
      5, 1, 'reunion', '2025-09-22T15:00:00Z', '2025-09-22T17:00:00Z',
      'Reunión presencial cerrada', true, false, true,
      1, '2025-09-22T16:00:00Z', 'Reunión exitosa, enviar cotización',

      // Completado hace 3 días
      6, 1, 'email', '2025-09-20T11:00:00Z', '2025-09-20T13:00:00Z',
      'Email enviado con información', true, false, true,
      1, '2025-09-20T11:15:00Z', 'Email enviado, cliente respondió positivamente',

      // Completado hace una semana
      7, 1, 'whatsapp', '2025-09-16T14:00:00Z', '2025-09-16T16:00:00Z',
      'WhatsApp con documentos', true, false, true,
      1, '2025-09-16T14:20:00Z', 'Documentos enviados, cliente revisando'
    ]);

    // 3. Actualizar estados de prospectos
    console.log('🔄 Actualizando estados de prospectos...');

    await client.query(`
      UPDATE prospectos
      SET estado_seguimiento = 'pendiente', fecha_ultimo_seguimiento = '2025-09-23T16:00:00Z'
      WHERE id IN (1, 2, 3)
    `);

    await client.query(`
      UPDATE prospectos
      SET estado_seguimiento = 'realizado', fecha_ultimo_seguimiento = '2025-09-23T09:30:00Z'
      WHERE id IN (4, 5, 6, 7)
    `);

    console.log('✅ Datos de prueba creados exitosamente!');
    console.log('📊 Resumen:');
    console.log('   - 3 seguimientos pendientes (1 vencido)');
    console.log('   - 4 seguimientos realizados');
    console.log('   - Estados de prospectos actualizados');

  } catch (error) {
    console.error('❌ Error creando datos de prueba:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  crearDatosPrueba();
}

module.exports = { crearDatosPrueba };