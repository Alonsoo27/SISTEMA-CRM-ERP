// models/ProspectoProductoInteres.js
const { query } = require('../config/database');

class ProspectoProductoInteres {
    static async obtenerPorProspecto(prospectoId) {
        const result = await query(`
            SELECT 
                ppi.*,
                p.descripcion as producto_descripcion_catalogo,
                p.codigo as producto_codigo_catalogo,
                c.nombre as categoria_nombre
            FROM prospecto_productos_interes ppi
            LEFT JOIN productos p ON ppi.producto_id = p.id
            LEFT JOIN categorias c ON ppi.categoria_id = c.id
            WHERE ppi.prospecto_id = $1
            ORDER BY ppi.created_at ASC
        `, [prospectoId]);
        
        return result.rows;
    }
    
    static async crear(datos) {
        const {
            prospecto_id, producto_id, codigo_producto, descripcion_producto,
            marca, categoria_id, unidad_medida, precio_sin_igv, cantidad_estimada,
            valor_linea, tipo, descripcion_personalizada, notas
        } = datos;
        
        const result = await query(`
            INSERT INTO prospecto_productos_interes (
                prospecto_id, producto_id, codigo_producto, descripcion_producto,
                marca, categoria_id, unidad_medida, precio_sin_igv, cantidad_estimada,
                valor_linea, tipo, descripcion_personalizada, notas
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
            RETURNING *
        `, [
            prospecto_id, 
            producto_id, 
            codigo_producto, 
            descripcion_producto,
            marca, 
            categoria_id, 
            unidad_medida || 'UND', 
            precio_sin_igv, 
            cantidad_estimada || 1,
            valor_linea, 
            tipo || 'catalogo', 
            descripcion_personalizada, 
            notas
        ]);
        
        return result.rows[0];
    }
    
    static async eliminarPorProspecto(prospectoId) {
        await query(
            'DELETE FROM prospecto_productos_interes WHERE prospecto_id = $1',
            [prospectoId]
        );
    }
}

module.exports = ProspectoProductoInteres;