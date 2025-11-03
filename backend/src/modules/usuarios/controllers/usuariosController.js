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
// MAPEO: ROL → ÁREA (Validación automática)
// ============================================
const ROL_AREA_MAP = {
    1: 6,   // SUPER_ADMIN → SISTEMAS
    2: 5,   // GERENTE → GERENCIA
    3: 1,   // JEFE_VENTAS → VENTAS
    4: 2,   // JEFE_MARKETING → MARKETING
    5: 3,   // JEFE_SOPORTE → SOPORTE
    6: 4,   // JEFE_ALMACEN → ALMACEN
    7: 1,   // VENDEDOR → VENTAS
    8: 2,   // MARKETING_EJECUTOR → MARKETING
    9: 3,   // SOPORTE_TECNICO → SOPORTE
    10: 4,  // ALMACENERO → ALMACEN
    11: 8   // ADMIN → ADMINISTRACIÓN
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

        // ✅ VALIDACIÓN: Verificar que el área corresponda al rol
        const areaEsperada = ROL_AREA_MAP[parseInt(rol_id)];
        const areaRecibida = area_id ? parseInt(area_id) : null;

        if (areaEsperada && areaRecibida && areaRecibida !== areaEsperada) {
            // Obtener nombres para mensaje más claro
            const areaEsperadaNombre = await query('SELECT nombre FROM areas WHERE id = $1', [areaEsperada]);
            const areaRecibidaNombre = await query('SELECT nombre FROM areas WHERE id = $1', [areaRecibida]);

            return res.status(400).json({
                success: false,
                message: `El rol seleccionado debe pertenecer al área "${areaEsperadaNombre.rows[0]?.nombre || areaEsperada}", pero se intentó asignar a "${areaRecibidaNombre.rows[0]?.nombre || areaRecibida}". Por favor, selecciona el rol correcto.`
            });
        }

        // Si no viene área o viene incorrecta, asignar automáticamente la correcta
        const areaFinal = areaEsperada || areaRecibida || null;
        console.log(`✅ Usuario creado con rol_id: ${rol_id}, area_id asignada: ${areaFinal}`);


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
            areaFinal || null,  // ✅ Usar área validada/asignada automáticamente
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
            estado,
            activo
        } = req.body;

        // Verificar que el usuario exista y obtener datos actuales
        const usuarioExisteResult = await query(
            'SELECT id, activo, rol_id, nombre, apellido FROM usuarios WHERE id = $1 AND deleted_at IS NULL',
            [id]
        );

        if (usuarioExisteResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Usuario no encontrado'
            });
        }

        const usuarioActual = usuarioExisteResult.rows[0];

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
        const jefe_id_clean = jefe_id === '' || jefe_id === undefined ? null : jefe_id;
        const telefono_clean = telefono === '' ? null : telefono;
        const rol_id_clean = rol_id === '' || rol_id === undefined ? null : rol_id;

        // ✅ VALIDACIÓN: Si se está cambiando el rol, validar que el área corresponda
        const rolFinal = rol_id_clean || usuarioActual.rol_id;
        const areaEsperada = ROL_AREA_MAP[parseInt(rolFinal)];
        const areaRecibida = area_id && area_id !== '' ? parseInt(area_id) : null;

        let area_id_clean;
        if (areaEsperada && areaRecibida && areaRecibida !== areaEsperada) {
            // Obtener nombres para mensaje más claro
            const areaEsperadaNombre = await query('SELECT nombre FROM areas WHERE id = $1', [areaEsperada]);
            const areaRecibidaNombre = await query('SELECT nombre FROM areas WHERE id = $1', [areaRecibida]);

            return res.status(400).json({
                success: false,
                message: `El rol seleccionado debe pertenecer al área "${areaEsperadaNombre.rows[0]?.nombre || areaEsperada}", pero se intentó asignar a "${areaRecibidaNombre.rows[0]?.nombre || areaRecibida}". Por favor, selecciona el rol correcto.`
            });
        }

        // Asignar área automáticamente según el rol (o mantener si no hay rol)
        area_id_clean = areaEsperada || areaRecibida || null;
        console.log(`✅ Usuario actualizado: rol_id: ${rolFinal}, area_id asignada: ${area_id_clean}`);

        // 🔄 DETECCIÓN AUTOMÁTICA: Si se está desactivando un VENDEDOR, traspasar prospectos
        // Detectar desactivación por cambio de 'activo' O por cambio de 'estado' a 'INACTIVO'
        const seEstaDesactivandoPorActivo = usuarioActual.activo === true && activo === false;
        const seEstaDesactivandoPorEstado = estado === 'INACTIVO' && usuarioActual.activo === true;
        const seEstaDesactivando = seEstaDesactivandoPorActivo || seEstaDesactivandoPorEstado;
        const esVendedor = usuarioActual.rol_id === 7; // VENDEDOR

        if (seEstaDesactivando && esVendedor) {
            console.log(`🔄 Desactivación de vendedor detectada: ${usuarioActual.nombre} ${usuarioActual.apellido} (ID: ${id})`);

            // Contar prospectos activos
            const prospectosResult = await query(`
                SELECT COUNT(*) as total
                FROM prospectos
                WHERE asesor_id = $1
                AND estado NOT IN ('Cerrado', 'Perdido', 'Convertido')
                AND activo = true
            `, [id]);

            const totalProspectos = parseInt(prospectosResult.rows[0]?.total || 0);

            // Si tiene prospectos activos, traspasarlos
            if (totalProspectos > 0) {
                console.log(`📋 Traspasando ${totalProspectos} prospectos automáticamente...`);

                // Obtener vendedores disponibles
                const vendedoresResult = await query(`
                    SELECT id, nombre, apellido
                    FROM usuarios
                    WHERE rol_id = 7
                    AND activo = true
                    AND id != $1
                    AND id != 19
                    ORDER BY RANDOM()
                `, [id]);

                if (vendedoresResult.rows.length > 0) {
                    // Obtener prospectos activos
                    const prospectosActivosResult = await query(`
                        SELECT id, codigo, nombre_cliente
                        FROM prospectos
                        WHERE asesor_id = $1
                        AND estado NOT IN ('Cerrado', 'Perdido', 'Convertido')
                        AND activo = true
                    `, [id]);

                    const prospectosActivos = prospectosActivosResult.rows;
                    const vendedoresDisponibles = vendedoresResult.rows;

                    // Distribuir prospectos entre vendedores
                    for (let i = 0; i < prospectosActivos.length; i++) {
                        const prospecto = prospectosActivos[i];
                        const vendedorIndex = i % vendedoresDisponibles.length;
                        const vendedor = vendedoresDisponibles[vendedorIndex];

                        // Traspasar prospecto
                        await query(`
                            UPDATE prospectos
                            SET asesor_id = $1,
                                asesor_nombre = $2,
                                numero_reasignaciones = numero_reasignaciones + 1,
                                fecha_traspaso = NOW(),
                                motivo_traspaso = $3
                            WHERE id = $4
                        `, [
                            vendedor.id,
                            `${vendedor.nombre} ${vendedor.apellido}`,
                            'Desactivación automática de usuario desde frontend',
                            prospecto.id
                        ]);

                        // Crear seguimiento
                        const fechaProgramada = new Date();
                        fechaProgramada.setDate(fechaProgramada.getDate() + 2);

                        await query(`
                            INSERT INTO seguimientos (
                                prospecto_id, asesor_id, fecha_programada, fecha_limite,
                                tipo, descripcion, completado, visible_para_asesor
                            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                        `, [
                            prospecto.id,
                            vendedor.id,
                            fechaProgramada.toISOString(),
                            fechaProgramada.toISOString(),
                            'Llamada',
                            `Prospecto reasignado por desactivación de ${usuarioActual.nombre} ${usuarioActual.apellido}`,
                            false,
                            true
                        ]);

                        console.log(`✅ ${prospecto.codigo} → ${vendedor.nombre} ${vendedor.apellido}`);
                    }
                } else {
                    // Activar modo libre si no hay vendedores
                    await query(`
                        UPDATE prospectos
                        SET modo_libre = true,
                            fecha_modo_libre = NOW(),
                            numero_reasignaciones = numero_reasignaciones + 1,
                            motivo_traspaso = $1
                        WHERE asesor_id = $2
                        AND estado NOT IN ('Cerrado', 'Perdido', 'Convertido')
                        AND activo = true
                    `, ['Desactivación de usuario - Sin vendedores disponibles', id]);
                }

                console.log(`✅ ${totalProspectos} prospectos traspasados exitosamente`);
            }
        }

        // Si se desactivó por estado, asegurar que activo también sea false
        let activoFinal = activo;
        if (seEstaDesactivandoPorEstado && activo === undefined) {
            activoFinal = false;
        }

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
                estado = COALESCE($10, estado),
                activo = COALESCE($11, activo)
            WHERE id = $12 AND deleted_at IS NULL
            RETURNING id, email, nombre, apellido, nombre || ' ' || apellido as nombre_completo,
                      rol_id, area_id, estado, activo, updated_at
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
            activoFinal,
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

