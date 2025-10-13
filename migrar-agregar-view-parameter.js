// Script para agregar parámetro VIEW a URLs de notificaciones
const { Pool } = require('pg');

const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'crm_erp_db',
    password: '',
    port: 5432,
});

async function migrarViewParameters() {
    const client = await pool.connect();

    try {
        console.log('🔄 Iniciando migración de parámetros VIEW en notificaciones...\n');

        // 1. SEGUIMIENTOS - Vista "seguimientos" (Balanza)
        console.log('📋 Actualizando URLs de seguimientos a vista "seguimientos"...');
        const resultSeguimientos = await client.query(`
            UPDATE notificaciones
            SET accion_url = REPLACE(accion_url, '/prospectos?id=', '/prospectos?view=seguimientos&id=')
            WHERE tipo IN (
                'seguimiento_vencido',
                'seguimiento_urgente',
                'seguimiento_critico',
                'seguimiento_proximo'
            )
            AND accion_url LIKE '/prospectos?id=%'
            AND accion_url NOT LIKE '%view=seguimientos%'
            RETURNING id, tipo, accion_url;
        `);
        console.log(`✅ ${resultSeguimientos.rowCount} notificaciones de seguimientos actualizadas`);

        // Caso especial: seguimiento_completado va a kanban
        const resultCompletado = await client.query(`
            UPDATE notificaciones
            SET accion_url = REPLACE(accion_url, '/prospectos?id=', '/prospectos?view=kanban&id=')
            WHERE tipo = 'seguimiento_completado'
            AND accion_url LIKE '/prospectos?id=%'
            AND accion_url NOT LIKE '%view=kanban%'
            RETURNING id, tipo, accion_url;
        `);
        console.log(`✅ ${resultCompletado.rowCount} notificaciones de seguimiento completado actualizadas`);

        // 2. PROSPECTOS - Vista "kanban" (Pipeline)
        console.log('\n📊 Actualizando URLs de prospectos a vista "kanban"...');
        const resultProspectos = await client.query(`
            UPDATE notificaciones
            SET accion_url = REPLACE(accion_url, '/prospectos?id=', '/prospectos?view=kanban&id=')
            WHERE tipo IN (
                'prospecto_creado',
                'prospecto_reasignado',
                'prospecto_libre_activado',
                'estado_cotizado',
                'estado_negociacion',
                'oportunidad_alta'
            )
            AND accion_url LIKE '/prospectos?id=%'
            AND accion_url NOT LIKE '%view=kanban%'
            RETURNING id, tipo, accion_url;
        `);
        console.log(`✅ ${resultProspectos.rowCount} notificaciones de prospectos actualizadas`);

        // 3. PROSPECTOS - Vista "lista"
        console.log('\n📝 Actualizando URLs de prospectos a vista "lista"...');
        const resultLista = await client.query(`
            UPDATE notificaciones
            SET accion_url = REPLACE(accion_url, '/prospectos?id=', '/prospectos?view=lista&id=')
            WHERE tipo IN (
                'venta_perdida',
                'alerta_reasignaciones'
            )
            AND accion_url LIKE '/prospectos?id=%'
            AND accion_url NOT LIKE '%view=lista%'
            RETURNING id, tipo, accion_url;
        `);
        console.log(`✅ ${resultLista.rowCount} notificaciones de lista actualizadas`);

        // 4. VENTAS - Vista "lista"
        console.log('\n💰 Actualizando URLs de ventas a vista "lista"...');
        const resultVentas = await client.query(`
            UPDATE notificaciones
            SET accion_url = REPLACE(accion_url, '/ventas?id=', '/ventas?view=lista&id=')
            WHERE tipo IN (
                'venta_cerrada',
                'conversion_exitosa'
            )
            AND accion_url LIKE '/ventas?id=%'
            AND accion_url NOT LIKE '%view=lista%'
            RETURNING id, tipo, accion_url;
        `);
        console.log(`✅ ${resultVentas.rowCount} notificaciones de ventas actualizadas`);

        // 5. Verificar resultados
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
            LIMIT 10;
        `);

        console.log('\n📋 Últimas 10 notificaciones (usuario ID 1):');
        console.table(verificacion.rows);

        // 6. Estadísticas detalladas
        const stats = await client.query(`
            SELECT
                tipo,
                COUNT(*) as total,
                COUNT(CASE WHEN accion_url LIKE '%view=kanban%' THEN 1 END) as vista_kanban,
                COUNT(CASE WHEN accion_url LIKE '%view=seguimientos%' THEN 1 END) as vista_seguimientos,
                COUNT(CASE WHEN accion_url LIKE '%view=lista%' THEN 1 END) as vista_lista,
                COUNT(CASE WHEN accion_url LIKE '%view=%' THEN 1 END) as total_con_view,
                COUNT(CASE WHEN accion_url NOT LIKE '%view=%' THEN 1 END) as sin_view
            FROM notificaciones
            GROUP BY tipo
            ORDER BY total DESC;
        `);

        console.log('\n📈 Estadísticas por tipo:');
        console.table(stats.rows);

        // 7. Verificar que no haya URLs sin view parameter
        const sinView = await client.query(`
            SELECT COUNT(*) as notificaciones_sin_view
            FROM notificaciones
            WHERE (accion_url LIKE '/prospectos%' OR accion_url LIKE '/ventas%')
            AND accion_url NOT LIKE '%view=%';
        `);

        console.log('\n🔍 Verificación final:');
        console.log(`   Notificaciones sin parámetro view: ${sinView.rows[0].notificaciones_sin_view}`);

        if (sinView.rows[0].notificaciones_sin_view === '0') {
            console.log('\n✅ ¡Migración completada exitosamente! Todas las URLs tienen parámetro view.');
        } else {
            console.log('\n⚠️  Atención: Aún hay notificaciones sin parámetro view (pueden ser URLs especiales).');
        }

    } catch (error) {
        console.error('❌ Error durante la migración:', error);
    } finally {
        client.release();
        await pool.end();
    }
}

migrarViewParameters();
