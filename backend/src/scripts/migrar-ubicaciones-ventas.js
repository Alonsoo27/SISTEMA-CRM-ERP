const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

// Configuración de base de datos
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Mapeo de correcciones conocidas
const CORRECCIONES_DEPARTAMENTOS = {
  'Lima': 'LIMA',
  'Cusco': 'CUSCO',
  'Arequipa': 'AREQUIPA',
  'La Libertad': 'LA LIBERTAD',
  'Piura': 'PIURA'
};

const CORRECCIONES_CIUDADES = {
  'Lima': 'LIMA',
  'Cusco': 'CUSCO',
  'Arequipa': 'AREQUIPA',
  'Trujillo': 'TRUJILLO',
  'Piura': 'PIURA'
};

async function analizarDatosInconsistentes() {
  const client = await db.connect();

  try {
    console.log('🔍 ANALIZANDO DATOS INCONSISTENTES...');
    console.log('=' .repeat(60));

    // Análisis de departamentos
    const deptQuery = `
      SELECT
        v.departamento,
        COUNT(*) as ventas_count,
        CASE
          WHEN EXISTS (
            SELECT 1 FROM ubicaciones_peru up
            WHERE UPPER(up.departamento) = UPPER(v.departamento)
          ) THEN '✅ VÁLIDO'
          ELSE '❌ INVÁLIDO'
        END as estado
      FROM ventas v
      WHERE v.departamento IS NOT NULL AND v.departamento != ''
      GROUP BY v.departamento
      ORDER BY ventas_count DESC
    `;

    const departamentos = await client.query(deptQuery);

    console.log('🏛️ DEPARTAMENTOS:');
    departamentos.rows.forEach(row => {
      console.log(`  ${row.estado} ${row.departamento}: ${row.ventas_count} ventas`);
    });

    // Análisis de ciudades
    const ciudadQuery = `
      SELECT
        v.ciudad,
        COUNT(*) as ventas_count,
        CASE
          WHEN EXISTS (
            SELECT 1 FROM ubicaciones_peru up
            WHERE UPPER(up.departamento) = UPPER(v.ciudad)
               OR UPPER(up.provincia) = UPPER(v.ciudad)
               OR UPPER(up.distrito) = UPPER(v.ciudad)
          ) THEN '✅ VÁLIDO'
          ELSE '❌ INVÁLIDO'
        END as estado
      FROM ventas v
      WHERE v.ciudad IS NOT NULL AND v.ciudad != ''
      GROUP BY v.ciudad
      ORDER BY ventas_count DESC
    `;

    const ciudades = await client.query(ciudadQuery);

    console.log('\n🏙️ CIUDADES:');
    ciudades.rows.forEach(row => {
      console.log(`  ${row.estado} ${row.ciudad}: ${row.ventas_count} ventas`);
    });

    return {
      departamentosInvalidos: departamentos.rows.filter(r => r.estado === '❌ INVÁLIDO'),
      ciudadesInvalidas: ciudades.rows.filter(r => r.estado === '❌ INVÁLIDO')
    };

  } finally {
    client.release();
  }
}

async function migrarDepartamentos() {
  const client = await db.connect();

  try {
    console.log('\n🔄 MIGRANDO DEPARTAMENTOS...');

    let totalCorregidos = 0;

    for (const [incorrecto, correcto] of Object.entries(CORRECCIONES_DEPARTAMENTOS)) {
      const result = await client.query(`
        UPDATE ventas
        SET departamento = $1
        WHERE departamento = $2
      `, [correcto, incorrecto]);

      if (result.rowCount > 0) {
        console.log(`  ✅ ${incorrecto} → ${correcto}: ${result.rowCount} ventas corregidas`);
        totalCorregidos += result.rowCount;
      }
    }

    // Corregir campos vacíos - asignar un valor por defecto en lugar de NULL
    const emptyResult = await client.query(`
      UPDATE ventas
      SET departamento = 'LIMA'
      WHERE departamento = '' OR TRIM(departamento) = ''
    `);

    if (emptyResult.rowCount > 0) {
      console.log(`  🧹 Campos vacíos limpiados: ${emptyResult.rowCount} registros`);
    }

    console.log(`\n📊 Total departamentos corregidos: ${totalCorregidos}`);
    return totalCorregidos;

  } finally {
    client.release();
  }
}