// ============================================
// LISTAR EQUIPO DE MARKETING
// ============================================
const listarEquipoMarketing = async (req, res) => {
    try {
        // Obtener TODOS los usuarios del área de marketing
        // Incluye: MARKETING_EJECUTOR, JEFE_MARKETING
        // + Ejecutivos con acceso a todas las áreas (para que puedan ver)
        const result = await query(`
            SELECT
                u.id,
                u.nombre,
                u.apellido,
                u.nombre || ' ' || u.apellido as nombre_completo,
                u.email,
                r.nombre as rol,
                r.id as rol_id,
                a.nombre as area
            FROM usuarios u
            LEFT JOIN roles r ON u.rol_id = r.id
            LEFT JOIN areas a ON u.area_id = a.id
            WHERE u.deleted_at IS NULL
              AND u.activo = true
              AND (
                r.nombre IN ('MARKETING_EJECUTOR', 'JEFE_MARKETING')
                OR r.nombre IN ('SUPER_ADMIN', 'ADMIN', 'GERENTE')
              )
            ORDER BY
              CASE
                WHEN r.nombre = 'SUPER_ADMIN' THEN 1
                WHEN r.nombre = 'ADMIN' THEN 2
                WHEN r.nombre = 'GERENTE' THEN 3
                WHEN r.nombre = 'JEFE_MARKETING' THEN 4
                WHEN r.nombre = 'MARKETING_EJECUTOR' THEN 5
                ELSE 6
              END,
              u.nombre, u.apellido
        `);

        res.json({
            success: true,
            message: 'Equipo de marketing obtenido exitosamente',
            data: result.rows,
            total: result.rowCount
        });

    } catch (error) {
        console.error('Error al listar equipo de marketing:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener equipo de marketing',
            error: error.message
        });
    }
};

