// Script para migrar URLs de notificaciones
const { Pool } = require('pg');

const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'crm_erp_db',
    password: '',
    port: 5432,
});

async function migrarURLs() {
    const client = await pool.connect();

    try {
        console.log('🔄 Iniciando migración de URLs de notificaciones...\n');

        // 1. Actualizar notificaciones de prospectos
        console.log('📋 Actualizando URLs de prospectos...');
        const resultProspectos = await client.query(`
            UPDATE notificaciones
            SET accion_url = CONCAT('/prospectos?id=', prospecto_id, '&action=view')
            WHERE prospecto_id IS NOT NULL
              AND accion_url ~ '^/prospectos/[0-9]+$'
            RETURNING id, tipo, accion_url;
        `);
        console.log(`✅ ${resultProspectos.rowCount} notificaciones de prospectos actualizadas`);

        // 2. Actualizar notificaciones de ventas
        console.log('\n💰 Actualizando URLs de ventas...');
        const resultVentas = await client.query(`
            UPDATE notificaciones
            SET accion_url = CONCAT('/ventas?id=', (datos_adicionales::json->>'venta_id')::integer, '&action=view')
            WHERE datos_adicionales IS NOT NULL
              AND datos_adicionales::json->>'venta_id' IS NOT NULL
              AND accion_url ~ '^/ventas/[0-9]+$'
            RETURNING id, tipo, accion_url;
        `);
        console.log(`✅ ${resultVentas.rowCount} notificaciones de ventas actualizadas`);

        // 3. Verificar resultados
        console.log('\n📊 Verificando resultados...');
        const verificacion = await client.query(`
            SELECT
                id,
                tipo,
                titulo,
                accion_url,
                prospecto_id,
                TO_CHAR(created_at, 'YYYY-MM-DD HH24:MI:SS') as created_at
            FROM notificaciones
            WHERE usuario_id = 1
            ORDER BY created_at DESC
            LIMIT 5;
        `);

        console.log('\n📋 Últimas 5 notificaciones (usuario ID 1):');
        console.table(verificacion.rows);

        // 4. Estadísticas
        const stats = await client.query(`
            SELECT
                tipo,
                COUNT(*) as total,
                COUNT(CASE WHEN accion_url LIKE '%?id=%' THEN 1 END) as con_query_params,
                COUNT(CASE WHEN accion_url ~ '^/(prospectos|ventas)/[0-9]+$' THEN 1 END) as formato_antiguo
            FROM notificaciones
            GROUP BY tipo
            ORDER BY total DESC;
        `);

        console.log('\n📈 Estadísticas por tipo:');
        console.table(stats.rows);

        console.log('\n✅ Migración completada exitosamente!');

    } catch (error) {
        console.error('❌ Error durante la migración:', error);
    } finally {
        client.release();
        await pool.end();
    }
}

migrarURLs();
