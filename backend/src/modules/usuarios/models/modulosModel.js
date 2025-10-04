// ============================================
// MODELO DE MÓDULOS Y PERMISOS
// ============================================
const { query } = require('../../../config/database');

class ModulosModel {
    /**
     * Obtener todos los módulos del sistema
     */
    static async obtenerModulos() {
        try {
            const sql = `
                SELECT id, codigo, nombre, icono, ruta, descripcion, orden, activo
                FROM modulos
                WHERE activo = true
                ORDER BY orden ASC
            `;
            const result = await query(sql);
            return {
                success: true,
                data: result.rows
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Obtener permisos de módulos de un usuario
     */
    static async obtenerPermisosUsuario(usuarioId) {
        try {
            const sql = `
                SELECT
                    m.id as modulo_id,
                    m.codigo,
                    m.nombre,
                    m.icono,
                    m.ruta,
                    COALESCE(um.puede_ver, false) as puede_ver,
                    COALESCE(um.puede_crear, false) as puede_crear,
                    COALESCE(um.puede_editar, false) as puede_editar,
                    COALESCE(um.puede_eliminar, false) as puede_eliminar
                FROM modulos m
                LEFT JOIN usuario_modulos um ON um.modulo_id = m.id AND um.usuario_id = $1
                WHERE m.activo = true
                ORDER BY m.orden ASC
            `;
            const result = await query(sql, [usuarioId]);
            return {
                success: true,
                data: result.rows
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Actualizar permisos de un usuario
     * @param {number} usuarioId
     * @param {Array} permisos - [{ modulo_id, puede_ver, puede_crear, puede_editar, puede_eliminar }]
     */
    static async actualizarPermisosUsuario(usuarioId, permisos) {
        try {
            // Eliminar permisos existentes
            await query('DELETE FROM usuario_modulos WHERE usuario_id = $1', [usuarioId]);

            // Insertar nuevos permisos
            if (permisos && permisos.length > 0) {
                const values = permisos.map((p, i) => {
                    const offset = i * 6;
                    return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6})`;
                }).join(', ');

                const params = permisos.flatMap(p => [
                    usuarioId,
                    p.modulo_id,
                    p.puede_ver !== false,
                    p.puede_crear === true,
                    p.puede_editar === true,
                    p.puede_eliminar === true
                ]);

                const sql = `
                    INSERT INTO usuario_modulos
                    (usuario_id, modulo_id, puede_ver, puede_crear, puede_editar, puede_eliminar)
                    VALUES ${values}
                `;

                await query(sql, params);
            }

            return {
                success: true,
                message: 'Permisos actualizados correctamente'
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Crear permisos por defecto para un nuevo usuario
     * Dashboard visible por defecto
     */
    static async crearPermisosDefecto(usuarioId) {
        try {
            const sql = `
                INSERT INTO usuario_modulos (usuario_id, modulo_id, puede_ver)
                SELECT $1, id, true
                FROM modulos
                WHERE codigo = 'dashboard'
            `;
            await query(sql, [usuarioId]);
            return {
                success: true,
                message: 'Permisos por defecto creados'
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }
}

module.exports = ModulosModel;