// ============================================
// DESACTIVAR USUARIO CON TRASPASO AUTOMÁTICO
// ============================================
const desactivarUsuario = async (req, res) => {
    try {
        const { id } = req.params;
        const { motivo = 'Desactivación de usuario' } = req.body;

        // 1. Verificar que el usuario existe y está activo
        const usuarioResult = await query(`
            SELECT u.*, r.nombre as rol_nombre
            FROM usuarios u
            LEFT JOIN roles r ON u.rol_id = r.id
            WHERE u.id = $1 AND u.deleted_at IS NULL
        `, [id]);

        if (usuarioResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Usuario no encontrado'
            });
        }

        const usuario = usuarioResult.rows[0];

        if (usuario.activo === false) {
            return res.status(400).json({
                success: false,
                message: 'El usuario ya está inactivo'
            });
        }

        // 2. Contar prospectos activos del usuario
        const prospectosResult = await query(`
            SELECT COUNT(*) as total
            FROM prospectos
            WHERE asesor_id = $1
            AND estado NOT IN ('Cerrado', 'Perdido', 'Convertido')
            AND activo = true
        `, [id]);

        const totalProspectos = parseInt(prospectosResult.rows[0]?.total || 0);

        // 3. Contar ventas activas del usuario
        const ventasResult = await query(`
            SELECT COUNT(*) as total
            FROM ventas
            WHERE asesor_id = $1
            AND activo = true
        `, [id]);

        const totalVentas = parseInt(ventasResult.rows[0]?.total || 0);

        // 4. Traspasar prospectos automáticamente
        let prospectosTraspasados = 0;
        if (totalProspectos > 0) {
            // Obtener vendedores activos disponibles (excluir el usuario a desactivar y usuario ficticio)
            const vendedoresResult = await query(`
                SELECT id, nombre, apellido
                FROM usuarios
                WHERE rol_id = 7
                AND activo = true
                AND id != $1
                AND id != 19
                ORDER BY RANDOM()
            `, [id]);

            if (vendedoresResult.rows.length > 0) {
                // Obtener los prospectos activos
                const prospectosActivosResult = await query(`
                    SELECT id, codigo, nombre_cliente
                    FROM prospectos
                    WHERE asesor_id = $1
                    AND estado NOT IN ('Cerrado', 'Perdido', 'Convertido')
                    AND activo = true
                `, [id]);

                const prospectosActivos = prospectosActivosResult.rows;
                const vendedoresDisponibles = vendedoresResult.rows;

                // Distribuir prospectos entre vendedores disponibles
                for (let i = 0; i < prospectosActivos.length; i++) {
                    const prospecto = prospectosActivos[i];
                    const vendedorIndex = i % vendedoresDisponibles.length;
                    const vendedor = vendedoresDisponibles[vendedorIndex];

                    // Traspasar prospecto
                    await query(`
                        UPDATE prospectos
                        SET asesor_id = $1,
                            asesor_nombre = $2,
                            numero_reasignaciones = numero_reasignaciones + 1,
                            fecha_traspaso = NOW(),
                            motivo_traspaso = $3
                        WHERE id = $4
                    `, [
                        vendedor.id,
                        `${vendedor.nombre} ${vendedor.apellido}`,
                        `${motivo} - Usuario desactivado`,
                        prospecto.id
                    ]);

                    // Crear seguimiento para el nuevo asesor
                    const fechaProgramada = new Date();
                    fechaProgramada.setDate(fechaProgramada.getDate() + 2);

                    await query(`
                        INSERT INTO seguimientos (
                            prospecto_id, asesor_id, fecha_programada, fecha_limite,
                            tipo, descripcion, completado, visible_para_asesor
                        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                    `, [
                        prospecto.id,
                        vendedor.id,
                        fechaProgramada.toISOString(),
                        fechaProgramada.toISOString(),
                        'Llamada',
                        `Prospecto reasignado por desactivación de usuario ${usuario.nombre} ${usuario.apellido}`,
                        false,
                        true
                    ]);

                    prospectosTraspasados++;
                }
            } else {
                // No hay vendedores disponibles - activar modo libre en todos los prospectos
                await query(`
                    UPDATE prospectos
                    SET modo_libre = true,
                        fecha_modo_libre = NOW(),
                        numero_reasignaciones = numero_reasignaciones + 1,
                        motivo_traspaso = $1
                    WHERE asesor_id = $2
                    AND estado NOT IN ('Cerrado', 'Perdido', 'Convertido')
                    AND activo = true
                `, [`${motivo} - Sin vendedores disponibles`, id]);

                prospectosTraspasados = totalProspectos;
            }
        }

        // 5. Marcar usuario como inactivo
        await query(`
            UPDATE usuarios
            SET activo = false,
                estado = 'INACTIVO',
                updated_at = NOW()
            WHERE id = $1
        `, [id]);

        // 6. Retornar resumen
        res.json({
            success: true,
            message: 'Usuario desactivado exitosamente',
            data: {
                usuario_id: id,
                nombre_completo: `${usuario.nombre} ${usuario.apellido}`,
                email: usuario.email,
                rol: usuario.rol_nombre,
                prospectos_activos: totalProspectos,
                prospectos_traspasados: prospectosTraspasados,
                ventas_activas: totalVentas,
                motivo: motivo
            }
        });

    } catch (error) {
        console.error('Error al desactivar usuario:', error);
        res.status(500).json({
            success: false,
            message: 'Error al desactivar usuario',
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
    listarVendedores,
    listarEquipoMarketing,
    desactivarUsuario
};
