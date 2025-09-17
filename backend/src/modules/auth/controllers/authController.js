// SISTEMA CRM/ERP EMPRESARIAL V2.0
// Controlador de Autenticación
// Login, Registro, Verificación de Tokens

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../../../config/database');

// Generar JWT Token
const generateToken = (userId, email, rol, area) => {
    return jwt.sign(
        { 
            userId, 
            email, 
            rol: rol.nombre,
            area: area.nombre,
            permisos: rol.permisos 
        },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );
};

// LOGIN - Autenticar usuario
const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Validar datos de entrada
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Email y contraseña son obligatorios'
            });
        }

        // Buscar usuario con datos completos
        const userQuery = 'SELECT u.id, u.email, u.password_hash, u.nombre, u.apellido, u.telefono, u.es_jefe, u.activo, u.ultimo_login, r.id as rol_id, r.nombre as rol_nombre, r.permisos, a.id as area_id, a.nombre as area_nombre, a.descripcion as area_descripcion FROM usuarios u JOIN roles r ON u.rol_id = r.id JOIN areas a ON u.area_id = a.id WHERE u.email = $1 AND u.activo = true';

        const userResult = await query(userQuery, [email.toLowerCase()]);

        if (userResult.rows.length === 0) {
            return res.status(401).json({
                success: false,
                message: 'Credenciales inválidas'
            });
        }

        const user = userResult.rows[0];

        // Verificar contraseña
        const isValidPassword = await bcrypt.compare(password, user.password_hash);
        if (!isValidPassword) {
            return res.status(401).json({
                success: false,
                message: 'Credenciales inválidas'
            });
        }

        // Actualizar último login
        await query(
            'UPDATE usuarios SET ultimo_login = NOW() WHERE id = $1',
            [user.id]
        );

        // Generar token
        const token = generateToken(
            user.id,
            user.email,
            { nombre: user.rol_nombre, permisos: user.permisos },
            { nombre: user.area_nombre }
        );

        // Respuesta exitosa
        res.json({
            success: true,
            message: 'Login exitoso',
            data: {
                token,
                user: {
                    id: user.id,
                    email: user.email,
                    nombre: user.nombre,
                    apellido: user.apellido,
                    telefono: user.telefono,
                    esJefe: user.es_jefe,
                    rol: {
                        id: user.rol_id,
                        nombre: user.rol_nombre,
                        permisos: user.permisos
                    },
                    area: {
                        id: user.area_id,
                        nombre: user.area_nombre,
                        descripcion: user.area_descripcion
                    },
                    ultimoLogin: user.ultimo_login
                }
            }
        });

    } catch (error) {
        console.error('Error en login:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        });
    }
};

module.exports = {
    login
};
