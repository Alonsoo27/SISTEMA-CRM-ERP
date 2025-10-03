#!/usr/bin/env node
// ============================================
// SCRIPT DE ACTUALIZACIÓN DE PERMISOS
// ============================================
// Automatiza la actualización de todos los archivos de rutas
// para usar el sistema centralizado de roles
// ============================================

const fs = require('fs');
const path = require('path');

// Colores para consola
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    red: '\x1b[31m',
    cyan: '\x1b[36m'
};

// Configuración
const config = {
    dryRun: process.argv.includes('--dry-run') || process.argv.includes('-d'),
    verbose: process.argv.includes('--verbose') || process.argv.includes('-v'),
    force: process.argv.includes('--force') || process.argv.includes('-f'),
    directorioBase: path.join(__dirname, 'src')
};

// Estadísticas
const stats = {
    archivosAnalizados: 0,
    archivosModificados: 0,
    archivosOmitidos: 0,
    errores: [],
    cambios: []
};

// Mapeo de roles antiguos a nuevos (usando constantes)
const MAPEO_ROLES = {
    // Roles en minúsculas o incorrectos -> Constante correcta
    'admin': 'ROLES.ADMIN',
    'supervisor': 'GRUPOS_ROLES.JEFES_Y_EJECUTIVOS', // 'supervisor' no existe, usar jefes
    'ADMIN': 'ROLES.ADMIN',
    'SUPER_ADMIN': 'ROLES.SUPER_ADMIN',
    'GERENTE': 'ROLES.GERENTE',
    'JEFE_VENTAS': 'ROLES.JEFE_VENTAS',
    'JEFE_MARKETING': 'ROLES.JEFE_MARKETING',
    'JEFE_SOPORTE': 'ROLES.JEFE_SOPORTE',
    'JEFE_ALMACEN': 'ROLES.JEFE_ALMACEN',
    'VENDEDOR': 'ROLES.VENDEDOR',
    'MARKETING_EJECUTOR': 'ROLES.MARKETING_EJECUTOR',
    'SOPORTE_TECNICO': 'ROLES.SOPORTE_TECNICO',
    'ALMACENERO': 'ROLES.ALMACENERO'
};

// Mapeo inteligente de combinaciones comunes de roles a grupos
const MAPEO_GRUPOS = {
    'ADMIN,GERENTE,JEFE_VENTAS,SUPER_ADMIN,VENDEDOR': 'GRUPOS_ROLES.VENTAS_COMPLETO',
    'JEFE_VENTAS,VENDEDOR': 'GRUPOS_ROLES.VENTAS',
    'ADMIN,SUPER_ADMIN': 'GRUPOS_ROLES.EJECUTIVOS',
    'ADMIN,GERENTE,SUPER_ADMIN': 'GRUPOS_ROLES.EJECUTIVOS',
    'ALMACENERO,JEFE_ALMACEN': 'GRUPOS_ROLES.ALMACEN',
    'JEFE_SOPORTE,SOPORTE_TECNICO': 'GRUPOS_ROLES.SOPORTE',
    'JEFE_MARKETING,MARKETING_EJECUTOR': 'GRUPOS_ROLES.MARKETING',
    'ADMIN,GERENTE,JEFE_ALMACEN,JEFE_MARKETING,JEFE_SOPORTE,JEFE_VENTAS,SUPER_ADMIN': 'GRUPOS_ROLES.JEFES_Y_EJECUTIVOS'
};

/**
 * Función principal
 */
async function main() {
    console.log(`${colors.cyan}${colors.bright}
╔════════════════════════════════════════════════════╗
║   SCRIPT DE ACTUALIZACIÓN DE PERMISOS v2.0        ║
║   Sistema CRM/ERP - Roles Centralizados           ║
╚════════════════════════════════════════════════════╝
${colors.reset}`);

    if (config.dryRun) {
        console.log(`${colors.yellow}🔍 MODO DRY-RUN: No se aplicarán cambios reales${colors.reset}\n`);
    }

    // Buscar todos los archivos de rutas
    const archivosRutas = buscarArchivosRutas(config.directorioBase);
    console.log(`${colors.blue}📂 Encontrados ${archivosRutas.length} archivos de rutas${colors.reset}\n`);

    // Procesar cada archivo
    for (const archivo of archivosRutas) {
        await procesarArchivo(archivo);
    }

    // Mostrar reporte final
    mostrarReporte();

    // Guardar reporte en JSON
    guardarReporteJSON();
}

/**
 * Buscar archivos de rutas recursivamente
 */
