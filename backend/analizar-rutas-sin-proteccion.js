#!/usr/bin/env node
// ============================================
// SCRIPT DE ANÁLISIS DE RUTAS SIN PROTECCIÓN
// ============================================
// Busca rutas que tienen authenticateToken pero NO tienen
// requireRole o requireOwnership
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
    cyan: '\x1b[36m',
    magenta: '\x1b[35m'
};

// Configuración
const config = {
    directorioBase: path.join(__dirname, 'src'),
    verbose: process.argv.includes('--verbose') || process.argv.includes('-v')
};

// Estadísticas
const stats = {
    archivosAnalizados: 0,
    rutasEncontradas: 0,
    rutasProtegidas: 0,
    rutasSinProteccion: 0,
    detalles: []
};

/**
 * Función principal
 */
async function main() {
    console.log(`${colors.cyan}${colors.bright}
╔════════════════════════════════════════════════════╗
║   ANÁLISIS DE RUTAS SIN PROTECCIÓN DE ROLES       ║
║   Sistema CRM/ERP - Auditoría de Seguridad        ║
╚════════════════════════════════════════════════════╝
${colors.reset}\n`);

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
                !elemento.includes('.backup') &&
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

    if (config.verbose) {
        console.log(`${colors.cyan}📄 Analizando: ${rutaRelativa}${colors.reset}`);
    }

    try {
        const contenido = fs.readFileSync(rutaArchivo, 'utf8');
        const lineas = contenido.split('\n');

        // Detectar si usa requireRole o requireOwnership
        const usaRequireRole = contenido.includes('requireRole');
        const usaRequireOwnership = contenido.includes('requireOwnership');
        const usaAuthenticateToken = contenido.includes('authenticateToken');

        // Encontrar todas las definiciones de rutas
        const rutasEncontradas = [];

        lineas.forEach((linea, index) => {
            // Buscar definiciones de rutas (router.get, router.post, etc.)
            const matchRuta = linea.match(/router\.(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]/);

            if (matchRuta) {
                const metodo = matchRuta[1].toUpperCase();
                const ruta = matchRuta[2];
                const lineaCompleta = linea.trim();

                // Mirar las siguientes 5 líneas para rutas multilínea
                let contexto = lineaCompleta;
                for (let i = 1; i <= 5 && (index + i) < lineas.length; i++) {
                    const siguienteLinea = lineas[index + i].trim();
                    contexto += ' ' + siguienteLinea;

                    // Si encontramos el cierre de paréntesis, terminamos
                    if (siguienteLinea.includes(');')) {
                        break;
                    }
                }

                // Detectar middlewares de protección (directo o indirecto)
                const tieneProteccion =
                    contexto.includes('requireRole') ||
                    contexto.includes('requireOwnership') ||
                    contexto.includes('requireProductsAuth') ||
                    contexto.includes('requireAlmacenAccess') ||
                    contexto.includes('requireAlmacenOperations') ||
                    contexto.includes('requireAlmacenAdmin') ||
                    contexto.includes('requireVentasAccess') ||
                    contexto.includes('requireVentasWrite') ||
                    contexto.includes('requireVentasReports') ||
                    contexto.includes('requireVentasManager') ||
                    contexto.includes('requireManagerAccess') ||
                    contexto.includes('requirePostVentaAccess') ||
                    contexto.includes('requirePostVentaWrite') ||
                    contexto.includes('verificarAccesoEjecutivo') ||
                    contexto.includes('requireAccessoTotal');

                const tieneAuth = contexto.includes('authenticateToken');

                rutasEncontradas.push({
                    metodo,
                    ruta,
                    lineaNumero: index + 1,
                    tieneAuth,
                    tieneProteccion,
                    contexto: contexto.substring(0, 150) // Primeros 150 caracteres
                });
            }
        });

        // Clasificar rutas
        const rutasSinProteccion = rutasEncontradas.filter(r => r.tieneAuth && !r.tieneProteccion);
        const rutasProtegidas = rutasEncontradas.filter(r => r.tieneAuth && r.tieneProteccion);
        const rutasSinAuth = rutasEncontradas.filter(r => !r.tieneAuth);

        stats.rutasEncontradas += rutasEncontradas.length;
        stats.rutasProtegidas += rutasProtegidas.length;
        stats.rutasSinProteccion += rutasSinProteccion.length;

        // Guardar detalles si hay rutas sin protección
        if (rutasSinProteccion.length > 0) {
            stats.detalles.push({
                archivo: rutaRelativa,
                rutaCompleta: rutaArchivo,
                totalRutas: rutasEncontradas.length,
                rutasProtegidas: rutasProtegidas.length,
                rutasSinProteccion: rutasSinProteccion.length,
                rutasSinAuth: rutasSinAuth.length,
                detalleRutasSinProteccion: rutasSinProteccion.map(r => ({
                    metodo: r.metodo,
                    ruta: r.ruta,
                    linea: r.lineaNumero
                }))
            });

            console.log(`  ${colors.yellow}⚠️  ${nombreArchivo}: ${rutasSinProteccion.length} rutas sin protección de roles${colors.reset}`);

            if (config.verbose) {
                rutasSinProteccion.forEach(r => {
                    console.log(`     ${colors.magenta}${r.metodo} ${r.ruta}${colors.reset} (línea ${r.lineaNumero})`);
                });
            }
        } else if (rutasEncontradas.length > 0) {
            console.log(`  ${colors.green}✓ ${nombreArchivo}: Todas las rutas protegidas (${rutasProtegidas.length})${colors.reset}`);
        }

    } catch (error) {
        console.error(`  ${colors.red}❌ Error procesando archivo:${colors.reset}`, error.message);
    }
}

