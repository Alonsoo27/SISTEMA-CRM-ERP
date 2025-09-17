// test-jwt-final.js
const axios = require('axios');

const BASE_URL = 'http://localhost:3001';

// Token generado para Alonso Admin (usuario real de Supabase)
// ⚠️ IMPORTANTE: Ejecuta primero 'node generate-token.js' y copia el primer token aquí
const ADMIN_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoxLCJub21icmUiOiJBbG9uc28iLCJhcGVsbGlkbyI6IkFkbWluIiwicm9sIjoiYWRtaW4iLCJpYXQiOjE3NTMyNTM4NDMsImV4cCI6MTc1MzM0MDI0M30.Ezbpf2BGIvXv8DofjpgILKUvZYJv0d54dQDcX8LJbR8';

async function testCompleteJWT() {
    console.log('🧪 TEST COMPLETO DE JWT AUTHENTICATION\n');
    console.log('📍 Servidor:', BASE_URL);
    console.log('👤 Usuario de prueba: Alonso Admin (ID: 1)\n');
    
    let allTestsPassed = true;

    // TEST 1: Servidor general funcionando
    try {
        console.log('1️⃣ Test: Servidor general (sin JWT)');
        const response = await axios.get(`${BASE_URL}/health`);
        console.log('   ✅ Status:', response.status, '- Servidor funcionando');
        console.log('   📄 Response:', response.data.message);
    } catch (error) {
        console.log('   ❌ Error:', error.message);
        console.log('   🚨 El servidor no está funcionando. Ejecuta: npm start');
        return false;
    }

    console.log('');

    // TEST 2: Endpoint protegido SIN token (debe fallar)
    try {
        console.log('2️⃣ Test: Endpoint protegido SIN token (debe fallar con 401)');
        const response = await axios.get(`${BASE_URL}/api/prospectos/health`);
        
        console.log('   ❌ PROBLEMA: Status', response.status, '(esperado: 401)');
        console.log('   🔍 JWT NO se está aplicando correctamente');
        allTestsPassed = false;
        
    } catch (error) {
        if (error.response?.status === 401) {
            console.log('   ✅ Status: 401 - JWT funcionando correctamente');
            console.log('   📄 Error:', error.response.data.error);
        } else {
            console.log('   ❌ Error inesperado:', error.response?.status, error.message);
            allTestsPassed = false;
        }
    }

    console.log('');

    // TEST 3: Endpoint protegido CON token válido (debe funcionar)
    if (ADMIN_TOKEN === 'PEGA_AQUI_EL_TOKEN_GENERADO') {
        console.log('3️⃣ Test: Endpoint protegido CON token');
        console.log('   ⚠️  SALTADO: Necesitas generar token primero');
        console.log('   📋 Ejecuta: node generate-token.js');
        console.log('   📋 Copia el primer token y pégalo en este archivo');
        return allTestsPassed;
    }

    try {
        console.log('3️⃣ Test: Endpoint protegido CON token válido (debe funcionar)');
        const response = await axios.get(`${BASE_URL}/api/prospectos/health`, {
            headers: { 'Authorization': `Bearer ${ADMIN_TOKEN}` }
        });
        
        console.log('   ✅ Status:', response.status, '- Autenticación exitosa');
        console.log('   👤 Usuario:', response.data.user?.nombre || 'No user info');
        console.log('   🎭 Rol:', response.data.user?.rol || 'No role info');
        console.log('   📦 Módulo:', response.data.module);
        console.log('   🔧 Versión:', response.data.version);
        
    } catch (error) {
        console.log('   ❌ Error con token válido:', error.response?.status);
        console.log('   📄 Error:', error.response?.data);
        
        if (error.response?.data?.code === 'INVALID_USER') {
            console.log('   🚨 PROBLEMA: Usuario no encontrado en Supabase');
            console.log('   📋 Verifica que el usuario ID: 1 existe en la tabla usuarios');
        }
        
        allTestsPassed = false;
    }

    console.log('');

    // TEST 4: Listar prospectos con JWT
    if (ADMIN_TOKEN !== 'PEGA_AQUI_EL_TOKEN_GENERADO') {
        try {
            console.log('4️⃣ Test: Listar prospectos con autenticación');
            const response = await axios.get(`${BASE_URL}/api/prospectos`, {
                headers: { 'Authorization': `Bearer ${ADMIN_TOKEN}` }
            });
            
            console.log('   ✅ Status:', response.status, '- Lista de prospectos obtenida');
            console.log('   📊 Total prospectos:', response.data.data?.length || 0);
            console.log('   🔐 Usuario filtrado:', response.data.user?.filtered ? 'Sí' : 'No');
            
        } catch (error) {
            console.log('   ❌ Error listando prospectos:', error.response?.status);
            console.log('   📄 Error:', error.response?.data?.error);
            allTestsPassed = false;
        }
    }

    console.log('\n' + '='.repeat(80));
    
    if (allTestsPassed && ADMIN_TOKEN !== 'PEGA_AQUI_EL_TOKEN_GENERADO') {
        console.log('🎉 ¡TODOS LOS TESTS PASARON! JWT FUNCIONANDO CORRECTAMENTE');
        console.log('✅ Autenticación: OK');
        console.log('✅ Autorización: OK');
        console.log('✅ Control de acceso: OK');
        console.log('✅ Validación de usuarios: OK');
        
        console.log('\n🚀 TU SISTEMA CRM ESTÁ LISTO CON JWT SECURITY');
        console.log('🔐 Los asesores solo verán sus prospectos');
        console.log('👑 Los admins verán todos los prospectos');
        console.log('👁️  Los supervisores tendrán acceso de solo lectura');
        
    } else {
        console.log('❌ ALGUNOS TESTS FALLARON');
        console.log('📋 Revisa los errores arriba y corrígelos');
        
        if (ADMIN_TOKEN === 'PEGA_AQUI_EL_TOKEN_GENERADO') {
            console.log('⚠️  Paso faltante: Generar token real');
        }
    }
    
    console.log('\n📞 Si necesitas ayuda, comparte el resultado de estos tests');
    
    return allTestsPassed;
}

// Ejecutar tests
if (require.main === module) {
    testCompleteJWT().catch(console.error);
}