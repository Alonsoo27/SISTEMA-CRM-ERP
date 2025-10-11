// Script temporal para revisar timezone en la BD
const { Pool } = require('pg');

// Conexión directa a Supabase (usando la del .env)
const pool = new Pool({
    connectionString: 'postgresql://postgres.wwssvdnjwvtqxnwyjkdb:Digimonnaruto1@aws-0-sa-east-1.pooler.supabase.com:6543/postgres',
    ssl: { rejectUnauthorized: false }
});

const query = async (text, params) => {
    try {
        const res = await pool.query(text, params);
        return res;
    } catch (error) {
        console.error('Database Error:', error.message);
        throw error;
    }
};

async function checkTimezoneData() {
    try {
        console.log('🔍 1. Verificando tipo de columnas...\n');

        const columnas = await query(`
            SELECT
                column_name,
                data_type,
                datetime_precision
            FROM information_schema.columns
            WHERE table_name = 'actividad_diaria'
            AND column_name IN ('check_in_time', 'check_out_time', 'fecha', 'created_at')
            ORDER BY ordinal_position;
        `);
        console.table(columnas.rows);

        console.log('\n🔍 2. Verificando timezone de PostgreSQL...\n');

        const timezone = await query(`SHOW timezone;`);
        console.log('Timezone BD:', timezone.rows[0].TimeZone);

        console.log('\n🔍 3. Hora actual del servidor...\n');

        const tiempos = await query(`
            SELECT
                NOW() as now_utc,
                NOW() AT TIME ZONE 'America/Lima' as now_lima,
                CURRENT_TIMESTAMP as current_timestamp,
                LOCALTIME as local_time,
                LOCALTIMESTAMP as local_timestamp;
        `);
        console.table(tiempos.rows);

        console.log('\n🔍 4. Datos recientes de actividad_diaria (últimos 5 registros)...\n');

        const actividad = await query(`
            SELECT
                u.nombre || ' ' || u.apellido as usuario,
                ad.fecha,
                ad.check_in_time,
                ad.check_out_time,
                ad.created_at,
                -- Ver cómo se ve con conversión
                ad.check_in_time AT TIME ZONE 'UTC' AT TIME ZONE 'America/Lima' as check_in_lima_converted,
                -- Ver sin conversión
                ad.check_in_time::text as check_in_raw
            FROM actividad_diaria ad
            JOIN usuarios u ON ad.usuario_id = u.id
            ORDER BY ad.created_at DESC
            LIMIT 5;
        `);
        console.log('\nDatos de actividad:\n');
        console.table(actividad.rows);

        console.log('\n🔍 5. Comparando con datos correctos (si hay)...\n');

        const comparacion = await query(`
            SELECT
                u.nombre || ' ' || u.apellido as usuario,
                ad.fecha,
                ad.check_in_time,
                -- Extraer solo la hora
                TO_CHAR(ad.check_in_time, 'HH24:MI:SS') as hora_guardada,
                -- Si fuera UTC, convertir a Lima
                TO_CHAR(ad.check_in_time AT TIME ZONE 'UTC' AT TIME ZONE 'America/Lima', 'HH24:MI:SS') as si_fuera_utc_a_lima,
                -- Si ya es Lima, solo formatear
                TO_CHAR(ad.check_in_time, 'HH24:MI:SS') as si_ya_es_lima
            FROM actividad_diaria ad
            JOIN usuarios u ON ad.usuario_id = u.id
            WHERE ad.fecha >= CURRENT_DATE - INTERVAL '2 days'
            ORDER BY ad.created_at DESC;
        `);
        console.log('\nComparación de interpretaciones:\n');
        console.table(comparacion.rows);

        await pool.end();
        process.exit(0);

    } catch (error) {
        console.error('❌ Error:', error.message);
        await pool.end();
        process.exit(1);
    }
}

checkTimezoneData();
