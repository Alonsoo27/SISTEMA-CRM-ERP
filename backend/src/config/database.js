// SISTEMA CRM/ERP EMPRESARIAL V2.0
// Configuración de Base de Datos PostgreSQL
// Conexión a Supabase

const { Pool } = require('pg');

// Configuración del pool de conexiones
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    // ⚡ CONFIGURACIÓN DE CHARSET Y TIMEZONE
    options: "-c client_encoding=UTF8 -c timezone='America/Lima'"
});

// Función para ejecutar queries
const query = async (text, params) => {
    const start = Date.now();
    try {
        const res = await pool.query(text, params);
        const duration = Date.now() - start;
        
        if (process.env.NODE_ENV === 'development') {
            console.log('Database Query:', {
                query: text,
                duration: duration + 'ms',
                rows: res.rowCount
            });
        }
        
        return res;
    } catch (error) {
        console.error('Database Error:', error);
        throw error;
    }
};

// Test de conexión
const testConnection = async () => {
    try {
        const result = await query('SELECT NOW() as current_time, version() as postgres_version');
        console.log('Database connected successfully:', {
            time: result.rows[0].current_time,
            version: result.rows[0].postgres_version.split(' ')[0] + ' ' + result.rows[0].postgres_version.split(' ')[1]
        });
        return true;
    } catch (error) {
        console.error('Database connection failed:', error.message);
        return false;
    }
};

module.exports = {
    query,
    testConnection,
    pool
};