async function migrarCiudades() {
  const client = await db.connect();

  try {
    console.log('\n🔄 MIGRANDO CIUDADES...');

    let totalCorregidos = 0;

    for (const [incorrecto, correcto] of Object.entries(CORRECCIONES_CIUDADES)) {
      const result = await client.query(`
        UPDATE ventas
        SET ciudad = $1
        WHERE ciudad = $2
      `, [correcto, incorrecto]);

      if (result.rowCount > 0) {
        console.log(`  ✅ ${incorrecto} → ${correcto}: ${result.rowCount} ventas corregidas`);
        totalCorregidos += result.rowCount;
      }
    }

    // Corregir campos vacíos - asignar un valor por defecto en lugar de NULL
    const emptyResult = await client.query(`
      UPDATE ventas
      SET ciudad = 'LIMA'
      WHERE ciudad = '' OR TRIM(ciudad) = ''
    `);

    if (emptyResult.rowCount > 0) {
      console.log(`  🧹 Campos vacíos limpiados: ${emptyResult.rowCount} registros`);
    }

    console.log(`\n📊 Total ciudades corregidas: ${totalCorregidos}`);
    return totalCorregidos;

  } finally {
    client.release();
  }
}

async function verificarMigracion() {
  const client = await db.connect();

  try {
    console.log('\n✅ VERIFICANDO MIGRACIÓN...');

    // Verificar duplicados de departamentos
    const duplicadosDept = await client.query(`
      SELECT
        UPPER(departamento) as dept_upper,
        COUNT(*) as variaciones,
        STRING_AGG(DISTINCT departamento, ', ') as todas_variaciones
      FROM ventas
      WHERE departamento IS NOT NULL AND departamento != ''
      GROUP BY UPPER(departamento)
      HAVING COUNT(DISTINCT departamento) > 1
    `);

    if (duplicadosDept.rows.length > 0) {
      console.log('⚠️ Aún hay duplicados en departamentos:');
      duplicadosDept.rows.forEach(row => {
        console.log(`  - ${row.dept_upper}: ${row.todas_variaciones}`);
      });
    } else {
      console.log('✅ No hay duplicados en departamentos');
    }

    // Verificar duplicados de ciudades
    const duplicadosCiudad = await client.query(`
      SELECT
        UPPER(ciudad) as ciudad_upper,
        COUNT(*) as variaciones,
        STRING_AGG(DISTINCT ciudad, ', ') as todas_variaciones
      FROM ventas
      WHERE ciudad IS NOT NULL AND ciudad != ''
      GROUP BY UPPER(ciudad)
      HAVING COUNT(DISTINCT ciudad) > 1
    `);

    if (duplicadosCiudad.rows.length > 0) {
      console.log('⚠️ Aún hay duplicados en ciudades:');
      duplicadosCiudad.rows.forEach(row => {
        console.log(`  - ${row.ciudad_upper}: ${row.todas_variaciones}`);
      });
    } else {
      console.log('✅ No hay duplicados en ciudades');
    }

    // Mostrar estadísticas finales
    const estadisticas = await client.query(`
      SELECT
        COUNT(DISTINCT departamento) as departamentos_unicos,
        COUNT(DISTINCT ciudad) as ciudades_unicas,
        COUNT(*) as total_ventas
      FROM ventas
      WHERE departamento IS NOT NULL OR ciudad IS NOT NULL
    `);

    console.log('\n📈 ESTADÍSTICAS FINALES:');
    const stats = estadisticas.rows[0];
    console.log(`  - Departamentos únicos: ${stats.departamentos_unicos}`);
    console.log(`  - Ciudades únicas: ${stats.ciudades_unicas}`);
    console.log(`  - Total ventas con ubicación: ${stats.total_ventas}`);

  } finally {
    client.release();
  }
}

async function ejecutarMigracion() {
  console.log('🇵🇪 MIGRACIÓN DE UBICACIONES EN VENTAS');
  console.log('=' .repeat(60));
  console.log('📅 Fecha:', new Date().toLocaleString('es-PE'));
  console.log('🎯 Objetivo: Estandarizar ubicaciones según UBIGEO oficial\n');

  try {
    // Análisis inicial
    await analizarDatosInconsistentes();

    // Migración
    const deptCorregidos = await migrarDepartamentos();
    const ciudadCorregidas = await migrarCiudades();

    // Verificación
    await verificarMigracion();

    console.log('\n🎉 MIGRACIÓN COMPLETADA EXITOSAMENTE');
    console.log(`📊 Total registros corregidos: ${deptCorregidos + ciudadCorregidas}`);
    console.log('🔄 El análisis geográfico ya no debería mostrar errores de keys duplicadas');

  } catch (error) {
    console.error('❌ Error durante la migración:', error);
    throw error;
  } finally {
    await db.end();
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  ejecutarMigracion()
    .then(() => {
      console.log('\n✅ Script completado');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Error en script:', error);
      process.exit(1);
    });
}

module.exports = { ejecutarMigracion };