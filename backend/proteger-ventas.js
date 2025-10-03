#!/usr/bin/env node
// Script para agregar protección de roles al módulo de ventas

const fs = require('fs');
const path = require('path');

const archivo = path.join(__dirname, 'src/modules/ventas/routes/ventasRoutes.js');
const contenido = fs.readFileSync(archivo, 'utf8');
const lineas = contenido.split('\n');

let modificaciones = 0;

const lineasModificadas = lineas.map((linea, index) => {
    // Ignorar la línea de /health que es pública
    if (linea.includes("router.get('/health',")) {
        return linea;
    }

    // Buscar rutas que tienen authenticateToken pero NO tienen middleware de roles después
    const match = linea.match(/^(router\.(get|post|put|delete)\([^,]+,\s+authenticateToken)(,\s+)(.*)/);

    if (match) {
        const inicio = match[1]; // router.get(..., authenticateToken
        const coma = match[3];   // ,
        const resto = match[4];   // resto de la línea

        // Ya tiene protección si incluye require
        if (resto.includes('require')) {
            return linea;
        }

        const metodo = match[2].toUpperCase();
        const rutaCompleta = linea;

        // Determinar qué middleware aplicar
        let middleware = 'requireVentasAccess';

        // Dashboards y reportes: solo jefes y ejecutivos
        if (rutaCompleta.includes('/dashboard') || rutaCompleta.includes('/reportes/')) {
            middleware = 'requireVentasReports';
        }
        // Operaciones de escritura (POST, PUT, DELETE)
        else if (metodo === 'POST' || metodo === 'PUT' || metodo === 'DELETE') {
            middleware = 'requireVentasWrite';
        }
        // Consultas GET
        else {
            middleware = 'requireVentasAccess';
        }

        modificaciones++;
        return `${inicio}, ${middleware}${coma}${resto}`;
    }

    return linea;
});

const nuevoContenido = lineasModificadas.join('\n');

// Crear backup
fs.writeFileSync(archivo + '.backup-ventas', contenido);
console.log('✅ Backup creado: ventasRoutes.js.backup-ventas');

// Escribir archivo modificado
fs.writeFileSync(archivo, nuevoContenido);
console.log(`✅ Modificadas ${modificaciones} rutas en ventasRoutes.js`);
console.log('📝 Middleware aplicado:');
console.log('   - requireVentasReports: dashboards y reportes (JEFES_Y_EJECUTIVOS)');
console.log('   - requireVentasWrite: POST, PUT, DELETE (VENTAS_COMPLETO)');
console.log('   - requireVentasAccess: GET consultas (VENTAS_COMPLETO)');