function buscarArchivosRutas(directorio, archivos = []) {
    try {
        const elementos = fs.readdirSync(directorio);

        elementos.forEach(elemento => {
            const rutaCompleta = path.join(directorio, elemento);
            const stat = fs.statSync(rutaCompleta);

            if (stat.isDirectory() && !elemento.includes('node_modules') && !elemento.includes('.git')) {
                buscarArchivosRutas(rutaCompleta, archivos);
            } else if (
                stat.isFile() &&
                (elemento.endsWith('Routes.js') || elemento.endsWith('routes.js')) &&
                !elemento.includes('_original') &&
                !elemento.includes('_clean') &&
                !elemento.includes('_backup') &&
                !elemento.includes('.new.js')
            ) {
                archivos.push(rutaCompleta);
            }
        });

        return archivos;
    } catch (error) {
        console.error(`${colors.red}❌ Error buscando archivos en ${directorio}:${colors.reset}`, error.message);
        return archivos;
    }
}

/**
 * Procesar un archivo de rutas
 */
async function procesarArchivo(rutaArchivo) {
    stats.archivosAnalizados++;
    const nombreArchivo = path.basename(rutaArchivo);
    const rutaRelativa = path.relative(config.directorioBase, rutaArchivo);

    console.log(`${colors.cyan}📄 Procesando: ${rutaRelativa}${colors.reset}`);

    try {
        let contenido = fs.readFileSync(rutaArchivo, 'utf8');
        const contenidoOriginal = contenido;

        let necesitaCambios = false;
        let cambiosAplicados = [];

        // 1. Verificar si ya tiene los imports de roles
        const tieneImportRoles = contenido.includes("require('../../../config/roles')") ||
                                  contenido.includes("require('../../config/roles')");

        // 2. Verificar si usa requireRole
        const usaRequireRole = contenido.includes('requireRole(');

        // 3. Verificar si tiene roles hardcodeados
        const tieneRolesHardcodeados = /requireRole\(\s*\[['"][A-Z_]+['"]/g.test(contenido);

        if (!usaRequireRole) {
            console.log(`  ${colors.yellow}⏭️  No usa requireRole, omitiendo${colors.reset}`);
            stats.archivosOmitidos++;
            return;
        }

        // 4. Agregar import si no existe
        if (!tieneImportRoles && usaRequireRole) {
            contenido = agregarImportRoles(contenido, rutaArchivo);
            necesitaCambios = true;
            cambiosAplicados.push('Agregado import de roles');
        }

        // 5. Reemplazar requireRole con roles hardcodeados
        if (tieneRolesHardcodeados) {
            const resultado = reemplazarRequireRole(contenido);
            contenido = resultado.contenido;
            if (resultado.cambios > 0) {
                necesitaCambios = true;
                cambiosAplicados.push(`Reemplazados ${resultado.cambios} requireRole`);
            }
        }

        // 6. Aplicar cambios si es necesario
        if (necesitaCambios) {
            if (!config.dryRun) {
                // Crear backup
                fs.writeFileSync(rutaArchivo + '.backup', contenidoOriginal);

                // Escribir archivo actualizado
                fs.writeFileSync(rutaArchivo, contenido);

                console.log(`  ${colors.green}✅ Modificado: ${cambiosAplicados.join(', ')}${colors.reset}`);
            } else {
                console.log(`  ${colors.yellow}📝 [DRY-RUN] Cambios detectados: ${cambiosAplicados.join(', ')}${colors.reset}`);
            }

            stats.archivosModificados++;
            stats.cambios.push({
                archivo: rutaRelativa,
                cambios: cambiosAplicados
            });
        } else {
            console.log(`  ${colors.green}✓ Ya está actualizado${colors.reset}`);
            stats.archivosOmitidos++;
        }

    } catch (error) {
        console.error(`  ${colors.red}❌ Error procesando archivo:${colors.reset}`, error.message);
        stats.errores.push({
            archivo: rutaRelativa,
            error: error.message
        });
    }

    console.log(''); // Línea en blanco
}

/**
 * Agregar import de roles al archivo
 */
function agregarImportRoles(contenido, rutaArchivo) {
    // Calcular la ruta relativa correcta a config/roles.js
    const directorioArchivo = path.dirname(rutaArchivo);
    const rutaConfig = path.join(__dirname, 'src', 'config', 'roles.js');
    const rutaRelativa = path.relative(directorioArchivo, rutaConfig).replace(/\\/g, '/');

    // Buscar la línea donde se importa el middleware de auth
    const regexAuth = /const\s+\{[^}]*\}\s*=\s*require\(['"].*\/middleware\/auth['"]\);?/;
    const matchAuth = contenido.match(regexAuth);

    if (matchAuth) {
        // Agregar import justo después del import de auth
        const importRoles = `\n// Importar constantes de roles\nconst { ROLES, GRUPOS_ROLES, PERMISOS_OPERACION } = require('${rutaRelativa}');`;
        contenido = contenido.replace(regexAuth, matchAuth[0] + importRoles);
    } else {
        // Si no encuentra auth, agregar después de los requires
        const lineas = contenido.split('\n');
        let indiceUltimoRequire = -1;

        lineas.forEach((linea, index) => {
            if (linea.includes('require(') && !linea.includes('//')) {
                indiceUltimoRequire = index;
            }
        });

        if (indiceUltimoRequire >= 0) {
            lineas.splice(indiceUltimoRequire + 1, 0, '', '// Importar constantes de roles', `const { ROLES, GRUPOS_ROLES, PERMISOS_OPERACION } = require('${rutaRelativa}');`);
            contenido = lineas.join('\n');
        }
    }

    return contenido;
}

/**
 * Reemplazar requireRole con constantes
 */
function reemplazarRequireRole(contenido) {
    let cambios = 0;

    // Regex para encontrar requireRole con arrays de roles
    const regex = /requireRole\(\s*\[([^\]]+)\]\s*\)/g;

    contenido = contenido.replace(regex, (match, rolesStr) => {
        cambios++;

        // Limpiar y extraer roles
        const roles = rolesStr
            .split(',')
            .map(r => r.trim().replace(/['"]/g, ''))
            .filter(r => r.length > 0);

        // Crear clave normalizada para buscar en MAPEO_GRUPOS (ordenada alfabéticamente)
        const rolesOrdenados = [...roles].sort();
        const claveGrupo = rolesOrdenados.join(',');

        // Intentar encontrar grupo predefinido
        if (MAPEO_GRUPOS[claveGrupo]) {
            return `requireRole(${MAPEO_GRUPOS[claveGrupo]})`;
        }

        // Si no hay grupo, convertir cada rol individualmente
        const rolesConvertidos = roles.map(rol => {
            return MAPEO_ROLES[rol] || `ROLES.${rol}`;
        });

        return `requireRole([${rolesConvertidos.join(', ')}])`;
    });

    return { contenido, cambios };
}

/**
 * Mostrar reporte final
 */
function mostrarReporte() {
    console.log(`${colors.bright}${colors.cyan}
╔════════════════════════════════════════════════════╗
║              REPORTE DE ACTUALIZACIÓN              ║
╚════════════════════════════════════════════════════╝
${colors.reset}`);

    console.log(`${colors.blue}📊 Estadísticas:${colors.reset}`);
    console.log(`   Archivos analizados: ${stats.archivosAnalizados}`);
    console.log(`   Archivos modificados: ${colors.green}${stats.archivosModificados}${colors.reset}`);
    console.log(`   Archivos omitidos: ${colors.yellow}${stats.archivosOmitidos}${colors.reset}`);
    console.log(`   Errores: ${stats.errores.length > 0 ? colors.red : colors.green}${stats.errores.length}${colors.reset}\n`);

    if (stats.cambios.length > 0) {
        console.log(`${colors.green}✅ Cambios aplicados:${colors.reset}`);
        stats.cambios.forEach(({ archivo, cambios }) => {
            console.log(`   📝 ${archivo}`);
            cambios.forEach(cambio => {
                console.log(`      → ${cambio}`);
            });
        });
        console.log('');
    }

    if (stats.errores.length > 0) {
        console.log(`${colors.red}❌ Errores encontrados:${colors.reset}`);
        stats.errores.forEach(({ archivo, error }) => {
            console.log(`   📄 ${archivo}: ${error}`);
        });
        console.log('');
    }

    if (config.dryRun) {
        console.log(`${colors.yellow}${colors.bright}
⚠️  MODO DRY-RUN ACTIVO
   No se aplicaron cambios reales.
   Ejecuta sin --dry-run para aplicar los cambios.
${colors.reset}`);
    } else {
        console.log(`${colors.green}${colors.bright}
✅ Actualización completada
   Se crearon backups (.backup) de los archivos modificados.
   Puedes revertir los cambios copiando los .backup sobre los originales.
${colors.reset}`);
    }
}

/**
 * Guardar reporte en JSON
 */
function guardarReporteJSON() {
    const reporte = {
        fecha: new Date().toISOString(),
        modo: config.dryRun ? 'dry-run' : 'aplicado',
        estadisticas: {
            archivosAnalizados: stats.archivosAnalizados,
            archivosModificados: stats.archivosModificados,
            archivosOmitidos: stats.archivosOmitidos,
            errores: stats.errores.length
        },
        cambios: stats.cambios,
        errores: stats.errores
    };

    const nombreReporte = `reporte-permisos-${config.dryRun ? 'dry-run-' : ''}${Date.now()}.json`;
    fs.writeFileSync(path.join(__dirname, nombreReporte), JSON.stringify(reporte, null, 2));

    console.log(`${colors.blue}📄 Reporte guardado en: ${nombreReporte}${colors.reset}\n`);
}

// Ejecutar
main().catch(error => {
    console.error(`${colors.red}❌ Error fatal:${colors.reset}`, error);
    process.exit(1);
});
