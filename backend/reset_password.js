// ============================================
// SCRIPT PARA RESETEAR PASSWORDS DE USUARIOS
// Uso: node reset_password.js email@example.com nuevaPassword
// ============================================

require('dotenv').config();
const bcrypt = require('bcrypt');
const { query } = require('./src/config/database');

async function resetPassword(email, newPassword) {
    try {
        console.log('\n🔐 Iniciando reseteo de password...');
        console.log('Email:', email);

        // Verificar que el usuario existe
        const userCheck = await query(
            'SELECT id, email, nombre, apellido FROM usuarios WHERE email = $1',
            [email]
        );

        if (userCheck.rows.length === 0) {
            console.error('❌ Error: Usuario no encontrado');
            process.exit(1);
        }

        const user = userCheck.rows[0];
        console.log(`✅ Usuario encontrado: ${user.nombre} ${user.apellido}`);

        // Generar hash de la nueva password
        console.log('🔄 Generando hash bcrypt...');
        const rounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
        const hash = await bcrypt.hash(newPassword, rounds);

        // Actualizar password
        await query(
            `UPDATE usuarios
             SET password_hash = $1,
                 password_cambiado_en = CURRENT_TIMESTAMP,
                 debe_cambiar_password = false
             WHERE email = $2`,
            [hash, email]
        );

        console.log('✅ Password actualizado exitosamente');
        console.log(`\n📋 Nuevas credenciales:`);
        console.log(`   Email: ${email}`);
        console.log(`   Password: ${newPassword}`);
        console.log('\n⚠️  Guarda estas credenciales en un lugar seguro\n');

    } catch (error) {
        console.error('❌ Error al resetear password:', error.message);
        process.exit(1);
    }
}

// Validar argumentos
const email = process.argv[2];
const password = process.argv[3];

if (!email || !password) {
    console.log('\n📖 Uso correcto:');
    console.log('   node reset_password.js email@example.com nuevaPassword\n');
    console.log('Ejemplos:');
    console.log('   node reset_password.js admin@test.com admin123');
    console.log('   node reset_password.js usuario@empresa.com MiPassword2024\n');
    process.exit(1);
}

// Ejecutar
resetPassword(email, password).then(() => {
    process.exit(0);
}).catch(error => {
    console.error('Error:', error);
    process.exit(1);
});
