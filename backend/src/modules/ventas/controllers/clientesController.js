// ============================================
// CLIENTES CONTROLLER - GESTIÓN PROFESIONAL
// Sistema CRM/ERP v2.0 - Integrado en módulo de ventas
// ============================================

const { query } = require('../../../config/database');

class ClientesController {
  constructor() {
    // PostgreSQL connection already configured in database.js
  }

  /**
   * Obtener todos los clientes con filtros básicos
   */
  async obtenerTodos(req, res) {
    try {
      const {
        busqueda = '',
        tipo_cliente = '',
        estado = 'activo',
        page = 1,
        limit = 50
      } = req.query;

      let whereConditions = ['activo = true'];
      let params = [];
      let paramCount = 0;

      // Filtro por búsqueda general
      if (busqueda) {
        paramCount++;
        whereConditions.push(`(
          nombres ILIKE $${paramCount} OR
          apellidos ILIKE $${paramCount} OR
          razon_social ILIKE $${paramCount} OR
          numero_documento ILIKE $${paramCount} OR
          email ILIKE $${paramCount}
        )`);
        params.push(`%${busqueda}%`);
      }

      // Filtro por tipo de cliente
      if (tipo_cliente) {
        paramCount++;
        whereConditions.push(`tipo_cliente = $${paramCount}`);
        params.push(tipo_cliente);
      }

      // Filtro por estado
      if (estado && estado !== 'todos') {
        paramCount++;
        whereConditions.push(`estado = $${paramCount}`);
        params.push(estado);
      }

      const offset = (parseInt(page) - 1) * parseInt(limit);
      paramCount++;
      params.push(parseInt(limit));
      paramCount++;
      params.push(offset);

      const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

      const queryText = `
        SELECT
          id,
          tipo_cliente,
          nombres,
          apellidos,
          razon_social,
          tipo_documento,
          numero_documento,
          telefono,
          email,
          direccion,
          distrito,
          provincia,
          departamento,
          contacto_nombres,
          contacto_apellidos,
          contacto_cargo,
          estado,
          created_at,
          updated_at
        FROM clientes
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT $${paramCount-1} OFFSET $${paramCount}
      `;

      const result = await query(queryText, params);

      // Procesar datos para el frontend
      const clientesProcesados = result.rows.map(cliente => ({
        ...cliente,
        nombre_completo: cliente.tipo_cliente === 'persona'
          ? `${cliente.nombres || ''} ${cliente.apellidos || ''}`.trim()
          : cliente.razon_social || '',
        documento_completo: `${cliente.tipo_documento}: ${cliente.numero_documento}`,
        es_persona: cliente.tipo_cliente === 'persona',
        es_empresa: cliente.tipo_cliente === 'empresa'
      }));

      res.json({
        success: true,
        data: clientesProcesados,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: result.rows.length
        }
      });

    } catch (error) {
      console.error('Error obteniendo clientes:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: error.message
      });
    }
  }

  /**
   * Crear nuevo cliente
   */
  async crear(req, res) {
    try {
      const {
        tipo_cliente,
        nombres,
        apellidos,
        razon_social,
        tipo_documento,
        numero_documento,
        telefono,
        email,
        direccion,
        distrito,
        provincia,
        departamento,
        contacto_nombres,
        contacto_apellidos,
        contacto_cargo,
        contacto_telefono,
        contacto_email,
        observaciones
      } = req.body;

      // Validaciones básicas
      if (!tipo_cliente || !tipo_documento || !numero_documento || !telefono) {
        return res.status(400).json({
          success: false,
          message: 'Campos requeridos: tipo_cliente, tipo_documento, numero_documento, telefono'
        });
      }

      if (tipo_cliente === 'persona' && (!nombres || !apellidos)) {
        return res.status(400).json({
          success: false,
          message: 'Para personas: nombres y apellidos son requeridos'
        });
      }

      if (tipo_cliente === 'empresa' && !razon_social) {
        return res.status(400).json({
          success: false,
          message: 'Para empresas: razón social es requerida'
        });
      }

      // Verificar si el documento ya existe
      const existeDocumento = await query(
        'SELECT id FROM clientes WHERE numero_documento = $1 AND activo = true',
        [numero_documento]
      );

      if (existeDocumento.rows.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Ya existe un cliente con este número de documento'
        });
      }

      const insertQuery = `
        INSERT INTO clientes (
          tipo_cliente, nombres, apellidos, razon_social,
          tipo_documento, numero_documento, telefono, email,
          direccion, distrito, provincia, departamento,
          contacto_nombres, contacto_apellidos, contacto_cargo,
          contacto_telefono, contacto_email, observaciones,
          estado, created_by, updated_by
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21
        )
        RETURNING *
      `;

      const insertParams = [
        tipo_cliente, nombres, apellidos, razon_social,
        tipo_documento, numero_documento, telefono, email,
        direccion, distrito, provincia, departamento,
        contacto_nombres, contacto_apellidos, contacto_cargo,
        contacto_telefono || telefono, contacto_email || email, observaciones,
        'activo', req.user?.id || 1, req.user?.id || 1
      ];

      const result = await query(insertQuery, insertParams);

      res.status(201).json({
        success: true,
        message: 'Cliente creado exitosamente',
        data: result.rows[0]
      });

    } catch (error) {
      console.error('Error creando cliente:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: error.message
      });
    }
  }

  /**
   * Obtener cliente por ID
   */
  async obtenerPorId(req, res) {
    try {
      const { id } = req.params;

      if (!id || isNaN(parseInt(id))) {
        return res.status(400).json({
          success: false,
          message: 'ID de cliente inválido'
        });
      }

      const result = await query(
        'SELECT * FROM clientes WHERE id = $1 AND activo = true',
        [parseInt(id)]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Cliente no encontrado'
        });
      }

      const cliente = result.rows[0];
      const clienteProcesado = {
        ...cliente,
        nombre_completo: cliente.tipo_cliente === 'persona'
          ? `${cliente.nombres || ''} ${cliente.apellidos || ''}`.trim()
          : cliente.razon_social || '',
        documento_completo: `${cliente.tipo_documento}: ${cliente.numero_documento}`,
        es_persona: cliente.tipo_cliente === 'persona',
        es_empresa: cliente.tipo_cliente === 'empresa'
      };

      res.json({
        success: true,
        data: clienteProcesado
      });

    } catch (error) {
      console.error('Error obteniendo cliente:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: error.message
      });
    }
  }

  /**
   * Actualizar cliente
   */
  async actualizar(req, res) {
    try {
      const { id } = req.params;

      if (!id || isNaN(parseInt(id))) {
        return res.status(400).json({
          success: false,
          message: 'ID de cliente inválido'
        });
      }

      // Verificar que el cliente existe
      const clienteExiste = await query(
        'SELECT id FROM clientes WHERE id = $1 AND activo = true',
        [parseInt(id)]
      );

      if (clienteExiste.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Cliente no encontrado'
        });
      }

      const {
        tipo_cliente,
        nombres,
        apellidos,
        razon_social,
        telefono,
        email,
        direccion,
        distrito,
        provincia,
        departamento,
        contacto_nombres,
        contacto_apellidos,
        contacto_cargo,
        estado,
        observaciones
      } = req.body;

      const updateQuery = `
        UPDATE clientes SET
          tipo_cliente = COALESCE($1, tipo_cliente),
          nombres = COALESCE($2, nombres),
          apellidos = COALESCE($3, apellidos),
          razon_social = COALESCE($4, razon_social),
          telefono = COALESCE($5, telefono),
          email = COALESCE($6, email),
          direccion = COALESCE($7, direccion),
          distrito = COALESCE($8, distrito),
          provincia = COALESCE($9, provincia),
          departamento = COALESCE($10, departamento),
          contacto_nombres = COALESCE($11, contacto_nombres),
          contacto_apellidos = COALESCE($12, contacto_apellidos),
          contacto_cargo = COALESCE($13, contacto_cargo),
          estado = COALESCE($14, estado),
          observaciones = COALESCE($15, observaciones),
          updated_at = CURRENT_TIMESTAMP,
          updated_by = $16
        WHERE id = $17
        RETURNING *
      `;

      const updateParams = [
        tipo_cliente, nombres, apellidos, razon_social,
        telefono, email, direccion, distrito, provincia, departamento,
        contacto_nombres, contacto_apellidos, contacto_cargo,
        estado, observaciones, req.user?.id || 1, parseInt(id)
      ];

      const result = await query(updateQuery, updateParams);

      res.json({
        success: true,
        message: 'Cliente actualizado exitosamente',
        data: result.rows[0]
      });

    } catch (error) {
      console.error('Error actualizando cliente:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: error.message
      });
    }
  }

  /**
   * Eliminar cliente (soft delete)
   */
  async eliminar(req, res) {
    try {
      const { id } = req.params;

      if (!id || isNaN(parseInt(id))) {
        return res.status(400).json({
          success: false,
          message: 'ID de cliente inválido'
        });
      }

      const result = await query(
        `UPDATE clientes SET
           activo = false,
           updated_at = CURRENT_TIMESTAMP,
           updated_by = $1
         WHERE id = $2 AND activo = true
         RETURNING id`,
        [req.user?.id || 1, parseInt(id)]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Cliente no encontrado'
        });
      }

      res.json({
        success: true,
        message: 'Cliente eliminado exitosamente'
      });

    } catch (error) {
      console.error('Error eliminando cliente:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: error.message
      });
    }
  }

  /**
   * Buscar cliente por documento
   */
  async buscarPorDocumento(req, res) {
    try {
      const { documento } = req.params;

      if (!documento || documento.length < 3) {
        return res.status(400).json({
          success: false,
          message: 'Documento debe tener al menos 3 caracteres'
        });
      }

      const result = await query(
        'SELECT * FROM clientes WHERE numero_documento = $1 AND activo = true',
        [documento.trim()]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Cliente no encontrado con ese documento'
        });
      }

      const cliente = result.rows[0];
      const clienteProcesado = {
        ...cliente,
        nombre_completo: cliente.tipo_cliente === 'persona'
          ? `${cliente.nombres || ''} ${cliente.apellidos || ''}`.trim()
          : cliente.razon_social || '',
        documento_completo: `${cliente.tipo_documento}: ${cliente.numero_documento}`,
        es_persona: cliente.tipo_cliente === 'persona',
        es_empresa: cliente.tipo_cliente === 'empresa'
      };

      res.json({
        success: true,
        data: clienteProcesado
      });

    } catch (error) {
      console.error('Error buscando cliente por documento:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: error.message
      });
    }
  }

  /**
   * Autocompletado para formularios
   */
  async autocomplete(req, res) {
    try {
      const { q: query_text = '', limit = 10 } = req.query;

      if (!query_text || query_text.length < 2) {
        return res.json({
          success: true,
          data: []
        });
      }

      const result = await query(`
        SELECT
          id,
          CASE
            WHEN tipo_cliente = 'persona' THEN CONCAT(nombres, ' ', apellidos)
            ELSE razon_social
          END as nombre_completo,
          numero_documento,
          tipo_documento,
          telefono,
          email
        FROM clientes
        WHERE activo = true
        AND (
          nombres ILIKE $1 OR
          apellidos ILIKE $1 OR
          razon_social ILIKE $1 OR
          numero_documento ILIKE $1
        )
        ORDER BY created_at DESC
        LIMIT $2
      `, [`%${query_text}%`, parseInt(limit)]);

      res.json({
        success: true,
        data: result.rows
      });

    } catch (error) {
      console.error('Error en autocompletado:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: error.message
      });
    }
  }

  /**
   * Obtener estadísticas básicas
   */
  async obtenerEstadisticas(req, res) {
    try {
      const { periodo = 'mes_actual' } = req.query;

      const result = await query(`
        SELECT
          COUNT(*) as total_clientes,
          COUNT(CASE WHEN tipo_cliente = 'persona' THEN 1 END) as personas,
          COUNT(CASE WHEN tipo_cliente = 'empresa' THEN 1 END) as empresas,
          COUNT(CASE WHEN estado = 'activo' THEN 1 END) as activos,
          COUNT(CASE WHEN created_at >= date_trunc('month', CURRENT_DATE) THEN 1 END) as nuevos_mes
        FROM clientes
        WHERE activo = true
      `);

      res.json({
        success: true,
        data: {
          resumen: result.rows[0],
          periodo: periodo,
          timestamp: new Date().toISOString()
        }
      });

    } catch (error) {
      console.error('Error obteniendo estadísticas:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: error.message
      });
    }
  }

  /**
   * Health check del servicio
   */
  async healthCheck(req, res) {
    try {
      const result = await query('SELECT COUNT(*) as total FROM clientes WHERE activo = true');

      res.json({
        success: true,
        service: 'ClientesController',
        status: 'OK',
        data: {
          total_clientes: result.rows[0].total,
          timestamp: new Date().toISOString()
        }
      });

    } catch (error) {
      console.error('Error en health check:', error);
      res.status(500).json({
        success: false,
        service: 'ClientesController',
        status: 'ERROR',
        error: error.message
      });
    }
  }

}

module.exports = new ClientesController();