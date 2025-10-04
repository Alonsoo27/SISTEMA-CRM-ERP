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
        const userQuery = 'SELECT u.id, u.email, u.password_hash, u.nombre, u.apellido, u.telefono, u.es_jefe, u.vende, u.jefe_id, u.activo, u.ultimo_login, r.id as rol_id, r.nombre as rol_nombre, r.permisos, a.id as area_id, a.nombre as area_nombre, a.descripcion as area_descripcion FROM usuarios u JOIN roles r ON u.rol_id = r.id JOIN areas a ON u.area_id = a.id WHERE u.email = $1 AND u.activo = true';

        const userResult = await query(userQuery, [email.toLowerCase()]);

        if (userResult.rows.length === 0) {
            return res.status(401).json({
                success: false,
                message: 'Credenciales inválidas'
            });
        }

        const user = userResult.rows[0];

        // DEBUG: Ver qué campos retorna la BD
        console.log('🔍 Usuario de BD:', JSON.stringify({
            id: user.id,
            rol_id: user.rol_id,
            es_jefe: user.es_jefe,
            vende: user.vende,
            jefe_id: user.jefe_id
        }, null, 2));

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

        // Obtener permisos de módulos del usuario
        let modulos_permitidos = {};

        // SUPER_ADMIN (rol_id = 1) tiene acceso total a todo automáticamente
        if (user.rol_id === 1) {
            const todosModulosQuery = `SELECT codigo FROM modulos WHERE activo = true`;
            const todosModulosResult = await query(todosModulosQuery);

            modulos_permitidos = todosModulosResult.rows.reduce((acc, modulo) => {
                acc[modulo.codigo] = {
                    puede_ver: true,
                    puede_crear: true,
                    puede_editar: true,
                    puede_eliminar: true
                };
                return acc;
            }, {});
        } else {
            // Para otros roles, usar permisos de la tabla usuario_modulos
            const permisosQuery = `
                SELECT
                    m.codigo,
                    m.nombre,
                    COALESCE(um.puede_ver, false) as puede_ver,
                    COALESCE(um.puede_crear, false) as puede_crear,
                    COALESCE(um.puede_editar, false) as puede_editar,
                    COALESCE(um.puede_eliminar, false) as puede_eliminar
                FROM modulos m
                LEFT JOIN usuario_modulos um ON um.modulo_id = m.id AND um.usuario_id = $1
                WHERE m.activo = true
                ORDER BY m.orden
            `;
            const permisosResult = await query(permisosQuery, [user.id]);
            modulos_permitidos = permisosResult.rows.reduce((acc, modulo) => {
                acc[modulo.codigo] = {
                    puede_ver: modulo.puede_ver,
                    puede_crear: modulo.puede_crear,
                    puede_editar: modulo.puede_editar,
                    puede_eliminar: modulo.puede_eliminar
                };
                return acc;
            }, {});
        }

        // Generar token
        const token = generateToken(
            user.id,
            user.email,
            { nombre: user.rol_nombre, permisos: user.permisos },
            { nombre: user.area_nombre }
        );

        // Respuesta exitosa con estructura normalizada
        res.json({
            success: true,
            message: 'Login exitoso',
            data: {
                token,
                user: {
                    // Identificación
                    id: user.id,
                    email: user.email,

                    // Información personal
                    nombre: user.nombre,
                    apellido: user.apellido,
                    nombre_completo: `${user.nombre} ${user.apellido}`,
                    telefono: user.telefono,

                    // Permisos y capacidades
                    rol_id: user.rol_id,
                    es_jefe: user.es_jefe,
                    vende: user.vende,
                    jefe_id: user.jefe_id,

                    // Rol completo (para compatibilidad)
                    rol: {
                        id: user.rol_id,
                        nombre: user.rol_nombre,
                        permisos: user.permisos
                    },

                    // Área
                    area_id: user.area_id,
                    area: {
                        id: user.area_id,
                        nombre: user.area_nombre,
                        descripcion: user.area_descripcion
                    },

                    // Permisos de módulos
                    modulos_permitidos,

                    // Metadata
                    activo: user.activo,
                    ultimo_login: user.ultimo_login
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
