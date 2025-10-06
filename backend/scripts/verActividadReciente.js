// Script para ver actividad reciente
require('dotenv').config();
const { query } = require('../src/config/database');

async function verActividadReciente() {
    try {
        console.log('🔍 Buscando actividad de los últimos 3 días...\n');

        const registros = await query(`
            SELECT
                id, usuario_id, fecha,
                check_in_time AT TIME ZONE 'UTC' AT TIME ZONE 'America/Lima' as check_in_lima,
                check_out_time AT TIME ZONE 'UTC' AT TIME ZONE 'America/Lima' as check_out_lima,
                estado_jornada,
                CASE
                    WHEN check_in_time IS NOT NULL AND check_out_time IS NOT NULL THEN
                        EXTRACT(EPOCH FROM (check_out_time - check_in_time)) / 3600.0
                    WHEN check_in_time IS NOT NULL THEN
                        EXTRACT(EPOCH FROM (NOW() - check_in_time)) / 3600.0
                    ELSE 0
                END as horas_calculadas
            FROM actividad_diaria
            WHERE fecha >= CURRENT_DATE - INTERVAL '3 days'
            ORDER BY fecha DESC, created_at DESC
            LIMIT 10
        `);

        if (registros.rows.length === 0) {
            console.log('✅ No hay registros recientes');
            process.exit(0);
        }

        console.log(`📊 Encontrados ${registros.rows.length} registros:\n`);
        registros.rows.forEach(r => {
            const checkIn = r.check_in_lima ? new Date(r.check_in_lima).toLocaleTimeString('es-PE') : 'N/A';
            const checkOut = r.check_out_lima ? new Date(r.check_out_lima).toLocaleTimeString('es-PE') : 'N/A';
            const horas = r.horas_calculadas ? r.horas_calculadas.toFixed(2) : '0.00';

            console.log(`📅 Fecha: ${r.fecha}`);
            console.log(`   Usuario: ${r.usuario_id}`);
            console.log(`   Check-in: ${checkIn}`);
            console.log(`   Check-out: ${checkOut}`);
            console.log(`   Estado: ${r.estado_jornada}`);
            console.log(`   Horas: ${horas}h`);
            console.log('');
        });

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

verActividadReciente();
