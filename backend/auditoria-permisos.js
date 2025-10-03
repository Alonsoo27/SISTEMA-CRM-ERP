// ========================================
// SCRIPT DE AUDITORÍA DE PERMISOS
// ========================================
// Ejecutar con: node backend/auditoria-permisos.js
// ========================================

const fs = require('fs');
const path = require('path');

const resultados = {
    rutas_con_requireRole: [],
    rutas_con_requireOwnership: [],
    rutas_sin_proteccion: [],
    roles_encontrados: new Set(),
    resumen_por_modulo: {}
};

// Función para analizar un archivo de rutas
function analizarArchivoRutas(rutaArchivo) {
    try {
        const contenido = fs.readFileSync(rutaArchivo, 'utf8');
        const nombreArchivo = path.basename(rutaArchivo);
        const modulo = path.dirname(rutaArchivo).split(path.sep).slice(-2).join('/');

        // Buscar patrones de requireRole
        const patronRequireRole = /router\.(get|post|put|delete|patch)\(['"]([^'"]+)['"].*?requireRole\(\[([^\]]+)\]/g;
        let match;

        while ((match = patronRequireRole.exec(contenido)) !== null) {
            const metodo = match[1].toUpperCase();
            const ruta = match[2];
            const rolesRaw = match[3];

            // Limpiar y extraer roles
            const roles = rolesRaw
                .split(',')
                .map(r => r.trim().replace(/['"]/g, ''))
                .filter(r => r.length > 0);

            roles.forEach(rol => resultados.roles_encontrados.add(rol));

            resultados.rutas_con_requireRole.push({
                archivo: nombreArchivo,
                modulo: modulo,
                metodo: metodo,
                ruta: ruta,
                roles: roles,
                ruta_completa: `/api/${modulo.split('/')[0]}${ruta}`
            });
        }

        // Buscar patrones de requireOwnership
        const patronRequireOwnership = /router\.(get|post|put|delete|patch)\(['"]([^'"]+)['"].*?requireOwnership/g;
        while ((match = patronRequireOwnership.exec(contenido)) !== null) {
            const metodo = match[1].toUpperCase();
            const ruta = match[2];

            resultados.rutas_con_requireOwnership.push({
                archivo: nombreArchivo,
                modulo: modulo,
                metodo: metodo,
                ruta: ruta,
                ruta_completa: `/api/${modulo.split('/')[0]}${ruta}`
            });
        }

        // Buscar rutas solo con authenticateToken (sin requireRole ni requireOwnership)
        const patronRutaBasica = /router\.(get|post|put|delete|patch)\(['"]([^'"]+)['"]/g;
        const lineasContenido = contenido.split('\n');

        while ((match = patronRutaBasica.exec(contenido)) !== null) {
            const metodo = match[1].toUpperCase();
            const ruta = match[2];
            const posicion = match.index;

            // Obtener el contexto (las 3 líneas alrededor)
            const lineaActual = contenido.substring(0, posicion).split('\n').length;
            const contexto = lineasContenido.slice(Math.max(0, lineaActual - 2), lineaActual + 2).join('\n');

            // Verificar si tiene authenticateToken pero NO requireRole ni requireOwnership
            const tieneAuth = contexto.includes('authenticateToken');
            const tieneRole = contexto.includes('requireRole');
            const tieneOwnership = contexto.includes('requireOwnership');

            if (tieneAuth && !tieneRole && !tieneOwnership && !ruta.includes('health') && !ruta.includes('test')) {
                resultados.rutas_sin_proteccion.push({
                    archivo: nombreArchivo,
                    modulo: modulo,
                    metodo: metodo,
                    ruta: ruta,
                    ruta_completa: `/api/${modulo.split('/')[0]}${ruta}`,
                    proteccion: 'Solo authenticateToken (sin roles específicos)'
                });
            }
        }

    } catch (error) {
        console.error(`Error analizando ${rutaArchivo}:`, error.message);
    }
}

// Función recursiva para buscar archivos de rutas
function buscarArchivosRutas(directorio, archivos = []) {
    try {
        const elementos = fs.readdirSync(directorio);

        elementos.forEach(elemento => {
            const rutaCompleta = path.join(directorio, elemento);
            const stat = fs.statSync(rutaCompleta);

            if (stat.isDirectory() && !elemento.includes('node_modules') && !elemento.includes('.git')) {
                buscarArchivosRutas(rutaCompleta, archivos);
            } else if (stat.isFile() &&
                      (elemento.endsWith('Routes.js') || elemento.endsWith('routes.js')) &&
                      !elemento.includes('_original') &&
                      !elemento.includes('_clean') &&
                      !elemento.includes('_backup')) {
                archivos.push(rutaCompleta);
            }
        });

        return archivos;
    } catch (error) {
        console.error(`Error buscando en ${directorio}:`, error.message);
        return archivos;
    }
}

// Función para agrupar por módulo
function agruparPorModulo() {
    // Agrupar requireRole por módulo
    resultados.rutas_con_requireRole.forEach(ruta => {
        if (!resultados.resumen_por_modulo[ruta.modulo]) {
            resultados.resumen_por_modulo[ruta.modulo] = {
                total_rutas: 0,
                rutas_con_roles: [],
                rutas_sin_roles: [],
                roles_utilizados: new Set()
            };
        }
        resultados.resumen_por_modulo[ruta.modulo].total_rutas++;
        resultados.resumen_por_modulo[ruta.modulo].rutas_con_roles.push(ruta);
        ruta.roles.forEach(rol => resultados.resumen_por_modulo[ruta.modulo].roles_utilizados.add(rol));
    });

    // Agregar rutas sin roles
    resultados.rutas_sin_proteccion.forEach(ruta => {
        if (!resultados.resumen_por_modulo[ruta.modulo]) {
            resultados.resumen_por_modulo[ruta.modulo] = {
                total_rutas: 0,
                rutas_con_roles: [],
                rutas_sin_roles: [],
                roles_utilizados: new Set()
            };
        }
        resultados.resumen_por_modulo[ruta.modulo].total_rutas++;
        resultados.resumen_por_modulo[ruta.modulo].rutas_sin_roles.push(ruta);
    });
}

// Función para verificar si GERENTE falta en algún módulo
function verificarRolGerente() {
    const modulosSinGerente = [];

    Object.keys(resultados.resumen_por_modulo).forEach(modulo => {
        const info = resultados.resumen_por_modulo[modulo];
        const rolesArray = Array.from(info.roles_utilizados);

        if (rolesArray.length > 0 && !rolesArray.includes('GERENTE')) {
            modulosSinGerente.push({
                modulo: modulo,
                roles_actuales: rolesArray,
                total_rutas_afectadas: info.rutas_con_roles.length
            });
        }
    });

    return modulosSinGerente;
}

// EJECUCIÓN PRINCIPAL
console.log('🔍 INICIANDO AUDITORÍA DE PERMISOS...\n');

const directorioBackend = path.join(__dirname, 'src');
const archivosRutas = buscarArchivosRutas(directorioBackend);

console.log(`📂 Encontrados ${archivosRutas.length} archivos de rutas\n`);

archivosRutas.forEach(archivo => {
    console.log(`  Analizando: ${path.relative(directorioBackend, archivo)}`);
    analizarArchivoRutas(archivo);
});

agruparPorModulo();

console.log('\n' + '='.repeat(80));
console.log('📊 RESUMEN DE AUDITORÍA');
console.log('='.repeat(80) + '\n');

console.log(`✅ Total de rutas con requireRole: ${resultados.rutas_con_requireRole.length}`);
console.log(`🔒 Total de rutas con requireOwnership: ${resultados.rutas_con_requireOwnership.length}`);
console.log(`⚠️  Total de rutas sin roles específicos: ${resultados.rutas_sin_proteccion.length}`);
console.log(`👥 Total de roles únicos encontrados: ${resultados.roles_encontrados.size}\n`);

console.log('ROLES ENCONTRADOS EN EL SISTEMA:');
console.log('-'.repeat(80));
Array.from(resultados.roles_encontrados).sort().forEach(rol => {
    console.log(`  • ${rol}`);
});

console.log('\n' + '='.repeat(80));
console.log('📋 RESUMEN POR MÓDULO');
console.log('='.repeat(80) + '\n');

Object.keys(resultados.resumen_por_modulo).sort().forEach(modulo => {
    const info = resultados.resumen_por_modulo[modulo];
    const rolesArray = Array.from(info.roles_utilizados);

    console.log(`\n📦 MÓDULO: ${modulo}`);
    console.log(`   Total rutas: ${info.total_rutas}`);
    console.log(`   Con roles específicos: ${info.rutas_con_roles.length}`);
    console.log(`   Sin roles específicos: ${info.rutas_sin_roles.length}`);

    if (rolesArray.length > 0) {
        console.log(`   Roles utilizados: ${rolesArray.join(', ')}`);
    } else {
        console.log(`   ⚠️  No usa roles específicos (solo authenticateToken)`);
    }
});

console.log('\n' + '='.repeat(80));
console.log('⚠️  VERIFICACIÓN: ¿FALTA EL ROL GERENTE?');
console.log('='.repeat(80) + '\n');

const modulosSinGerente = verificarRolGerente();

if (modulosSinGerente.length > 0) {
    console.log('❌ Los siguientes módulos NO incluyen el rol GERENTE:\n');

    modulosSinGerente.forEach(info => {
        console.log(`  📦 ${info.modulo}`);
        console.log(`     Roles actuales: ${info.roles_actuales.join(', ')}`);
        console.log(`     Rutas afectadas: ${info.total_rutas_afectadas}`);
        console.log(`     ⚠️  Se recomienda agregar 'GERENTE' a los roles permitidos\n`);
    });
} else {
    console.log('✅ Todos los módulos que usan roles incluyen GERENTE o no usan roles específicos\n');
}

console.log('='.repeat(80));
console.log('📄 DETALLES COMPLETOS POR RUTA');
console.log('='.repeat(80) + '\n');

// Mostrar todas las rutas con requireRole
if (resultados.rutas_con_requireRole.length > 0) {
    console.log('🔐 RUTAS CON ROLES ESPECÍFICOS:\n');

    resultados.rutas_con_requireRole
        .sort((a, b) => a.ruta_completa.localeCompare(b.ruta_completa))
        .forEach((ruta, index) => {
            console.log(`${index + 1}. ${ruta.metodo} ${ruta.ruta_completa}`);
            console.log(`   Roles: ${ruta.roles.join(', ')}`);
            console.log(`   Archivo: ${ruta.archivo}\n`);
        });
}

// Mostrar rutas sin roles específicos
if (resultados.rutas_sin_proteccion.length > 0) {
    console.log('\n⚠️  RUTAS SIN ROLES ESPECÍFICOS (solo authenticateToken):\n');

    resultados.rutas_sin_proteccion
        .sort((a, b) => a.ruta_completa.localeCompare(b.ruta_completa))
        .forEach((ruta, index) => {
            console.log(`${index + 1}. ${ruta.metodo} ${ruta.ruta_completa}`);
            console.log(`   Protección: ${ruta.proteccion}`);
            console.log(`   Archivo: ${ruta.archivo}\n`);
        });
}

console.log('='.repeat(80));
console.log('✅ AUDITORÍA COMPLETADA');
console.log('='.repeat(80));

// Guardar resultados en JSON
const archivoSalida = path.join(__dirname, 'auditoria-permisos-resultado.json');
fs.writeFileSync(
    archivoSalida,
    JSON.stringify({
        ...resultados,
        roles_encontrados: Array.from(resultados.roles_encontrados),
        resumen_por_modulo: Object.fromEntries(
            Object.entries(resultados.resumen_por_modulo).map(([k, v]) => [
                k,
                { ...v, roles_utilizados: Array.from(v.roles_utilizados) }
            ])
        ),
        modulos_sin_gerente: modulosSinGerente
    }, null, 2)
);

console.log(`\n📄 Resultados guardados en: ${archivoSalida}`);
