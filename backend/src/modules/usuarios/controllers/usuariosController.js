// ============================================
// CONTROLLER DE GESTIÓN DE USUARIOS
// Sistema CRM/ERP - Módulo de Administración
// ============================================

const { query } = require('../../../config/database');
const bcrypt = require('bcrypt');
const ModulosModel = require('../models/modulosModel');

// ============================================
// LISTAR TODOS LOS USUARIOS
// ============================================
const listarUsuarios = async (req, res) => {
    try {
        const result = await query(`
            SELECT
                u.id,
                u.email,
                u.nombre,
                u.apellido,
                u.nombre || ' ' || u.apellido as nombre_completo,
                u.telefono,
                u.es_jefe,
                u.vende,
                u.estado,
                u.ultimo_login,
                u.created_at,
                r.id as rol_id,
                r.nombre as rol_nombre,
                a.id as area_id,
                a.nombre as area_nombre,
                a.descripcion as departamento,
                jefe.nombre || ' ' || jefe.apellido as jefe_nombre
            FROM usuarios u
            LEFT JOIN roles r ON u.rol_id = r.id
            LEFT JOIN areas a ON u.area_id = a.id
            LEFT JOIN usuarios jefe ON u.jefe_id = jefe.id
            WHERE u.deleted_at IS NULL
            ORDER BY u.created_at DESC
        `);

        res.json({
            success: true,
            message: 'Usuarios obtenidos exitosamente',
            data: result.rows,
            total: result.rowCount
        });

    } catch (error) {
        console.error('Error al listar usuarios:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener usuarios',
            error: error.message
        });
    }
};

// ============================================
// OBTENER UN USUARIO POR ID
// ============================================
const obtenerUsuario = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await query(`
            SELECT
                u.*,
                u.nombre || ' ' || u.apellido as nombre_completo,
                r.nombre as rol_nombre,
                r.permisos as rol_permisos,
                a.nombre as area_nombre,
                a.descripcion as departamento,
                jefe.nombre || ' ' || jefe.apellido as jefe_nombre
            FROM usuarios u
            LEFT JOIN roles r ON u.rol_id = r.id
            LEFT JOIN areas a ON u.area_id = a.id
            LEFT JOIN usuarios jefe ON u.jefe_id = jefe.id
            WHERE u.id = $1 AND u.deleted_at IS NULL
        `, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Usuario no encontrado'
            });
        }

        // No enviar el password_hash al frontend
        const usuario = result.rows[0];
        delete usuario.password_hash;

        res.json({
            success: true,
            data: usuario
        });

    } catch (error) {
        console.error('Error al obtener usuario:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener usuario',
            error: error.message
        });
    }
};

// ============================================
// CREAR NUEVO USUARIO
// ============================================
const crearUsuario = async (req, res) => {
    try {
        const {
            email,
            password,
            nombre,
            apellido,
            rol_id,
            area_id,
            jefe_id,
            telefono,
            es_jefe,
            vende
        } = req.body;

        // Validaciones
        if (!email || !password || !nombre || !apellido || !rol_id) {
            return res.status(400).json({
                success: false,
                message: 'Faltan campos requeridos: email, password, nombre, apellido, rol_id'
            });
        }

        // Verificar que el email no exista
        const existeEmail = await query(
            'SELECT id FROM usuarios WHERE email = $1 AND deleted_at IS NULL',
            [email]
        );

        if (existeEmail.rows.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'El email ya está registrado'
            });
        }

        // Hash de la contraseña
        const rounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
        const password_hash = await bcrypt.hash(password, rounds);

        // Insertar usuario
        const result = await query(`
            INSERT INTO usuarios (
                email, password_hash, nombre, apellido,
                rol_id, area_id, jefe_id, telefono,
                es_jefe, vende, debe_cambiar_password
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true)
            RETURNING id, email, nombre, apellido, nombre || ' ' || apellido as nombre_completo,
                      rol_id, area_id, estado, created_at
        `, [
            email,
            password_hash,
            nombre,
            apellido,
            rol_id,
            area_id || null,
            jefe_id || null,
            telefono || null,
            es_jefe || false,
            vende || false
        ]);

        res.status(201).json({
            success: true,
            message: 'Usuario creado exitosamente',
            data: result.rows[0]
        });

    } catch (error) {
        console.error('Error al crear usuario:', error);
        res.status(500).json({
            success: false,
            message: 'Error al crear usuario',
            error: error.message
        });
    }
};

