require('dotenv').config();
const jwt = require('jsonwebtoken');

// El token que usas actualmente (reemplaza con el tuyo real)
const token = 'tu_token_aqui'; // ← PONDRÉ EL REAL DESPUÉS

try {
    console.log('=== CONTENIDO DEL JWT ===');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('DECODED JWT:', decoded);
    
    console.log('\n=== CAMPOS ESPECÍFICOS ===');
    console.log('decoded.id:', decoded.id);
    console.log('decoded.user_id:', decoded.user_id);
    console.log('decoded.nombre:', decoded.nombre);
    console.log('decoded.rol:', decoded.rol);
    
} catch (error) {
    console.error('ERROR DECODIFICANDO JWT:', error.message);
}
