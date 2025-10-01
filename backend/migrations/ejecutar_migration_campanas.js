// ============================================
// EJECUTAR MIGRACIÓN DE CAMPAÑAS
// ============================================

const fs = require('fs');
const path = require('path');
const { query } = require('../src/config/database');

async function ejecutarMigracion() {
    try {
        console.log('🚀 Iniciando migración de tabla campañas...');

        // Leer el archivo SQL
        const sqlPath = path.join(__dirname, 'create_campanas_table.sql');
        const sqlContent = fs.readFileSync(sqlPath, 'utf8');

        // Dividir por comandos (por punto y coma)
        const commands = sqlContent
            .split(';')
            .map(cmd => cmd.trim())
            .filter(cmd => cmd.length > 0 && !cmd.startsWith('--'));

        console.log(`📝 Ejecutando ${commands.length} comandos SQL...`);

        // Ejecutar cada comando
        for (let i = 0; i < commands.length; i++) {
            const command = commands[i];
            if (command) {
                try {
                    console.log(`   ${i + 1}. Ejecutando comando...`);
                    await query(command);
                } catch (error) {
                    if (error.message.includes('already exists')) {
                        console.log(`   ⚠️ Elemento ya existe, continuando...`);
                    } else {
                        throw error;
                    }
                }
            }
        }

        // Verificar que la tabla existe
        const verificacion = await query(`
            SELECT
                table_name,
                column_name,
                data_type,
                is_nullable
            FROM information_schema.columns
            WHERE table_name = 'campanas'
            ORDER BY ordinal_position
        `);

        console.log('\n✅ Migración completada exitosamente!');
        console.log(`📊 Tabla 'campanas' creada con ${verificacion.rows.length} columnas:`);

        verificacion.rows.forEach(col => {
            console.log(`   - ${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? '(NOT NULL)' : ''}`);
        });

        // Verificar datos de ejemplo
        const datosEjemplo = await query('SELECT COUNT(*) as total FROM campanas');
        console.log(`\n🎯 ${datosEjemplo.rows[0].total} campañas de ejemplo insertadas`);

        process.exit(0);

    } catch (error) {
        console.error('❌ Error en migración:', error);
        process.exit(1);
    }
}

// Ejecutar migración
ejecutarMigracion();