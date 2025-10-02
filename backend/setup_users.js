// Script para ejecutar la migración de usuarios
const { query } = require('./src/config/database');
const fs = require('fs');
const path = require('path');

async function setupUsers() {
    try {
        console.log('🚀 Iniciando setup de sistema de usuarios...\n');

        // Leer el archivo SQL
        const sqlPath = path.join(__dirname, '../database/migrations/create_users_system.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        // Ejecutar el script
        console.log('📊 Ejecutando migraciones...');
        await query(sql);

        console.log('\n✅ Sistema de usuarios creado exitosamente!');
        console.log('\n📋 Credenciales iniciales:');
        console.log('   Email: eliashuaraca2012@gmail.com');
        console.log('   Password: admin123');
        console.log('   ⚠️  Cambiar contraseña después del primer login\n');

        process.exit(0);
    } catch (error) {
        console.error('❌ Error en setup:', error);
        process.exit(1);
    }
}

setupUsers();