/**
 * Mostrar reporte final
 */
function mostrarReporte() {
    console.log(`\n${colors.bright}${colors.cyan}
╔════════════════════════════════════════════════════╗
║           REPORTE DE ANÁLISIS DE SEGURIDAD         ║
╚════════════════════════════════════════════════════╝
${colors.reset}`);

    console.log(`${colors.blue}📊 Estadísticas Generales:${colors.reset}`);
    console.log(`   Archivos analizados: ${stats.archivosAnalizados}`);
    console.log(`   Rutas encontradas: ${stats.rutasEncontradas}`);
    console.log(`   Rutas protegidas: ${colors.green}${stats.rutasProtegidas}${colors.reset}`);
    console.log(`   Rutas sin protección: ${stats.rutasSinProteccion > 0 ? colors.red : colors.green}${stats.rutasSinProteccion}${colors.reset}\n`);

    if (stats.detalles.length > 0) {
        console.log(`${colors.yellow}⚠️  ARCHIVOS CON RUTAS SIN PROTECCIÓN:${colors.reset}\n`);

        stats.detalles.forEach(detalle => {
            console.log(`${colors.bright}📄 ${detalle.archivo}${colors.reset}`);
            console.log(`   Total rutas: ${detalle.totalRutas} | Protegidas: ${colors.green}${detalle.rutasProtegidas}${colors.reset} | Sin protección: ${colors.red}${detalle.rutasSinProteccion}${colors.reset}`);

            console.log(`   ${colors.yellow}Rutas sin protección:${colors.reset}`);
            detalle.detalleRutasSinProteccion.forEach(r => {
                console.log(`      ${colors.magenta}${r.metodo.padEnd(6)}${colors.reset} ${r.ruta.padEnd(40)} ${colors.cyan}(línea ${r.linea})${colors.reset}`);
            });
            console.log('');
        });
    } else {
        console.log(`${colors.green}${colors.bright}
✅ ¡EXCELENTE!
   Todas las rutas autenticadas tienen protección de roles.
${colors.reset}`);
    }

    // Resumen de acciones recomendadas
    if (stats.rutasSinProteccion > 0) {
        console.log(`${colors.yellow}${colors.bright}
📋 ACCIONES RECOMENDADAS:
${colors.reset}${colors.yellow}
   1. Revisar cada ruta sin protección
   2. Agregar requireRole(GRUPOS_ROLES.XXX) según corresponda
   3. Considerar si la ruta debería ser pública o usar requireOwnership
   4. Volver a ejecutar este script para verificar
${colors.reset}`);
    }

    // Calcular porcentaje de protección
    const porcentajeProteccion = stats.rutasEncontradas > 0
        ? ((stats.rutasProtegidas / stats.rutasEncontradas) * 100).toFixed(1)
        : 0;

    console.log(`${colors.blue}
📈 Nivel de protección: ${porcentajeProteccion}%
${colors.reset}`);
}

/**
 * Guardar reporte en JSON
 */
function guardarReporteJSON() {
    const reporte = {
        fecha: new Date().toISOString(),
        estadisticas: {
            archivosAnalizados: stats.archivosAnalizados,
            rutasEncontradas: stats.rutasEncontradas,
            rutasProtegidas: stats.rutasProtegidas,
            rutasSinProteccion: stats.rutasSinProteccion,
            porcentajeProteccion: stats.rutasEncontradas > 0
                ? ((stats.rutasProtegidas / stats.rutasEncontradas) * 100).toFixed(1)
                : 0
        },
        archivosSinProteccion: stats.detalles
    };

    const nombreReporte = `analisis-seguridad-rutas-${Date.now()}.json`;
    fs.writeFileSync(path.join(__dirname, nombreReporte), JSON.stringify(reporte, null, 2));

    console.log(`${colors.blue}💾 Reporte guardado en: ${nombreReporte}${colors.reset}\n`);
}

// Ejecutar
main().catch(error => {
    console.error(`${colors.red}❌ Error fatal:${colors.reset}`, error);
    process.exit(1);
});