// ============================================
// ACTUALIZAR USUARIO
// ============================================
const actualizarUsuario = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            email,
            nombre,
            apellido,
            rol_id,
            area_id,
            jefe_id,
            telefono,
            es_jefe,
            vende,
            estado
        } = req.body;

        // Verificar que el usuario exista
        const usuarioExiste = await query(
            'SELECT id FROM usuarios WHERE id = $1 AND deleted_at IS NULL',
            [id]
        );

        if (usuarioExiste.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Usuario no encontrado'
            });
        }

        // Si se cambia el email, verificar que no exista
        if (email) {
            const existeEmail = await query(
                'SELECT id FROM usuarios WHERE email = $1 AND id != $2 AND deleted_at IS NULL',
                [email, id]
            );

            if (existeEmail.rows.length > 0) {
                return res.status(400).json({
                    success: false,
                    message: 'El email ya está registrado por otro usuario'
                });
            }
        }

        // Convertir strings vacías a null para campos numéricos
        const area_id_clean = area_id === '' || area_id === undefined ? null : area_id;
        const jefe_id_clean = jefe_id === '' || jefe_id === undefined ? null : jefe_id;
        const telefono_clean = telefono === '' ? null : telefono;
        const rol_id_clean = rol_id === '' || rol_id === undefined ? null : rol_id;

        // Actualizar usuario
        const result = await query(`
            UPDATE usuarios SET
                email = COALESCE($1, email),
                nombre = COALESCE($2, nombre),
                apellido = COALESCE($3, apellido),
                rol_id = COALESCE($4, rol_id),
                area_id = $5,
                jefe_id = $6,
                telefono = $7,
                es_jefe = COALESCE($8, es_jefe),
                vende = COALESCE($9, vende),
                estado = COALESCE($10, estado)
            WHERE id = $11 AND deleted_at IS NULL
            RETURNING id, email, nombre, apellido, nombre || ' ' || apellido as nombre_completo,
                      rol_id, area_id, estado, updated_at
        `, [
            email,
            nombre,
            apellido,
            rol_id_clean,
            area_id_clean,
            jefe_id_clean,
            telefono_clean,
            es_jefe,
            vende,
            estado,
            id
        ]);

        res.json({
            success: true,
            message: 'Usuario actualizado exitosamente',
            data: result.rows[0]
        });

    } catch (error) {
        console.error('Error al actualizar usuario:', error);
        res.status(500).json({
            success: false,
            message: 'Error al actualizar usuario',
            error: error.message
        });
    }
};

// ============================================
// CAMBIAR CONTRASEÑA
// ============================================
const cambiarPassword = async (req, res) => {
    try {
        const { id } = req.params;
        const { password_actual, password_nuevo } = req.body;

        if (!password_nuevo) {
            return res.status(400).json({
                success: false,
                message: 'La nueva contraseña es requerida'
            });
        }

        // Obtener usuario
        const usuario = await query(
            'SELECT password_hash FROM usuarios WHERE id = $1 AND deleted_at IS NULL',
            [id]
        );

        if (usuario.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Usuario no encontrado'
            });
        }

        // Si se proporciona password actual, verificar
        if (password_actual) {
            const passwordValido = await bcrypt.compare(
                password_actual,
                usuario.rows[0].password_hash
            );

            if (!passwordValido) {
                return res.status(401).json({
                    success: false,
                    message: 'Contraseña actual incorrecta'
                });
            }
        }

        // Hash de la nueva contraseña
        const rounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
        const password_hash = await bcrypt.hash(password_nuevo, rounds);

        // Actualizar contraseña
        await query(`
            UPDATE usuarios
            SET password_hash = $1,
                password_cambiado_en = CURRENT_TIMESTAMP,
                debe_cambiar_password = false
            WHERE id = $2
        `, [password_hash, id]);

        res.json({
            success: true,
            message: 'Contraseña actualizada exitosamente'
        });

    } catch (error) {
        console.error('Error al cambiar contraseña:', error);
        res.status(500).json({
            success: false,
            message: 'Error al cambiar contraseña',
            error: error.message
        });
    }
};

// ============================================
// ELIMINAR USUARIO (Soft Delete)
// ============================================
const eliminarUsuario = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await query(`
            UPDATE usuarios
            SET deleted_at = CURRENT_TIMESTAMP,
                estado = 'INACTIVO'
            WHERE id = $1 AND deleted_at IS NULL
            RETURNING id, email, nombre || ' ' || apellido as nombre_completo
        `, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Usuario no encontrado'
            });
        }

        res.json({
            success: true,
            message: 'Usuario eliminado exitosamente',
            data: result.rows[0]
        });

    } catch (error) {
        console.error('Error al eliminar usuario:', error);
        res.status(500).json({
            success: false,
            message: 'Error al eliminar usuario',
            error: error.message
        });
    }
};

