const jwt = require('jsonwebtoken');
const JWT_SECRET = 'mi_super_clave_secreta_jwt_empresarial_2025_!!';

const ahora = Math.floor(Date.now() / 1000);
const payload = {
    user_id: 1,
    nombre: 'Alonso',
    apellido: 'Admin', 
    rol: 'admin',
    iat: ahora,
    exp: ahora + (7 * 24 * 60 * 60) // 7 días desde HOY
};

const token = jwt.sign(payload, JWT_SECRET);
console.log('=== TOKEN FRESCO GENERADO ===');
console.log(token);
console.log('=== EXPIRA EL ===');
console.log(new Date(payload.exp * 1000).toLocaleString());
console.log('=== PARA USAR EN POWERSHELL ===');
console.log('$token = "' + token + '"');
