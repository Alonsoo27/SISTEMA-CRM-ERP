// ========================================
// DIAGNÓSTICO DE NOTIFICACIONES
// ========================================
// INSTRUCCIONES:
// 1. Abre la consola del navegador (F12)
// 2. Copia y pega este código completo
// 3. Presiona Enter
// 4. Copia la salida completa y compártela
// ========================================

console.log('🔍 INICIANDO DIAGNÓSTICO DE NOTIFICACIONES...\n');

// 1. Verificar localStorage
console.log('📦 1. VERIFICANDO LOCALSTORAGE:');
console.log('===============================');

const token = localStorage.getItem('token');
const userStr = localStorage.getItem('user');

console.log('Token existe:', !!token);
console.log('User existe:', !!userStr);

if (token) {
    console.log('\n🎫 TOKEN:');
    console.log('Longitud:', token.length);
    console.log('Primeros 50 caracteres:', token.substring(0, 50) + '...');

    // Intentar decodificar JWT
    try {
        const parts = token.split('.');
        if (parts.length === 3) {
            const payload = JSON.parse(atob(parts[1]));
            console.log('\n✅ JWT DECODIFICADO:');
            console.log(JSON.stringify(payload, null, 2));
            console.log('\nuser_id en JWT:', payload.user_id || payload.id || payload.sub);
        } else {
            console.log('⚠️ Token NO es un JWT válido (probablemente fake token)');
            console.log('Token completo:', token);
        }
    } catch (error) {
        console.error('❌ Error decodificando JWT:', error);
    }
}

if (userStr) {
    console.log('\n👤 USER EN LOCALSTORAGE:');
    try {
        const user = JSON.parse(userStr);
        console.log(JSON.stringify(user, null, 2));
        console.log('\nuser.id:', user.id);
    } catch (error) {
        console.error('❌ Error parseando user:', error);
        console.log('Raw user string:', userStr);
    }
}

// 2. Verificar que IDs coincidan
console.log('\n\n🔐 2. VERIFICANDO CONSISTENCIA DE IDS:');
console.log('=======================================');

try {
    let jwtUserId = null;
    let localStorageUserId = null;

    // JWT
    if (token) {
        const parts = token.split('.');
        if (parts.length === 3) {
            const payload = JSON.parse(atob(parts[1]));
            jwtUserId = payload.user_id || payload.id || payload.sub;
        }
    }

    // localStorage
    if (userStr) {
        const user = JSON.parse(userStr);
        localStorageUserId = user.id;
    }

    console.log('ID desde JWT:', jwtUserId);
    console.log('ID desde localStorage:', localStorageUserId);

    if (jwtUserId && localStorageUserId) {
        if (jwtUserId === localStorageUserId) {
            console.log('✅ IDs COINCIDEN - Todo correcto');
        } else {
            console.log('❌ ¡ERROR! IDs NO COINCIDEN');
            console.log('   Esto causará problemas de autenticación');
            console.log('   Solución: Cerrar sesión y volver a iniciar sesión');
        }
    } else {
        console.log('⚠️ No se pudieron comparar IDs (alguno está ausente)');
    }
} catch (error) {
    console.error('❌ Error verificando IDs:', error);
}

// 3. Simular llamada a notificaciones
console.log('\n\n📞 3. SIMULANDO LLAMADA A NOTIFICACIONES:');
console.log('==========================================');

if (token) {
    let userId = null;

    try {
        const parts = token.split('.');
        if (parts.length === 3) {
            const payload = JSON.parse(atob(parts[1]));
            userId = payload.user_id || payload.id || payload.sub;
        } else if (userStr) {
            const user = JSON.parse(userStr);
            userId = user.id;
        }
    } catch (error) {
        console.error('Error obteniendo userId:', error);
    }

    if (userId) {
        console.log(`Usuario detectado: ${userId}`);
        console.log(`URL que se usará: /api/notificaciones/${userId}`);

        // Hacer la llamada real
        const apiBase = window.location.origin;
        const url = `${apiBase}/api/notificaciones/${userId}?limite=5&solo_no_leidas=false`;

        console.log(`\n🌐 Intentando llamada a: ${url}`);

        fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        })
        .then(response => {
            console.log('\n📡 RESPUESTA RECIBIDA:');
            console.log('Status:', response.status);
            console.log('Status Text:', response.statusText);

            return response.json().then(data => {
                console.log('\n📄 DATOS:');
                console.log(JSON.stringify(data, null, 2));

                if (response.status === 403) {
                    console.log('\n❌ ERROR 403 - ACCESO DENEGADO');
                    console.log('Causas posibles:');
                    console.log('1. El JWT tiene un user_id diferente al solicitado');
                    console.log('2. El usuario no tiene el rol adecuado');
                    console.log('3. Hay datos antiguos en localStorage');
                    console.log('\n💡 SOLUCIÓN RECOMENDADA:');
                    console.log('1. Cerrar sesión completamente');
                    console.log('2. Borrar localStorage: localStorage.clear()');
                    console.log('3. Volver a iniciar sesión');
                }
            });
        })
        .catch(error => {
            console.error('❌ Error en la llamada:', error);
        });
    } else {
        console.log('❌ No se pudo obtener userId');
    }
} else {
    console.log('❌ No hay token - usuario no autenticado');
}

console.log('\n\n📋 RESUMEN:');
console.log('===========');
console.log('Si ves errores arriba, sigue estos pasos:');
console.log('1. Ejecuta: localStorage.clear()');
console.log('2. Recarga la página (F5)');
console.log('3. Inicia sesión nuevamente');
console.log('4. Vuelve a ejecutar este diagnóstico');

console.log('\n✅ Diagnóstico completado');
