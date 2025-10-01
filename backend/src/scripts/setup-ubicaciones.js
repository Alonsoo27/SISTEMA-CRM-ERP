const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

// Configuración de base de datos (usando las mismas variables de entorno)
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function setupUbicaciones() {
  const client = await db.connect();

  try {
    console.log('🇵🇪 Iniciando configuración de ubicaciones oficiales del Perú...');

    // Leer el archivo SQL
    const sqlFile = path.join(__dirname, '../sql/ubicaciones_peru.sql');
    const sqlContent = fs.readFileSync(sqlFile, 'utf8');

    console.log('📄 Ejecutando script SQL de ubicaciones...');

    // Ejecutar el SQL
    await client.query(sqlContent);

    console.log('✅ Tabla ubicaciones_peru creada exitosamente');

    // Verificar que se insertaron los datos
    const result = await client.query(`
      SELECT
        COUNT(*) as total_ubicaciones,
        COUNT(CASE WHEN nivel = 'departamento' THEN 1 END) as departamentos,
        COUNT(CASE WHEN nivel = 'provincia' THEN 1 END) as provincias,
        COUNT(CASE WHEN nivel = 'distrito' THEN 1 END) as distritos
      FROM ubicaciones_peru
    `);

    const stats = result.rows[0];
    console.log('📊 Estadísticas de ubicaciones:');
    console.log(`   - Total de registros: ${stats.total_ubicaciones}`);
    console.log(`   - Departamentos: ${stats.departamentos}`);
    console.log(`   - Provincias: ${stats.provincias}`);
    console.log(`   - Distritos: ${stats.distritos}`);

    // Mostrar algunos ejemplos
    const ejemplos = await client.query(`
      SELECT departamento, provincia, distrito
      FROM ubicaciones_peru
      WHERE nivel = 'distrito' AND departamento = 'LIMA'
      LIMIT 5
    `);

    console.log('🏙️ Ejemplos de distritos de Lima:');
    ejemplos.rows.forEach(row => {
      console.log(`   - ${row.departamento} → ${row.provincia} → ${row.distrito}`);
    });

    console.log('🎉 ¡Configuración de ubicaciones completada exitosamente!');

  } catch (error) {
    console.error('❌ Error configurando ubicaciones:', error);
    throw error;
  } finally {
    client.release();
    await db.end();
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  setupUbicaciones()
    .then(() => {
      console.log('✅ Script completado');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Error en script:', error);
      process.exit(1);
    });
}

module.exports = { setupUbicaciones };