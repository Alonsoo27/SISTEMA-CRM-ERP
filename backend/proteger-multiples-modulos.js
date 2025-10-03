#!/usr/bin/env node
// Script genérico para proteger múltiples módulos

const fs = require('fs');
const path = require('path');

// Configuración de archivos a procesar
const archivos = [
    {
        path: 'src/modules/ventas/routes/postventaRoutes.js',
        writeMiddleware: 'requirePostVentaWrite',
        accessMiddleware: 'requirePostVentaAccess',
        excludeRoutes: ['/test'] // Rutas a excluir
    },
    {
        path: 'src/modules/ventas/routes/dashboardPersonalRoutes.js',
        writeMiddleware: 'requireVentasWrite',
        accessMiddleware: 'requireOwnership', // Los dashboards personales usan ownership
        excludeRoutes: []
    },
    {
        path: 'src/modules/ventas/routes/dashboardEjecutivoRoutes.js',
        writeMiddleware: null,
        accessMiddleware: 'requireRole(GRUPOS_ROLES.JEFES_Y_EJECUTIVOS)', // Solo ejecutivos
        excludeRoutes: []
    },
    {
        path: 'src/modules/ventas/routes/dashboardsRoutes.js',
        writeMiddleware: null,
        accessMiddleware: 'requireRole(GRUPOS_ROLES.JEFES_Y_EJECUTIVOS)',
        excludeRoutes: []
    },
    {
        path: 'src/modules/ventas/routes/comisionesRoutes.js',
        writeMiddleware: 'requireRole(GRUPOS_ROLES.VENTAS_COMPLETO)',
        accessMiddleware: 'requireOwnership', // Los bonos son por asesor
        excludeRoutes: []
    },
    {
        path: 'src/modules/ventas/routes/asesoresRoutes.js',
        writeMiddleware: null,
        accessMiddleware: 'requireRole(GRUPOS_ROLES.JEFES_Y_EJECUTIVOS)',
        excludeRoutes: []
    }
];

let totalModificaciones = 0;

archivos.forEach(config => {
    const rutaArchivo = path.join(__dirname, config.path);

    if (!fs.existsSync(rutaArchivo)) {
        console.log(`⚠️  Archivo no encontrado: ${config.path}`);
        return;
    }

    const contenido = fs.readFileSync(rutaArchivo, 'utf8');
    const lineas = contenido.split('\n');
    let modificaciones = 0;

    const lineasModificadas = lineas.map((linea, index) => {
        // Buscar rutas que tienen authenticateToken pero NO tienen middleware de roles después
        const match = linea.match(/^(router\.(get|post|put|delete)\([^,]+,\s+authenticateToken)(,\s+)(.*)/);

        if (match) {
            const inicio = match[1];
            const metodo = match[2].toUpperCase();
            const coma = match[3];
            const resto = match[4];

            // Ya tiene protección
            if (resto.includes('require') || resto.includes('Ownership')) {
                return linea;
            }

            // Verificar si la ruta está excluida
            const esExcluida = config.excludeRoutes.some(ruta => linea.includes(`'${ruta}'`));
            if (esExcluida) {
                return linea;
            }

            // Determinar middleware según el método
            let middleware;
            if (metodo === 'POST' || metodo === 'PUT' || metodo === 'DELETE') {
                middleware = config.writeMiddleware || config.accessMiddleware;
            } else {
                middleware = config.accessMiddleware;
            }

            if (!middleware) {
                return linea;
            }

            modificaciones++;
            return `${inicio}, ${middleware}${coma}${resto}`;
        }

        return linea;
    });

    if (modificaciones > 0) {
        const nuevoContenido = lineasModificadas.join('\n');

        // Crear backup
        fs.writeFileSync(rutaArchivo + '.backup', contenido);

        // Escribir archivo modificado
        fs.writeFileSync(rutaArchivo, nuevoContenido);

        console.log(`✅ ${path.basename(config.path)}: ${modificaciones} rutas protegidas`);
        totalModificaciones += modificaciones;
    } else {
        console.log(`  ${path.basename(config.path)}: Ya protegido`);
    }
});

console.log(`\n📊 Total: ${totalModificaciones} rutas protegidas en ${archivos.length} archivos`);
