// Script temporal para limpiar registros de actividad incorrectos
require('dotenv').config();
const { query } = require('../src/config/database');

async function limpiarActividadHoy() {
    try {
        console.log('🔍 Buscando registros de hoy...');

        // Ver registros de hoy
        const fechaHoy = new Date().toISOString().split('T')[0];
        const registros = await query(`
            SELECT id, usuario_id, fecha,
                   check_in_time AT TIME ZONE 'UTC' AT TIME ZONE 'America/Lima' as check_in_lima,
                   check_out_time AT TIME ZONE 'UTC' AT TIME ZONE 'America/Lima' as check_out_lima,
                   estado_jornada
            FROM actividad_diaria
            WHERE fecha = $1
            ORDER BY created_at DESC
        `, [fechaHoy]);

        console.log(`\n📊 Encontrados ${registros.rows.length} registros de hoy:`);
        registros.rows.forEach(r => {
            console.log(`  ID: ${r.id}, Usuario: ${r.usuario_id}, Check-in: ${r.check_in_lima}, Estado: ${r.estado_jornada}`);
        });

        if (registros.rows.length === 0) {
            console.log('\n✅ No hay registros para limpiar');
            process.exit(0);
        }

        console.log('\n⚠️  ELIMINANDO registros de hoy...');
        const resultado = await query(`
            DELETE FROM actividad_diaria
            WHERE fecha = $1
            RETURNING id
        `, [fechaHoy]);

        console.log(`✅ ${resultado.rows.length} registros eliminados`);
        console.log('✅ Ya puedes hacer check-in correctamente');

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

limpiarActividadHoy();
