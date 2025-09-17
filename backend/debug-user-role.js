const { query } = require('./src/config/database');

async function checkUserRole() {
    try {
        const user = await query('SELECT id, nombre, rol_id FROM usuarios WHERE id = 1');
        console.log('👤 Usuario:', user.rows[0]);
        
        const roles = await query('SELECT * FROM roles ORDER BY id');
        console.log('🔐 Roles disponibles:');
        roles.rows.forEach(role => console.log(\- ID \: \\));
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        process.exit(0);
    }
}

checkUserRole();
