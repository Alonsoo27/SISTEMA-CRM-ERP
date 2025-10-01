const { query } = require('../../../config/database');

class JerarquiaAlmacenService {

    // Obtener estructura jerárquica completa de almacenes
    async obtenerEstructuraJerarquica() {
        try {
            const sql = `
                WITH RECURSIVE jerarquia_almacenes AS (
                    -- Nodos raíz (almacenes principales)
                    SELECT
                        id,
                        nombre,
                        tipo,
                        codigo,
                        ubicacion,
                        almacen_padre_id,
                        responsable_id,
                        activo,
                        1 as nivel,
                        ARRAY[id] as ruta,
                        nombre as ruta_nombres
                    FROM almacenes
                    WHERE almacen_padre_id IS NULL AND activo = true

                    UNION ALL

                    -- Nodos hijos (recursivo)
                    SELECT
                        a.id,
                        a.nombre,
                        a.tipo,
                        a.codigo,
                        a.ubicacion,
                        a.almacen_padre_id,
                        a.responsable_id,
                        a.activo,
                        j.nivel + 1,
                        j.ruta || a.id,
                        j.ruta_nombres || ' > ' || a.nombre
                    FROM almacenes a
                    INNER JOIN jerarquia_almacenes j ON a.almacen_padre_id = j.id
                    WHERE a.activo = true
                )
                SELECT
                    j.*,
                    u.nombre as responsable_nombre,
                    u.apellido as responsable_apellido,
                    COUNT(i.id) as total_productos,
                    COALESCE(SUM(i.cantidad), 0) as total_stock,
                    COALESCE(SUM(i.cantidad * p.precio_venta), 0) as valor_inventario
                FROM jerarquia_almacenes j
                LEFT JOIN usuarios u ON j.responsable_id = u.id
                LEFT JOIN inventario i ON j.id = i.almacen_id
                LEFT JOIN productos p ON i.producto_id = p.id
                GROUP BY j.id, j.nombre, j.tipo, j.codigo, j.ubicacion, j.almacen_padre_id,
                         j.responsable_id, j.activo, j.nivel, j.ruta, j.ruta_nombres,
                         u.nombre, u.apellido
                ORDER BY j.ruta
            `;

            const result = await query(sql);
            return this.construirArbolJerarquia(result.rows);
        } catch (error) {
            console.error('Error obteniendo estructura jerárquica:', error);
            throw error;
        }
    }

    // Construir árbol jerárquico a partir de datos planos
    construirArbolJerarquia(data) {
        const almacenesMap = new Map();
        const raices = [];

        // Crear mapa de almacenes
        data.forEach(almacen => {
            almacenesMap.set(almacen.id, {
                ...almacen,
                hijos: [],
                responsable_completo: almacen.responsable_nombre
                    ? `${almacen.responsable_nombre} ${almacen.responsable_apellido || ''}`.trim()
                    : null
            });
        });

        // Construir relaciones padre-hijo
        data.forEach(almacen => {
            const nodo = almacenesMap.get(almacen.id);

            if (almacen.almacen_padre_id) {
                const padre = almacenesMap.get(almacen.almacen_padre_id);
                if (padre) {
                    padre.hijos.push(nodo);
                }
            } else {
                raices.push(nodo);
            }
        });

        return {
            estructura: raices,
            resumen: this.calcularResumenJerarquico(data)
        };
    }

    // Calcular resumen de la jerarquía
    calcularResumenJerarquico(data) {
        const tipoContadores = {};
        let totalProductos = 0;
        let totalValor = 0;
        let nivelMaximo = 0;

        data.forEach(almacen => {
            // Contadores por tipo
            tipoContadores[almacen.tipo] = (tipoContadores[almacen.tipo] || 0) + 1;

            // Totales
            totalProductos += parseInt(almacen.total_productos) || 0;
            totalValor += parseFloat(almacen.valor_inventario) || 0;

            // Nivel máximo
            nivelMaximo = Math.max(nivelMaximo, almacen.nivel);
        });

        return {
            total_almacenes: data.length,
            distribucion_tipos: tipoContadores,
            total_productos: totalProductos,
            valor_total_inventario: totalValor,
            niveles_jerarquia: nivelMaximo,
            almacenes_principales: data.filter(a => a.nivel === 1).length,
            almacenes_hoja: data.filter(a => !data.some(b => b.almacen_padre_id === a.id)).length
        };
    }

