// Test directo de conexión
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: 'postgresql://postgres:Digimonnaruto1@db.wwssvdnjwvtqxnwyjkdb.supabase.co:5432/postgres',
    ssl: { rejectUnauthorized: false }
});

async function test() {
    try {
        const result = await pool.query('SELECT NOW()');
        console.log('✅ Conexión exitosa:', result.rows[0]);
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
    process.exit();
}

test();
