// quick-jwt-test.js
const axios = require('axios');

const BASE_URL = 'http://localhost:3001';

async function testJWT() {
    console.log('🧪 TEST RÁPIDO: ¿Se está aplicando JWT?\n');
    
    try {
        console.log('📡 Test 1: Health check SIN token (debe fallar con 401)');
        
        const response = await axios.get(`${BASE_URL}/api/prospectos/health`);
        
        console.log('❌ PROBLEMA DETECTADO:');
        console.log(`   Status: ${response.status} (esperado: 401)`);
        console.log(`   Respuesta:`, JSON.stringify(response.data, null, 2));
        console.log('\n🔍 DIAGNÓSTICO: JWT NO se está aplicando correctamente');
        console.log('   El endpoint responde sin requerir token\n');
        
        return false;
        
    } catch (error) {
        if (error.response?.status === 401) {
            console.log('✅ PERFECTO: JWT funcionando correctamente');
            console.log(`   Status: 401 (correcto)`);
            console.log(`   Error:`, JSON.stringify(error.response.data, null, 2));
            console.log('\n🎯 El problema está en el controller - JWT sí funciona\n');
            return true;
        } else {
            console.log('❌ ERROR INESPERADO:');
            console.log(`   Status: ${error.response?.status || 'NO_RESPONSE'}`);
            console.log(`   Error:`, error.message);
            return false;
        }
    }
}

async function testWithValidToken() {
    const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoxLCJub21icmUiOiJKdWFuIiwiYXBlbGxpZG8iOiJQw6lyZXoiLCJyb2wiOiJhc2Vzb3IiLCJpYXQiOjE3NTMyNTA3MTIsImV4cCI6MTc1MzMzNzExMn0.UPRUk-Dz3Zdy4hIe6FKakvyi-awxtkMwZfhidt5Gu64';
    
    try {
        console.log('📡 Test 2: Health check CON token válido');
        
        const response = await axios.get(`${BASE_URL}/api/prospectos/health`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        console.log('✅ Token válido funciona:');
        console.log(`   Status: ${response.status}`);
        console.log(`   Usuario:`, response.data.user || 'No user info');
        console.log('\n');
        
        return true;
        
    } catch (error) {
        console.log('❌ Error con token válido:');
        console.log(`   Status: ${error.response?.status}`);
        console.log(`   Error:`, error.response?.data || error.message);
        return false;
    }
}

// Ejecutar tests
(async () => {
    const jwtWorks = await testJWT();
    
    if (jwtWorks) {
        await testWithValidToken();
        
        console.log('🎯 CONCLUSIÓN:');
        console.log('   ✅ JWT está funcionando correctamente');
        console.log('   ❌ El problema está en el controller usando fallbacks');
        console.log('   🔧 SOLUCIÓN: Actualizar controller para usar req.user real');
    } else {
        console.log('🎯 CONCLUSIÓN:');
        console.log('   ❌ JWT NO se está aplicando');
        console.log('   🔧 SOLUCIÓN: Verificar middleware auth.js');
    }
    
    console.log('\n📋 PRÓXIMOS PASOS:');
    console.log('   1. Ejecuta este test para confirmar diagnóstico');
    console.log('   2. Actualiza el controller según resultado');
    console.log('   3. Regenera tokens si han expirado');
})();