    // Obtener almacenes descendientes de un almacén específico
    async obtenerDescendientes(almacenId) {
        try {
            const sql = `
                WITH RECURSIVE descendientes AS (
                    SELECT id, nombre, tipo, almacen_padre_id, 1 as nivel
                    FROM almacenes
                    WHERE id = $1 AND activo = true

                    UNION ALL

                    SELECT a.id, a.nombre, a.tipo, a.almacen_padre_id, d.nivel + 1
                    FROM almacenes a
                    INNER JOIN descendientes d ON a.almacen_padre_id = d.id
                    WHERE a.activo = true
                )
                SELECT
                    d.*,
                    COUNT(i.id) as total_productos,
                    COALESCE(SUM(i.cantidad), 0) as total_stock
                FROM descendientes d
                LEFT JOIN inventario i ON d.id = i.almacen_id
                GROUP BY d.id, d.nombre, d.tipo, d.almacen_padre_id, d.nivel
                ORDER BY d.nivel, d.nombre
            `;

            const result = await query(sql, [almacenId]);
            return result.rows;
        } catch (error) {
            console.error('Error obteniendo descendientes:', error);
            throw error;
        }
    }

    // Obtener ruta de ancestros hasta la raíz
    async obtenerRutaAncestros(almacenId) {
        try {
            const sql = `
                WITH RECURSIVE ancestros AS (
                    SELECT id, nombre, tipo, almacen_padre_id, 0 as nivel
                    FROM almacenes
                    WHERE id = $1 AND activo = true

                    UNION ALL

                    SELECT a.id, a.nombre, a.tipo, a.almacen_padre_id, an.nivel + 1
                    FROM almacenes a
                    INNER JOIN ancestros an ON a.id = an.almacen_padre_id
                    WHERE a.activo = true
                )
                SELECT * FROM ancestros
                ORDER BY nivel DESC
            `;

            const result = await query(sql, [almacenId]);
            return result.rows;
        } catch (error) {
            console.error('Error obteniendo ruta de ancestros:', error);
            throw error;
        }
    }

    // Transferencia inteligente entre almacenes de la misma jerarquía
    async transferirEntreJerarquia(params) {
        const {
            producto_id,
            almacen_origen_id,
            almacen_destino_id,
            cantidad,
            usuario_id,
            motivo = 'TRANSFERENCIA_JERARQUICA'
        } = params;

        const connection = await query('BEGIN');

        try {
            // Verificar que ambos almacenes estén en la misma jerarquía
            const verificacionSql = `
                WITH RECURSIVE jerarquia_origen AS (
                    SELECT id, almacen_padre_id, 1 as nivel, ARRAY[id] as ruta
                    FROM almacenes WHERE id = $1

                    UNION ALL

                    SELECT a.id, a.almacen_padre_id, j.nivel + 1, j.ruta || a.id
                    FROM almacenes a
                    INNER JOIN jerarquia_origen j ON a.almacen_padre_id = j.id
                ),
                jerarquia_destino AS (
                    SELECT id, almacen_padre_id, 1 as nivel, ARRAY[id] as ruta
                    FROM almacenes WHERE id = $2

                    UNION ALL

                    SELECT a.id, a.almacen_padre_id, j.nivel + 1, j.ruta || a.id
                    FROM almacenes a
                    INNER JOIN jerarquia_destino j ON a.almacen_padre_id = j.id
                )
                SELECT
                    CASE WHEN EXISTS(
                        SELECT 1 FROM jerarquia_origen jo, jerarquia_destino jd
                        WHERE jo.ruta && jd.ruta
                    ) THEN true ELSE false END as misma_jerarquia
            `;

            const verificacion = await query(verificacionSql, [almacen_origen_id, almacen_destino_id]);

            if (!verificacion.rows[0].misma_jerarquia) {
                throw new Error('Los almacenes no pertenecen a la misma jerarquía');
            }

            // Verificar stock disponible
            const stockSql = `
                SELECT cantidad FROM inventario
                WHERE producto_id = $1 AND almacen_id = $2
            `;
            const stockResult = await query(stockSql, [producto_id, almacen_origen_id]);

            if (!stockResult.rows.length || stockResult.rows[0].cantidad < cantidad) {
                throw new Error('Stock insuficiente en almacén origen');
            }

            // Reducir stock en origen
            await query(`
                UPDATE inventario
                SET cantidad = cantidad - $1, updated_at = NOW(), updated_by = $2
                WHERE producto_id = $3 AND almacen_id = $4
            `, [cantidad, usuario_id, producto_id, almacen_origen_id]);

            // Aumentar stock en destino (o crear registro si no existe)
            await query(`
                INSERT INTO inventario (producto_id, almacen_id, cantidad, stock_minimo, created_by, updated_by)
                VALUES ($1, $2, $3, 0, $4, $4)
                ON CONFLICT (producto_id, almacen_id)
                DO UPDATE SET
                    cantidad = inventario.cantidad + $3,
                    updated_at = NOW(),
                    updated_by = $4
            `, [producto_id, almacen_destino_id, cantidad, usuario_id]);

            // Registrar movimiento
            await query(`
                INSERT INTO movimientos_inventario
                (producto_id, almacen_origen_id, almacen_destino_id, cantidad, tipo_movimiento, motivo, usuario_id)
                VALUES ($1, $2, $3, $4, 'TRANSFERENCIA', $5, $6)
            `, [producto_id, almacen_origen_id, almacen_destino_id, cantidad, motivo, usuario_id]);

            await query('COMMIT');

            return {
                success: true,
                mensaje: 'Transferencia completada exitosamente',
                movimiento_id: result.rows[0]?.id
            };

        } catch (error) {
            await query('ROLLBACK');
            console.error('Error en transferencia jerárquica:', error);
            throw error;
        }
    }