// ============================================
// LISTAR ROLES
// ============================================
const listarRoles = async (req, res) => {
    try {
        const result = await query(`
            SELECT id, nombre, descripcion, permisos, activo
            FROM roles
            WHERE activo = true
            ORDER BY id
        `);

        res.json({
            success: true,
            data: result.rows
        });

    } catch (error) {
        console.error('Error al listar roles:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener roles',
            error: error.message
        });
    }
};

// ============================================
// LISTAR ÁREAS
// ============================================
const listarAreas = async (req, res) => {
    try {
        const result = await query(`
            SELECT id, nombre, descripcion, activo
            FROM areas
            WHERE activo = true
            ORDER BY nombre
        `);

        res.json({
            success: true,
            data: result.rows
        });

    } catch (error) {
        console.error('Error al listar áreas:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener áreas',
            error: error.message
        });
    }
};

// ============================================
// GESTIÓN DE MÓDULOS Y PERMISOS
// ============================================

/**
 * Listar todos los módulos del sistema
 */
const listarModulos = async (req, res) => {
    try {
        const resultado = await ModulosModel.obtenerModulos();

        if (!resultado.success) {
            return res.status(400).json({
                success: false,
                message: 'Error al obtener módulos',
                error: resultado.error
            });
        }

        res.json({
            success: true,
            data: resultado.data
        });
    } catch (error) {
        console.error('Error al listar módulos:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: error.message
        });
    }
};

/**
 * Obtener permisos de módulos de un usuario
 */
const obtenerPermisosUsuario = async (req, res) => {
    try {
        const { id } = req.params;
        const resultado = await ModulosModel.obtenerPermisosUsuario(parseInt(id));

        if (!resultado.success) {
            return res.status(400).json({
                success: false,
                message: 'Error al obtener permisos',
                error: resultado.error
            });
        }

        res.json({
            success: true,
            data: resultado.data
        });
    } catch (error) {
        console.error('Error al obtener permisos:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: error.message
        });
    }
};

/**
 * Actualizar permisos de un usuario
 */
const actualizarPermisosUsuario = async (req, res) => {
    try {
        const { id } = req.params;
        const { permisos } = req.body;

        if (!permisos || !Array.isArray(permisos)) {
            return res.status(400).json({
                success: false,
                message: 'Se requiere un array de permisos'
            });
        }

        const resultado = await ModulosModel.actualizarPermisosUsuario(parseInt(id), permisos);

        if (!resultado.success) {
            return res.status(400).json({
                success: false,
                message: 'Error al actualizar permisos',
                error: resultado.error
            });
        }

        res.json({
            success: true,
            message: 'Permisos actualizados correctamente'
        });
    } catch (error) {
        console.error('Error al actualizar permisos:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: error.message
        });
    }
};

// ============================================
// LISTAR VENDEDORES/ASESORES
// Para uso en filtros y reportes
// ============================================
const listarVendedores = async (req, res) => {
    try {
        // 🔒 CORREGIDO: Obtener TODOS los usuarios que pueden vender
        // Incluye: VENDEDOR, JEFE_VENTAS (si vende), SUPER_ADMIN (si vende)
        const result = await query(`
            SELECT
                u.id,
                u.nombre,
                u.apellido,
                u.nombre || ' ' || u.apellido as nombre_completo,
                u.email,
                r.nombre as rol,
                u.vende
            FROM usuarios u
            LEFT JOIN roles r ON u.rol_id = r.id
            WHERE u.deleted_at IS NULL
              AND u.activo = true
              AND (u.vende = true OR r.nombre IN ('VENDEDOR', 'JEFE_VENTAS', 'SUPER_ADMIN'))
            ORDER BY
              CASE
                WHEN r.nombre = 'SUPER_ADMIN' THEN 1
                WHEN r.nombre = 'JEFE_VENTAS' THEN 2
                WHEN r.nombre = 'VENDEDOR' THEN 3
                ELSE 4
              END,
              u.nombre, u.apellido
        `);

        res.json({
            success: true,
            message: 'Vendedores obtenidos exitosamente',
            data: result.rows,
            total: result.rowCount
        });

    } catch (error) {
        console.error('Error al listar vendedores:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener vendedores',
            error: error.message
        });
    }
};

module.exports = {
    listarUsuarios,
    obtenerUsuario,
    crearUsuario,
    actualizarUsuario,
    cambiarPassword,
    eliminarUsuario,
    listarRoles,
    listarAreas,
    listarModulos,
    obtenerPermisosUsuario,
    actualizarPermisosUsuario,
    listarVendedores
};
