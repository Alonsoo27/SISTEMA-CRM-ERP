require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

console.log('Variables de entorno:');
console.log('SUPABASE_URL:', process.env.SUPABASE_URL ? 'Configurada' : 'NO CONFIGURADA');
console.log('SUPABASE_ANON_KEY:', process.env.SUPABASE_ANON_KEY ? 'Configurada' : 'NO CONFIGURADA');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function diagnosticar() {
    try {
        console.log('\n=== DIAGNÓSTICO DE BASE DE DATOS ===');
        
        // Verificar usuarios
        console.log('\n1. Verificando tabla usuarios...');
        const { data: usuarios, error: errorUsuarios } = await supabase
            .from('usuarios')
            .select('id, nombre, apellido, email, rol_id, activo')
            .limit(5);
            
        console.log('USUARIOS:', usuarios);
        if (errorUsuarios) console.log('ERROR USUARIOS:', errorUsuarios);
        
        // Verificar roles
        console.log('\n2. Verificando tabla roles...');
        const { data: roles, error: errorRoles } = await supabase
            .from('roles')
            .select('*');
            
        console.log('ROLES:', roles);
        if (errorRoles) console.log('ERROR ROLES:', errorRoles);
        
        // Verificar relación usuarios-roles
        console.log('\n3. Verificando relación usuarios-roles...');
        const { data: usuariosConRoles, error: errorRelacion } = await supabase
            .from('usuarios')
            .select('id, nombre, email, rol_id, activo, roles(id, nombre)')
            .limit(3);
            
        console.log('USUARIOS CON ROLES:', usuariosConRoles);
        if (errorRelacion) console.log('ERROR RELACIÓN:', errorRelacion);
        
        // Verificar usuario específico con ID 1 (que es el que usa el token fake)
        console.log('\n4. Verificando usuario ID 1 específicamente...');
        const { data: usuario1, error: errorUsuario1 } = await supabase
            .from('usuarios')
            .select('id, nombre, apellido, email, rol_id, activo, roles(nombre)')
            .eq('id', 1)
            .eq('activo', true)
            .single();
            
        console.log('USUARIO ID 1:', usuario1);
        if (errorUsuario1) console.log('ERROR USUARIO 1:', errorUsuario1);
        
    } catch (error) {
        console.error('ERROR GENERAL:', error);
    }
}

diagnosticar();