    // Consolidar inventario por jerarquía
    async consolidarInventarioPorJerarquia(almacenRaizId) {
        try {
            const sql = `
                WITH RECURSIVE jerarquia AS (
                    SELECT id, nombre, tipo, 1 as nivel
                    FROM almacenes
                    WHERE id = $1 AND activo = true

                    UNION ALL

                    SELECT a.id, a.nombre, a.tipo, j.nivel + 1
                    FROM almacenes a
                    INNER JOIN jerarquia j ON a.almacen_padre_id = j.id
                    WHERE a.activo = true
                )
                SELECT
                    p.id as producto_id,
                    p.nombre as producto_nombre,
                    p.codigo as producto_codigo,
                    SUM(i.cantidad) as cantidad_total,
                    COUNT(DISTINCT i.almacen_id) as almacenes_con_stock,
                    json_agg(
                        json_build_object(
                            'almacen_id', i.almacen_id,
                            'almacen_nombre', j.nombre,
                            'almacen_tipo', j.tipo,
                            'cantidad', i.cantidad,
                            'stock_minimo', i.stock_minimo,
                            'nivel', j.nivel
                        ) ORDER BY j.nivel, i.cantidad DESC
                    ) as distribucion_almacenes
                FROM productos p
                INNER JOIN inventario i ON p.id = i.producto_id
                INNER JOIN jerarquia j ON i.almacen_id = j.id
                WHERE p.activo = true
                GROUP BY p.id, p.nombre, p.codigo
                HAVING SUM(i.cantidad) > 0
                ORDER BY cantidad_total DESC, p.nombre
            `;

            const result = await query(sql, [almacenRaizId]);
            return result.rows;
        } catch (error) {
            console.error('Error consolidando inventario por jerarquía:', error);
            throw error;
        }
    }

    // Análisis de distribución por jerarquía
    async analizarDistribucionJerarquica() {
        try {
            const sql = `
                WITH RECURSIVE jerarquia_completa AS (
                    SELECT
                        id, nombre, tipo, almacen_padre_id,
                        1 as nivel,
                        id::text as ruta_id,
                        nombre as ruta_nombre
                    FROM almacenes
                    WHERE almacen_padre_id IS NULL AND activo = true

                    UNION ALL

                    SELECT
                        a.id, a.nombre, a.tipo, a.almacen_padre_id,
                        j.nivel + 1,
                        j.ruta_id || '>' || a.id::text,
                        j.ruta_nombre || ' > ' || a.nombre
                    FROM almacenes a
                    INNER JOIN jerarquia_completa j ON a.almacen_padre_id = j.id
                    WHERE a.activo = true
                ),
                analisis_por_nivel AS (
                    SELECT
                        j.nivel,
                        j.tipo,
                        COUNT(*) as cantidad_almacenes,
                        COUNT(DISTINCT i.producto_id) as productos_unicos,
                        COALESCE(SUM(i.cantidad), 0) as stock_total,
                        COALESCE(SUM(i.cantidad * p.precio_venta), 0) as valor_inventario
                    FROM jerarquia_completa j
                    LEFT JOIN inventario i ON j.id = i.almacen_id
                    LEFT JOIN productos p ON i.producto_id = p.id
                    GROUP BY j.nivel, j.tipo
                )
                SELECT
                    nivel,
                    tipo,
                    cantidad_almacenes,
                    productos_unicos,
                    stock_total,
                    valor_inventario,
                    ROUND(
                        (valor_inventario / NULLIF(SUM(valor_inventario) OVER(), 0) * 100)::numeric, 2
                    ) as porcentaje_valor_total
                FROM analisis_por_nivel
                ORDER BY nivel, tipo
            `;

            const result = await query(sql);
            return result.rows;
        } catch (error) {
            console.error('Error analizando distribución jerárquica:', error);
            throw error;
        }
    }
}

module.exports = new JerarquiaAlmacenService();